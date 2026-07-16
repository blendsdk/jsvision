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

// ST-6 — the "coming soon" roadmap band is exactly the six not-yet-shipped RDs (RD-09…RD-14); RD-07
// (Columns & layout) and RD-08 (Rows & selection) have shipped, so their placeholders were replaced by
// live clusters.
test('ST-6: the Roadmap category holds exactly 6 placeholder entries (RD-09…RD-14)', () => {
  const roadmap = STORIES.filter((s) => s.category === 'Roadmap');
  expect(roadmap.length).toBe(6);
});

// The navigator categories the inventory defines: the shipped clusters (Columns & layout landed with
// RD-07) plus the roadmap band. A future RD adding a cluster updates this list.
const CATEGORIES = [
  'Foundation',
  'Editing',
  'Cell editors',
  'Formatting',
  'Sorting',
  'Filtering',
  'Columns & layout',
  'Rows & selection',
  'Roadmap',
] as const;

// ST-5 — every navigator category is present (a future RD adding a cluster updates this list).
test('ST-5: all navigator categories are present', () => {
  const present = new Set(STORIES.map((s) => s.category));
  for (const c of CATEGORIES) {
    expect(present.has(c), `category "${c}" present`).toBe(true);
  }
});

// ST-7 — each shipped cluster carries its full demo count (the §Demo Inventory scope).
test('ST-7: each shipped cluster has its full demo count', () => {
  const counts: Record<string, number> = {};
  for (const s of STORIES) counts[s.category] = (counts[s.category] ?? 0) + 1;
  expect(counts['Foundation'], 'Foundation').toBe(5);
  expect(counts['Editing'], 'Editing').toBe(5);
  expect(counts['Cell editors'], 'Cell editors').toBe(9);
  expect(counts['Formatting'], 'Formatting').toBe(8);
  expect(counts['Sorting'], 'Sorting').toBe(5);
  expect(counts['Filtering'], 'Filtering').toBe(6);
  expect(counts['Columns & layout'], 'Columns & layout').toBe(5);
  expect(counts['Rows & selection'], 'Rows & selection').toBe(5);
});
