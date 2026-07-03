/**
 * Implementation tests — `ProgressBar` internals & edges (RD-18, 07 §impl). Beyond the ST oracles:
 * the `clampNaN`/`clamp01` units, round-first rounding boundaries (PF-002 cases), the `percent`
 * getter, caption centring at even/odd widths, and the `asciiOnly` truth table. `.js` per NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { ProgressBar, clampNaN, clamp01, asciiOnly, PARTIAL } from '../src/feedback/progress-bar.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true } },
}).profile;

/** Render a ProgressBar and return a row-0 string + the buffer. */
function render(value: number, w: number, h = 1, caption = false) {
  const bar = new ProgressBar({ value: signal(value), caption });
  bar.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(bar);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const buf = loop.renderRoot.buffer();
  return {
    buf,
    row: buf
      .rows()[0]
      .map((c) => c.char)
      .join(''),
  };
}

test('clampNaN: NaN → 0; finite/±∞ pass through unchanged', () => {
  expect(clampNaN(NaN)).toBe(0);
  expect(clampNaN(0)).toBe(0);
  expect(clampNaN(0.5)).toBe(0.5);
  expect(clampNaN(-3)).toBe(-3);
  expect(clampNaN(Infinity)).toBe(Infinity);
  expect(clampNaN(-Infinity)).toBe(-Infinity);
});

test('clamp01: maps NaN/-0/±∞/OOB into [0,1]; boundaries exact', () => {
  expect(clamp01(NaN)).toBe(0);
  expect(clamp01(-0)).toBe(0);
  expect(clamp01(-1)).toBe(0);
  expect(clamp01(0)).toBe(0);
  expect(clamp01(0.5)).toBe(0.5);
  expect(clamp01(1)).toBe(1);
  expect(clamp01(2)).toBe(1);
  expect(clamp01(Infinity)).toBe(1);
  expect(clamp01(-Infinity)).toBe(0);
});

test('rounding boundaries — round-first e=round(v·w·8), full=floor(e/8), part=e%8 (PF-002)', () => {
  const FULL = '█';
  const TRACK = '░';
  // v=0.99,w=1 → e=round(7.92)=8 → full=1, part=0: a single full cell, no partial.
  expect(render(0.99, 1).buf.get(0, 0)?.char, '0.99,w1 → 1 full').toBe(FULL);
  // v=0.9,w=1 → e=round(7.2)=7 → full=0, part=7 → PARTIAL[7]=▉.
  expect(render(0.9, 1).buf.get(0, 0)?.char, '0.9,w1 → part 7').toBe(PARTIAL[7]);
  // v=0.5,w=1 → e=round(4)=4 → full=0, part=4 → PARTIAL[4]=▌.
  expect(render(0.5, 1).buf.get(0, 0)?.char, '0.5,w1 → part 4').toBe(PARTIAL[4]);
  // v=0.298,w=10 → v·w≈2.98 → e=round(23.84)=24 → full=3, part=0: 3 full + 7 track (PF-002 case).
  {
    const { buf } = render(0.298, 10);
    for (let x = 0; x < 3; x += 1) expect(buf.get(x, 0)?.char, `x${x} full`).toBe(FULL);
    expect(buf.get(3, 0)?.char, 'x3 track (no partial)').toBe(TRACK);
  }
});

test('percent getter: round(clamp(value)·100), clamped', () => {
  expect(new ProgressBar({ value: signal(0.456) }).percent).toBe(46);
  expect(new ProgressBar({ value: signal(0) }).percent).toBe(0);
  expect(new ProgressBar({ value: signal(1) }).percent).toBe(100);
  expect(new ProgressBar({ value: signal(2) }).percent).toBe(100);
  expect(new ProgressBar({ value: signal(NaN) }).percent).toBe(0);
  expect(new ProgressBar({ value: signal(-1) }).percent).toBe(0);
});

test('caption centring at even and odd widths', () => {
  // width 10 (even), " 45% " is 5 wide → lx=floor((10-5)/2)=2.
  const even = render(0.45, 10, 1, true);
  expect(even.buf.get(2, 0)?.char, 'lx=2 leading space').toBe(' ');
  expect(even.row.slice(2, 7), 'centred label').toBe(' 45% ');
  // width 9 (odd) → lx=floor((9-5)/2)=2 as well.
  const odd = render(0.45, 9, 1, true);
  expect(odd.row.slice(2, 7), 'centred label (odd width)').toBe(' 45% ');
});

test('asciiOnly truth table: !utf8 || !halfBlocks', () => {
  const build = (utf8: boolean, halfBlocks: boolean) =>
    resolveCapabilities({
      env: {},
      platform: 'linux',
      override: { colorDepth: 'truecolor', unicode: { utf8 }, glyphs: { boxDrawing: true, halfBlocks } },
    }).profile;
  expect(asciiOnly(build(true, true)), 'utf8+halfBlocks → false').toBe(false);
  expect(asciiOnly(build(true, false)), 'no halfBlocks → true').toBe(true);
  expect(asciiOnly(build(false, true)), 'no utf8 → true').toBe(true);
  expect(asciiOnly(build(false, false)), 'neither → true').toBe(true);
});
