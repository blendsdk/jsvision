/**
 * Implementation test — RD-15 `graph.ts` edge cases + internals (written AFTER the spec is green).
 *
 * Covers the `lines` bitmask across deep/mixed sibling context, `guides=false` width parity, the
 * `MAX_DEPTH` cycle guard, the empty forest, and the leaf-always-`ovExpanded` invariant that makes
 * the defensive marker equal TV's. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';

import { createGraph, flattenVisible, graphWidth, OV_EXPANDED, OV_CHILDREN, OV_LAST } from '../src/tree/graph.js';
import type { TreeNode } from '../src/tree/graph.js';

function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

test('lines bitmask threads ancestor continuations through a deep, mixed-sibling tree', () => {
  //   R            ┐ (forest root, NOT last — S follows) ⇒ its subtree keeps bit 0
  //   ├ C1         ┐ (not last — C2 follows) ⇒ its subtree keeps bit 1
  //   │ └ G1       (last leaf, level 2)
  //   └ C2         (last)
  //   S            (last root)
  const g1 = node('G1');
  const c1 = node('C1', [g1]);
  const c2 = node('C2');
  const r = node('R', [c1, c2]);
  const s = node('S');
  const rows = flattenVisible([r, s], () => true);

  expect(rows.map((x) => x.node)).toEqual([r, c1, g1, c2, s]); // display order
  expect(rows.map((x) => x.lines)).toEqual([
    0, // R: no ancestors
    0b1, // C1: ancestor level 0 (R) has a continued sibling (S) below
    0b11, // G1: level 0 (R→S) AND level 1 (C1→C2) both continue
    0b1, // C2: level 0 (R→S) continues
    0, // S: last root, no continuation
  ]);

  // The G1 prefix draws `│` at both ancestor columns (cols 0 and 3), then `└──`.
  const g1Graph = createGraph(2, 0b11, OV_LAST | OV_EXPANDED);
  expect([...g1Graph][0]).toBe('│');
  expect([...g1Graph][3]).toBe('│');
  expect([...g1Graph].slice(6)).toEqual(['└', '─', '─']);
});

test('guides=false preserves total width at every level (width = level*3 + 3)', () => {
  for (const level of [0, 1, 2, 3, 5, 8]) {
    const on = createGraph(level, 0b101, OV_CHILDREN);
    const off = createGraph(level, 0b101, OV_CHILDREN, false);
    expect([...on]).toHaveLength(graphWidth(level));
    expect([...off]).toHaveLength(graphWidth(level));
  }
});

test('flattenVisible is depth-guarded: a pathological deep chain terminates and truncates', () => {
  let deep = node('leaf');
  for (let i = 0; i < 1000; i += 1) deep = node(`n${i}`, [deep]);
  const rows = flattenVisible([deep], () => true);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.length).toBeLessThan(1000); // the MAX_DEPTH guard truncated the 1000-deep chain
});

test('flattenVisible over an empty forest returns no rows', () => {
  expect(flattenVisible([], () => true)).toEqual([]);
});

test('a leaf forest row is OV_LAST|OV_EXPANDED (single root, no children)', () => {
  const only = node('only');
  const rows = flattenVisible([only], () => false);
  expect(rows).toHaveLength(1);
  expect(rows[0].flags & OV_LAST).toBeTruthy();
  expect(rows[0].flags & OV_EXPANDED).toBeTruthy();
  expect(rows[0].flags & OV_CHILDREN).toBeFalsy();
});

test('every leaf row carries OV_EXPANDED, so its marker is `─`, never `+` (toutline.cpp:200)', () => {
  const leaves = [node('a'), node('b'), node('c')];
  const parent = node('p', leaves);
  const rows = flattenVisible([parent], () => true);
  for (const r of rows) {
    if (r.node.children.length === 0) {
      expect(r.flags & OV_EXPANDED).toBeTruthy();
      expect(createGraph(r.level, r.lines, r.flags).endsWith('+')).toBe(false);
    }
  }
});
