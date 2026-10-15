// All calendar logic runs in Bangladesh time, whatever the device clock's timezone is.
const TZ = 'Asia/Dhaka';
const DAY_MS = 86_400_000;

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

export class DhakaDate {
  static TZ = TZ;
  static DAY_MS = DAY_MS;

  static parts(date = new Date()) {
    const out = {};
    for (const p of partsFormatter.formatToParts(date)) out[p.type] = p.value;
    return out;
  }

  /** "2026-10-15" */
  static dateKey(date = new Date()) {
    const p = this.parts(date);
    return `${p.year}-${p.month}-${p.day}`;
  }

  /** "2026-10" */
  static monthKey(date = new Date()) {
    return this.dateKey(date).slice(0, 7);
  }

  /** Minutes since midnight in Dhaka. */
  static minutesNow(date = new Date()) {
    const p = this.parts(date);
    return Number(p.hour) * 60 + Number(p.minute);
  }

  static addDays(dateKey, n) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }

  static nextMonthKey(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  }

  static prevMonthKey(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  }

  static daysInMonth(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  /** A Date that is noon in Dhaka on the given day — safe to format in any timezone. */
  static toDate(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 6));
  }

  /** "13:00" → 780 */
  static toMinutes(hhmm) {
    const [h, m] = String(hhmm).split(':').map(Number);
    return h * 60 + (m || 0);
  }
}
