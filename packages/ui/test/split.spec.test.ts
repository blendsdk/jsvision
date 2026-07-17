/**
 * Specification tests (immutable oracles) — the `SplitView` container (ST-10…ST-31).
 *
 * `SplitView` is a documented new component (Turbo Vision has no split-pane counterpart), so its
 * geometry, glyphs, and behaviour are a fresh design pinned here — not a decode. Panes are `fr`
 * tracks and the existing reflow places everything, so every geometry expectation below is
 * hand-computed from `solveTrack`/`apportion(Min)`, never read off the implementation. A failing
 * oracle means the CODE is wrong.
 *
 * Rendered the shipped way (`createEventLoop` + mount); bounds are read after `flush()`, the buffer
 * cell-by-cell. `applySplitResize` (module-private, per the layout/pack-row precedent) is imported
 * by relative path. The `.js` extension is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { apportion } from '../src/layout/index.js';
import { createEventLoop } from '../src/event/index.js';
import { SplitView } from '../src/split/split-view.js';
import { applySplitResize } from '../src/split/resize.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false, ...mods };
}
/** A left mouse event at 1-based terminal coords (exactly as the terminal sends them). */
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

/** A trivial leaf pane that paints a solid fill, so a pane's rect is visible if needed. */
class Pane extends View {
  constructor(private readonly ch = ' ') {
    super();
  }
  draw(ctx: DrawContext): void {
    ctx.fill(this.ch, ctx.color('window'));
  }
}

interface SplitHarness {
  split: SplitView;
  loop: ReturnType<typeof createEventLoop>;
  sizes: Signal<number[]>;
  resizes: number[][];
  ends: number[][];
  cell: (x: number, y: number) => { char: string; fg: string; bg: string } | undefined;
  flush: () => void;
}

function makeSplit(opts: {
  direction?: 'row' | 'col';
  children: View[];
  sizes: number[];
  minSize?: number | number[];
  width: number;
  height: number;
}): SplitHarness {
  const sizes = signal(opts.sizes);
  const resizes: number[][] = [];
  const ends: number[][] = [];
  const split = new SplitView({
    direction: opts.direction ?? 'row',
    children: opts.children,
    sizes,
    minSize: opts.minSize,
    onResize: (s) => resizes.push([...s]),
    onResizeEnd: (s) => ends.push([...s]),
  });
  split.layout = { position: 'absolute', rect: { x: 0, y: 0, width: opts.width, height: opts.height } };
  const root = new Group();
  root.add(split);
  const loop = createEventLoop({ width: opts.width, height: opts.height }, { caps });
  loop.mount(root);
  const flush = () => loop.renderRoot.flush();
  flush();
  const cell = (x: number, y: number) => {
    const c = loop.renderRoot.buffer().get(x, y);
    return c ? { char: c.char, fg: c.fg, bg: c.bg } : undefined;
  };
  return { split, loop, sizes, resizes, ends, cell, flush };
}

// ── ST-10: a row split, 2 panes, sizes [1,1], 21×5 ───────────────────────────────────────────────

test('ST-10: row split 2 panes sizes[1,1] at 21×5 → panes 10@0 and 10@11, splitter 1@10 full height', () => {
  const a = new Pane('A');
  const b = new Pane('B');
  const h = makeSplit({ children: [a, b], sizes: [1, 1], width: 21, height: 5 });
  // free = 21 − 1 splitter = 20, split 10/10.
  expect(a.bounds).toEqual({ x: 0, y: 0, width: 10, height: 5 });
  expect(b.bounds).toEqual({ x: 11, y: 0, width: 10, height: 5 });
  expect(h.split.splitters.length, 'one splitter for two panes').toBe(1);
  expect(h.split.splitters[0].bounds).toEqual({ x: 10, y: 0, width: 1, height: 5 });
});

// ── ST-11: a row split, 3 panes, sizes [1,1,1], 22×5 ─────────────────────────────────────────────

test('ST-11: row split 3 panes sizes[1,1,1] at 22×5 → panes 7,7,6; splitters at x=7 and x=15; fills 22', () => {
  const [a, b, c] = [new Pane(), new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b, c], sizes: [1, 1, 1], width: 22, height: 5 });
  // free = 22 − 2 splitters = 20 → 7,7,6 (leftover to the earliest).
  expect(a.bounds.width).toBe(7);
  expect(b.bounds.width).toBe(7);
  expect(c.bounds.width).toBe(6);
  expect(h.split.splitters.map((s) => s.bounds.x)).toEqual([7, 15]);
  const fill = a.bounds.width + 1 + b.bounds.width + 1 + c.bounds.width;
  expect(fill, 'panes + splitters fill exactly').toBe(22);
});

// ── ST-12…ST-14, ST-28: the pure applySplitResize helper ─────────────────────────────────────────

test('ST-12: applySplitResize([10,10], 0, +3, [0,0]) → [13,7] (only the adjacent pair moves, sum conserved)', () => {
  expect(applySplitResize([10, 10], 0, 3, [0, 0])).toEqual([13, 7]);
});

test('ST-13: applySplitResize([10,10], 0, +8, [5,5]) → [15,5] (clamped at the right pane minimum)', () => {
  expect(applySplitResize([10, 10], 0, 8, [5, 5])).toEqual([15, 5]);
});

test('ST-14: applySplitResize([37,42], 0, +1, [0,0]) → [38,41]; apportion(79, result) is the identity', () => {
  const next = applySplitResize([37, 42], 0, 1, [0, 0]);
  expect(next).toEqual([38, 41]);
  // Σ conserved (79), so the re-solve is the identity — the divider moved exactly 1 cell.
  expect(apportion(79, next)).toEqual([38, 41]);
});

test('ST-28: applySplitResize on already-squeezed panes ([10,9], mins [12,12]) freezes for every delta', () => {
  // The engine squeezes 2 panes of minSize 12 into free 19 down to [10,9] (both below their min).
  // Both clamp bounds then collapse to 0, so a zero- or non-zero-delta mouse-down never rewrites sizes.
  for (const delta of [0, 5, -5]) {
    expect(applySplitResize([10, 9], 0, delta, [12, 12]), `delta ${delta}`).toEqual([10, 9]);
  }
});

// ── ST-15: keyboard resize of the focused splitter ───────────────────────────────────────────────

test('ST-15: a focused splitter grows the left pane by 1 on the increasing arrow, shrinks by 1 on the other', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], width: 21, height: 5 });
  h.loop.focusView(h.split.splitters[0]);
  h.loop.dispatch(keyEvent('right'));
  h.flush();
  expect(a.bounds.width, 'right grows the left pane by 1').toBe(11);
  expect(b.bounds.width).toBe(9);
  h.loop.dispatch(keyEvent('left'));
  h.flush();
  expect(a.bounds.width, 'left shrinks it back by 1').toBe(10);
  expect(b.bounds.width).toBe(10);
});

// ── ST-16: a splitter is focusable ───────────────────────────────────────────────────────────────

test('ST-16: a Splitter is focusable (a tab stop)', () => {
  const h = makeSplit({ children: [new Pane(), new Pane()], sizes: [1, 1], width: 21, height: 5 });
  expect(h.split.splitters[0].focusable).toBe(true);
});

// ── ST-17: capture is requested on the SplitView, and a lost capture abandons the gesture ────────

test('ST-17: mouse-down captures the SplitView; when hasCapture goes false mid-drag the gesture aborts', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], width: 21, height: 5 });
  let captured: View | null = null;
  // Drive the gesture through a hand-built envelope so we can observe the capture target and then
  // simulate an external capture loss (a modal opening mid-drag).
  const down = {
    event: mouse('down', 11, 1), // 1-based col 11 → the splitter cell (x=10)
    handled: false,
    setCapture: (v: View) => {
      captured = v;
    },
    releaseCapture: () => {
      captured = null;
    },
    hasCapture: (v: View) => captured === v,
  };
  h.split.splitters[0].onEvent(down);
  expect(captured, 'capture is requested on the SplitView, not the splitter').toBe(h.split);
  expect(h.split.splitters[0].dragging(), 'the splitter shows the drag state').toBe(true);

  // Capture is lost externally; the next captured event must abort cleanly.
  captured = null;
  const move = {
    event: mouse('drag', 16, 1),
    handled: false,
    setCapture: () => undefined,
    releaseCapture: () => undefined,
    hasCapture: (v: View) => captured === v,
  };
  h.split.onEvent(move);
  expect(h.split.splitters[0].dragging(), 'a lost capture abandons the gesture').toBe(false);
});

// ── ST-18: a single-child split is legal (no splitter) ───────────────────────────────────────────

test('ST-18: a SplitView with 1 child at 20×5 → 0 splitters; the child fills 20×5', () => {
  const only = new Pane();
  const h = makeSplit({ children: [only], sizes: [1], width: 20, height: 5 });
  expect(h.split.splitters.length).toBe(0);
  expect(only.bounds).toEqual({ x: 0, y: 0, width: 20, height: 5 });
});

// ── ST-19: a wrong-length sizes array is padded / truncated at construction ─────────────────────

test('ST-19: sizes shorter/longer than the child count is padded/truncated to it (never throws)', () => {
  const short = makeSplit({ children: [new Pane(), new Pane()], sizes: [1], width: 21, height: 5 });
  expect(short.sizes(), 'padded to the child count').toHaveLength(2);
  const long = makeSplit({ children: [new Pane(), new Pane()], sizes: [1, 1, 1], width: 21, height: 5 });
  expect(long.sizes(), 'truncated to the child count').toHaveLength(2);
});

// ── ST-20: nesting a col split inside a row split produces a grid by composition ─────────────────

test('ST-20: a row split whose 2nd child is a col split lays the inner panes out inside the outer rect', () => {
  const sidebar = new Pane();
  const top = new Pane();
  const bottom = new Pane();
  const inner = new SplitView({ direction: 'col', children: [top, bottom], sizes: signal([1, 1]) });
  makeSplit({ children: [sidebar, inner], sizes: [1, 1], width: 40, height: 10 });
  // Outer: free = 40 − 1 = 39 → 20/19 (leftover to the earliest). Inner occupies the 2nd pane's rect.
  expect(sidebar.bounds.width).toBe(20);
  expect(inner.bounds.width).toBe(19);
  expect(inner.bounds.x).toBe(21);
  // The inner col split stacks its two panes within the inner rect (each spans the inner width).
  expect(top.bounds.width, 'inner panes span the inner rect width').toBe(19);
  expect(bottom.bounds.width).toBe(19);
  expect(top.bounds.height + 1 + bottom.bounds.height, 'inner panes + splitter fill the inner height').toBe(10);
});

// ── ST-21: splitter glyphs + grab mark per direction ─────────────────────────────────────────────

test('ST-21: a row splitter draws │ down its column with ▓ at the midpoint; a col splitter draws ─ across', () => {
  const rowH = makeSplit({ children: [new Pane(), new Pane()], sizes: [1, 1], width: 21, height: 5 });
  // Row splitter at x=10, full height 5 → │ in every row, ▓ at y = floor(5/2) = 2.
  for (let y = 0; y < 5; y += 1) {
    expect(rowH.cell(10, y)?.char, `row splitter col cell y=${y}`).toBe(y === 2 ? '▓' : '│');
  }
  const colH = makeSplit({ direction: 'col', children: [new Pane(), new Pane()], sizes: [1, 1], width: 5, height: 5 });
  // Col splitter is 5 wide, 1 tall, placed on the boundary row → ─ across, ▓ at x = floor(5/2) = 2.
  const sy = colH.split.splitters[0].bounds.y;
  for (let x = 0; x < 5; x += 1) {
    expect(colH.cell(x, sy)?.char, `col splitter row cell x=${x}`).toBe(x === 2 ? '▓' : '─');
  }
});

// ── ST-22: a splitter paints the splitter role at rest, splitterDragging while dragging ──────────

test('ST-22: a splitter paints in the splitter role at rest and in splitterDragging while dragging', () => {
  const h = makeSplit({ children: [new Pane(), new Pane()], sizes: [1, 1], width: 21, height: 5 });
  const restFg = h.cell(10, 0)?.fg;
  expect(restFg, 'the resting splitter fg is defined').toBeTruthy();
  h.split.splitters[0].dragging.set(true);
  h.flush();
  const dragFg = h.cell(10, 0)?.fg;
  expect(dragFg, 'the dragging splitter repaints in a different role').not.toBe(restFg);
});

// ── ST-23: a drag and a keyboard resize both deliver the new cell array ──────────────────────────

test('ST-23: both a keyboard step and a drag deliver the new cell array to onResize and to sizes', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], width: 21, height: 5 });
  h.loop.focusView(h.split.splitters[0]);
  h.loop.dispatch(keyEvent('right'));
  h.flush();
  expect(h.resizes.at(-1), 'onResize got the new array').toEqual(h.sizes());
  expect(h.sizes(), 'sizes holds the same array').toEqual([11, 9]);
});

// ── ST-24: minSize scalar vs per-pane array ──────────────────────────────────────────────────────

test('ST-24: minSize as a scalar applies to every pane; as an array it applies per-pane', () => {
  // Scalar 12 on a 3-pane split too narrow to honour it → the engine squeezes, but no pane exceeds
  // the container. Per-pane [5,20] on a 2-pane split pins the 2nd pane at 20 when squeezed.
  const [a, b, c] = [new Pane(), new Pane(), new Pane()];
  makeSplit({ children: [a, b, c], sizes: [1, 1, 1], minSize: 12, width: 41, height: 3 });
  // free = 41 − 2 = 39, three mins of 12 (Σ 36 ≤ 39) all honoured: 13,13,13 → clamp holds each ≥ 12.
  expect(
    Math.min(a.bounds.width, b.bounds.width, c.bounds.width),
    'every pane ≥ its scalar min',
  ).toBeGreaterThanOrEqual(12);
  const [d, e] = [new Pane(), new Pane()];
  makeSplit({ children: [d, e], sizes: [1, 1], minSize: [5, 20], width: 31, height: 3 });
  // free = 30; the per-pane array pins the 2nd pane's minimum at 20.
  expect(e.bounds.width, 'the per-pane array pins pane 2 at 20').toBeGreaterThanOrEqual(20);
  expect(d.bounds.width, 'pane 1 honours its own smaller min').toBeGreaterThanOrEqual(5);
});

// ── ST-27: a container shrink clamps at minSize (engine), which no drag handler could ────────────

test('ST-27: row split sizes[1,3] minSize 12 at width 31 → [12,18] (the engine clamps on shrink)', () => {
  const [a, b] = [new Pane(), new Pane()];
  makeSplit({ children: [a, b], sizes: [1, 3], minSize: 12, width: 31, height: 3 });
  // free = 30; naive apportion of the 1:3 weights gives [8,22]; the engine min clamps to [12,18].
  expect(a.bounds.width).toBe(12);
  expect(b.bounds.width).toBe(18);
  expect(a.bounds.width + 1 + b.bounds.width, 'fills exactly').toBe(31);
});

// ── ST-29: the splitter repaints in the resting role after mouse-up (no stuck highlight) ─────────

test('ST-29: after a drag ends with mouse-up, the splitter is painted in the resting role again', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], width: 21, height: 5 });
  const restFg = h.cell(10, 0)?.fg;
  h.loop.dispatch(mouse('down', 11, 1)); // grab the splitter at x=10
  h.flush();
  const draggingFg = h.cell(10, 0)?.fg;
  expect(draggingFg, 'mid-drag it is in the dragging role').not.toBe(restFg);
  // Mouse-up with no size change on the final event — the bind on `dragging` must repaint it to rest.
  h.loop.dispatch(mouse('up', 11, 1));
  h.flush();
  expect(h.split.splitters[0].dragging(), 'drag state cleared').toBe(false);
  expect(h.cell(10, 0)?.fg, 'repainted in the resting role after mouse-up').toBe(restFg);
});

// ── ST-30: a wrong-length sizes write AFTER mount is normalized, never NaN-poisoned ─────────────

test('ST-30: a wrong-length sizes.set after mount is truncated/padded to the child count, never NaN', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], width: 21, height: 5 });
  h.sizes.set([1, 1, 1]); // too long
  h.flush();
  expect(h.sizes(), 'truncated back to the child count').toHaveLength(2);
  expect(Number.isFinite(a.bounds.width) && a.bounds.width > 0, 'pane still has a finite size').toBe(true);
  h.sizes.set([1]); // too short
  h.flush();
  expect(h.sizes(), 'padded back to the child count').toHaveLength(2);
  expect(Number.isFinite(b.bounds.width) && b.bounds.width > 0, 'pane still has a finite size').toBe(true);
});

// ── ST-31: callback call counts — onResize on change only, onResizeEnd exactly once per commit ──

test('ST-31: onResize fires per changed array and 0× while clamped; onResizeEnd fires exactly once at mouse-up', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], minSize: 5, width: 21, height: 5 });
  h.loop.dispatch(mouse('down', 11, 1)); // grab at x=10 (no size change)
  const resizesAfterDown = h.resizes.length;
  h.loop.dispatch(mouse('drag', 14, 1)); // move +3 → a changed array
  expect(h.resizes.length, 'a changing move fired onResize').toBeGreaterThan(resizesAfterDown);
  const afterMove = h.resizes.length;
  // Drag hard past the right pane's minimum, then hold there: the clamped value never changes, so
  // no further onResize fires while pinned.
  h.loop.dispatch(mouse('drag', 40, 1));
  const afterFirstClamp = h.resizes.length;
  h.loop.dispatch(mouse('drag', 41, 1)); // still pinned at the clamp → identical array → silent
  expect(h.resizes.length, 'a held-against-clamp move fires nothing').toBe(afterFirstClamp);
  expect(afterFirstClamp, 'the first clamp move did change the array once').toBeGreaterThan(afterMove);
  expect(h.ends.length, 'no commit until mouse-up').toBe(0);
  h.loop.dispatch(mouse('up', 41, 1));
  expect(h.ends.length, 'exactly one onResizeEnd at mouse-up').toBe(1);

  // A keyboard step is a discrete commit: one onResize and one onResizeEnd.
  const [c, d] = [new Pane(), new Pane()];
  const k = makeSplit({ children: [c, d], sizes: [1, 1], width: 21, height: 5 });
  k.loop.focusView(k.split.splitters[0]);
  k.loop.dispatch(keyEvent('right'));
  expect(k.resizes.length, 'key step: one onResize').toBe(1);
  expect(k.ends.length, 'key step: one onResizeEnd').toBe(1);
});
