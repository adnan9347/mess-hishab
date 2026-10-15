import { SafeStorage } from './Storage.js';
import { Money } from '../domain/Money.js';
import { DhakaDate } from './DhakaDate.js';
import bn from '../i18n/bn.js';
import en from '../i18n/en.js';

const DICTS = { bn, en };
const STORAGE_KEY = 'mh.locale';

/** Bangla-first translations plus locale-aware numbers, money and dates. */
export class I18n extends EventTarget {
  static LOCALES = ['bn', 'en'];

  constructor() {
    super();
    const saved = SafeStorage.get(STORAGE_KEY);
    this.locale = I18n.LOCALES.includes(saved) ? saved : 'bn';
    this.apply();
  }

  get intlLocale() {
    return this.locale === 'bn' ? 'bn-BD' : 'en-BD';
  }

  setLocale(locale) {
    if (!I18n.LOCALES.includes(locale) || locale === this.locale) return;
    this.locale = locale;
    SafeStorage.set(STORAGE_KEY, locale);
    this.apply();
    this.dispatchEvent(new Event('change'));
  }

  apply() {
    document.documentElement.lang = this.locale;
    document.documentElement.classList.toggle('lang-bn', this.locale === 'bn');
    document.cookie = `NEXT_LOCALE=${this.locale};path=/;max-age=31536000;SameSite=Lax`;
  }

  /** t('today.morning', { name: 'Rafi' }) — falls back to English, then to the key. */
  t(key, params = {}) {
    const raw = lookup(DICTS[this.locale], key) ?? lookup(DICTS.en, key);
    if (raw == null) {
      console.warn(`[i18n] missing key: ${key}`);
      return key;
    }
    return String(raw).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
  }

  num(value, decimals = 0) {
    return new Intl.NumberFormat(this.intlLocale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(Number.isFinite(value) ? value : 0);
  }

  /** Meal counts: whole numbers stay whole, half meals show one decimal. */
  meals(value) {
    return this.num(value, Number.isInteger(value) ? 0 : 1);
  }

  money(amount, opts) {
    return Money.format(amount, this.locale, opts);
  }

  /** Accepts a Date or a "yyyy-mm-dd" key. */
  date(value, opts = { day: 'numeric', month: 'short' }) {
    const d = typeof value === 'string' ? DhakaDate.toDate(value) : value;
    return new Intl.DateTimeFormat(this.intlLocale, { timeZone: DhakaDate.TZ, ...opts }).format(d);
  }

  monthName(monthKey, opts = { month: 'long', year: 'numeric' }) {
    return this.date(`${monthKey}-15`, opts);
  }

  /** "20:00" → "8:00 PM" in English, "রাত ৮টা" in Bangla (the way people actually say it). */
  time(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    if (this.locale === 'bn') {
      const period = h < 6 ? 'ভোর' : h < 12 ? 'সকাল' : h < 15 ? 'দুপুর' : h < 18 ? 'বিকাল' : h < 20 ? 'সন্ধ্যা' : 'রাত';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      return `${period} ${this.num(h12)}${m ? `:${this.num(m).padStart(2, '০')}` : 'টা'}`;
    }
    const d = new Date(Date.UTC(2026, 0, 1, h - 6, m));
    return new Intl.DateTimeFormat(this.intlLocale, { timeZone: DhakaDate.TZ, hour: 'numeric', minute: '2-digit' }).format(d);
  }
}

function lookup(dict, key) {
  return key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);
}
