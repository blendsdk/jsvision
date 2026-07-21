/**
 * Specification tests (immutable oracles) — RD-18 `Spinner` (03-02, 07 ST-6…ST-9 + ST-14 spinner part).
 *
 * RD-18 has NO Turbo Vision counterpart (GATE-1, AR-186); the spinner is a documented new component.
 * These oracles derive from AC-6…AC-9 + AC-14 and the 03-02 decode: caller-driven `frame` reduced by
 * a negative-safe mod into 0..n-1; frozen `SPINNERS` presets (dots braille / line ASCII / blocks
 * eighth-blocks); under asciiOnly caps any non-`line` preset swaps to `line` (animation preserved);
 * an optional label at column 2 in the `label` role, sanitized + width-clipped. Rendered the shipped
 * way (createEventLoop + mount). `.js` in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Spinner, SPINNERS } from '../src/feedback/index.js';
import type { SpinnerName } from '../src/feedback/index.js';

// Full-Unicode caps (braille + block presets render as-is).
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true } },
}).profile;
// Unicode-off caps → non-`line` presets fall back to `line`.
const asciiCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: false } },
}).profile;

const DOTS = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const; // U+280B…, n=10
const LINE = ['|', '/', '-', '\\'] as const;
const BLOCKS = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█'] as const; // U+258F…U+2588

/** Mount a Spinner at w×h under the given caps; return the composed buffer + a row string. */
function render(
  frameVal: number,
  opts?: { preset?: SpinnerName; label?: string | (() => string); caps?: typeof caps; w?: number; h?: number },
) {
  const f = signal(frameVal);
  const sp = new Spinner({ frame: f, preset: opts?.preset, label: opts?.label });
  const w = opts?.w ?? 20;
  const h = opts?.h ?? 1;
  sp.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } });
  const root = new Group();
  root.add(sp);
  const loop = createEventLoop({ width: w, height: h }, { caps: opts?.caps ?? caps });
  loop.mount(root);
  const buf = loop.renderRoot.buffer();
  const row = (y: number) =>
    buf
      .rows()
      [y].map((c) => c.char)
      .join('');
  return { buf, row, sp, f, loop };
}

// ST-6 / AC-6 — default `dots`, negative-safe mod maps any frame into 0..n-1.
test('ST-6: default dots; frame 0→⠋, 1→⠙, 10→⠋ (mod 10), -1→⠏ (negative-safe)', () => {
  expect(render(0).buf.get(0, 0)?.char, 'frame 0').toBe(DOTS[0]);
  expect(render(1).buf.get(0, 0)?.char, 'frame 1').toBe(DOTS[1]);
  expect(render(10).buf.get(0, 0)?.char, 'frame 10 == 0 mod 10').toBe(DOTS[0]);
  expect(render(-1).buf.get(0, 0)?.char, 'frame -1 → last (⠏)').toBe(DOTS[9]);
});

// ST-7 / AC-7 — SPINNERS presets: exact code points, default dots, deeply frozen.
test('ST-7: SPINNERS presets are the pinned frozen arrays; default is dots', () => {
  expect([...SPINNERS.dots]).toEqual([...DOTS]);
  expect([...SPINNERS.line]).toEqual([...LINE]);
  expect([...SPINNERS.blocks]).toEqual([...BLOCKS]);
  // Default preset (no `preset` option) renders dots.
  expect(render(0).buf.get(0, 0)?.char, 'no preset → dots').toBe(DOTS[0]);
  // Deeply frozen: the map and each preset array.
  expect(Object.isFrozen(SPINNERS), 'SPINNERS frozen').toBe(true);
  expect(Object.isFrozen(SPINNERS.dots), 'dots frozen').toBe(true);
  expect(Object.isFrozen(SPINNERS.line), 'line frozen').toBe(true);
  expect(Object.isFrozen(SPINNERS.blocks), 'blocks frozen').toBe(true);
});

// ST-8 / AC-8 — asciiOnly caps: any non-`line` preset renders `line`; animation preserved; no throw.
test('ST-8: under asciiOnly caps, dots/blocks fall back to line; line unchanged; still animates', () => {
  expect(render(0, { preset: 'dots', caps: asciiCaps }).buf.get(0, 0)?.char, 'dots→line[0]').toBe(LINE[0]);
  expect(render(0, { preset: 'blocks', caps: asciiCaps }).buf.get(0, 0)?.char, 'blocks→line[0]').toBe(LINE[0]);
  expect(render(0, { preset: 'line', caps: asciiCaps }).buf.get(0, 0)?.char, 'line unchanged').toBe(LINE[0]);
  // Advancing the frame still animates (a different glyph), never a frozen static glyph.
  expect(render(1, { preset: 'dots', caps: asciiCaps }).buf.get(0, 0)?.char, 'dots→line[1]').toBe(LINE[1]);
});

// ST-9 / AC-9 + ST-14 — label at column 2 in the label role, right of the glyph; clipped; sanitized.
test('ST-9: label draws at column 2 in the label role; long label clipped; escapes sanitized', () => {
  const { buf } = render(0, { label: 'Loading…' });
  expect(buf.get(0, 0)?.char, 'glyph at col 0').toBe(DOTS[0]);
  expect(buf.get(2, 0)?.char, 'label starts at col 2 (gap of 1)').toBe('L');
  expect(buf.get(2, 0)?.fg, 'label in the label role').toBe(defaultTheme.label.fg);
  // A label longer than the view is clipped, never overruns.
  const narrow = render(0, { label: 'a very long label that exceeds width', w: 8 });
  expect(narrow.buf.get(8, 0), 'nothing painted past the view width').toBeUndefined();
  // An escape-bearing label is sanitized — no raw ESC in the composed buffer.
  const evil = render(0, { label: '\x1b[31mX' });
  expect(evil.row(0).includes('\x1b'), 'no raw ESC leaks into the buffer').toBe(false);
});
