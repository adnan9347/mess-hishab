import { SafeStorage } from './Storage.js';

const STORAGE_KEY = 'mh.theme';

/** Light / Dark / System. Drives Bootstrap (data-bs-theme) and Tailwind (.dark) together. */
export class ThemeManager extends EventTarget {
  static MODES = ['light', 'dark', 'system'];
  static META_COLORS = { light: '#F5F6F4', dark: '#0E1113' };

  constructor() {
    super();
    const saved = SafeStorage.get(STORAGE_KEY);
    this.mode = ThemeManager.MODES.includes(saved) ? saved : 'system';
    this.media = window.matchMedia('(prefers-color-scheme: dark)');
    this.media.addEventListener('change', () => this.mode === 'system' && this.apply());
    this.apply();
  }

  get resolved() {
    if (this.mode === 'system') return this.media.matches ? 'dark' : 'light';
    return this.mode;
  }

  setMode(mode) {
    if (!ThemeManager.MODES.includes(mode)) return;
    this.mode = mode;
    SafeStorage.set(STORAGE_KEY, mode);
    this.apply(true);
    this.dispatchEvent(new Event('change'));
  }

  toggle() {
    this.setMode(this.resolved === 'dark' ? 'light' : 'dark');
  }

  apply(animate = false) {
    const root = document.documentElement;
    const theme = this.resolved;
    if (animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-transition');
      setTimeout(() => root.classList.remove('theme-transition'), 300);
    }
    root.dataset.bsTheme = theme;
    root.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ThemeManager.META_COLORS[theme]);
  }
}
