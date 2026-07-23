/**
 * Implementation tests (edges/internals) — jsvision-ui RD-21 `ColorSwatch` (written AFTER impl).
 *
 * Covers cursor init/re-home, `select()`/`onChange`, the near-black marker style on a custom palette,
 * drag revert-vs-clamp internals, `measure()`, and the **GATE-2 glyph-width guard** (PF-005): both `█`
 * and `◘` measure width 1 under the swatch's default `wcwidth` mode, so the 3-wide cell math and the
 * centered `◘` at `cellX+1` hold. The `.js` extension in import specifiers is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme, PALETTE, charWidth } from '@jsvision/core';
import type { Color } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { ColorSwatch } from '../src/color/color-swatch.js';
import { gridDims } from '../src/color/color-grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface H {
  swatch: ColorSwatch;
  loop: ReturnType<typeof createEventLoop>;
  value: Signal<Color>;
  changes: Color[]; // commit callback (onChange)
  inputs: Color[]; // live callback (onInput)
  cell: (x: number, y: number) => { char: string; fg: string; bg: string } | undefined;
  markers: () => { x: number; y: number }[];
}
function make(opts: { value?: Color; colors?: readonly Color[]; columns?: number; focus?: boolean } = {}): H {
  const colors = opts.colors ?? ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
  const columns = opts.columns ?? 4;
  const value = signal<Color>(opts.value ?? colors[0]);
  const changes: Color[] = [];
  const inputs: Color[] = [];
  const swatch = new ColorSwatch({
    value,
    colors,
    columns,
    onInput: (c) => inputs.push(c),
    onChange: (c) => changes.push(c),
  });
  const { width, rows } = gridDims(colors.length, columns);
  const h = Math.max(1, rows);
  swatch.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height: h } });
  const root = new Group();
  root.add(swatch);
  const loop = createEventLoop({ width, height: h }, { caps });
  loop.mount(root);
  if (opts.focus) loop.focusView(swatch);
  loop.renderRoot.flush();
  const cell = (x: number, y: number) => {
    const c = loop.renderRoot.buffer().get(x, y);
    return c ? { char: c.char, fg: c.fg, bg: c.bg } : undefined;
  };
  const markers = () => {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < h; y += 1) for (let x = 0; x < width; x += 1) if (cell(x, y)?.char === '◘') out.push({ x, y });
    return out;
  };
  return { swatch, loop, value, changes, inputs, cell, markers };
}
const key = (k: string) => ({ type: 'key' as const, key: k, ctrl: false, alt: false, shift: false });

// ── GATE-2 glyph-width guard (PF-005) ──────────────────────────────────────────────────────────────

test('GATE-2: both █ (U+2588) and ◘ (U+25D8) measure width 1 under wcwidth', () => {
  expect(charWidth('█'.codePointAt(0)!, 'wcwidth'), '█ width 1').toBe(1);
  expect(charWidth('◘'.codePointAt(0)!, 'wcwidth'), '◘ width 1').toBe(1);
});

// ── cursor init / re-home ──────────────────────────────────────────────────────────────────────────

test('cursor inits to indexOf(value) when the value is a member', () => {
  const h = make({ value: 'green', focus: true }); // cursor = 2
  h.loop.dispatch(key('right')); // → 3
  h.loop.dispatch(key('enter'));
  expect(h.value(), 'commit from the value-derived cursor').toBe('yellow');
});

test('an off-palette value leaves the cursor where it is (re-home only on a member)', () => {
  const h = make({ value: 'green', focus: true }); // cursor = 2
  h.value.set('#abcdef'); // ∉ colors → cursor stays 2
  h.loop.renderRoot.flush();
  h.loop.dispatch(key('right')); // → 3
  h.loop.dispatch(key('enter'));
  expect(h.value(), 'cursor stayed at 2 despite the off-palette set → committed yellow').toBe('yellow');
});

// ── select() / onInput / onChange ─────────────────────────────────────────────────────────────────

test('select() drives the value + fires both onInput (live) and onChange (commit)', () => {
  const h = make({ value: 'red' });
  h.swatch.select('blue');
  expect(h.value()).toBe('blue');
  expect(h.inputs.at(-1)).toBe('blue');
  expect(h.changes.at(-1)).toBe('blue');
});

// ── IT-2: the live/commit split under the pointer ───────────────────────────────────────────────────

test('IT-2: a drag across cells fires onInput per cell; onChange fires once, only on the release', () => {
  const h = make({ value: 'black', columns: 4, focus: true }); // 8 colors, cursor 0
  // Press cell 0, drag through cell 1 (red) to cell 2 (green), release over cell 2. Row 0: cols 0-2 / 3-5 / 6-8.
  h.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 1, y: 1 }); // cell 0 (black)
  h.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, x: 4, y: 1 }); // cell 1 (red)
  h.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, x: 7, y: 1 }); // cell 2 (green)
  expect(h.changes, 'no commit fires during the drag — only live previews').toEqual([]);
  expect(h.inputs, 'each cell under the pointer fired a live onInput').toContain('red');
  expect(h.inputs.at(-1), 'the last live preview is the cell under the pointer (green)').toBe('green');
  h.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, x: 7, y: 1 }); // release over cell 2
  expect(h.changes, 'the release fires onChange exactly once, with the committed color').toEqual(['green']);
  expect(h.value(), 'value committed to green').toBe('green');
});

test('IT-2: a mouse-up over a cell fires onChange once (a single click-commit)', () => {
  const h = make({ value: 'black', columns: 4, focus: true });
  h.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 4, y: 1 }); // cell 1 (red)
  h.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, x: 4, y: 1 });
  expect(h.changes, 'onChange fired exactly once on the release').toEqual(['red']);
});

// ── near-black marker on a custom palette ────────────────────────────────────────────────────────

test('a near-black member value draws its ◘ in the colorMarker role', () => {
  const h = make({ colors: ['#010101', 'red'], columns: 2, value: '#010101' });
  // cell 0 at cols 0-2, centre col 1.
  expect(h.cell(1, 0)?.char, 'marker present on the near-black cell').toBe('◘');
  expect(h.cell(1, 0)?.bg, 'forced-contrast colorMarker bg').toBe(defaultTheme.colorMarker.bg);
});

test('a bright member value draws its ◘ in the cell color (bg = black)', () => {
  const h = make({ colors: ['#010101', 'white'], columns: 2, value: 'white' });
  // cell 1 at cols 3-5, centre col 4.
  expect(h.cell(4, 0)?.char).toBe('◘');
  expect(h.cell(4, 0)?.fg, 'bright marker uses the cell color').toBe('white');
  expect(h.cell(4, 0)?.bg).toBe(PALETTE.black);
});

// ── drag revert vs clamp internals ────────────────────────────────────────────────────────────────

test('a drag that re-enters the grid after leaving tracks the final in-grid cell', () => {
  const h = make({ value: 'red', columns: 4, focus: true }); // cursor 1
  h.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 1, y: 1 }); // cell 0
  h.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, x: 30, y: 1 }); // outside → revert to pre (1)
  h.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, x: 7, y: 1 }); // back in → local (6,0) → cell 2
  h.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, x: 7, y: 1 });
  h.loop.dispatch(key('enter'));
  expect(h.value(), 'final in-grid cell 2 = green').toBe('green');
});

// ── measure() ────────────────────────────────────────────────────────────────────────────────────

test('measure() advertises the grid width × row count', () => {
  const value = signal<Color>('red');
  const sw = new ColorSwatch({ value, colors: ['a', 'b', 'c', 'd', 'e'] as unknown as Color[], columns: 4 });
  expect(sw.measure()).toStrictEqual({ width: 12, height: 2 }); // 5 colors × 4 → 2 rows
});
