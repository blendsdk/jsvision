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
import { ProgressBar, clampNaN, clamp01, asciiOnly, fillEighths, PARTIAL } from '../src/feedback/progress-bar.js';

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

test('fillEighths: round-first mid-range, 0%/100% snapped, clamped', () => {
  expect(fillEighths(0.5, 20), 'mid → round(v·w·8)').toBe(80);
  expect(fillEighths(0.28, 10), 'mid → round(22.4)').toBe(22);
  expect(fillEighths(0.994, 20), '99% → not snapped').toBe(Math.round(0.994 * 160)); // 159
  expect(fillEighths(0.996, 20), 'rounds to 100% → full (snap fixes the partial last cell)').toBe(160);
  expect(fillEighths(0.004, 20), 'rounds to 0% → empty').toBe(0);
  expect(fillEighths(1, 20), '100% → full').toBe(160);
  expect(fillEighths(0, 20), '0% → empty').toBe(0);
  expect(fillEighths(2, 20), 'clamps >1 → full').toBe(160);
  expect(fillEighths(-1, 20), 'clamps <0 → empty').toBe(0);
  expect(fillEighths(NaN, 20), 'NaN → empty').toBe(0);
});

test('percent getter: round(clamp(value)·100), clamped', () => {
  expect(new ProgressBar({ value: signal(0.456) }).percent).toBe(46);
  expect(new ProgressBar({ value: signal(0) }).percent).toBe(0);
  expect(new ProgressBar({ value: signal(1) }).percent).toBe(100);
  expect(new ProgressBar({ value: signal(2) }).percent).toBe(100);
  expect(new ProgressBar({ value: signal(NaN) }).percent).toBe(0);
  expect(new ProgressBar({ value: signal(-1) }).percent).toBe(0);
});

test('knockout caption centring (no padding) at even and odd widths', () => {
  // '45%' is 3 wide (no surrounding spaces now); width 10 → start=floor((10-3)/2)=3 → cols 3..5.
  const even = render(0.45, 10, 1, true);
  expect(even.row.slice(3, 6), 'centred 45%').toBe('45%');
  // width 9 (odd) → start=floor((9-3)/2)=3 as well.
  const odd = render(0.45, 9, 1, true);
  expect(odd.row.slice(3, 6), 'centred 45% (odd width)').toBe('45%');
});

/** Mount a labelled ProgressBar; return the buffer + a per-row string reader. */
function renderLabelled(
  value: number,
  w: number,
  h: number,
  label: string | (() => string),
  labelPosition: 'left' | 'right' | 'top' | 'top-left',
  caption = false,
) {
  const bar = new ProgressBar({ value: signal(value), label, labelPosition, caption });
  bar.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const root = new Group();
  root.add(bar);
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const buf = loop.renderRoot.buffer();
  const row = (y: number) =>
    buf
      .rows()
      [y].map((c) => c.char)
      .join('');
  return { buf, row };
}

test('label left/right: the reserved gap is exactly one column between text and bar', () => {
  // left: 'AB' (2) + 1 gap → bar at x=3; col 2 is the gap (untouched → space).
  const left = renderLabelled(1, 12, 1, 'AB', 'left');
  expect(left.row(0).slice(0, 2)).toBe('AB');
  expect(left.buf.get(2, 0)?.char, 'the 1-col gap').toBe(' ');
  expect(left.buf.get(3, 0)?.char, 'bar after the gap').toBe('█');
});

test('label top-left composes with the knockout caption on the bar row', () => {
  const { row } = renderLabelled(0.5, 12, 2, 'Sync', 'top-left', /* caption */ true);
  expect(row(0).startsWith('Sync'), 'label on row 0').toBe(true);
  expect(row(1).includes('50%'), 'knockout caption on the bar row').toBe(true);
});

test('a fixed-width right label keeps the bar from reflowing across 99%→100%', () => {
  // Padded to 4 ("100%" width) so the reserved label column is constant → bar region is stable.
  const pct = (v: number) => () => `${Math.round(v * 100)}%`.padStart(4);
  const at99 = renderLabelled(0.99, 28, 1, pct(0.99), 'right');
  const at100 = renderLabelled(1.0, 28, 1, pct(1.0), 'right');
  const fills = (r: string) => [...r].filter((c) => c === '█').length;
  expect(fills(at100.row(0)) >= fills(at99.row(0)), '100% is at least as full as 99% (no retreat)').toBe(true);
  // bw = 28 - (4 + 1) = 23 → the whole bar region is full blocks at 100%, no partial last cell.
  for (let x = 0; x < 23; x += 1) expect(at100.buf.get(x, 0)?.char, `x${x} full`).toBe('█');
});

test('label longer than the view width is clipped, never overruns', () => {
  const { buf } = renderLabelled(0.5, 6, 2, 'ThisLabelIsTooLong', 'top-left');
  expect(buf.get(6, 0), 'nothing painted past the view width').toBeUndefined();
});

test('reactive label: a function label re-reads on repaint', () => {
  const s = signal('one');
  const bar = new ProgressBar({ value: signal(1), label: () => s(), labelPosition: 'left' });
  bar.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 16, height: 1 } };
  const root = new Group();
  root.add(bar);
  const loop = createEventLoop({ width: 16, height: 1 }, { caps });
  loop.mount(root);
  expect(
    loop.renderRoot
      .buffer()
      .rows()[0]
      .map((c) => c.char)
      .join('')
      .startsWith('one'),
  ).toBe(true);
  s.set('two');
  loop.renderRoot.flush();
  expect(
    loop.renderRoot
      .buffer()
      .rows()[0]
      .map((c) => c.char)
      .join('')
      .startsWith('two'),
  ).toBe(true);
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
