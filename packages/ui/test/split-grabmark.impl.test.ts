/**
 * Implementation tests (internals / edges) — the reactive grab-mark toggle on SplitView splitters
 * (ST-6, ST-7, followups).
 *
 * These cover the two axes the spec oracles don't pin directly: the `col` direction (the mark sits on
 * the horizontal `─` splitter, gated the same way) and a multi-splitter split (every divider reads the
 * same owner signal, so a flip shows/hides them all). The `.js` extension is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { createEventLoop } from '../src/event/index.js';
import { SplitView } from '../src/split/split-view.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Harness {
  split: SplitView;
  loop: ReturnType<typeof createEventLoop>;
  flush: () => void;
}

/** Mount a SplitView with an explicit rect (so it fills the viewport) and flush one frame. */
function mount(split: SplitView, width: number, height: number): Harness {
  split.layout = { position: 'absolute', rect: { x: 0, y: 0, width, height } };
  const root = new Group();
  root.add(split);
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  const flush = (): void => loop.renderRoot.flush();
  flush();
  return { split, loop, flush };
}

/** Count the painted `▓` grab-mark cells across the whole buffer. */
function countGrabMarks(loop: ReturnType<typeof createEventLoop>): number {
  let n = 0;
  for (const row of loop.renderRoot.buffer().rows()) for (const c of row) if (c.char === '▓') n += 1;
  return n;
}

// ── ST-6 (followups): the mark is gated the same way on a `col` splitter ──────────────────────────

test('ST-6 (followups): a col split paints the ▓ by default and drops it on grabMark false', () => {
  const split = new SplitView({ direction: 'col', children: [new Group(), new Group()], sizes: signal([1, 1]) });
  const h = mount(split, 8, 8);
  // The col splitter draws `─` across, ▓ at floor(width/2) on its single row.
  expect(countGrabMarks(h.loop), 'col default paints one ▓').toBe(1);
  split.grabMark.set(false);
  h.flush();
  expect(countGrabMarks(h.loop), 'col grabMark false drops the ▓').toBe(0);
});

// ── ST-7 (followups): every divider reads the same owner signal ───────────────────────────────────

test('ST-7 (followups): 3 panes ⇒ 2 splitters ⇒ 2 grab marks; a flip hides them all', () => {
  const split = new SplitView({
    direction: 'row',
    children: [new Group(), new Group(), new Group()],
    sizes: signal([1, 1, 1]),
  });
  const h = mount(split, 24, 8);
  expect(split.splitters.length, 'two dividers for three panes').toBe(2);
  expect(countGrabMarks(h.loop), 'one ▓ per divider').toBe(2);
  split.grabMark.set(false);
  h.flush();
  expect(countGrabMarks(h.loop), 'the single owner flip hides every ▓').toBe(0);
  split.grabMark.set(true);
  h.flush();
  expect(countGrabMarks(h.loop), 'and restores them all').toBe(2);
});
