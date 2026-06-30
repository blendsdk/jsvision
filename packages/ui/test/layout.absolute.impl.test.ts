/**
 * Implementation tests — RD-02 absolute placement internals (RD-05 Phase 0).
 *
 * Edge cases beyond the FX spec oracles: rect clamp/normalization (negative/non-finite sides),
 * the degenerate no-rect absolute box, mixed flow+absolute containers (flow indexing unaffected by
 * an interleaved absolute child), parent-padding offset, and absolute overflow past the parent.
 *
 * Trace: RD-05 03-00 §A · PA-15 (Error Handling table).
 */
import { test, expect } from 'vitest';
import { layout, type LayoutBox } from '../src/layout/index.js';

test('negative rect sides are clamped to non-negative integers (toCells)', () => {
  const abs: LayoutBox = {
    props: { position: 'absolute', rect: { x: -2, y: -1, width: -3, height: 4 } },
    children: [],
  };
  const root: LayoutBox = { props: {}, children: [abs] };

  const r = layout(root, { width: 20, height: 10 });

  expect(r.get(abs)).toEqual({ x: 0, y: 0, width: 0, height: 4 });
});

test('fractional rect sides floor to integers', () => {
  const abs: LayoutBox = {
    props: { position: 'absolute', rect: { x: 2.9, y: 1.2, width: 3.7, height: 2.5 } },
    children: [],
  };
  const root: LayoutBox = { props: {}, children: [abs] };

  const r = layout(root, { width: 20, height: 10 });

  expect(r.get(abs)).toEqual({ x: 2, y: 1, width: 3, height: 2 });
});

test('non-finite rect sides collapse to 0', () => {
  const abs: LayoutBox = {
    props: { position: 'absolute', rect: { x: Number.NaN, y: Number.POSITIVE_INFINITY, width: 5, height: 3 } },
    children: [],
  };
  const root: LayoutBox = { props: {}, children: [abs] };

  const r = layout(root, { width: 20, height: 10 });

  expect(r.get(abs)).toEqual({ x: 0, y: 0, width: 5, height: 3 });
});

test('an absolute box declared without a rect collapses to a degenerate zero rect (no throw)', () => {
  const abs: LayoutBox = { props: { position: 'absolute' }, children: [] };
  const root: LayoutBox = { props: {}, children: [abs] };

  const r = layout(root, { width: 20, height: 10 });

  expect(r.get(abs)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
});

test('mixed container: an interleaved absolute child does not disturb flow indexing', () => {
  const f1: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const abs: LayoutBox = { props: { position: 'absolute', rect: { x: 1, y: 0, width: 2, height: 1 } }, children: [] };
  const f2: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  // Absolute child sits between the two flow children in array order.
  const root: LayoutBox = { props: { direction: 'row' }, children: [f1, abs, f2] };

  const r = layout(root, { width: 10, height: 1 });

  // The two flow children split the full width as if the absolute child were absent.
  expect(r.get(f1)?.x).toBe(0);
  expect(r.get(f1)?.width).toBe(5);
  expect(r.get(f2)?.x).toBe(5);
  expect(r.get(f2)?.width).toBe(5);
  expect(r.get(abs)).toEqual({ x: 1, y: 0, width: 2, height: 1 });
});

test("an absolute child's rect is offset by the parent's padding (content-box-relative)", () => {
  const abs: LayoutBox = { props: { position: 'absolute', rect: { x: 0, y: 0, width: 2, height: 2 } }, children: [] };
  const root: LayoutBox = { props: { padding: 2 }, children: [abs] };

  const r = layout(root, { width: 20, height: 10 });

  // rect (0,0) is relative to the parent's content box origin, which padding 2 shifts to (2,2).
  expect(r.get(abs)).toEqual({ x: 2, y: 2, width: 2, height: 2 });
});

test('an absolute child larger than its parent keeps its full rect (overflow allowed)', () => {
  const abs: LayoutBox = {
    props: { position: 'absolute', rect: { x: 5, y: 5, width: 50, height: 50 } },
    children: [],
  };
  const root: LayoutBox = { props: {}, children: [abs] };

  const r = layout(root, { width: 20, height: 10 });

  expect(r.get(abs)).toEqual({ x: 5, y: 5, width: 50, height: 50 });
});
