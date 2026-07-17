/**
 * Implementation tests — `SplitView` internals, gesture edges, and integration through the real
 * event loop. Complements the spec oracle (split.spec) with the failure modes and end-to-end paths.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent } from '@jsvision/core';
import { Group, View } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import type { Signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { SplitView } from '../src/split/split-view.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function keyEvent(key: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false, ...mods };
}
function mouse(kind: MouseEvent['kind'], x: number, y: number): MouseEvent {
  return { type: 'mouse', kind, button: 0, x, y };
}

class Pane extends View {
  draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color('window'));
  }
}

interface Harness {
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
}): Harness {
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

// ── endDrag idempotency + no-move click ──────────────────────────────────────────────────────────

test('endDrag is idempotent: an abandoned gesture then a mouse-up fires no onResizeEnd', () => {
  const h = makeSplit({ children: [new Pane(), new Pane()], sizes: [1, 1], width: 21, height: 5 });
  let captured: View | null = null;
  h.split.splitters[0].onEvent({
    event: mouse('down', 11, 1),
    handled: false,
    setCapture: (v: View) => {
      captured = v;
    },
    hasCapture: (v: View) => captured === v,
  });
  captured = null; // external capture loss
  h.split.onEvent({ event: mouse('drag', 16, 1), handled: false, hasCapture: (v: View) => captured === v }); // → endDrag()
  h.split.onEvent({ event: mouse('up', 16, 1), handled: false, hasCapture: (v: View) => captured === v });
  expect(h.ends.length, 'an abandoned gesture reports no phantom commit').toBe(0);
});

test('a mouse-down then up with no movement leaves sizes unchanged and fires no onResize', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], width: 21, height: 5 });
  h.loop.dispatch(mouse('down', 11, 1));
  h.loop.dispatch(mouse('up', 11, 1));
  h.flush();
  expect(h.resizes.length, 'no live change on a no-move click').toBe(0);
  expect([a.bounds.width, b.bounds.width], 'geometry unchanged').toEqual([10, 10]);
  // A gesture still ends on up, so onResizeEnd fires exactly once — matching Slider's onChange.
  expect(h.ends.length, 'one commit per gesture (as Slider does), even with no movement').toBe(1);
});

// ── normalization edges ──────────────────────────────────────────────────────────────────────────

test('degenerate inputs normalize without throwing (0 children; mismatched/negative minSize)', () => {
  expect(() => makeSplit({ children: [], sizes: [], width: 20, height: 5 }).flush()).not.toThrow();

  // minSize array shorter than the pane count → padded with 0: pane 0 clamps at 12, pane 1 has no floor.
  const [a, b] = [new Pane(), new Pane()];
  makeSplit({ children: [a, b], sizes: [1, 3], minSize: [12], width: 30, height: 5 });
  expect([a.bounds.width, b.bounds.width], 'pane 0 min binds, pane 1 min padded to 0').toEqual([12, 17]);
  expect(a.bounds.width + 1 + b.bounds.width, 'fills exactly, never overflows').toBe(30);

  // Negative minSize floors to 0 → a plain split, no clamp.
  const [c, d] = [new Pane(), new Pane()];
  makeSplit({ children: [c, d], sizes: [1, 1], minSize: -5, width: 21, height: 5 });
  expect([c.bounds.width, d.bounds.width]).toEqual([10, 10]);
});

// ── modified arrows fall through ─────────────────────────────────────────────────────────────────

test('Ctrl/Alt + arrow on a splitter is left unhandled (bubbles) and never resizes', () => {
  const h = makeSplit({ children: [new Pane(), new Pane()], sizes: [1, 1], width: 21, height: 5 });
  for (const mod of [{ ctrl: true }, { alt: true }]) {
    const ev = { event: keyEvent('right', mod), handled: false };
    h.split.splitters[0].onEvent(ev);
    expect(ev.handled, `right+${JSON.stringify(mod)} not consumed`).toBe(false);
  }
  expect(h.sizes(), 'no resize occurred').toEqual([1, 1]);
});

// ── grab-mark position at even/odd extents + a 1-cell axis ───────────────────────────────────────

test('the ▓ grab mark sits at floor(extent/2): row heights 4, 5, 6 → y = 2, 2, 3', () => {
  for (const [height, gy] of [
    [4, 2],
    [5, 2],
    [6, 3],
  ] as const) {
    const h = makeSplit({ children: [new Pane(), new Pane()], sizes: [1, 1], width: 21, height });
    for (let y = 0; y < height; y += 1) {
      expect(h.cell(10, y)?.char, `h=${height} y=${y}`).toBe(y === gy ? '▓' : '│');
    }
  }
});

test('a splitter on a 1-cell axis shows the grab mark at its only cell', () => {
  const h = makeSplit({ children: [new Pane(), new Pane()], sizes: [1, 1], width: 21, height: 1 });
  expect(h.cell(10, 0)?.char).toBe('▓');
});

// ── zero-delta drag in the squeezed regime does not corrupt sizes (PF-001 end-to-end) ────────────

test('a zero-delta drag while the panes are squeezed below their mins never corrupts sizes ([10,9], not [12,7])', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], minSize: 12, width: 20, height: 5 });
  expect([a.bounds.width, b.bounds.width], 'engine squeezes two min-12 panes into free 19').toEqual([10, 9]);
  h.loop.dispatch(mouse('down', 11, 1)); // grab the splitter at x=10
  h.loop.dispatch(mouse('drag', 11, 1)); // no movement → delta 0
  h.loop.dispatch(mouse('up', 11, 1));
  h.flush();
  expect([a.bounds.width, b.bounds.width], 'frozen — never the un-guarded [12,7]').toEqual([10, 9]);
});

// ── the applyWeights write-back terminates (PF-004) ──────────────────────────────────────────────

test('a wrong-length sizes write self-corrects in one pass and does not loop', () => {
  const h = makeSplit({ children: [new Pane(), new Pane()], sizes: [1, 1], width: 21, height: 5 });
  h.sizes.set([9, 9, 9]); // too long
  h.flush();
  expect(h.sizes(), 'truncated to the pane count (the test completing proves no infinite loop)').toEqual([9, 9]);
  h.sizes.set([4]); // too short
  h.flush();
  expect(h.sizes(), 'padded to the pane count').toEqual([4, 1]);
});

// ── rubber-band guard (recompute-from-start, not incremental) ────────────────────────────────────

test('the drag stays pinned past a clamp and only moves once the pointer returns past the clamp point', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], minSize: 5, width: 21, height: 5 });
  h.loop.dispatch(mouse('down', 11, 1)); // grab at x=10; startCells [10,10]
  h.loop.dispatch(mouse('drag', 40, 1)); // far right: total delta 29 → clamp 5 → [15,5]
  h.flush();
  expect([a.bounds.width, b.bounds.width]).toEqual([15, 5]);
  h.loop.dispatch(mouse('drag', 39, 1)); // reverse by 1 → total delta 28 → still clamped → [15,5]
  h.flush();
  expect([a.bounds.width, b.bounds.width], 'still pinned — an incremental accumulator would move here').toEqual([
    15, 5,
  ]);
  h.loop.dispatch(mouse('drag', 15, 1)); // total delta 4 → back inside the clamp → [14,6]
  h.flush();
  expect([a.bounds.width, b.bounds.width], 'moves only once the pointer returns past the clamp point').toEqual([14, 6]);
  h.loop.dispatch(mouse('up', 15, 1));
});

// ── integration: the gesture through the real capture seam ───────────────────────────────────────

test('a full down→drag→up through the event loop tracks the divider, then releases the capture', () => {
  const [a, b] = [new Pane(), new Pane()];
  const h = makeSplit({ children: [a, b], sizes: [1, 1], width: 21, height: 5 });
  h.loop.dispatch(mouse('down', 11, 1));
  h.loop.dispatch(mouse('drag', 14, 1)); // +3 → [13,7]
  h.flush();
  expect([a.bounds.width, b.bounds.width]).toEqual([13, 7]);
  expect(h.split.splitters[0].dragging(), 'held during the drag').toBe(true);
  h.loop.dispatch(mouse('up', 14, 1));
  expect(h.split.splitters[0].dragging(), 'capture released and drag state cleared on up').toBe(false);
  expect(h.ends.length, 'exactly one commit for the gesture').toBe(1);
  // With the capture gone, further motion must not resize.
  const after = [...h.sizes()];
  h.loop.dispatch(mouse('drag', 18, 1));
  expect(h.sizes(), 'no resize after release').toEqual(after);
});

// ── integration: a pane's interior reflows to the new rect after a drag ──────────────────────────

test("a pane's fr-laid-out interior reflows to the new pane rect after a drag (the declarative guarantee)", () => {
  const paneA = new Group();
  const inner = new Group();
  inner.layout = { size: { kind: 'fr', weight: 1 } };
  paneA.add(inner);
  const [paneB] = [new Pane()];
  const h = makeSplit({ children: [paneA, paneB], sizes: [1, 1], width: 21, height: 5 });
  h.flush();
  expect(inner.bounds.width, 'interior fills the pane initially').toBe(paneA.bounds.width);
  h.loop.dispatch(mouse('down', 11, 1));
  h.loop.dispatch(mouse('drag', 14, 1)); // grow paneA to 13
  h.loop.dispatch(mouse('up', 14, 1));
  h.flush();
  expect(paneA.bounds.width, 'the pane grew').toBe(13);
  expect(inner.bounds.width, 'the descendant reflowed to the new pane width').toBe(13);
});

// ── integration: a nested row-of-cols is a 2×2 grid by composition ───────────────────────────────

test('a nested row-of-cols lays out a 2×2 grid at a realistic size', () => {
  const [tl, bl, tr, br] = [new Pane(), new Pane(), new Pane(), new Pane()];
  const left = new SplitView({ direction: 'col', children: [tl, bl], sizes: signal([1, 1]) });
  const right = new SplitView({ direction: 'col', children: [tr, br], sizes: signal([1, 1]) });
  const h = makeSplit({ children: [left, right], sizes: [1, 1], width: 41, height: 11 });
  h.flush();
  // Outer row: free = 40 → [20,20]; the right column starts past the 1-cell splitter.
  expect(left.bounds.width).toBe(20);
  expect(right.bounds.x).toBe(21);
  expect([tl.bounds.width, br.bounds.width], 'inner panes span their column width').toEqual([20, 20]);
  // Each column: free height = 10 → [5,5], stacked over a 1-cell splitter.
  expect(tl.bounds.height + 1 + bl.bounds.height, 'the left column fills the height').toBe(11);
  expect(tr.bounds.height).toBe(5);
});
