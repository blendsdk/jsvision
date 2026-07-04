/**
 * Specification test (immutable oracle) — the kitchen-sink showcase registry.
 *
 * Source: the jsvision "kitchen-sink showcase (NON-NEGOTIABLE)" rule (repo `CLAUDE.md` +
 * `codeops/kitchen-sink-gate.md`). Every registered `Story` MUST mount headlessly and draw
 * something — this is the CI guard that keeps stories from rotting and makes "a story exists +
 * renders" mechanically checkable without a TTY. It also enforces the registry hygiene the shell
 * relies on (unique ids, required metadata).
 *
 * Real `@jsvision/ui` `RenderRoot` over fixed caps; each story is built + mounted + composed, then
 * the buffer is asserted non-empty. Expectations derive from the showcase contract, not the stories'
 * internals. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createRenderRoot, createRoot } from '@jsvision/ui';
import { STORIES } from '../kitchen-sink/stories/index.js';
import { at } from '../kitchen-sink/story.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const WIDTH = 72;
const HEIGHT = 16;

/** Count cells that were actually painted (a bare frame/empty view leaves only spaces). */
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

test('story ids are unique (the shell uses them as menu command names)', () => {
  const ids = STORIES.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});

// ST-24 (RD-16 AC-12) — the DataGrid showcase story is registered, carries a unique id, and paints
// at least one non-blank cell headlessly.
test('ST-24: the data-grid story is registered and paints', () => {
  const story = STORIES.find((s) => s.id === 'data-grid');
  expect(story, 'a story with id "data-grid" is registered').toBeTruthy();
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    expect(paintedCells(rr.buffer().rows()), 'the data-grid story painted nothing').toBeGreaterThan(0);
    dispose();
  });
});

// ST-35 (RD-17 AC-13) — the Tabs showcase story is registered, carries the required metadata
// (unique id `containers/tabs`, category `Containers`, an `rd`), and paints at least one non-blank
// cell headlessly.
test('ST-35: the containers/tabs story is registered with metadata and paints', () => {
  const story = STORIES.find((s) => s.id === 'containers/tabs');
  expect(story, 'a story with id "containers/tabs" is registered').toBeTruthy();
  expect(story!.category, 'category Containers').toBe('Containers');
  expect(story!.rd, 'provenance RD chip').toBeTruthy();
  createRoot((dispose) => {
    const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
    rr.mount(view);
    expect(paintedCells(rr.buffer().rows()), 'the tabs story painted nothing').toBeGreaterThan(0);
    dispose();
  });
});

// ST-13 (RD-18 AC-13) — the Feedback showcase stories are registered with the required metadata
// (unique ids `feedback/progress-bar` + `feedback/spinner`, category `Feedback`, an `rd`) and each
// paints at least one non-blank cell headlessly.
for (const id of ['feedback/progress-bar', 'feedback/spinner']) {
  test(`ST-13: the ${id} story is registered with metadata and paints`, () => {
    const story = STORIES.find((s) => s.id === id);
    expect(story, `a story with id "${id}" is registered`).toBeTruthy();
    expect(story!.category, 'category Feedback').toBe('Feedback');
    expect(story!.rd, 'provenance RD chip').toBeTruthy();
    createRoot((dispose) => {
      const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
      rr.mount(view);
      expect(paintedCells(rr.buffer().rows()), `the ${id} story painted nothing`).toBeGreaterThan(0);
      dispose();
    });
  });
}

// ST-16 (RD-20 AC-16) — the Date showcase stories are registered with the required metadata (unique
// ids `date/calendar` + `date/date-picker`, category `Date`, an `rd`) and each paints headlessly.
for (const id of ['date/calendar', 'date/date-picker']) {
  test(`ST-16: the ${id} story is registered with metadata and paints`, () => {
    const story = STORIES.find((s) => s.id === id);
    expect(story, `a story with id "${id}" is registered`).toBeTruthy();
    expect(story!.category, 'category Date').toBe('Date');
    expect(story!.rd, 'provenance RD chip').toBeTruthy();
    createRoot((dispose) => {
      const view = at(story!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
      rr.mount(view);
      expect(paintedCells(rr.buffer().rows()), `the ${id} story painted nothing`).toBeGreaterThan(0);
      dispose();
    });
  });
}

// The core smoke oracle: each story builds + mounts + draws without throwing, and paints something.
for (const story of STORIES) {
  test(`story "${story.id}" mounts headlessly and paints`, () => {
    // Build inside a disposable owner (as the shell does) so any story computeds/effects are owned.
    createRoot((dispose) => {
      const view = at(story.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
      expect(() => rr.mount(view)).not.toThrow();
      expect(paintedCells(rr.buffer().rows()), `${story.id} painted nothing`).toBeGreaterThan(0);
      dispose();
    });
  });
}
