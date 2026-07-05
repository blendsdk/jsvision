/**
 * Implementation tests — jsvision-ui RD-19 `SurfaceView` internals + the **GATE-2 executable diff** vs
 * `tsurface.cpp:93-141`: the direct-copy `clip==extent` case, the top/bottom + left/right margin bands,
 * the negative-delta inset, and the null surface — re-verified cell-by-cell (no mismatch, see the
 * `surface-view.ts` JSDoc). Plus wide-glyph blit + straddle-drop (PA-11), `scrollTo`/`panBy` clamp,
 * `onScroll` change-only, and the surface-swap-on-resize buffer re-read (PA-10). `.js` specifiers required.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { Style } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Surface } from '../src/surface/surface.js';
import { SurfaceView } from '../src/surface/surface-view.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const EMPTY_FG = defaultTheme.windowInactive.fg;
const EMPTY_BG = defaultTheme.windowInactive.bg;
const S: Style = { fg: 'white', bg: 'black' };

interface Point {
  x: number;
  y: number;
}

function makeView(opts: {
  surface: Surface | null;
  vw: number;
  vh: number;
  delta?: Point;
  onScroll?: (d: Point) => void;
}): {
  view: SurfaceView;
  delta: Signal<Point>;
  flush: () => void;
  cell: (x: number, y: number) => { char: string; fg: string; bg: string; width: number } | undefined;
} {
  const delta = signal<Point>(opts.delta ?? { x: 0, y: 0 });
  const view = new SurfaceView({ surface: opts.surface, delta, onScroll: opts.onScroll });
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: opts.vw, height: opts.vh } };
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width: opts.vw, height: opts.vh }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  const cell = (x: number, y: number) => {
    const c = loop.renderRoot.buffer().get(x, y);
    return c ? { char: c.char, fg: c.fg as string, bg: c.bg as string, width: c.width } : undefined;
  };
  return { view, delta, flush: () => loop.renderRoot.flush(), cell };
}

// ── GATE-2 executable diff (cell-by-cell vs tsurface.cpp) ────────────────────────────────────────

test('GATE-2: direct-copy clip==extent maps view(vx,vy) → surface(delta+vx, delta+vy) (:112-115)', () => {
  const s = Surface.from(['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST']);
  const { cell } = makeView({ surface: s, vw: 3, vh: 2, delta: { x: 2, y: 1 } });
  // first visible cell = surface(max(2,0), max(1,0)) = surface(2,1) = 'H'
  expect(cell(0, 0)?.char).toBe('H');
  expect(cell(2, 1)?.char).toBe('O'); // surface(4,2)
});

test('GATE-2: side bands — a narrow surface centred by negative delta leaves cEmpty margins (:123-132)', () => {
  const s = Surface.from(['xy']); // 2×1
  const { cell } = makeView({ surface: s, vw: 4, vh: 1, delta: { x: -1, y: 0 } });
  // clip {1,0,2,1}: left col 0 empty, surface at cols 1-2, right col 3 empty.
  expect(cell(0, 0)).toEqual({ char: ' ', fg: EMPTY_FG, bg: EMPTY_BG, width: 1 });
  expect(cell(1, 0)?.char).toBe('x');
  expect(cell(2, 0)?.char).toBe('y');
  expect(cell(3, 0)).toEqual({ char: ' ', fg: EMPTY_FG, bg: EMPTY_BG, width: 1 });
});

// ── Wide-glyph blit + straddle-drop (PA-11) ──────────────────────────────────────────────────────

test('wide-glyph blit — a lead occupies 2 view cells; the continuation is skipped', () => {
  const s = new Surface({ size: { x: 4, y: 1 } });
  s.getDrawContext().text(0, 0, '中', S);
  const { cell } = makeView({ surface: s, vw: 4, vh: 1 });
  expect(cell(0, 0)?.char).toBe('中');
  expect(cell(0, 0)?.width).toBe(2);
  expect(cell(1, 0)?.width).toBe(0); // continuation
});

test('wide-glyph straddle — a wide glyph at the view right edge is dropped whole (never a half-cell)', () => {
  const s = new Surface({ size: { x: 3, y: 1 } });
  s.set(0, 0, 'A', S);
  s.getDrawContext().text(1, 0, '中', S); // wide lead at surface col 1
  const { cell } = makeView({ surface: s, vw: 2, vh: 1 }); // view width 2: the wide glyph at view col 1 can't fit
  expect(cell(0, 0)?.char).toBe('A');
  expect(cell(1, 0)?.char).not.toBe('中'); // dropped whole
  expect(cell(1, 0)?.width).not.toBe(2);
});

// ── scrollTo / panBy clamp (PA-9) ────────────────────────────────────────────────────────────────

test('scrollTo clamps the offset to [0, surface − view]', () => {
  const s = Surface.from(['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST']); // 5×4
  const h = makeView({ surface: s, vw: 3, vh: 2 });
  h.view.scrollTo({ x: 99, y: 99 });
  expect(h.delta()).toEqual({ x: 2, y: 2 }); // maxX = 5-3, maxY = 4-2
  h.view.scrollTo({ x: -5, y: -5 });
  expect(h.delta()).toEqual({ x: 0, y: 0 });
});

test('panBy accumulates from the current offset, clamped', () => {
  const s = Surface.from(['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST']);
  const h = makeView({ surface: s, vw: 3, vh: 2, delta: { x: 1, y: 0 } });
  h.view.panBy(1, 1);
  expect(h.delta()).toEqual({ x: 2, y: 1 });
  h.view.panBy(5, 5); // clamps at the far edge
  expect(h.delta()).toEqual({ x: 2, y: 2 });
});

// ── onScroll change-only (PA-9) ──────────────────────────────────────────────────────────────────

test('onScroll fires on a real delta change only — not on init, not on a same-coordinate set', () => {
  const scrolls: Point[] = [];
  const h = makeView({
    surface: Surface.from(['abcd', 'efgh']),
    vw: 2,
    vh: 2,
    onScroll: (d) => scrolls.push({ ...d }),
  });
  expect(scrolls).toEqual([]); // initial run skipped
  h.delta.set({ x: 1, y: 0 });
  expect(scrolls).toEqual([{ x: 1, y: 0 }]);
  h.delta.set({ x: 1, y: 0 }); // new object, same coordinates → no fire
  expect(scrolls).toEqual([{ x: 1, y: 0 }]);
  h.delta.set({ x: 1, y: 1 });
  expect(scrolls).toEqual([
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]);
});

// ── surface swap on resize re-reads the buffer (PA-10) ───────────────────────────────────────────

test('after surface.resize (buffer swapped) the view reads the NEW buffer', () => {
  const s = Surface.from(['abc', 'def']);
  const h = makeView({ surface: s, vw: 3, vh: 2 });
  expect(h.cell(0, 0)?.char).toBe('a');
  s.resize({ x: 5, y: 4 }); // swaps the internal ScreenBuffer; version bumps → repaint
  h.flush();
  expect(h.cell(0, 0)?.char).toBe('a'); // overlap preserved, read from the new buffer
  s.set(0, 0, 'Z', S); // write to the NEW buffer
  h.flush();
  expect(h.cell(0, 0)?.char).toBe('Z'); // proves the view is not holding a stale buffer reference
});

// ── null / degenerate hardening ──────────────────────────────────────────────────────────────────

test('a null surface renders the whole view as windowInactive spaces and never throws', () => {
  const h = makeView({ surface: null, vw: 3, vh: 3 });
  for (let y = 0; y < 3; y += 1)
    for (let x = 0; x < 3; x += 1) expect(h.cell(x, y)).toEqual({ char: ' ', fg: EMPTY_FG, bg: EMPTY_BG, width: 1 });
});
