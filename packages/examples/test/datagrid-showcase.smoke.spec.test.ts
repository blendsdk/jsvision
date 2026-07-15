/**
 * Specification test (immutable oracle) — the datagrid-showcase registry + per-demo render.
 *
 * Source: the RD-15 showcase specification + the jsvision "kitchen-sink showcase (NON-NEGOTIABLE)"
 * rule (`codeops/kitchen-sink-gate.md`). Every registered `Story` MUST mount headlessly and paint
 * something — the mechanical "a demo exists + renders" guard, no TTY required — and the registry must
 * stay hygienic (unique ids, required metadata). Expectations derive from RD-15, never from a demo's
 * internals.
 *
 * Real `@jsvision/ui` `RenderRoot` over fixed caps; each demo is built + mounted + composed, then the
 * buffer is asserted non-empty. The `.js` extension in import specifiers is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, createRenderRoot, createRoot } from '@jsvision/ui';
import { STORIES } from '../datagrid-showcase/stories/index.js';
import { at } from '../datagrid-showcase/story.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const WIDTH = 72;
const HEIGHT = 20;

/** Count cells that were actually painted (a bare frame / empty view leaves only spaces). */
function paintedCells(rows: readonly { char: string }[][]): number {
  let n = 0;
  for (const row of rows) for (const cell of row) if (cell.char !== ' ') n += 1;
  return n;
}

// ST-1 — the registry is non-empty.
test('ST-1: the registry is non-empty', () => {
  expect(STORIES.length).toBeGreaterThan(0);
});

// ST-2 — every registered demo carries the required metadata.
test('ST-2: every demo carries the required metadata (id/category/title/blurb)', () => {
  for (const story of STORIES) {
    expect(story.id, 'id').toBeTruthy();
    expect(story.category, `${story.id} category`).toBeTruthy();
    expect(story.title, `${story.id} title`).toBeTruthy();
    expect(story.blurb, `${story.id} blurb`).toBeTruthy();
  }
});

// ST-3 — ids are unique (the shell uses them as navigation command names).
test('ST-3: demo ids are unique', () => {
  const ids = STORIES.map((s) => s.id);
  expect(new Set(ids).size).toBe(ids.length);
});

// ST-4 — each demo builds + mounts + draws without throwing, and paints at least one non-blank cell.
for (const story of STORIES) {
  test(`ST-4: demo "${story.id}" mounts headlessly and paints`, () => {
    // Build inside a disposable owner (as the shell does) so any demo computeds/effects are owned.
    createRoot((dispose) => {
      const view = at(story.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
      const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps });
      expect(() => rr.mount(view)).not.toThrow();
      expect(paintedCells(rr.buffer().rows()), `${story.id} painted nothing`).toBeGreaterThan(0);
      dispose();
    });
  });
}

// ST-6 — the "coming soon" roadmap band is exactly the eight not-yet-shipped RDs (RD-07…RD-14).
test('ST-6: the Roadmap category holds exactly 8 placeholder entries (RD-07…RD-14)', () => {
  const roadmap = STORIES.filter((s) => s.category === 'Roadmap');
  expect(roadmap.length).toBe(8);
});
