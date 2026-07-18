/**
 * Specification test (immutable oracle) — the in-package datagrid showcase registry. Every registered
 * `Story` MUST mount headlessly and draw something, and the registry must stay hygienic (unique ids,
 * required metadata). This is the mechanical "a story exists + renders" guard, no TTY required.
 *
 * Real `@jsvision/ui` `RenderRoot` over fixed caps; each story is built + mounted + composed, then the
 * buffer is asserted non-empty. Expectations derive from the showcase contract, not story internals.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, createRenderRoot, createRoot } from '@jsvision/ui';
import { STORIES } from './kitchen-sink/stories/index.js';
import { at } from './kitchen-sink/story.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const WIDTH = 40;
const HEIGHT = 10;

/** Count cells that were actually painted (a bare/empty view leaves only spaces). */
function paintedCells(rows: readonly { char: string }[][]): number {
  let n = 0;
  for (const row of rows) for (const cell of row) if (cell.char !== ' ') n += 1;
  return n;
}

test('the registry is non-empty and every story carries the required metadata', () => {
  expect(STORIES.length).toBeGreaterThan(0);
  for (const story of STORIES) {
    expect(story.id, 'id').toBeTruthy();
    expect(story.category, `${story.id} category`).toBeTruthy();
    expect(story.title, `${story.id} title`).toBeTruthy();
    expect(story.blurb, `${story.id} blurb`).toBeTruthy();
  }
});

test('story ids are unique', () => {
  const ids = STORIES.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});

// ST-12 — each story builds + mounts + draws without throwing, and paints at least one non-blank cell.
for (const story of STORIES) {
  test(`story "${story.id}" mounts headlessly and paints`, () => {
    createRoot((dispose) => {
      const view = at(story.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
      expect(() => rr.mount(view)).not.toThrow();
      expect(paintedCells(rr.buffer().rows()), `${story.id} painted nothing`).toBeGreaterThan(0);
      dispose();
    });
  });
}
