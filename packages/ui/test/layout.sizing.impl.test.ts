/**
 * Implementation tests — RD-02 layout engine, Phase 1 (main-axis sizing internals).
 *
 * Covers internals and edges not pinned by the spec oracles: ≥ 0 clamps on
 * negative `fixed.cells`/`fr.weight`/`gap`, mixed `fr` weights, recursive
 * natural sizing of nested `auto` containers, and integer clamping of a
 * fractional `measure()` result.
 */
import { test, expect } from 'vitest';
import { layout, type LayoutBox } from '../src/layout/index.js';

test('negative gap is clamped to 0 — children pack with no spacing', () => {
  const a: LayoutBox = { props: { size: { kind: 'fixed', cells: 2 } }, children: [] };
  const b: LayoutBox = { props: { size: { kind: 'fixed', cells: 2 } }, children: [] };
  const root: LayoutBox = { props: { direction: 'row', gap: -3 }, children: [a, b] };

  const result = layout(root, { width: 20, height: 1 });

  expect(result.get(a)?.x).toBe(0);
  expect(result.get(b)?.x).toBe(2);
});

test('negative fixed.cells is clamped to 0 width', () => {
  const a: LayoutBox = { props: { size: { kind: 'fixed', cells: -5 } }, children: [] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [a] };

  const result = layout(root, { width: 10, height: 1 });

  expect(result.get(a)?.width).toBe(0);
});

test('negative fr.weight is clamped to 0 — sibling fr absorbs all space', () => {
  const a: LayoutBox = { props: { size: { kind: 'fr', weight: -1 } }, children: [] };
  const b: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [a, b] };

  const result = layout(root, { width: 10, height: 1 });

  expect(result.get(a)?.width).toBe(0);
  expect(result.get(b)?.width).toBe(10);
});

test('mixed fr weights split proportionally and exactly: [2,1] of 30 → [20,10]', () => {
  const a: LayoutBox = { props: { size: { kind: 'fr', weight: 2 } }, children: [] };
  const b: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [a, b] };

  const result = layout(root, { width: 30, height: 1 });

  expect(result.get(a)?.width).toBe(20);
  expect(result.get(b)?.width).toBe(10);
});

test('an auto container nesting an auto container derives its natural size recursively', () => {
  const leaf: LayoutBox = { props: { size: { kind: 'fixed', cells: 4 } }, children: [] };
  const inner: LayoutBox = { props: { direction: 'row', size: { kind: 'auto' } }, children: [leaf] };
  const outer: LayoutBox = { props: { direction: 'row', size: { kind: 'auto' } }, children: [inner] };
  const root: LayoutBox = { props: { direction: 'row' }, children: [outer] };

  const result = layout(root, { width: 20, height: 1 });

  // Natural width composes bottom-up: leaf 4 → inner 4 → outer 4.
  expect(result.get(outer)?.width).toBe(4);
  expect(result.get(inner)?.width).toBe(4);
  expect(result.get(leaf)?.width).toBe(4);
  // Parent-relative origins: each nested box starts at x 0 within its parent.
  expect(result.get(outer)?.x).toBe(0);
  expect(result.get(inner)?.x).toBe(0);
  expect(result.get(leaf)?.x).toBe(0);
});

test('a fractional measure() result is clamped to integer cells (floor)', () => {
  const a: LayoutBox = {
    props: { size: { kind: 'auto' } },
    children: [],
    measure: () => ({ width: 5.9, height: 1.2 }),
  };
  const root: LayoutBox = { props: { direction: 'row' }, children: [a] };

  const result = layout(root, { width: 10, height: 1 });

  expect(result.get(a)?.width).toBe(5);
});
