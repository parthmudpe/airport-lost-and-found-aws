const { compareItems, findCandidateMatches } = require('../src/services/matchingService');

function lostFixture(overrides = {}) {
  return {
    category: 'Electronics', brand: 'Apple', model: 'iPhone 15 Pro', color: 'Black',
    serial_number: 'ABC123', description: 'Black phone with cracked case corner',
    unique_features: 'Blue wallet case attached',
    date_lost: '2026-09-18', airport_id: 'jfk-id', terminal: 'Terminal 4',
    ...overrides,
  };
}
function foundFixture(overrides = {}) {
  return {
    category: 'Electronics', brand: 'Apple', model: 'iPhone 15 Pro', color: 'Black',
    serial_number: 'ABC123', description: 'Black iPhone with a cracked case corner',
    unique_features: 'Blue wallet case attached',
    date_found: '2026-09-18', airport_id: 'jfk-id', terminal: 'Terminal 4',
    ...overrides,
  };
}

describe('matchingService.compareItems', () => {
  test('identical items score very high and are HIGH confidence', () => {
    const result = compareItems(lostFixture(), foundFixture());
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.confidence).toBe('HIGH');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test('different category still scores but loses the category weight', () => {
    const result = compareItems(lostFixture(), foundFixture({ category: 'Bags' }));
    expect(result.differences).toEqual(expect.arrayContaining(['Category differs']));
  });

  test('different airport loses location points and lowers the score', () => {
    const same = compareItems(lostFixture(), foundFixture());
    const different = compareItems(lostFixture(), foundFixture({ airport_id: 'lax-id', terminal: 'Terminal 1' }));
    expect(different.score).toBeLessThan(same.score);
    expect(different.differences).toEqual(expect.arrayContaining(['Different airport']));
  });

  test('found item dated before the lost date gets no date/time credit', () => {
    const result = compareItems(lostFixture({ date_lost: '2026-09-20' }), foundFixture({ date_found: '2026-09-10' }));
    expect(result.reasons.some((r) => r.includes('Dates are close'))).toBe(false);
  });

  test('completely unrelated items fall below the LOW threshold and are not suggested', () => {
    const lost = lostFixture({
      category: 'Wallets', brand: '', model: '', color: 'Brown', serial_number: '',
      description: 'Leather wallet', unique_features: '', airport_id: 'ord-id', terminal: 'Terminal 2',
    });
    const found = foundFixture({
      category: 'Electronics', brand: 'Sony', model: 'WH-1000XM5', color: 'Silver', serial_number: '',
      description: 'Headphones', unique_features: '', airport_id: 'lax-id', terminal: 'T3',
    });
    const result = compareItems(lost, found);
    expect(result.confidence).toBeNull();
  });

  test('matching engine never returns a confidence above HIGH or a score above 100', () => {
    const result = compareItems(lostFixture(), foundFixture());
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['HIGH', 'MEDIUM', 'LOW', null]).toContain(result.confidence);
  });

  test('serial number mismatch is recorded as a difference, not silently ignored', () => {
    const result = compareItems(lostFixture({ serial_number: 'AAA111' }), foundFixture({ serial_number: 'BBB222' }));
    expect(result.differences).toEqual(expect.arrayContaining(['Serial number does not match']));
  });
});

describe('matchingService.findCandidateMatches', () => {
  test('only returns candidates in the same category, sorted by score descending', () => {
    const lost = lostFixture();
    const candidates = [
      foundFixture({ color: 'Red' }),             // same category, partial match
      foundFixture(),                              // same category, near-perfect match
      foundFixture({ category: 'Bags', color: 'Black' }), // different category -> excluded
    ];
    const results = findCandidateMatches(lost, candidates);
    expect(results.length).toBe(2);
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });
});
