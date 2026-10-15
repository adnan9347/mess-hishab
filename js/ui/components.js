import { esc, initials, hueFor, haptic } from '../core/util.js';
import { Money } from '../domain/Money.js';

export function avatar(member, size = 40) {
  const name = member?.displayName ?? '?';
  const hue = hueFor(member?.uid ?? name);
  return `<span class="avatar" style="--hue:${hue};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${esc(initials(name))}</span>`;
}

/** SVG progress ring. Zeigarnik: an unfinished ring nags gently until dues are cleared. */
export function ring(progress, { size = 168, stroke = 14, tone = 'brand' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return `
    <svg class="ring ring--${tone}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="presentation">
      <defs><linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="ring__stop-a"/><stop offset="1" class="ring__stop-b"/></linearGradient></defs>
      <circle class="ring__track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/>
      <circle class="ring__bar" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-offset="${c * (1 - p)}"
        transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
}

/** Start ring animations after mount (they render empty, then fill). */
export function animateRings(root) {
  requestAnimationFrame(() => {
    root.querySelectorAll('.ring__bar[data-offset]').forEach((el) => {
      el.style.strokeDashoffset = el.dataset.offset;
    });
  });
}

export function segmented(name, options, value, { label = '', size = '' } = {}) {
  return `
    <div class="seg ${size}" role="radiogroup" aria-label="${esc(label)}" data-seg="${name}">
      ${options
        .map(
          (o) => `<button type="button" class="seg__btn ${o.value === value ? 'is-active' : ''}" role="radio"
            aria-checked="${o.value === value}" data-value="${esc(o.value)}">${o.icon ? `<i class="bi ${o.icon}"></i>` : ''}<span>${esc(o.label)}</span></button>`
        )
        .join('')}
    </div>`;
}

export function emptyState(icon, title, body = '') {
  return `
    <div class="empty-state">
      <div class="empty-state__icon"><i class="bi ${icon}"></i></div>
      <p class="tw-font-semibold tw-mb-1">${esc(title)}</p>
      ${body ? `<p class="tw-text-sm tw-text-muted tw-mb-0">${esc(body)}</p>` : ''}
    </div>`;
}

export function moneyClass(balance) {
  if (balance < -0.5) return 'money-neg';
  if (balance > 0.5) return 'money-pos';
  return '';
}

export function backButton(label, target) {
  return `<a href="#/${target}" class="icon-btn" aria-label="${esc(label)}"><i class="bi bi-arrow-left"></i></a>`;
}

/**
 * Big amount keypad, bKash/Nagad style (Jakob's Law).
 * Works with taps, a hardware keyboard and paste (Postel's Law: "১২৫০", "৳1,250").
 */
export class AmountKeypad {
  static MAX = 999_999;

  constructor(root, { locale = 'bn', initial = '', onChange = () => {}, label = '' } = {}) {
    this.root = root;
    this.locale = locale;
    this.raw = initial ? String(initial) : '';
    this.onChange = onChange;
    this.label = label;
    this.render();
    this.onKey = (e) => this.handleKey(e);
    this.onPaste = (e) => this.handlePaste(e);
    document.addEventListener('keydown', this.onKey);
    document.addEventListener('paste', this.onPaste);
  }

  get amount() {
    const n = Money.parse(this.raw || '0');
    return Number.isFinite(n) ? n : 0;
  }

  set(value) {
    this.raw = value ? String(value) : '';
    this.refresh();
  }

  render() {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'];
    this.root.innerHTML = `
      <output class="amount-display" aria-live="polite" aria-label="${esc(this.label)}"></output>
      <div class="keypad" role="group" aria-label="${esc(this.label)}">
        ${keys
          .map((k) =>
            k === 'back'
              ? `<button type="button" class="keypad__key" data-key="back" aria-label="Delete"><i class="bi bi-backspace"></i></button>`
              : `<button type="button" class="keypad__key" data-key="${k}">${this.locale === 'bn' ? Money.toBanglaDigits(k) : k}</button>`
          )
          .join('')}
      </div>`;
    this.root.querySelector('.keypad').addEventListener('click', (e) => {
      const key = e.target.closest('[data-key]')?.dataset.key;
      if (key) this.press(key);
    });
    this.refresh();
  }

  press(key) {
    haptic(6);
    if (key === 'back') this.raw = this.raw.slice(0, -1);
    else if (key === '.') {
      if (!this.raw.includes('.')) this.raw = (this.raw || '0') + '.';
    } else {
      const next = this.raw === '0' ? key : this.raw + key;
      const [, decimals = ''] = next.split('.');
      if (decimals.length > 2 || Number(next) > AmountKeypad.MAX) return this.shake();
      this.raw = next;
    }
    this.refresh();
  }

  handleKey(e) {
    if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
    const key = Money.normalizeDigits(e.key);
    if (/^\d$/.test(key) || key === '.') this.press(key);
    else if (e.key === 'Backspace') this.press('back');
    else return;
    e.preventDefault();
  }

  handlePaste(e) {
    if (e.target.closest('input, textarea')) return;
    const amount = Money.parse(e.clipboardData?.getData('text') ?? '');
    if (Number.isFinite(amount) && amount <= AmountKeypad.MAX) {
      this.set(String(amount));
      e.preventDefault();
    }
  }

  shake() {
    const el = this.root.querySelector('.amount-display');
    el.classList.remove('is-shaking');
    void el.offsetWidth;
    el.classList.add('is-shaking');
    haptic([10, 30, 10]);
  }

  refresh() {
    const shown = this.raw || '0';
    const [int, dec] = shown.split('.');
    const grouped = new Intl.NumberFormat(this.locale === 'bn' ? 'bn-BD' : 'en-BD').format(Number(int || 0));
    const decPart = dec !== undefined ? `.${this.locale === 'bn' ? Money.toBanglaDigits(dec) : dec}` : '';
    const out = this.root.querySelector('.amount-display');
    out.innerHTML = `<span class="amount-display__sign">৳</span>${grouped}${decPart}`;
    out.classList.toggle('is-empty', !this.raw);
    this.onChange(this.amount);
  }

  destroy() {
    document.removeEventListener('keydown', this.onKey);
    document.removeEventListener('paste', this.onPaste);
  }
}
