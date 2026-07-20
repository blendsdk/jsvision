/**
 * Implementation tests (internals & edges) — `View.setLayout(patch)`. Covers the empty patch, the
 * frame coalescing the "invalidate unconditionally" design rests on, and the replace-not-mutate
 * identity that in-place `layout.rect = …` writers elsewhere depend on. These assert observed
 * internals rather than requirements, so they belong in the impl tier.
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { ViewHost } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { StatusLine } from '../src/status/index.js';
import { ColorPicker } from '../src/color/index.js';
import type { Color } from '@jsvision/core';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Minimal concrete leaf view. */
class Leaf extends View {
  draw(): void {
    // no-op — only layout props are under test here
  }
}

/** A `ViewHost` double that counts reflow requests specifically (never frames). */
function countingHost(): { host: ViewHost; relayouts: () => number } {
  let relayouts = 0;
  return {
    host: {
      markRepaint() {
        // not under test
      },
      markRelayout() {
        relayouts += 1;
      },
    },
    relayouts: () => relayouts,
  };
}

// ST-I1 — an empty patch keeps every prop, still assigns a fresh object, and still invalidates.
test('ST-I1: setLayout({}) preserves the props, replaces the object, and invalidates', () => {
  const v = new Leaf();
  v.layout = { direction: 'col', padding: 1 };
  const before = v.layout;
  const { host, relayouts } = countingHost();
  v.host = host;

  v.setLayout({});

  expect(v.layout).toEqual({ direction: 'col', padding: 1 });
  expect(v.layout).not.toBe(before);
  expect(relayouts()).toBe(1);
});

// ST-I3 — N calls request N reflows but coalesce into ONE frame. This is why invalidating
// unconditionally costs nothing: the render root early-returns once a flush is already pending.
test('ST-I3: N setLayout calls request N reflows but schedule exactly one frame', () => {
  let scheduled = 0;
  let pending: (() => void) | null = null;
  const root = new Group();
  const child = new Leaf();
  root.add(child);
  const rr = createRenderRoot(
    { width: 10, height: 3 },
    {
      caps,
      // Deferred, not synchronous: running the flush inline would clear the pending flag between
      // calls and each write would legitimately schedule its own frame.
      schedule: (fn) => {
        scheduled += 1;
        pending = fn;
      },
    },
  );
  rr.mount(root); // mount flushes directly, not via `schedule`
  const base = scheduled;
  // Spied through `ViewHost`, the interface that actually declares it — the public `RenderRoot`
  // interface keeps `markRelayout` internal. Same object; `spyOn` calls through.
  const relayouts = vi.spyOn(rr as unknown as ViewHost, 'markRelayout');

  for (let i = 1; i <= 5; i += 1) child.setLayout({ padding: i });

  expect(relayouts).toHaveBeenCalledTimes(5); // every call really does request a reflow…
  expect(scheduled - base).toBe(1); // …and they collapse into one frame

  expect(child.layout.padding).toBe(5);
  pending?.();
});

// ST-I5 — the one genuinely new migration witness. Both widgets set `direction: 'row'` in their
// constructor; nothing else in the codebase asserts it, and the ColorPicker suites overwrite that
// layout wholesale, so the write's effect is otherwise invisible. Written green BEFORE the
// conversion, so it witnesses that the constructor write survives it.
//
// Deliberately an object-shape witness only, not a geometry one: `direction:'row'` is the engine's
// own default, so replace, merge, and deleting the line outright all solve to the same rects — a
// bounds assertion here could not fail for any reachable reason.
test('ST-I5: StatusLine and ColorPicker keep their constructor direction', () => {
  expect(new StatusLine().layout.direction).toBe('row');

  const picker = new ColorPicker({ value: signal<Color>('red') });
  expect(picker.layout.direction).toBe('row');
});

// ST-I4 — setLayout replaces the object rather than mutating it in place. Sites that write
// `view.layout.rect = …` rely on the previous object staying untouched by a later patch.
test('ST-I4: setLayout replaces the layout object rather than mutating it', () => {
  const v = new Leaf();
  v.layout = { direction: 'col' };
  const before = v.layout;

  v.setLayout({ padding: 1 });

  expect(v.layout).not.toBe(before);
  expect(before).toEqual({ direction: 'col' });
});
