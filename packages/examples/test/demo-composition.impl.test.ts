/**
 * Composition witnesses for the two example canvases that print no frame of their own.
 *
 * Both drive the **real** exported artifact — `chrome-bars-demo`'s window builder and the registered
 * drill-down story — rather than rebuilding either tree here: a rebuilt tree would assert the test's
 * own copy and stay green no matter what happened to the source.
 *
 * Every rect below is a literal, captured from a solved layout. Relationships between two solved
 * values (`b.y === a.y + a.height`) are avoided on purpose: they also hold when both collapse to
 * zero, which is precisely the failure these witnesses exist to catch. For the same reason the
 * layout is flushed before any `bounds` is read — `bounds` only refreshes on a layout pass, so
 * reading early would capture `{0,0,0,0}` and bake the zeros in as the expected rect.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, describe } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createApplication, createEventLoop, createRoot, Group } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { buildChromeBarsWindow } from '../chrome-bars-demo/tree.js';
import { drillDownStory } from '../kitchen-sink/stories/drill-down.story.js';
import { at, firstFocusable } from '../kitchen-sink/story.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Assert a solved rect is real geometry — the guard against a witness recording an unsolved view. */
function expectSolved(view: View): void {
  expect(view.bounds.width, 'width collapsed — the layout was read before it was solved').toBeGreaterThan(0);
  expect(view.bounds.height, 'height collapsed — the layout was read before it was solved').toBeGreaterThan(0);
}

describe('chrome-bars-demo window', () => {
  test('the body fills the whole interior of the 48×9 frame', () => {
    const app = createApplication({ caps, requireTty: false, viewport: { width: 60, height: 20 } });
    const win = buildChromeBarsWindow();
    app.desktop.addWindow(win);
    app.loop.renderRoot.flush();

    expect(win.children).toHaveLength(1);
    const body = win.children[0]!;
    expectSolved(body);
    expect(win.bounds).toEqual({ x: 2, y: 2, width: 48, height: 9 });
    expect(body.bounds).toEqual({ x: 1, y: 1, width: 46, height: 7 }); // inset by the window frame
  });
});

describe('drill-down story', () => {
  const WIDTH = 72;
  const HEIGHT = 16;

  test('the list screen stacks vertically and its list fills the router pane', () => {
    createRoot((dispose) => {
      const loop = createEventLoop({ width: WIDTH, height: HEIGHT }, { caps });
      const canvas = at(drillDownStory.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      loop.mount(canvas);
      loop.renderRoot.flush();

      const router = routerOf(canvas);
      expect(router.children).toHaveLength(1); // only the list screen is built yet
      const screen = router.children[0] as Group;

      // A lone filling child looks identical under either direction, so the stacking direction has
      // to be read off the screen itself — the rect alone cannot see it.
      expect(screen.layout.direction).toBe('col');
      expect(screen.background).toBe('window');
      expect(screen.children).toHaveLength(1);
      const list = screen.children[0]!;
      expectSolved(list);
      expect(list.bounds).toEqual({ x: 0, y: 0, width: 70, height: 13 });

      dispose();
    });
  });

  test('the detail screen stacks its three children one blank row apart', () => {
    createRoot((dispose) => {
      const loop = createEventLoop({ width: WIDTH, height: HEIGHT }, { caps });
      const canvas = at(drillDownStory.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      loop.mount(canvas);
      loop.renderRoot.flush();

      // `DetailScreen` is not exported, so it is reached the way a user reaches it: focus the list
      // and press Enter, which pushes the detail route.
      const router = routerOf(canvas);
      const rows = firstFocusable(router)!;
      loop.focusView(rows);
      loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift: false });
      loop.renderRoot.flush();

      expect(router.children).toHaveLength(2); // the list stays warm beneath the pushed screen
      const detail = router.children[1] as Group;
      expect(detail.children).toHaveLength(3);
      const [title, meta, back] = detail.children as [View, View, View];
      for (const child of [title, meta, back]) expectSolved(child);

      // One padding row, then a blank row between each pair.
      expect(title.bounds).toEqual({ x: 1, y: 1, width: 68, height: 1 });
      expect(meta.bounds).toEqual({ x: 1, y: 3, width: 68, height: 1 });
      expect(back.bounds).toEqual({ x: 1, y: 5, width: 68, height: 2 });

      dispose();
    });
  });
});

/** The story wraps its router in a `Group` beside a live location read-out; return the router. */
function routerOf(storyGroup: Group): Group {
  const router = storyGroup.children[1];
  if (!(router instanceof Group)) throw new Error('the story no longer places its router second');
  return router;
}
