const DAY_MS = 86_400_000;

/** Every user's calculation data must be kept for at least 30 days. */
export class RetentionPolicy {
  static MIN_DAYS = 30;
  static OPTIONS = Object.freeze([30, 60, 90]);
  static EXPIRY_WARNING_DAYS = 3;

  constructor(days = RetentionPolicy.MIN_DAYS) {
    if (!Number.isInteger(days) || days < RetentionPolicy.MIN_DAYS) {
      throw new RangeError(`Retention must be a whole number of days ≥ ${RetentionPolicy.MIN_DAYS}`);
    }
    this.days = days;
    Object.freeze(this);
  }

  /** Accepts anything and falls back to the minimum, for data coming from storage. */
  static from(days) {
    return Number.isInteger(days) && days >= RetentionPolicy.MIN_DAYS
      ? new RetentionPolicy(days)
      : new RetentionPolicy();
  }

  expireAt(base = new Date()) {
    return new Date(new Date(base).getTime() + this.days * DAY_MS);
  }

  static isExpired(expireAt, now = new Date()) {
    return Boolean(expireAt) && new Date(expireAt).getTime() <= now.getTime();
  }

  static daysLeft(expireAt, now = new Date()) {
    return Math.max(0, Math.ceil((new Date(expireAt).getTime() - now.getTime()) / DAY_MS));
  }

  static isExpiringSoon(expireAt, now = new Date()) {
    return (
      Boolean(expireAt) &&
      !RetentionPolicy.isExpired(expireAt, now) &&
      RetentionPolicy.daysLeft(expireAt, now) <= RetentionPolicy.EXPIRY_WARNING_DAYS
    );
  }
}
