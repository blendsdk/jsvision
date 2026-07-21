/**
 * Specification tests (immutable oracles) — RD-02 layout engine, Phase 1.
 *
 * ST-01…ST-06 derive from RD-02 acceptance criteria AC-1…AC-6 (main-axis
 * sizing: `fixed`/`fr` apportionment, `auto` via `measure`, `auto` containers
 * derived from children, `gap` between children only). They assert exact
 * integer rects through the public `layout()` function — never from reading the
 * implementation. If one fails after implementation, the implementation is wrong.
 *
 * Trace: RD-02 §Acceptance Criteria 1–6 · AR-19, AR-20, AR-21, AR-29.
 */
import { test, expect } from 'vitest';
import { layout, type LayoutBox } from '../src/layout/index.js';
import { normalizeSize } from '../src/layout/types.js';

// ST-01 / AC-1 — a row of [fixed 3, fr 1] within width 10 fills exactly.
test('ST-01: row [fixed 3, fr 1] in width 10 → widths [3, 7] summing exactly to 10', () => {
  const a: LayoutBox = { props: { size: { kind: 'fixed', cells: 3 } }, children: [] };
  const b: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [a, b] };

  const result = layout(root, { width: 10, height: 1 });

  expect(result.get(a)?.width).toBe(3);
  expect(result.get(b)?.width).toBe(7);
  // Fills exactly — no gap, no overlap at the flex boundary.
  expect((result.get(a)?.width ?? 0) + (result.get(b)?.width ?? 0)).toBe(10);
  expect(result.get(a)?.x).toBe(0);
  expect(result.get(b)?.x).toBe(3);
});

// ST-02 / AC-2 — three equal-fr children across 80 cells → 27,27,26 (matches the solveTrack golden).
test('ST-02: row [fr 1, fr 1, fr 1] in width 80 → widths [27, 27, 26], leftover to earliest', () => {
  const a: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const b: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const c: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [a, b, c] };

  const result = layout(root, { width: 80, height: 1 });

  expect(result.get(a)?.width).toBe(27);
  expect(result.get(b)?.width).toBe(27);
  expect(result.get(c)?.width).toBe(26);
  expect((result.get(a)?.width ?? 0) + (result.get(b)?.width ?? 0) + (result.get(c)?.width ?? 0)).toBe(80);
});

// ST-03 / AC-3 — fixed kept, fr split only the remainder, sum exactly to the container.
test('ST-03: row [fixed 5, fr 1, fr 1] in width 20 → widths [5, 8, 7]', () => {
  const a: LayoutBox = { props: { size: { kind: 'fixed', cells: 5 } }, children: [] };
  const b: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const c: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [a, b, c] };

  const result = layout(root, { width: 20, height: 1 });

  expect(result.get(a)?.width).toBe(5);
  expect(result.get(b)?.width).toBe(8);
  expect(result.get(c)?.width).toBe(7);
  expect((result.get(a)?.width ?? 0) + (result.get(b)?.width ?? 0) + (result.get(c)?.width ?? 0)).toBe(20);
});

// ST-04 / AC-4 — an `auto` leaf whose measure() reports width 5 is laid out at width 5.
test('ST-04: row child auto with measure()→{5,1} → laid out at width 5', () => {
  const a: LayoutBox = {
    props: { size: { kind: 'auto' } },
    children: [],
    measure: () => ({ width: 5, height: 1 }),
  };
  const root: LayoutBox = { props: { direction: 'row' }, children: [a] };

  const result = layout(root, { width: 10, height: 1 });

  expect(result.get(a)?.width).toBe(5);
});

// ST-05 / AC-5 — an `auto` row (no measure) with [fixed 3, fixed 4] + gap:1 has natural width 8;
// observed by nesting it so its rect is sized to its natural width, and its children placed within.
test('ST-05: auto row [fixed 3, fixed 4] gap 1 → natural width 8; children at x 0 and 4', () => {
  const c1: LayoutBox = { props: { size: { kind: 'fixed', cells: 3 } }, children: [] };
  const c2: LayoutBox = { props: { size: { kind: 'fixed', cells: 4 } }, children: [] };
  const autoRow: LayoutBox = {
    props: { direction: 'row', size: { kind: 'auto' }, gap: 1 },
    children: [c1, c2],
  };
  const root: LayoutBox = { props: { direction: 'row' }, children: [autoRow] };

  const result = layout(root, { width: 20, height: 1 });

  // Natural width derived from children: 3 + 4 + gap(1) = 8.
  expect(result.get(autoRow)?.width).toBe(8);
  // Children placed within the auto row's content box; gap between only.
  expect(result.get(c1)?.x).toBe(0);
  expect(result.get(c1)?.width).toBe(3);
  expect(result.get(c2)?.x).toBe(4);
  expect(result.get(c2)?.width).toBe(4);
});

// ST-06 / AC-6 — gap:2 inserts 2 cells between adjacent pairs, never before the first or after the last.
test('ST-06: row [fixed 2, fixed 2, fixed 2] gap 2 → x offsets 0, 4, 8', () => {
  const a: LayoutBox = { props: { size: { kind: 'fixed', cells: 2 } }, children: [] };
  const b: LayoutBox = { props: { size: { kind: 'fixed', cells: 2 } }, children: [] };
  const c: LayoutBox = { props: { size: { kind: 'fixed', cells: 2 } }, children: [] };
  const root: LayoutBox = { props: { direction: 'row', gap: 2 }, children: [a, b, c] };

  const result = layout(root, { width: 20, height: 1 });

  expect(result.get(a)?.x).toBe(0);
  expect(result.get(b)?.x).toBe(4);
  expect(result.get(c)?.x).toBe(8);
  expect(result.get(a)?.width).toBe(2);
  expect(result.get(b)?.width).toBe(2);
  expect(result.get(c)?.width).toBe(2);
});

// ---------------------------------------------------------------------------
// Minimum-size support on the `fr` variant (split-panes feature). Ids are
// qualified `ST-N (split-panes)` because this file already numbers its own
// cases ST-01…ST-06 — a bare `ST-8` under `ST-06` would read as this file's
// next case, which it is not.
// ---------------------------------------------------------------------------

// ST-8 (split-panes) — a negative `fr` minimum floors to 0, exactly as `fixed`
// cells are clamped. `normalizeSize` is module-private (absent from the barrel);
// tested through a direct relative import, the pack-row precedent.
test('ST-8 (split-panes): normalizeSize floors a negative fr min to 0', () => {
  expect(normalizeSize({ kind: 'fr', weight: 1, min: -5 })).toEqual({ kind: 'fr', weight: 1, min: 0 });
});

// ST-9 (split-panes) — an `fr` child contributes its `min` (not 0) to an `auto`
// container's natural size, so a shrink-to-fit parent reserves the floor. The
// auto row is nested so its rect is sized to its natural main and can be read.
test('ST-9 (split-panes): an auto container measures an fr child min:20 as 20 on the main axis', () => {
  const child: LayoutBox = { props: { size: { kind: 'fr', weight: 1, min: 20 } }, children: [] };
  const autoRow: LayoutBox = { props: { direction: 'row', size: { kind: 'auto' } }, children: [child] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [autoRow] };

  const result = layout(root, { width: 100, height: 1 });

  // Today an fr child contributes 0, so this measures 0 until min support lands.
  expect(result.get(autoRow)?.width).toBe(20);
});
