const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

/**
 * Money helpers. Postel's Law: be liberal in what we accept —
 * "৳1,250", "1250", "১২৫০", "1250 tk" and "১,২৫০ টাকা" all parse to 1250.
 */
export class Money {
  static normalizeDigits(value) {
    return String(value).replace(/[০-৯]/g, (ch) => String(BN_DIGITS.indexOf(ch)));
  }

  /** Returns a number rounded to paisa, or NaN when the input is not an amount. */
  static parse(input) {
    if (typeof input === 'number') return Number.isFinite(input) ? Money.round2(input) : NaN;
    if (input == null) return NaN;
    const cleaned = Money.normalizeDigits(input)
      .replace(/৳|টাকা|taka|tk|bdt|,|\s/gi, '')
      .trim();
    if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
    return Money.round2(parseFloat(cleaned));
  }

  static round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  static toBanglaDigits(value) {
    return String(value).replace(/\d/g, (d) => BN_DIGITS[d]);
  }

  /**
   * Format with the taka sign and locale digits.
   * @param {number} amount
   * @param {'bn'|'en'} locale
   */
  static format(amount, locale = 'bn', { decimals = 0, sign = false } = {}) {
    const nf = new Intl.NumberFormat(locale === 'bn' ? 'bn-BD' : 'en-BD', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
    const safe = Number.isFinite(amount) ? amount : 0;
    const rounded = decimals === 0 ? Math.round(safe) : safe;
    const prefix = rounded < 0 ? '−' : sign && rounded > 0 ? '+' : '';
    return `${prefix}৳${nf.format(Math.abs(rounded))}`;
  }
}
