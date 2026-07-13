/**
 * Implementation tests — `Spinner` internals & edges (RD-18, 07 §impl). Beyond the ST oracles:
 * negative-safe mod over large negatives, preset code-point identity, empty/undefined + reactive
 * label handling, and the full preset-swap matrix ({dots,line,blocks} × asciiOnly∈{T,F}). `.js` per
 * NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Spinner, SPINNERS } from '../src/feedback/index.js';
import type { SpinnerName } from '../src/feedback/index.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true } },
}).profile;
const asciiCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: false } },
}).profile;

function render(
  frameVal: number,
  opts?: { preset?: SpinnerName; label?: string | (() => string); caps?: typeof caps },
) {
  const f = signal(frameVal);
  const sp = new Spinner({ frame: f, preset: opts?.preset, label: opts?.label });
  sp.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 1 } };
  const root = new Group();
  root.add(sp);
  const loop = createEventLoop({ width: 20, height: 1 }, { caps: opts?.caps ?? caps });
  loop.mount(root);
  const buf = loop.renderRoot.buffer();
  return {
    buf,
    f,
    loop,
    row: () =>
      buf
        .rows()[0]
        .map((c) => c.char)
        .join(''),
  };
}

test('negative-safe mod maps large negatives/positives into 0..n-1 (dots, n=10)', () => {
  const at = (f: number) => render(f).buf.get(0, 0)?.char;
  const idx = (f: number) => ((f % 10) + 10) % 10;
  for (const f of [-1, -9, -10, -13, -100, 0, 9, 10, 23, 137]) {
    expect(at(f), `frame ${f}`).toBe(SPINNERS.dots[idx(f)]);
  }
});

test('preset code-point identity: exact lengths + boundary code points (frozen)', () => {
  expect(SPINNERS.dots.length).toBe(10);
  expect(SPINNERS.line.length).toBe(4);
  expect(SPINNERS.blocks.length).toBe(8);
  expect(SPINNERS.dots[0].codePointAt(0)).toBe(0x280b); // ⠋
  expect(SPINNERS.blocks[0].codePointAt(0)).toBe(0x258f); // ▏
  expect(SPINNERS.blocks[7].codePointAt(0)).toBe(0x2588); // █
  expect(SPINNERS.line.join('')).toBe('|/-\\');
});

test('blocks ping-pongs (grows then shrinks) instead of looping back to the sliver', () => {
  const B = SPINNERS.blocks; // ▏▎▍▌▋▊▉█ — the glyph vocabulary is unchanged; only the order animates
  const at = (f: number) => render(f, { preset: 'blocks' }).buf.get(0, 0)?.char;
  // Triangle-wave index sequence over the 14-frame period (endpoints once, interior frames twice).
  const expectedIdx = [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0, 1];
  expectedIdx.forEach((idx, f) => expect(at(f), `frame ${f}`).toBe(B[idx]));
  // The peak never snaps straight back to the thin sliver — it reverses.
  expect(at(7), 'peak is the full block').toBe(B[7]); // █
  expect(at(8), 'frame after the peak steps back down, not restarts').toBe(B[6]); // ▉, not ▏
  // Negative-safe: -1 mirrors onto the second glyph (one step in on the way up).
  expect(at(-1), 'frame -1').toBe(B[1]); // ▎

  // Rotating presets are unaffected — dots still loops straight through its cycle.
  const dotsAt = (f: number) => render(f, { preset: 'dots' }).buf.get(0, 0)?.char;
  expect(dotsAt(SPINNERS.dots.length), 'dots wraps to frame 0, no bounce').toBe(SPINNERS.dots[0]);
});

test('empty/undefined label → glyph only (nothing painted at the label column)', () => {
  expect(render(0).buf.get(2, 0)?.char, 'no label option → col 2 blank').not.toBe('L');
  expect(render(0, { label: '' }).buf.get(2, 0)?.char, 'empty label → col 2 blank').not.toBe('L');
  // A real label does paint at column 2 (control).
  expect(render(0, { label: 'L' }).buf.get(2, 0)?.char).toBe('L');
});

test('reactive-getter label repaints when its signal changes', () => {
  const txt = signal('one');
  const { loop, buf } = render(0, { label: () => txt() });
  expect(buf.get(2, 0)?.char, 'initial label').toBe('o');
  txt.set('two');
  loop.renderRoot.flush();
  expect(loop.renderRoot.buffer().get(2, 0)?.char, 'repainted label').toBe('t');
});

test('preset-swap matrix: {dots,line,blocks} × asciiOnly∈{true,false}', () => {
  const presets: SpinnerName[] = ['dots', 'line', 'blocks'];
  for (const preset of presets) {
    // Full caps: the preset renders its own frame 0.
    expect(render(0, { preset }).buf.get(0, 0)?.char, `${preset} full-caps`).toBe(SPINNERS[preset][0]);
    // asciiOnly caps: non-`line` presets swap to line, `line` is unchanged — all yield line[0].
    expect(render(0, { preset, caps: asciiCaps }).buf.get(0, 0)?.char, `${preset} ascii-caps → line`).toBe(
      SPINNERS.line[0],
    );
  }
});
