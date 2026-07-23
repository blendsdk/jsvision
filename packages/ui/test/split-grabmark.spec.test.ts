/**
 * Specification tests (immutable oracles) — the reactive grab-mark toggle on SplitView splitters
 * (ST-1…ST-4, followups).
 *
 * A SplitView splitter paints a `▓` grab mark at its midpoint. This follow-up makes that mark
 * optional and reactive: a `grabMark?: boolean` option (default `true`) seeds a public
 * `SplitView.grabMark: Signal<boolean>`, and flipping that signal shows/hides the mark on the next
 * frame. These oracles pin the default-on behaviour (backward-compatible with the shipped output),
 * the construction-time opt-out, and the runtime flip. A failing oracle means the CODE is wrong.
 *
 * Rendered the shipped way (`createEventLoop` + mount with an explicit rect so the split fills the
 * viewport — a root mounted with no rect collapses to {0,0} and paints nothing); the buffer is
 * scanned for the `▓` glyph. The `.js` extension is required by NodeNext ESM resolution.
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

/**
 * Mount a SplitView the shipped way (mirrors `split.spec.test.ts`'s `makeSplit`): give it an explicit
 * absolute rect so it fills the viewport, then flush one frame. Without the rect the root collapses to
 * {0,0} and paints nothing, so even a correct splitter would show no `▓`.
 */
function mount(split: SplitView, width: number, height: number): Harness {
  split.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height } });
  const root = new Group();
  root.add(split);
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  const flush = (): void => loop.renderRoot.flush();
  flush();
  return { split, loop, flush };
}

/** True when any painted cell is the `▓` grab mark. */
function hasGrabMark(loop: ReturnType<typeof createEventLoop>): boolean {
  return loop.renderRoot
    .buffer()
    .rows()
    .some((row) => row.some((c) => c.char === '▓'));
}

/** True when any painted cell is the `│` row-splitter line. */
function hasRowLine(loop: ReturnType<typeof createEventLoop>): boolean {
  return loop.renderRoot
    .buffer()
    .rows()
    .some((row) => row.some((c) => c.char === '│'));
}

// ── ST-1 (followups): the grab mark is on by default (F1) ─────────────────────────────────────────

test('ST-1 (followups): a SplitView with no grabMark option paints the ▓ grab mark (default true)', () => {
  const split = new SplitView({ direction: 'row', children: [new Group(), new Group()], sizes: signal([1, 1]) });
  const h = mount(split, 20, 8);
  expect(hasGrabMark(h.loop), 'default grabMark true paints the ▓').toBe(true);
});

// ── ST-2 (followups): grabMark:false paints only the line, no ▓ (F3) ──────────────────────────────

test('ST-2 (followups): grabMark:false draws the │ line but no ▓ grab mark', () => {
  const split = new SplitView({
    direction: 'row',
    children: [new Group(), new Group()],
    sizes: signal([1, 1]),
    grabMark: false,
  });
  const h = mount(split, 20, 8);
  expect(hasGrabMark(h.loop), 'grabMark false hides the ▓').toBe(false);
  expect(hasRowLine(h.loop), 'the splitter │ line is still painted').toBe(true);
});

// ── ST-3 (followups): flipping the signal shows/hides the mark on the next frame (F2, F4) ──────────

test('ST-3 (followups): split.grabMark.set(false) then true toggles the ▓ reactively', () => {
  const split = new SplitView({ direction: 'row', children: [new Group(), new Group()], sizes: signal([1, 1]) });
  const h = mount(split, 20, 8);
  expect(hasGrabMark(h.loop), 'starts with the ▓ (default true)').toBe(true);
  split.grabMark.set(false);
  h.flush();
  expect(hasGrabMark(h.loop), 'set(false) repaints without the ▓').toBe(false);
  split.grabMark.set(true);
  h.flush();
  expect(hasGrabMark(h.loop), 'set(true) restores the ▓').toBe(true);
});

// ── ST-4 (followups): the grabMark signal is seeded from the option (F1, F2) ──────────────────────

test('ST-4 (followups): grabMark signal is seeded false when opted out, true when omitted', () => {
  const off = new SplitView({
    direction: 'row',
    children: [new Group(), new Group()],
    sizes: signal([1, 1]),
    grabMark: false,
  });
  const on = new SplitView({ direction: 'row', children: [new Group(), new Group()], sizes: signal([1, 1]) });
  expect(off.grabMark.peek(), 'seeded false from the option').toBe(false);
  expect(on.grabMark.peek(), 'seeded true when omitted').toBe(true);
});
