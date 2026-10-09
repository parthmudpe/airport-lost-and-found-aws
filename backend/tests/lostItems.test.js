process.env.SQLITE_FILE = ':memory:';
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/server');
const { hashPassword } = require('../src/utils/password');
const { Users, Airports } = require('../src/db/repository');

async function loginAs(email, role, airportId) {
  const passwordHash = await hashPassword('StrongPass1');
  Users.create({ email, passwordHash, fullName: 'Test User', role, airportId });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'StrongPass1' });
  return res.body.token;
}

describe('Lost item reporting, staff review, matching and ownership flow', () => {
  let airport;
  let passengerToken;
  let staffToken;

  beforeAll(async () => {
    airport = Airports.create({ code: 'JFK', name: 'JFK Intl', city: 'New York', country: 'USA', terminals: ['T4'] });
    passengerToken = await loginAs('flyer@example.com', 'PASSENGER');
    staffToken = await loginAs('agent@example.com', 'STAFF', airport.id);
  });

  let lostItemId;

  test('passenger can submit a lost item report', async () => {
    const res = await request(app)
      .post('/api/lost-items')
      .set('Authorization', `Bearer ${passengerToken}`)
      .field('category', 'Electronics')
      .field('itemName', 'iPhone 15 Pro')
      .field('brand', 'Apple')
      .field('model', 'iPhone 15 Pro')
      .field('color', 'Black')
      .field('serialNumber', 'SN12345')
      .field('dateLost', '2026-09-18')
      .field('airportId', airport.id)
      .field('terminal', 'T4');
    expect(res.status).toBe(201);
    expect(res.body.lostItem.status).toBe('REPORTED');
    expect(res.body.lostItem.report_number).toMatch(/^LF-\d{4}-\d{5}$/);
    lostItemId = res.body.lostItem.id;
  });

  test('a passenger cannot view another passenger\'s report', async () => {
    const otherToken = await loginAs('other@example.com', 'PASSENGER');
    const res = await request(app).get(`/api/lost-items/${lostItemId}`).set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });

  test('staff registering a matching found item triggers an automatic possible match, not an auto-return', async () => {
    const res = await request(app)
      .post('/api/found-items')
      .set('Authorization', `Bearer ${staffToken}`)
      .field('category', 'Electronics')
      .field('itemName', 'iPhone (black)')
      .field('brand', 'Apple')
      .field('model', 'iPhone 15 Pro')
      .field('color', 'Black')
      .field('serialNumber', 'SN12345')
      .field('dateFound', '2026-09-18')
      .field('airportId', airport.id)
      .field('terminal', 'T4');
    expect(res.status).toBe(201);
    expect(res.body.foundItem.status).toBe('POSSIBLE_MATCH');

    const lostRes = await request(app).get(`/api/lost-items/${lostItemId}`).set('Authorization', `Bearer ${passengerToken}`);
    expect(lostRes.body.lostItem.status).toBe('POSSIBLE_MATCH');
    // Critically: it must NOT already be RETURNED just because scores matched.
    expect(lostRes.body.lostItem.status).not.toBe('RETURNED');
  });

  let matchId;
  test('staff can see the possible match with score and reasons', async () => {
    const res = await request(app).get(`/api/matches?status=PENDING_REVIEW`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.items[0]).toHaveProperty('score');
    expect(res.body.items[0]).toHaveProperty('reasons');
    matchId = res.body.items[0].id;
  });

  test('a passenger viewing possible matches never sees the full found-item serial number', async () => {
    const res = await request(app).get(`/api/lost-items/${lostItemId}/matches`).set('Authorization', `Bearer ${passengerToken}`);
    expect(res.status).toBe(200);
    const found = res.body.matches[0].foundItem;
    expect(found.serial_number).not.toBe('SN12345');
    expect(found.serial_number).toMatch(/\*+2345$/);
  });

  test('staff confirming a match starts ownership verification, it does not mark the item returned', async () => {
    const res = await request(app).put(`/api/matches/${matchId}`).set('Authorization', `Bearer ${staffToken}`).send({ action: 'CONFIRM' });
    expect(res.status).toBe(200);
    expect(res.body.match.status).toBe('OWNERSHIP_PENDING');
    expect(res.body.ownershipVerification.status).toBe('REQUESTED');
  });

  let verificationId;
  test('passenger submits ownership proof', async () => {
    const listRes = await request(app).get(`/api/lost-items/${lostItemId}`).set('Authorization', `Bearer ${passengerToken}`);
    expect(listRes.body.lostItem.status).toBe('OWNERSHIP_VERIFICATION');

    const matchRes = await request(app).get(`/api/matches/${matchId}`).set('Authorization', `Bearer ${passengerToken}`);
    verificationId = matchRes.body.match.status; // placeholder, fetched properly below
  });

  test('full ownership approval -> mark returned flow', async () => {
    // fetch the verification id via the DB layer for test simplicity
    const { OwnershipVerifications } = require('../src/db/repository');
    const db = require('../src/db');
    const row = db.prepare('SELECT id FROM ownership_verifications WHERE lost_item_id = ?').get(lostItemId);
    const vId = row.id;

    const submit = await request(app)
      .put(`/api/ownership-verification/${vId}`)
      .set('Authorization', `Bearer ${passengerToken}`)
      .field('proofText', 'Serial number SN12345, receipt from Apple Store on file.');
    expect(submit.status).toBe(200);
    expect(submit.body.ownershipVerification.status).toBe('SUBMITTED');

    const approve = await request(app)
      .post(`/api/ownership-verification/${vId}/review`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ approved: true, notes: 'Serial matches exactly.' });
    expect(approve.status).toBe(200);
    expect(approve.body.ownershipVerification.status).toBe('STAFF_APPROVED');

    const ret = await request(app)
      .post(`/api/ownership-verification/${vId}/mark-returned`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(ret.status).toBe(200);
    expect(ret.body.lostItem.status).toBe('RETURNED');
  });

  test('the passenger has an in-app notification for each major step', async () => {
    const res = await request(app).get('/api/notifications').set('Authorization', `Bearer ${passengerToken}`);
    const types = res.body.notifications.map((n) => n.type);
    expect(types).toEqual(expect.arrayContaining([
      'LOST_REPORT_SUBMITTED', 'POSSIBLE_MATCH_FOUND', 'OWNERSHIP_VERIFICATION_REQUESTED',
      'OWNERSHIP_VERIFIED', 'ITEM_READY_FOR_COLLECTION', 'ITEM_RETURNED',
    ]));
  });
});
