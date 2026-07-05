/**
 * Specification tests (immutable oracles) — jsvision-ui RD-19 `SurfaceView` (ST-3…ST-6/ST-8/ST-9/ST-10/
 * ST-13). The draw is a **faithful decode** of `TSurfaceView::draw()` (`source/tvision/tsurface.cpp:
 * 93-141`, GATE-1): the `delta`-offset clip `TRect(0,0,surface.size).move(-delta).intersect(viewExtent)`
 * (`:105-107`), the direct-copy `clip==extent` case (`:112-115`), the top/bottom + side margin bands
 * filled with `mapColor(1)` → **`windowInactive`** spaces (`:118-132`), and the null-surface whole-view
 * fill (`:136-140`). Extensions (spec oracles, no `.cpp` diff): the fully-outside all-empty fill (PA-3),
 * reactive pan/content repaint (AC-5/6), passivity + `ScrollBar` composition (AC-8).
 *
 * Rendered the shipped way (createEventLoop + mount, the color-swatch.spec idiom); the pre-`serialize`
 * buffer is asserted cell-by-cell. Per the immutable-oracle + TV-fidelity rules a failing oracle means
 * the CODE is wrong (and for the draw geometry, wrong vs `tsurface.cpp`). `.js` specifiers required.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal, effect, createRoot } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { Surface } from '../src/surface/surface.js';
import { SurfaceView } from '../src/surface/surface-view.js';
import { ScrollBar } from '../src/scroll/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const EMPTY_FG = defaultTheme.windowInactive.fg;
const EMPTY_BG = defaultTheme.windowInactive.bg;

interface Point {
  x: number;
  y: number;
}

interface ViewHarness {
  view: SurfaceView;
  delta: Signal<Point>;
  loop: ReturnType<typeof createEventLoop>;
  flush: () => void;
  cell: (x: number, y: number) => { char: string; fg: string; bg: string } | undefined;
}

function makeView(opts: {
  surface: Surface | null;
  vw: number;
  vh: number;
  delta?: Point;
  onScroll?: (d: Point) => void;
}): ViewHarness {
  const delta = signal<Point>(opts.delta ?? { x: 0, y: 0 });
  const view = new SurfaceView({ surface: opts.surface, delta, onScroll: opts.onScroll });
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: opts.vw, height: opts.vh } };
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width: opts.vw, height: opts.vh }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  const buffer = () => loop.renderRoot.buffer();
  const cell = (x: number, y: number) => {
    const c = buffer().get(x, y);
    return c ? { char: c.char, fg: c.fg as string, bg: c.bg as string } : undefined;
  };
  return { view, delta, loop, flush: () => loop.renderRoot.flush(), cell };
}

/** A 5×4 surface whose cell (x,y) holds a distinct letter, so the blit mapping is verifiable. */
function letterSurface(): Surface {
  return Surface.from(['ABCDE', 'FGHIJ', 'KLMNO', 'PQRST']);
}

function keyEvent(key: string): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false };
}

function expectEmpty(cell: { char: string; fg: string; bg: string } | undefined): void {
  expect(cell?.char).toBe(' ');
  expect(cell?.fg).toBe(EMPTY_FG);
  expect(cell?.bg).toBe(EMPTY_BG);
}

// ── ST-3 — faithful blit geometry (cell-by-cell vs tsurface.cpp:93-141) ──────────────────────────

test('ST-3: surface fills the view exactly (clip == extent, direct copy :112-115)', () => {
  // 5×4 surface, delta {1,1}, 3×2 view → view(vx,vy) = surface(1+vx, 1+vy), no margins.
  const { cell } = makeView({ surface: letterSurface(), vw: 3, vh: 2, delta: { x: 1, y: 1 } });
  expect(cell(0, 0)?.char).toBe('G'); // surface (1,1)
  expect(cell(1, 0)?.char).toBe('H');
  expect(cell(2, 0)?.char).toBe('I');
  expect(cell(0, 1)?.char).toBe('L'); // surface (1,2)
  expect(cell(1, 1)?.char).toBe('M');
  expect(cell(2, 1)?.char).toBe('N');
});

test('ST-3: surface smaller than the view → right + bottom margins in windowInactive (:120-132)', () => {
  // 3×2 surface at top-left of a 5×3 view: cols 3-4 + row 2 are empty bands.
  const { cell } = makeView({ surface: Surface.from(['abc', 'def']), vw: 5, vh: 3 });
  expect(cell(0, 0)?.char).toBe('a'); // surface content
  expect(cell(2, 1)?.char).toBe('f');
  expectEmpty(cell(3, 0)); // right band
  expectEmpty(cell(4, 1));
  expectEmpty(cell(0, 2)); // bottom band
  expectEmpty(cell(4, 2)); // corner
});

test('ST-3: negative delta insets the surface → top/left/right/bottom margins (:105-132)', () => {
  // 3×2 surface, delta {-1,-1}, 6×4 view → surface drawn at view (1,1), size 3×2.
  const { cell } = makeView({ surface: Surface.from(['abc', 'def']), vw: 6, vh: 4, delta: { x: -1, y: -1 } });
  expectEmpty(cell(0, 0)); // top band
  expectEmpty(cell(5, 0));
  expectEmpty(cell(0, 1)); // left band
  expect(cell(1, 1)?.char).toBe('a'); // surface (0,0) at view (1,1)
  expect(cell(3, 1)?.char).toBe('c');
  expectEmpty(cell(4, 1)); // right band
  expect(cell(1, 2)?.char).toBe('d');
  expectEmpty(cell(0, 3)); // bottom band
});

// ── ST-4 / ST-10 — empty-area colour + cells render their own colours ────────────────────────────

test('ST-4: a null surface fills the whole view with windowInactive spaces (:136-140)', () => {
  const { cell } = makeView({ surface: null, vw: 4, vh: 3 });
  for (let y = 0; y < 3; y += 1) for (let x = 0; x < 4; x += 1) expectEmpty(cell(x, y));
});

test('ST-10: surface cells render in their OWN colours (not a theme role)', () => {
  const s = new Surface({ size: { x: 2, y: 1 } });
  s.set(0, 0, 'R', { fg: 'red', bg: 'blue' });
  const { cell } = makeView({ surface: s, vw: 2, vh: 1 });
  expect(cell(0, 0)).toEqual({ char: 'R', fg: 'red', bg: 'blue' });
});

// ── ST-5 — reactive pan: one coalesced repaint; revealed appears, vacated replaced ───────────────

test('ST-5: a delta change repaints the viewport (revealed region appears)', () => {
  const h = makeView({ surface: letterSurface(), vw: 3, vh: 2, delta: { x: 0, y: 0 } });
  expect(h.cell(0, 0)?.char).toBe('A'); // surface (0,0)
  h.delta.set({ x: 2, y: 1 });
  h.flush();
  expect(h.cell(0, 0)?.char).toBe('H'); // now surface (2,1)
});

test('ST-5: multiple delta writes before a flush coalesce to ONE recompose', () => {
  const h = makeView({ surface: letterSurface(), vw: 3, vh: 2 });
  let draws = 0;
  const orig = h.view.draw.bind(h.view);
  h.view.draw = (ctx) => {
    draws += 1;
    orig(ctx);
  };
  h.delta.set({ x: 1, y: 0 });
  h.delta.set({ x: 2, y: 1 });
  h.flush();
  expect(draws).toBe(1); // coalesced
  expect(h.cell(0, 0)?.char).toBe('H'); // reflects the last delta {2,1}
});

// ── ST-6 — reactive content: mutating the surface repaints the visible region ────────────────────

test('ST-6: mutating surface content (same identity) repaints on the next flush (AC-6)', () => {
  const s = Surface.from(['abc', 'def']);
  const h = makeView({ surface: s, vw: 3, vh: 2 });
  expect(h.cell(0, 0)?.char).toBe('a');
  s.set(0, 0, 'Z', { fg: 'default', bg: 'default' }); // bumps version
  h.flush();
  expect(h.cell(0, 0)?.char).toBe('Z');
});

// ── ST-8 — passive (no input moves delta) + ScrollBar composition ────────────────────────────────

test('ST-8: SurfaceView is not focusable and does not handle input (delta unchanged)', () => {
  const h = makeView({ surface: letterSurface(), vw: 3, vh: 2 });
  expect(h.view.focusable).toBe(false);
  h.view.onEvent({ event: keyEvent('down'), handled: false } as never);
  h.view.onEvent({ event: keyEvent('right'), handled: false } as never);
  expect(h.delta()).toEqual({ x: 0, y: 0 }); // never moved by input
});

test('ST-8: a ScrollBar bound to delta scrolls the viewport (composition, AC-8)', () => {
  const h = makeView({ surface: letterSurface(), vw: 3, vh: 2 });
  const barValue = signal(0);
  // A horizontal ScrollBar shares `barValue`; the app composes value → delta.x (SurfaceView stays passive).
  new ScrollBar({ value: barValue, min: 0, max: 2, orientation: 'horizontal' });
  createRoot(() => {
    effect(() => h.delta.set({ x: barValue(), y: 0 }));
  });
  barValue.set(2); // as if the user paged the bar
  h.flush();
  expect(h.cell(0, 0)?.char).toBe('C'); // surface (2,0) now at view (0,0)
});

// ── ST-9 / ST-13 — degenerate / fully-outside / bounds-safe (no crash, no OOB) ───────────────────

test('ST-9: a surface scrolled fully outside → all-empty windowInactive fill (PA-3)', () => {
  const { cell } = makeView({ surface: Surface.from(['abc', 'def']), vw: 4, vh: 4, delta: { x: 10, y: 0 } });
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) expectEmpty(cell(x, y));
});

test('ST-13: extreme + negative deltas never crash and never index out of range (AC-13)', () => {
  const s = letterSurface();
  for (const d of [
    { x: -100, y: -100 },
    { x: 100, y: 100 },
    { x: -3, y: 5 },
    { x: 4, y: -2 },
  ]) {
    expect(() => {
      const h = makeView({ surface: s, vw: 3, vh: 2, delta: d });
      h.flush();
    }).not.toThrow();
  }
});
