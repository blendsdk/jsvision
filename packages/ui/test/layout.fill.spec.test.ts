/**
 * Specification tests (immutable oracles) — the engine `position:'fill'` overlay mode.
 *
 * ST-1…ST-5 assert exact integer rects through the public `layout()` function. A `fill` child takes
 * its parent's whole content box, overlaps siblings, reserves no flow space, is excluded from the
 * parent's intrinsic size, and ignores `justify`/`align`. If one fails after implementation, the
 * implementation is wrong.
 */
import { test, expect } from 'vitest';
import { layout, type LayoutBox } from '../src/layout/index.js';

// ST-1 — a `position:'fill'` child of a padded container gets the content box exactly.
test('ST-1: fill child of a padding:2 container in 20×10 → the content box {2,2,16,6}', () => {
  const overlay: LayoutBox = { props: { position: 'fill' }, children: [] };
  const root: LayoutBox = { props: { padding: 2 }, children: [overlay] };

  const result = layout(root, { width: 20, height: 10 });

  expect(result.get(overlay)).toEqual({ x: 2, y: 2, width: 16, height: 6 });
});

// ST-2 — a fill child reserves no flow space: the flow sibling fills as if the fill child were absent.
test('ST-2: fill child reserves no flow space — the grow sibling fills the whole content width', () => {
  const flow: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const overlay: LayoutBox = { props: { position: 'fill' }, children: [] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [flow, overlay] };

  const result = layout(root, { width: 30, height: 5 });

  // Identical to the fill child being absent: the flow child owns the full 30 cells at x 0.
  expect(result.get(flow)).toEqual({ x: 0, y: 0, width: 30, height: 5 });
});

// ST-3 — a fill child is excluded from the parent's intrinsic size (auto measures flow only).
test('ST-3: fill child excluded from intrinsic size — auto container measures to its flow child (5)', () => {
  const fixed: LayoutBox = { props: { size: { kind: 'fixed', cells: 5 } }, children: [] };
  const overlay: LayoutBox = { props: { position: 'fill' }, children: [] };
  const autoRow: LayoutBox = {
    props: { direction: 'row', size: { kind: 'auto' } },
    children: [fixed, overlay],
  };
  const root: LayoutBox = { props: { direction: 'row' }, children: [autoRow] };

  const result = layout(root, { width: 40, height: 3 });

  // Natural main extent is the flow child only (5) — the fill overlay does not inflate it.
  expect(result.get(autoRow)?.width).toBe(5);
});

// ST-4 — a fill child ignores justify/align: it originates at the content-box origin and fills it.
test('ST-4: fill child ignores justify:center/align:center — originates at content origin, fills', () => {
  const overlay: LayoutBox = { props: { position: 'fill' }, children: [] };
  const root: LayoutBox = {
    props: { direction: 'row', justify: 'center', align: 'center', padding: 1 },
    children: [overlay],
  };

  const result = layout(root, { width: 20, height: 10 });

  // Outside the flow: justify/align never move it; it is the content box {1,1,18,8}.
  expect(result.get(overlay)).toEqual({ x: 1, y: 1, width: 18, height: 8 });
});

// ST-5 — two fill children resolve to the same content-box rect (they overlap).
test('ST-5: two fill children resolve to the same content-box rect (overlap)', () => {
  const a: LayoutBox = { props: { position: 'fill' }, children: [] };
  const b: LayoutBox = { props: { position: 'fill' }, children: [] };
  const root: LayoutBox = { props: { padding: 1 }, children: [a, b] };

  const result = layout(root, { width: 12, height: 8 });

  const expected = { x: 1, y: 1, width: 10, height: 6 };
  expect(result.get(a)).toEqual(expected);
  expect(result.get(b)).toEqual(expected);
});
