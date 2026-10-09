/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('./index');
const { hashPassword } = require('../utils/password');
const {
  Airports, Users, LostItems, FoundItems, Matches, Notifications, OwnershipVerifications,
} = require('./repository');
const { compareItems } = require('../services/matchingService');

async function seed() {
  console.log('[seed] Resetting database...');
  db.exec(`
    DELETE FROM audit_logs; DELETE FROM notifications; DELETE FROM ownership_verifications;
    DELETE FROM matches; DELETE FROM found_items; DELETE FROM lost_items;
    DELETE FROM users; DELETE FROM airports;
  `);

  console.log('[seed] Creating airports...');
  const jfk = Airports.create({ code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'USA', terminals: ['Terminal 1', 'Terminal 4', 'Terminal 5', 'Terminal 8'] });
  const lax = Airports.create({ code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'USA', terminals: ['Terminal 1', 'Terminal 3', 'Tom Bradley Int'] });
  const ord = Airports.create({ code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'USA', terminals: ['Terminal 1', 'Terminal 2', 'Terminal 3', 'Terminal 5'] });

  console.log('[seed] Creating users...');
  const pw = await hashPassword('Passw0rd!');
  const admin = Users.create({ email: 'admin@airportlf.com', passwordHash: pw, fullName: 'Alicia Munoz', role: 'ADMIN' });
  const staffJfk = Users.create({ email: 'staff.jfk@airportlf.com', passwordHash: pw, fullName: 'Marcus Chen', role: 'STAFF', airportId: jfk.id });
  const staffLax = Users.create({ email: 'staff.lax@airportlf.com', passwordHash: pw, fullName: 'Priya Nair', role: 'STAFF', airportId: lax.id });

  const passengers = [
    Users.create({ email: 'passenger1@example.com', passwordHash: pw, fullName: 'Daniel Reyes', phone: '+1-555-0101', role: 'PASSENGER' }),
    Users.create({ email: 'passenger2@example.com', passwordHash: pw, fullName: 'Sofia Lindgren', phone: '+1-555-0102', role: 'PASSENGER' }),
    Users.create({ email: 'passenger3@example.com', passwordHash: pw, fullName: 'Wei Zhang', phone: '+1-555-0103', role: 'PASSENGER' }),
    Users.create({ email: 'passenger4@example.com', passwordHash: pw, fullName: 'Aisha Bello', phone: '+1-555-0104', role: 'PASSENGER' }),
  ];

  console.log('[seed] Creating lost item reports...');
  const lost1 = LostItems.create({
    userId: passengers[0].id, category: 'Electronics', itemName: 'iPhone 15 Pro', description: 'Black iPhone with a cracked corner on the case, blue MagSafe wallet attached',
    brand: 'Apple', model: 'iPhone 15 Pro', color: 'Black', serialNumber: 'F2LN3JXKQP1', uniqueFeatures: 'Blue MagSafe wallet attached, cracked phone case corner',
    dateLost: '2026-09-18', timeLost: '14:30', airportId: jfk.id, terminal: 'Terminal 4', locationArea: 'Gate B22 seating area', flightNumber: 'DL204',
    contactPhone: '+1-555-0101', contactEmail: passengers[0].email, images: [], additionalNotes: 'Lost while charging phone at gate seating area.',
  });
  const lost2 = LostItems.create({
    userId: passengers[1].id, category: 'Bags', itemName: 'Blue Rolling Carry-on', description: 'Navy blue hardshell carry-on suitcase with a luggage tag reading "S.L."',
    brand: 'Samsonite', model: 'Winfield 3', color: 'Navy Blue', serialNumber: '', uniqueFeatures: 'Luggage tag with initials S.L., small dent on front',
    dateLost: '2026-09-19', timeLost: '09:15', airportId: jfk.id, terminal: 'Terminal 4', locationArea: 'Security checkpoint C', flightNumber: 'AA1187',
    contactPhone: '+1-555-0102', contactEmail: passengers[1].email, images: [],
  });
  const lost3 = LostItems.create({
    userId: passengers[2].id, category: 'Electronics', itemName: 'Sony WH-1000XM5 Headphones', description: 'Silver over-ear noise cancelling headphones in a black zip case',
    brand: 'Sony', model: 'WH-1000XM5', color: 'Silver', serialNumber: '', uniqueFeatures: 'Small scratch on left ear cup',
    dateLost: '2026-09-20', timeLost: '18:00', airportId: lax.id, terminal: 'Tom Bradley Int', locationArea: 'Lounge seating near Gate 130', flightNumber: 'UA88',
    contactPhone: '+1-555-0103', contactEmail: passengers[2].email, images: [],
  });
  const lost4 = LostItems.create({
    userId: passengers[3].id, category: 'Wallets', itemName: 'Brown Leather Wallet', description: 'Brown leather bifold wallet with driver\'s license and two credit cards',
    brand: '', model: '', color: 'Brown', serialNumber: '', uniqueFeatures: 'Embossed initials "A.B." on the inside flap',
    dateLost: '2026-09-21', timeLost: '11:00', airportId: ord.id, terminal: 'Terminal 2', locationArea: 'Food court', flightNumber: '',
    contactPhone: '+1-555-0104', contactEmail: passengers[3].email, images: [],
  });

  console.log('[seed] Creating found item registrations...');
  const found1 = FoundItems.create({
    category: 'Electronics', itemName: 'iPhone (Black)', description: 'Black iPhone found with a blue wallet-style case attached, corner of case is cracked',
    brand: 'Apple', model: 'iPhone 15 Pro', color: 'Black', serialNumber: 'F2LN3JXKQP1', uniqueFeatures: 'Blue attached wallet case, cracked case corner',
    dateFound: '2026-09-18', timeFound: '15:10', airportId: jfk.id, terminal: 'Terminal 4', locationArea: 'Gate B22', foundByStaffId: staffJfk.id,
    storageLocation: 'JFK T4 Lost & Found Locker A-12', images: [],
  });
  const found2 = FoundItems.create({
    category: 'Electronics', itemName: 'Silver Headphones', description: 'Silver over-ear headphones in black case, minor scratch on one ear cup',
    brand: 'Sony', model: 'WH-1000XM5', color: 'Silver', serialNumber: '', uniqueFeatures: 'Scratch on left ear cup',
    dateFound: '2026-09-20', timeFound: '19:45', airportId: lax.id, terminal: 'Tom Bradley Int', locationArea: 'Gate 130 lounge', foundByStaffId: staffLax.id,
    storageLocation: 'LAX TBIT Lost & Found Shelf 3', images: [],
  });
  const found3 = FoundItems.create({
    category: 'Bags', itemName: 'Black Backpack', description: 'Black laptop backpack, no tags',
    brand: 'North Face', model: '', color: 'Black', serialNumber: '', uniqueFeatures: 'Small keychain on zipper',
    dateFound: '2026-09-19', timeFound: '10:00', airportId: jfk.id, terminal: 'Terminal 1', locationArea: 'Baggage claim', foundByStaffId: staffJfk.id,
    storageLocation: 'JFK T1 Lost & Found Bin 4', images: [],
  });

  console.log('[seed] Generating matches with the scoring engine...');
  function makeMatch(lost, found) {
    const result = compareItems(lost, found);
    if (!result.confidence) return null;
    return Matches.create({ lostItemId: lost.id, foundItemId: found.id, score: result.score, confidence: result.confidence, reasons: result.reasons, differences: result.differences });
  }
  const m1 = makeMatch(lost1, found1); // should be a strong/high match (serial matches)
  const m2 = makeMatch(lost3, found2); // strong match on brand/model/color/location

  if (m1) {
    LostItems.setStatus(lost1.id, 'POSSIBLE_MATCH');
    FoundItems.setStatus(found1.id, 'POSSIBLE_MATCH');
    Notifications.create({ userId: passengers[0].id, type: 'POSSIBLE_MATCH_FOUND', title: 'Possible match found for your lost item', message: `We found a possible match (${m1.confidence} confidence) for your report ${lost1.report_number}.`, relatedEntityType: 'MATCH', relatedEntityId: m1.id, channel: 'INAPP' });
  }
  if (m2) {
    LostItems.setStatus(lost3.id, 'POSSIBLE_MATCH');
    FoundItems.setStatus(found2.id, 'POSSIBLE_MATCH');
    Notifications.create({ userId: passengers[2].id, type: 'POSSIBLE_MATCH_FOUND', title: 'Possible match found for your lost item', message: `We found a possible match (${m2.confidence} confidence) for your report ${lost3.report_number}.`, relatedEntityType: 'MATCH', relatedEntityId: m2.id, channel: 'INAPP' });
  }

  // Push one match further through the workflow to demo ownership verification end-to-end.
  if (m1) {
    Matches.updateStatus(m1.id, 'OWNERSHIP_PENDING', staffJfk.id);
    LostItems.setStatus(lost1.id, 'OWNERSHIP_VERIFICATION');
    const verification = OwnershipVerifications.create({ matchId: m1.id, lostItemId: lost1.id, passengerId: passengers[0].id, verificationMethod: 'SERIAL_NUMBER' });
    OwnershipVerifications.submitProof(verification.id, { proofText: 'Serial number is F2LN3JXKQP1, visible in Settings > General > About on the device. Purchased at the Apple Store Fifth Avenue, receipt available.', proofDocuments: [] });
    Notifications.create({ userId: passengers[0].id, type: 'OWNERSHIP_VERIFICATION_REQUESTED', title: 'Ownership verification needed', message: `Please provide ownership details for report ${lost1.report_number}.`, relatedEntityType: 'OWNERSHIP_VERIFICATION', relatedEntityId: verification.id, channel: 'INAPP' });
  }

  console.log('[seed] Done.');
  console.log('\nDemo credentials (password for all: Passw0rd!):');
  console.log('  Admin:    admin@airportlf.com');
  console.log('  Staff JFK:staff.jfk@airportlf.com');
  console.log('  Staff LAX:staff.lax@airportlf.com');
  console.log('  Passenger:passenger1@example.com (has an active possible match -> ownership verification in progress)');
  console.log('  Passenger:passenger2@example.com');
  console.log('  Passenger:passenger3@example.com (has a possible match awaiting staff review)');
  console.log('  Passenger:passenger4@example.com');
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
