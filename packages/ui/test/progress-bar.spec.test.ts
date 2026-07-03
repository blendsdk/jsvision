/**
 * Specification tests (immutable oracles) — RD-18 `ProgressBar` (03-01, 07 ST-1…ST-5 + ST-14 bar part).
 *
 * RD-18 has NO Turbo Vision counterpart (GATE-1, AR-186); the bar is a documented new component whose
 * pieces are grounded in Unicode Block Elements + the caps-driven ASCII fallback + the `progress*`
 * extension colours. These oracles derive from AC-1…AC-5 + AC-14 and the 03-01 draw algorithm:
 *   e = round(v·w·8); full = floor(e/8); part = e % 8  →  full×█(U+2588), one PARTIAL[part]
 *   (U+258F…U+2589) when part∈1..7, then ░(U+2591) track; ASCII caps → whole-cell #/- (no partials);
 *   optional centred ` NN% ` caption in staticText; value clamped (NaN/±∞/OOB → 0/1).
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
function render(value: number, w: number, h: number, opts?: { caption?: boolean; caps?: typeof caps }) {
  const v = signal(value);
  const bar = new ProgressBar({ value: v, caption: opts?.caption });
  bar.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
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

// ST-4 / AC-4 — optional centred percent caption over the bar, in staticText; clamped 0..100.
test('ST-4: caption:true draws a centred NN% in staticText; omitted → none; clamped', () => {
  const { row } = render(0.45, 10, 1, { caption: true });
  expect(row(0).includes('45%'), 'centred 45% caption present').toBe(true);
  // Off by default.
  const plain = render(0.45, 10, 1);
  expect(plain.row(0).includes('45%'), 'no caption by default').toBe(false);
  // percent is clamped to 0..100.
  expect(render(2, 10, 1, { caption: true }).bar.percent).toBe(100);
  expect(render(-1, 10, 1, { caption: true }).bar.percent).toBe(0);
});

// ST-4 — tiny width: the caption is width-clipped, never overruns.
test('ST-4: a caption at a tiny width is clipped, never overruns the view', () => {
  const { buf } = render(0.5, 3, 1, { caption: true });
  expect(buf.get(3, 0), 'nothing painted past the view width').toBeUndefined();
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
