import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Money } from '../js/domain/Money.js';
import { MealEntry, MealCutoffPolicy } from '../js/domain/MealEntry.js';
import { HishabCalculator } from '../js/domain/HishabCalculator.js';
import { GreedySettlementStrategy, roundPreservingSum, FUND_ID } from '../js/domain/SettlementStrategy.js';
import { RetentionPolicy } from '../js/domain/RetentionPolicy.js';
import { DhakaDate } from '../js/core/DhakaDate.js';

test('Money.parse accepts the many ways people type taka (Postel)', () => {
  assert.equal(Money.parse('৳1,250'), 1250);
  assert.equal(Money.parse('1250'), 1250);
  assert.equal(Money.parse('১২৫০'), 1250);
  assert.equal(Money.parse('১,২৫০ টাকা'), 1250);
  assert.equal(Money.parse(' 99.5 tk '), 99.5);
  assert.ok(Number.isNaN(Money.parse('abc')));
  assert.ok(Number.isNaN(Money.parse('')));
});

test('Money.format uses locale digits and a real minus sign', () => {
  assert.equal(Money.format(1250, 'en'), '৳1,250');
  assert.equal(Money.format(1250, 'bn'), '৳১,২৫০');
  assert.equal(Money.format(-420, 'en'), '−৳420');
});

test('MealEntry counts with weights and stays immutable', () => {
  const e = new MealEntry({ memberUid: 'a', date: '2026-10-01', breakfast: true, lunch: true, guests: 1 });
  assert.equal(e.count(), 3);
  assert.equal(e.count({ breakfast: 0.5 }), 2.5);
  const t = e.toggled('dinner');
  assert.equal(e.dinner, false);
  assert.equal(t.dinner, true);
  assert.throws(() => e.toggled('snack'));
});

const members = [
  { uid: 'a', displayName: 'A', active: true },
  { uid: 'b', displayName: 'B', active: true }
];

test('calculator: zero meals gives zero meal rate, fixed costs still split', () => {
  const c = new HishabCalculator({ members, fixedCosts: [{ amount: 1000 }] });
  assert.equal(c.mealRate, 0);
  assert.equal(c.summaryFor('a').fixedShare, 500);
  assert.equal(c.summaryFor('a').balance, -500);
});

test('calculator: meal rate, balances and the fund add up', () => {
  const meals = [
    { memberUid: 'a', date: '2026-10-01', lunch: true, dinner: true },
    { memberUid: 'b', date: '2026-10-01', lunch: true, dinner: true },
    { memberUid: 'b', date: '2026-10-02', lunch: true, dinner: true }
  ];
  const c = new HishabCalculator({
    members,
    meals,
    bazar: [{ amount: 600, source: 'fund' }],
    deposits: [
      { memberUid: 'a', amount: 500, status: 'confirmed' },
      { memberUid: 'b', amount: 300, status: 'confirmed' },
      { memberUid: 'b', amount: 900, status: 'pending' }
    ]
  });
  assert.equal(c.totalMeals(), 6);
  assert.equal(c.mealRate, 100);
  const a = c.summaryFor('a');
  const b = c.summaryFor('b');
  assert.equal(a.balance, 300);
  assert.equal(b.balance, -100);
  assert.equal(b.pending, 900);
  assert.equal(a.status, 'gets');
  assert.equal(b.status, 'owes');
  // Fund holds 800 − 600 = 200. Members' balances sum to the cash in the fund.
  assert.equal(c.fundCash(), 200);
  assert.equal(a.balance + b.balance, c.fundCash());
});

test('calculator: bazar paid from own pocket counts as a contribution', () => {
  const c = new HishabCalculator({
    members,
    meals: [
      { memberUid: 'a', date: '2026-10-01', lunch: true },
      { memberUid: 'b', date: '2026-10-01', lunch: true }
    ],
    bazar: [{ amount: 400, source: 'pocket', shopperUid: 'a' }]
  });
  assert.equal(c.summaryFor('a').balance, 200);
  assert.equal(c.summaryFor('b').balance, -200);
  assert.deepEqual(c.settle(), [{ from: 'b', to: 'a', amount: 200 }]);
});

test('calculator: single member and inactive members', () => {
  const solo = new HishabCalculator({ members: [members[0]], fixedCosts: [{ amount: 900 }] });
  assert.equal(solo.summaryFor('a').fixedShare, 900);
  const withInactive = new HishabCalculator({
    members: [...members, { uid: 'c', displayName: 'C', active: false }],
    fixedCosts: [{ amount: 900 }]
  });
  assert.equal(withInactive.summaryFor('a').fixedShare, 450);
  assert.equal(withInactive.summaryFor('c').fixedShare, 0);
});

test('roundPreservingSum keeps totals exact to the taka', () => {
  const r = roundPreservingSum([33.33, 33.33, -66.66]);
  assert.equal(r.reduce((s, v) => s + v, 0), 0);
  const r2 = roundPreservingSum([10.5, 10.5, -21]);
  assert.equal(r2.reduce((s, v) => s + v, 0), 0);
});

test('greedy settlement uses at most n−1 transfers and balances everyone', () => {
  const entries = [
    { id: 'a', balance: 420 },
    { id: 'b', balance: -300 },
    { id: 'c', balance: -200 },
    { id: FUND_ID, balance: 80 }
  ];
  const transfers = new GreedySettlementStrategy().settle(entries);
  assert.ok(transfers.length <= entries.length - 1);
  const net = Object.fromEntries(entries.map((e) => [e.id, 0]));
  for (const t of transfers) {
    net[t.from] -= t.amount;
    net[t.to] += t.amount;
  }
  for (const e of entries) assert.equal(net[e.id], e.balance);
});

test('settlement with uneven decimals never loses a taka', () => {
  const c = new HishabCalculator({
    members: [...members, { uid: 'c', displayName: 'C', active: true }],
    meals: [
      { memberUid: 'a', date: '2026-10-01', lunch: true },
      { memberUid: 'b', date: '2026-10-01', lunch: true },
      { memberUid: 'c', date: '2026-10-01', lunch: true }
    ],
    bazar: [{ amount: 100, source: 'pocket', shopperUid: 'a' }]
  });
  const transfers = c.settle();
  const toA = transfers.filter((t) => t.to === 'a').reduce((s, t) => s + t.amount, 0);
  assert.equal(toA, 67);
});

test('RetentionPolicy enforces the 30-day minimum', () => {
  assert.throws(() => new RetentionPolicy(29));
  assert.throws(() => new RetentionPolicy(30.5));
  assert.equal(RetentionPolicy.from(7).days, 30);
  const base = new Date('2026-10-01T04:00:00Z');
  const p = new RetentionPolicy(30);
  const exp = p.expireAt(base);
  assert.equal(exp.getTime() - base.getTime(), 30 * 86_400_000);
  assert.equal(RetentionPolicy.isExpired(exp, new Date('2026-10-30T00:00:00Z')), false);
  assert.equal(RetentionPolicy.isExpired(exp, new Date('2026-11-01T00:00:00Z')), true);
  assert.equal(RetentionPolicy.isExpiringSoon(exp, new Date('2026-10-29T04:00:00Z')), true);
});

test('cutoff policy locks past days and passed cutoffs, never future days', () => {
  const policy = new MealCutoffPolicy({ lunch: '13:00' });
  // 2026-10-15 12:00 in Dhaka = 06:00 UTC
  const noon = new Date('2026-10-15T06:00:00Z');
  assert.equal(policy.isLocked('lunch', '2026-10-15', noon), false);
  assert.equal(policy.isLocked('breakfast', '2026-10-15', noon), true);
  assert.equal(policy.isLocked('lunch', '2026-10-14', noon), true);
  assert.equal(policy.isLocked('dinner', '2026-10-16', noon), false);
});

test('DhakaDate handles month boundaries', () => {
  assert.equal(DhakaDate.nextMonthKey('2026-12'), '2027-01');
  assert.equal(DhakaDate.prevMonthKey('2026-01'), '2025-12');
  assert.equal(DhakaDate.daysInMonth('2028-02'), 29);
  assert.equal(DhakaDate.addDays('2026-10-31', 1), '2026-11-01');
  // 2026-10-15 20:00 UTC is already 16 Oct in Dhaka
  assert.equal(DhakaDate.dateKey(new Date('2026-10-15T20:00:00Z')), '2026-10-16');
});

test('settlement folds the fund into the manager who holds the cash', () => {
  const c = new HishabCalculator({
    members,
    meals: [
      { memberUid: 'a', date: '2026-10-01', lunch: true },
      { memberUid: 'b', date: '2026-10-01', lunch: true }
    ],
    bazar: [{ amount: 200, source: 'fund' }],
    deposits: [
      { memberUid: 'a', amount: 500, status: 'confirmed' },
      { memberUid: 'b', amount: 300, status: 'confirmed' }
    ]
  });
  // a: 500 − 100 = +400, b: 300 − 100 = +200, fund holds 600 → manager 'a' owes the fund's cash out.
  const transfers = c.settle(undefined, 'a');
  assert.deepEqual(transfers, [{ from: 'a', to: 'b', amount: 200 }]);
  assert.ok(!transfers.some((t) => t.from === FUND_ID || t.to === FUND_ID));
});
