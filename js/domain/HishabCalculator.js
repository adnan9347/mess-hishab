import { MealEntry, DEFAULT_WEIGHTS } from './MealEntry.js';
import { GreedySettlementStrategy, FUND_ID } from './SettlementStrategy.js';
import { Money } from './Money.js';

/** One member's numbers for a month. */
export class MemberSummary {
  constructor({ uid, name, meals, mealRate, mealCost, fixedShare, paid, pending, balance }) {
    Object.assign(this, { uid, name, meals, mealRate, mealCost, fixedShare, paid, pending, balance });
    Object.freeze(this);
  }

  get cost() {
    return this.mealCost + this.fixedShare;
  }

  /** 'owes' | 'gets' | 'settled' — ±৳0.50 counts as settled. */
  get status() {
    if (this.balance < -0.5) return 'owes';
    if (this.balance > 0.5) return 'gets';
    return 'settled';
  }

  /** Share of the cost already covered, 0–1. Drives the dues ring. */
  get coverage() {
    if (this.cost <= 0) return 1;
    return Math.max(0, Math.min(1, this.paid / this.cost));
  }

  toJSON() {
    const { uid, name, meals, mealRate, mealCost, fixedShare, paid, pending, balance } = this;
    return { uid, name, meals, mealRate, mealCost, fixedShare, paid, pending, balance };
  }
}

/**
 * Tesler's Law in code: all of the mess maths lives here so nobody does it by hand.
 *
 *   mealRate   = total bazar ÷ total meals
 *   memberCost = memberMeals × mealRate + fixed costs ÷ active members
 *   paid       = confirmed deposits + bazar the member paid from their own pocket
 *   balance    = paid − memberCost          (positive → gets money back)
 *
 * Money from deposits sits with the manager (the "fund"); fund bazar and fixed bills are paid from it.
 */
export class HishabCalculator {
  constructor({ members = [], meals = [], bazar = [], fixedCosts = [], deposits = [], weights = DEFAULT_WEIGHTS } = {}) {
    this.members = members;
    this.meals = meals.map((m) => (m instanceof MealEntry ? m : new MealEntry(m)));
    this.bazar = bazar;
    this.fixedCosts = fixedCosts;
    this.deposits = deposits;
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  get activeMembers() {
    return this.members.filter((m) => m.active !== false);
  }

  mealsOf(uid) {
    return this.meals.filter((m) => m.memberUid === uid).reduce((s, m) => s + m.count(this.weights), 0);
  }

  mealsOn(dateKey) {
    return this.meals.filter((m) => m.date === dateKey).reduce((s, m) => s + m.count(this.weights), 0);
  }

  totalMeals() {
    return this.meals.reduce((s, m) => s + m.count(this.weights), 0);
  }

  totalBazar() {
    return sum(this.bazar.map((b) => Number(b.amount)));
  }

  fundBazar() {
    return sum(this.bazar.filter((b) => b.source !== 'pocket').map((b) => Number(b.amount)));
  }

  pocketBazarOf(uid) {
    return sum(this.bazar.filter((b) => b.source === 'pocket' && b.shopperUid === uid).map((b) => Number(b.amount)));
  }

  totalFixed() {
    return sum(this.fixedCosts.map((f) => Number(f.amount)));
  }

  confirmedDeposits(uid = null) {
    return sum(
      this.deposits
        .filter((d) => d.status === 'confirmed' && (uid === null || d.memberUid === uid))
        .map((d) => Number(d.amount))
    );
  }

  pendingDeposits(uid = null) {
    return sum(
      this.deposits
        .filter((d) => d.status === 'pending' && (uid === null || d.memberUid === uid))
        .map((d) => Number(d.amount))
    );
  }

  get mealRate() {
    const meals = this.totalMeals();
    return meals > 0 ? this.totalBazar() / meals : 0;
  }

  get fixedShare() {
    const n = this.activeMembers.length;
    return n > 0 ? this.totalFixed() / n : 0;
  }

  /** Cash the manager should be holding right now. */
  fundCash() {
    return this.confirmedDeposits() - this.fundBazar() - this.totalFixed();
  }

  summaryFor(uid) {
    const member = this.members.find((m) => m.uid === uid) ?? { uid, displayName: '', active: true };
    const meals = this.mealsOf(uid);
    const mealRate = this.mealRate;
    const mealCost = meals * mealRate;
    const fixedShare = member.active === false ? 0 : this.fixedShare;
    const paid = this.confirmedDeposits(uid) + this.pocketBazarOf(uid);
    return new MemberSummary({
      uid,
      name: member.displayName,
      meals,
      mealRate: Money.round2(mealRate),
      mealCost: Money.round2(mealCost),
      fixedShare: Money.round2(fixedShare),
      paid: Money.round2(paid),
      pending: Money.round2(this.pendingDeposits(uid)),
      balance: Money.round2(paid - mealCost - fixedShare)
    });
  }

  summaries() {
    return this.members.map((m) => this.summaryFor(m.uid));
  }

  /**
   * Who pays whom at month end. The fund cash is held by someone (normally the manager):
   * pass their uid and the fund is folded into their balance, so every transfer is person-to-person.
   * Without a holder the fund appears as its own party (FUND_ID).
   */
  settle(strategy = new GreedySettlementStrategy(), fundHolderUid = null) {
    const entries = this.summaries().map((s) => ({ id: s.uid, balance: s.balance }));
    const fundBalance = -this.fundCash();
    if (Math.abs(fundBalance) >= 0.005) {
      const holder = fundHolderUid && entries.find((e) => e.id === fundHolderUid);
      if (holder) holder.balance += fundBalance;
      else entries.push({ id: FUND_ID, balance: fundBalance });
    }
    return strategy.settle(entries);
  }

  /** Projected cost for the whole month, used as the bazar-fund goal (Goal-Gradient). */
  projectedMonthCost(daysElapsed, daysInMonth) {
    const spent = this.totalBazar() + this.totalFixed();
    if (daysElapsed <= 0) return spent;
    const bazarPerDay = this.totalBazar() / daysElapsed;
    return bazarPerDay * daysInMonth + this.totalFixed();
  }
}

function sum(values) {
  return values.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
}
