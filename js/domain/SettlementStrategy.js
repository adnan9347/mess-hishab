/** Virtual party that represents the cash the manager is holding for the mess. */
export const FUND_ID = '__fund__';

/**
 * Round a list of numbers to whole taka while keeping their sum exact
 * (largest-remainder method), so a settlement never leaves a stray taka behind.
 */
export function roundPreservingSum(values) {
  const target = Math.round(values.reduce((s, v) => s + v, 0));
  const floors = values.map(Math.floor);
  let remaining = target - floors.reduce((s, v) => s + v, 0);
  const order = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (const { i } of order) {
    if (remaining <= 0) break;
    out[i] += 1;
    remaining -= 1;
  }
  return out;
}

/** Strategy interface: turns balances into a list of transfers. */
export class SettlementStrategy {
  /**
   * @param {{id: string, balance: number}[]} entries positive = should receive, negative = should pay
   * @returns {{from: string, to: string, amount: number}[]}
   */
  settle(entries) {
    throw new Error(`${this.constructor.name} must implement settle()`);
  }
}

/** Greedy matching of the largest debtor with the largest creditor — at most n−1 transfers. */
export class GreedySettlementStrategy extends SettlementStrategy {
  settle(entries) {
    const rounded = roundPreservingSum(entries.map((e) => e.balance));
    const people = entries.map((e, i) => ({ id: e.id, amount: rounded[i] }));
    const creditors = people.filter((p) => p.amount > 0).sort((a, b) => b.amount - a.amount);
    const debtors = people
      .filter((p) => p.amount < 0)
      .map((p) => ({ id: p.id, amount: -p.amount }))
      .sort((a, b) => b.amount - a.amount);

    const transfers = [];
    let c = 0;
    let d = 0;
    while (c < creditors.length && d < debtors.length) {
      const amount = Math.min(creditors[c].amount, debtors[d].amount);
      if (amount > 0) transfers.push({ from: debtors[d].id, to: creditors[c].id, amount });
      creditors[c].amount -= amount;
      debtors[d].amount -= amount;
      if (creditors[c].amount === 0) c += 1;
      if (debtors[d].amount === 0) d += 1;
    }
    return transfers;
  }
}
