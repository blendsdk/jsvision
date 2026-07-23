/**
 * Specification tests (immutable oracles) — RD-18 `ProgressBar` (03-01, 07 ST-1…ST-5 + ST-14 bar part;
 * ST-15/16 = the PA-13 positioned-label extension).
 *
 * RD-18 has NO Turbo Vision counterpart (GATE-1, AR-186); the bar is a documented new component whose
 * pieces are grounded in Unicode Block Elements + the caps-driven ASCII fallback + the `progress*`
 * extension colours. These oracles derive from AC-1…AC-5 + AC-14 and the 03-01 draw algorithm:
 *   e = round(v·w·8); full = floor(e/8); part = e % 8  →  full×█(U+2588), one PARTIAL[part]
 *   (U+258F…U+2589) when part∈1..7, then ░(U+2591) track; ASCII caps → whole-cell #/- (no partials);
 *   optional centred NN% KNOCKOUT caption (PA-12 — on the bar, not a staticText box); value clamped.
 * Widgets render the shipped way (createEventLoop + mount, the tab-strip.spec idiom) so ctx.caps flows
 * automatically. `.js` in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { ProgressBar } from '../src/feedback/index.js';

// Full-Unicode caps → smooth sub-cell fill (asciiOnly false: utf8 + halfBlocks on).
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true } },
}).profile;
// Unicode-off caps → whole-cell ASCII fallback (asciiOnly true).
const asciiCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: false } },
}).profile;

const FULL = '█'; // █
const TRACK = '░'; // ░
// PARTIAL[1..7] = U+258F…U+2589 (index 0 unused).
const PARTIAL = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const;

/** Mount a ProgressBar filling w×h under the given caps; return the composed buffer + a row string. */
function render(
  value: number,
  w: number,
  h: number,
  opts?: {
    caption?: boolean;
    caps?: typeof caps;
    label?: string | (() => string);
    labelPosition?: 'left' | 'right' | 'top' | 'top-left';
  },
) {
  const v = signal(value);
  const bar = new ProgressBar({
    value: v,
    caption: opts?.caption,
    label: opts?.label,
    labelPosition: opts?.labelPosition,
  });
  bar.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(bar);
  const loop = createEventLoop({ width: w, height: h }, { caps: opts?.caps ?? caps });
  loop.mount(root);
  const buf = loop.renderRoot.buffer();
  const row = (y: number) =>
    buf
      .rows()
      [y].map((c) => c.char)
      .join('');
  return { buf, row, bar, v, loop };
}

// ST-1 / AC-1 — a value write fills proportionally and repaints on change.
test('ST-1: value.set drives the proportion; a re-set repaints to the new value', () => {
  const { row, v, loop } = render(0.5, 10, 1);
  const filledCount = (s: string) => [...s].filter((c) => c === FULL).length;
  expect(filledCount(row(0)), 'half → 5 full cells').toBe(5);
  v.set(0.8);
  loop.renderRoot.flush(); // force the coalesced repaint (the loop defers flush; app-shell spec idiom)
  const row2 = loop.renderRoot
    .buffer()
    .rows()[0]
    .map((c) => c.char)
    .join('');
  expect(filledCount(row2), '0.8 → 8 full cells (more than at 0.5)').toBe(8);
});

// ST-2 / AC-2 — cell-by-cell smooth fill against the round-first oracle, pre-serialize.
test('ST-2: smooth sub-cell fill — full×█, one PARTIAL[part], then ░ track (round-first)', () => {
  // v=0.3,w=10 → e=round(24)=24 → full=3, part=0: 3×█ + 7×░, no partial.
  {
    const { buf } = render(0.3, 10, 1);
    for (let x = 0; x < 3; x += 1) expect(buf.get(x, 0)?.char, `x${x} full`).toBe(FULL);
    for (let x = 3; x < 10; x += 1) expect(buf.get(x, 0)?.char, `x${x} track`).toBe(TRACK);
  }
  // v=1,w=10 → e=80 → full=10: all █.
  {
    const { buf } = render(1, 10, 1);
    for (let x = 0; x < 10; x += 1) expect(buf.get(x, 0)?.char, `x${x} full`).toBe(FULL);
  }
  // v=0,w=10 → e=0: all ░.
  {
    const { buf } = render(0, 10, 1);
    for (let x = 0; x < 10; x += 1) expect(buf.get(x, 0)?.char, `x${x} track`).toBe(TRACK);
  }
  // v=0.28,w=10 → e=round(22.4)=22 → full=2, part=6: 2×█ + ▊(PARTIAL[6]=U+258A) + 7×░.
  {
    const { buf } = render(0.28, 10, 1);
    expect(buf.get(0, 0)?.char).toBe(FULL);
    expect(buf.get(1, 0)?.char).toBe(FULL);
    expect(buf.get(2, 0)?.char, 'the partial cell').toBe(PARTIAL[6]);
    expect(PARTIAL[6]).toBe('▊');
    for (let x = 3; x < 10; x += 1) expect(buf.get(x, 0)?.char, `x${x} track`).toBe(TRACK);
  }
});

// ST-2 (styles) — the fill cells carry progressFill, the track cells progressTrack.
test('ST-2: fill cells use progressFill, track cells use progressTrack', () => {
  const { buf } = render(0.28, 10, 1); // 2 full + partial (fill role), then track
  const fill = buf.get(0, 0);
  expect(fill?.fg, 'fill fg').toBe(defaultTheme.progressFill.fg);
  expect(fill?.bg, 'fill bg').toBe(defaultTheme.progressFill.bg);
  const partial = buf.get(2, 0);
  expect(partial?.fg, 'partial uses fill fg').toBe(defaultTheme.progressFill.fg);
  const track = buf.get(9, 0);
  expect(track?.fg, 'track fg').toBe(defaultTheme.progressTrack.fg);
  expect(track?.bg, 'track bg').toBe(defaultTheme.progressTrack.bg);
});

// ST-3 / AC-3 — Unicode-off caps: whole-cell #/- fill, distinct chars, no partials, no throw.
test('ST-3: asciiOnly caps render whole-cell # fill and - track (no partials)', () => {
  const { buf, row } = render(0.5, 10, 1, { caps: asciiCaps });
  for (let x = 0; x < 5; x += 1) expect(buf.get(x, 0)?.char, `x${x} #`).toBe('#');
  for (let x = 5; x < 10; x += 1) expect(buf.get(x, 0)?.char, `x${x} -`).toBe('-');
  // No sub-cell partials and no full-block glyph leaked into the ASCII branch.
  expect(
    [...row(0)].some((c) => c === FULL || PARTIAL.includes(c as never)),
    'no block glyphs',
  ).toBe(false);
});

// ST-4 / AC-4 (PA-12, knockout supersedes the staticText draft) — optional centred NN% caption that
// reads ON the bar: each digit's bg matches what it sits on (fill colour where the fill has swept over
// it, the track's bg where it hasn't) and the fg inverts for contrast. No contrasting staticText box.
test('ST-4: caption:true draws a centred knockout NN%; off by default; clamped; contrasts at the fill edge', () => {
  // Present when on, absent by default, percent clamped 0..100.
  expect(render(0.45, 10, 1, { caption: true }).row(0).includes('45%'), 'centred 45% present').toBe(true);
  expect(render(0.45, 10, 1).row(0).includes('45%'), 'no caption by default').toBe(false);
  expect(render(2, 10, 1, { caption: true }).bar.percent).toBe(100);
  expect(render(-1, 10, 1, { caption: true }).bar.percent).toBe(0);

  // v=0.5,w=10 → '50%' centred at cols 3..5; the fill boundary is 5 cells, so '5','0' sit over the
  // fill and '%' sits over the track — the knockout must colour them differently.
  const { buf } = render(0.5, 10, 1, { caption: true });
  const overFill = buf.get(3, 0); // '5' — over the fill → inverse video (fill bg/fg swapped)
  expect(overFill?.char).toBe('5');
  expect(overFill?.fg, 'over-fill digit fg = fill bg').toBe(defaultTheme.progressFill.bg);
  expect(overFill?.bg, 'over-fill digit bg = fill fg').toBe(defaultTheme.progressFill.fg);
  const overTrack = buf.get(5, 0); // '%' — over the track → bright fg on the track background
  expect(overTrack?.char).toBe('%');
  expect(overTrack?.fg, 'over-track digit fg = fill fg (bright)').toBe(defaultTheme.progressFill.fg);
  expect(overTrack?.bg, 'over-track digit bg = track bg').toBe(defaultTheme.progressTrack.bg);
  // The defect is gone: no caption cell carries the staticText box background.
  for (let x = 0; x < 10; x += 1) {
    expect(buf.get(x, 0)?.bg, `x${x} is not the old staticText box`).not.toBe(defaultTheme.staticText.bg);
  }
});

// ST-4 — tiny width: the caption is width-clipped, never overruns.
test('ST-4: a caption at a tiny width is clipped, never overruns the view', () => {
  const { buf } = render(0.5, 3, 1, { caption: true });
  expect(buf.get(3, 0), 'nothing painted past the view width').toBeUndefined();
});

// ST-17 (bugfix, user-reported) — the visual fill agrees with the rounded percent at the boundaries:
// a value that rounds to 100% fills the LAST cell (no lingering partial); a value that rounds to 0% is
// completely empty. Between the boundaries the smooth sub-cell fill is unchanged.
test('ST-17: fill agrees with the rounded percent — 100% fills the last cell, 0% is empty', () => {
  // v=0.996 → round(99.6)=100%, but round(v·20·8)=1594/... would leave a ▉ partial without the snap.
  const near = render(0.996, 20, 1);
  expect(near.bar.percent, 'reads 100%').toBe(100);
  for (let x = 0; x < 20; x += 1) expect(near.buf.get(x, 0)?.char, `x${x} full (no partial last cell)`).toBe(FULL);
  // v=0.004 → round(0.4)=0% → completely empty (no leading sliver).
  const bare = render(0.004, 20, 1);
  expect(bare.bar.percent, 'reads 0%').toBe(0);
  for (let x = 0; x < 20; x += 1) expect(bare.buf.get(x, 0)?.char, `x${x} empty track`).toBe(TRACK);
});

// ST-5 / AC-5 + ST-14 — value bounds: NaN/-1 → 0 filled; 2/Infinity → all; never OOB / overruns width.
test('ST-5: value clamps — NaN/-1 → empty, 2/Infinity → full; never exceeds width', () => {
  const fullCount = (s: string) => [...s].filter((c) => c === FULL).length;
  expect(fullCount(render(NaN, 10, 1).row(0)), 'NaN → 0 filled').toBe(0);
  expect(fullCount(render(-1, 10, 1).row(0)), '-1 → 0 filled').toBe(0);
  expect(fullCount(render(2, 10, 1).row(0)), '2 → all filled').toBe(10);
  expect(fullCount(render(Infinity, 10, 1).row(0)), 'Infinity → all filled').toBe(10);
  // Never writes past the view width (no OOB).
  expect(render(2, 10, 1).buf.get(10, 0), 'nothing at x=10').toBeUndefined();
});

// ST-15 / PA-13 — a top label occupies row 0; the bar drops to row 1 (two rows). `top` centres it,
// `top-left` sets it flush-left.
test('ST-15: a top label occupies row 0 and the bar drops to row 1', () => {
  const { row } = render(0.5, 12, 2, { label: 'Copy', labelPosition: 'top-left' });
  expect(row(0).startsWith('Copy'), 'top-left label flush-left on row 0').toBe(true);
  expect(
    [...row(0)].some((c) => c === FULL || c === TRACK),
    'no bar glyphs on the label row',
  ).toBe(false);
  expect(
    [...row(1)].some((c) => c === FULL || c === TRACK),
    'the bar renders on row 1',
  ).toBe(true);
  const centred = render(0.5, 12, 2, { label: 'Copy', labelPosition: 'top' });
  expect(centred.row(0).includes('Copy'), 'centred label present').toBe(true);
  expect(centred.row(0).startsWith('Copy'), 'centred, not flush-left').toBe(false);
});

// ST-15 — a top label with only one row of space: the bar wins (a top label needs a second row).
test('ST-15: a top label at height 1 yields the single row to the bar', () => {
  const { row } = render(1, 10, 1, { label: 'x', labelPosition: 'top' });
  expect(
    [...row(0)].every((c) => c === FULL),
    'full bar occupies the single row',
  ).toBe(true);
});

// ST-16 / PA-13 — `left`/`right` labels reserve columns beside the bar on the same row; the bar shrinks.
test('ST-16: a left label reserves leading columns; a right label reserves trailing columns', () => {
  const left = render(1, 12, 1, { label: 'AB', labelPosition: 'left' });
  expect(left.buf.get(0, 0)?.char, 'label at the start').toBe('A');
  expect(left.buf.get(3, 0)?.char, 'bar begins after label + 1-col gap').toBe(FULL);
  const right = render(1, 12, 1, { label: 'AB', labelPosition: 'right' });
  expect(right.buf.get(0, 0)?.char, 'bar begins at x=0').toBe(FULL);
  expect(right.row(0).endsWith('AB'), 'label at the trailing columns').toBe(true);
});

// ST-16 — measure(): a top label advertises 2 rows; otherwise 1; width fills the available track.
test('ST-16: measure() reports 2 rows for a top label, 1 otherwise, filling width', () => {
  const top = new ProgressBar({ value: signal(0.5), label: 'x', labelPosition: 'top' });
  expect(top.measure?.({ width: 20, height: 10 })).toEqual({ width: 20, height: 2 });
  const side = new ProgressBar({ value: signal(0.5), label: 'x', labelPosition: 'left' });
  expect(side.measure?.({ width: 20, height: 10 })).toEqual({ width: 20, height: 1 });
  const none = new ProgressBar({ value: signal(0.5) });
  expect(none.measure?.({ width: 20, height: 10 })).toEqual({ width: 20, height: 1 });
});
