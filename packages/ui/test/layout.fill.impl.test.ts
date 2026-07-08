/**
 * Implementation tests — the engine `position:'fill'` mode edge cases (written after the spec is
 * green). Covers a collapsed (zero-size) content box, a fill nested inside a fill, and a fill placed
 * beside several flow children.
 */
import { test, expect } from 'vitest';
import { layout, type LayoutBox } from '../src/layout/index.js';

// A padding larger than the box collapses the content box to zero; a fill child degrades to a
// zero-size rect at the content origin, no throw.
test('fill child of a collapsed content box → zero-size rect at the content origin', () => {
  const overlay: LayoutBox = { props: { position: 'fill' }, children: [] };
  const root: LayoutBox = { props: { padding: 3 }, children: [overlay] };

  const result = layout(root, { width: 4, height: 4 });

  expect(result.get(overlay)).toEqual({ x: 3, y: 3, width: 0, height: 0 });
});

// A fill nested inside a fill: the inner fill takes the outer fill's whole (padding-free) box,
// parent-relative to the outer.
test('fill inside a fill → inner takes the outer content box, parent-relative', () => {
  const inner: LayoutBox = { props: { position: 'fill' }, children: [] };
  const outer: LayoutBox = { props: { position: 'fill' }, children: [inner] };
  const root: LayoutBox = { props: { padding: 1 }, children: [outer] };

  const result = layout(root, { width: 12, height: 8 });

  // Outer fills the root content box.
  expect(result.get(outer)).toEqual({ x: 1, y: 1, width: 10, height: 6 });
  // Inner fills the outer (no padding on outer) → parent-relative origin (0,0).
  expect(result.get(inner)).toEqual({ x: 0, y: 0, width: 10, height: 6 });
});

// A fill child alongside multiple flow children: the flow children lay out normally (the fill takes
// no space), and the fill takes the whole content box.
test('fill beside [fixed 4, fixed 6] in a row of 20 → flow unchanged, fill = whole box', () => {
  const a: LayoutBox = { props: { size: { kind: 'fixed', cells: 4 } }, children: [] };
  const b: LayoutBox = { props: { size: { kind: 'fixed', cells: 6 } }, children: [] };
  const overlay: LayoutBox = { props: { position: 'fill' }, children: [] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [a, b, overlay] };

  const result = layout(root, { width: 20, height: 5 });

  expect(result.get(a)).toEqual({ x: 0, y: 0, width: 4, height: 5 });
  expect(result.get(b)).toEqual({ x: 4, y: 0, width: 6, height: 5 });
  expect(result.get(overlay)).toEqual({ x: 0, y: 0, width: 20, height: 5 });
});
