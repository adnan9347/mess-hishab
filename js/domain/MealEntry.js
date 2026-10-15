import { DhakaDate } from '../core/DhakaDate.js';

export const MEAL_SLOTS = Object.freeze(['breakfast', 'lunch', 'dinner']);

export const DEFAULT_WEIGHTS = Object.freeze({ breakfast: 1, lunch: 1, dinner: 1, guest: 1 });

export const DEFAULT_CUTOFFS = Object.freeze({ breakfast: '10:00', lunch: '13:00', dinner: '20:00' });

/** One member's meals for one day. Immutable: every change returns a new entry. */
export class MealEntry {
  constructor({ memberUid, date, breakfast = false, lunch = false, dinner = false, guests = 0, updatedAt = null }) {
    this.memberUid = memberUid;
    this.date = date;
    this.breakfast = Boolean(breakfast);
    this.lunch = Boolean(lunch);
    this.dinner = Boolean(dinner);
    this.guests = Math.max(0, Math.trunc(guests) || 0);
    this.updatedAt = updatedAt;
    Object.freeze(this);
  }

  static id(uid, date) {
    return `${uid}_${date}`;
  }

  static empty(memberUid, date) {
    return new MealEntry({ memberUid, date });
  }

  get id() {
    return MealEntry.id(this.memberUid, this.date);
  }

  /** Weighted meal count, e.g. breakfast can count as half a meal. */
  count(weights = DEFAULT_WEIGHTS) {
    const w = { ...DEFAULT_WEIGHTS, ...weights };
    return MEAL_SLOTS.reduce((sum, slot) => sum + (this[slot] ? w[slot] : 0), 0) + this.guests * w.guest;
  }

  toggled(slot) {
    if (!MEAL_SLOTS.includes(slot)) throw new RangeError(`Unknown meal slot: ${slot}`);
    return new MealEntry({ ...this.toJSON(), [slot]: !this[slot] });
  }

  withGuests(guests) {
    return new MealEntry({ ...this.toJSON(), guests });
  }

  toJSON() {
    const { memberUid, date, breakfast, lunch, dinner, guests } = this;
    return { memberUid, date, breakfast, lunch, dinner, guests };
  }
}

/** Decides whether a member may still change a meal slot (the manager may always). */
export class MealCutoffPolicy {
  constructor(cutoffs = DEFAULT_CUTOFFS) {
    this.cutoffs = { ...DEFAULT_CUTOFFS, ...cutoffs };
  }

  isLocked(slot, dateKey, now = new Date()) {
    const today = DhakaDate.dateKey(now);
    if (dateKey < today) return true;
    if (dateKey > today) return false;
    return DhakaDate.minutesNow(now) >= DhakaDate.toMinutes(this.cutoffs[slot]);
  }

  /** Guests follow the dinner cutoff — the last meal of the day. */
  guestsLocked(dateKey, now = new Date()) {
    return this.isLocked('dinner', dateKey, now);
  }
}
