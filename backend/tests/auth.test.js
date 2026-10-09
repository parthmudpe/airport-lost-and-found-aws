process.env.SQLITE_FILE = ':memory:';
process.env.JWT_SECRET = 'test_secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/server');

describe('Auth: register & login', () => {
  test('a new passenger can register and receives a JWT', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'jane.doe@example.com', password: 'StrongPass1', fullName: 'Jane Doe',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('PASSENGER');
    expect(res.body.user.email).toBe('jane.doe@example.com');
  });


test('registration is rejected for a duplicate email', async () => {
  await request(app).post('/api/auth/register').send({
    email: 'dupe@example.com',
    password: 'StrongPass1',
    fullName: 'Alice',
  });

  const res = await request(app).post('/api/auth/register').send({
    email: 'dupe@example.com',
    password: 'StrongPass1',
    fullName: 'Alice Brown',
  });

  expect(res.status).toBe(409);
});


  test('registration is rejected for a short password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'short@example.com', password: '123', fullName: 'A' });
    expect(res.status).toBe(400);
  });

  test('login succeeds with correct credentials and fails with wrong password', async () => {
    await request(app).post('/api/auth/register').send({ email: 'login@example.com', password: 'StrongPass1', fullName: 'Login User' });
    const ok = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'StrongPass1' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'WrongPass' });
    expect(bad.status).toBe(401);
  });

  test('passwords are never stored in plaintext', async () => {
    const db = require('../src/db');
    await request(app).post('/api/auth/register').send({ email: 'hash@example.com', password: 'StrongPass1', fullName: 'Hash User' });
    const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('hash@example.com');
    expect(row.password_hash).not.toBe('StrongPass1');
    expect(row.password_hash.startsWith('$2')).toBe(true); // bcrypt hash prefix
  });
});

describe('Authorization: role-based access control', () => {
  async function registerAndLogin(email, role) {
    if (role === 'PASSENGER') {
      const res = await request(app).post('/api/auth/register').send({ email, password: 'StrongPass1', fullName: 'User' });
      return res.body.token;
    }
    // create admin directly via repository for test setup, then log in
    const { Users } = require('../src/db/repository');
    const { hashPassword } = require('../src/utils/password');
    const passwordHash = await hashPassword('StrongPass1');
    Users.create({ email, passwordHash, fullName: 'Staffer', role });
    const res = await request(app).post('/api/auth/login').send({ email, password: 'StrongPass1' });
    return res.body.token;
  }

  test('a passenger cannot access the staff dashboard', async () => {
    const token = await registerAndLogin('p1@example.com', 'PASSENGER');
    const res = await request(app).get('/api/dashboard/staff').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('a passenger cannot register a found item', async () => {
    const token = await registerAndLogin('p2@example.com', 'PASSENGER');
    const res = await request(app).post('/api/found-items').set('Authorization', `Bearer ${token}`).send({
      category: 'Electronics', itemName: 'Phone', dateFound: '2026-09-01', airportId: 'nonexistent',
    });
    expect(res.status).toBe(403);
  });

  test('an unauthenticated request to a protected endpoint is rejected', async () => {
    const res = await request(app).get('/api/lost-items');
    expect(res.status).toBe(401);
  });

  test('staff can access the staff dashboard', async () => {
    const token = await registerAndLogin('staffer1@example.com', 'STAFF');
    const res = await request(app).get('/api/dashboard/staff').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalLostReports');
  });
});
