import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Reads the colour tokens straight from app.css so the check can't drift from the real theme.
const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('\n}', start));
}

function tokens(selector) {
  const out = {};
  const src = block(selector);
  for (const m of src.matchAll(/--(c-[\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)/g)) out[m[1]] = [+m[2], +m[3], +m[4]];
  const grad = src.match(/--g-brand:\s*linear-gradient\(([^;]+)\);/);
  out.gradStops = grad ? [...grad[1].matchAll(/#([0-9a-f]{6})/gi)].map((h) => hex(h[1])) : [];
  return out;
}

const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const light = tokens(':root');

// The app ships a single light theme.
for (const [name, t] of [['light', light]]) {
  test(`${name} theme meets WCAG AA (4.5:1) for text`, () => {
    const pairs = [
      ['text on bg', 'c-text', 'c-bg'],
      ['text on surface', 'c-text', 'c-surface'],
      ['secondary text on bg', 'c-text-2', 'c-bg'],
      ['secondary text on surface', 'c-text-2', 'c-surface'],
      ['brand link on surface', 'c-brand', 'c-surface'],
      ['brand link on bg', 'c-brand', 'c-bg'],
      ['brand text on brand-soft', 'c-brand', 'c-brand-soft'],
      ['text on brand-soft', 'c-text', 'c-brand-soft'],
      ['button text on brand', 'c-brand-fg', 'c-brand'],
      ['success on surface', 'c-success', 'c-surface'],
      ['danger on surface', 'c-danger', 'c-surface'],
      ['warning on surface', 'c-warning', 'c-surface']
    ];
    for (const [label, fg, bg] of pairs) {
      const ratio = contrast(t[fg], t[bg]);
      assert.ok(ratio >= 4.5, `${name}: ${label} is ${ratio.toFixed(2)}:1`);
    }
  });

  test(`${name} theme: button text stays readable across the whole gradient`, () => {
    assert.ok(t.gradStops.length >= 2, 'gradient stops found');
    for (const stop of t.gradStops) {
      const ratio = contrast(t['c-brand-fg'], stop);
      assert.ok(ratio >= 4.5, `${name}: brand-fg on #${stop.map((v) => v.toString(16).padStart(2, '0')).join('')} is ${ratio.toFixed(2)}:1`);
    }
  });
}

test('no dark theme is shipped', () => {
  assert.ok(!css.includes(':root.dark'), 'dark tokens removed');
  assert.ok(!/^\.dark /m.test(css), 'no .dark rules');
});
