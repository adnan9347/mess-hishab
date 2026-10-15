import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import bn from '../js/i18n/bn.js';
import en from '../js/i18n/en.js';

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]));

const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') && !p.includes('i18n') ? [p] : [];
});

test('Bangla and English have exactly the same keys', () => {
  const b = new Set(flatten(bn));
  const e = new Set(flatten(en));
  assert.deepEqual([...e].filter((k) => !b.has(k)), [], 'missing in bn');
  assert.deepEqual([...b].filter((k) => !e.has(k)), [], 'missing in en');
});

test('every static key used in the code exists', () => {
  const keys = new Set(flatten(en));
  const used = new Set();
  for (const f of files('js')) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+)'/g)) used.add(m[1]);
    for (const m of src.matchAll(/'((?:hishab|today|mess|retention|auth\.err|settings|manager|settle|pay|verify)\.[a-zA-Z0-9.]+)'/g)) used.add(m[1]);
  }
  const missing = [...used].filter((k) => !keys.has(k));
  assert.deepEqual(missing, []);
});

test('placeholders match between languages', () => {
  const get = (o, k) => k.split('.').reduce((n, p) => n[p], o);
  for (const k of flatten(en)) {
    const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    assert.equal(ph(get(bn, k)), ph(get(en, k)), k);
  }
});
