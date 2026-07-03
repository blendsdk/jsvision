/**
 * Specification test — jsvision-ui RD-15 `graph.ts` line-prefix builder + flatten (ST-1…ST-7).
 *
 * Immutable oracle. Expectations derive ONLY from RD-15 (AC-1/AC-2/AC-4/AC-13) and the Turbo Vision
 * GATE-1 decode (`toutline.cpp` — the fidelity oracle), never from the implementation:
 *   • `graphChars = "\x20\xB3\xC3\xC0\xC4\xC4+\xC4"` (`toutline.cpp:367`) → CP437→unambiguous-narrow
 *     Unicode: space · `│` · `├` · `└` · `─` · `─` · `+` · `─` (decode §1).
 *   • `levelWidth = 3`, `endWidth = 3` (`toutline.cpp:366`); `createGraph` (`:165-205`) emits, per
 *     ancestor level, `[│ or space][2 fillers]`, then a 3-column end graphic `[fork/corner][─][marker]`
 *     (the inner End-Filler `memset` is skipped at endWidth=3 — the third `--endWidth>0` is false).
 *   • flags `ovExpanded=0x01 · ovChildren=0x02 · ovLast=0x04` (`outline.h:27-29`); `traverseTree`
 *     (`:262-322`) sets `ovLast` for a last sibling, `ovChildren` when expanded-with-children, and
 *     `ovExpanded` when expanded OR a leaf (`!children`).
 *
 * `flattenVisible` is the jsvision walk (forest of roots = the TV root + its `getNext` siblings,
 * `:310-320`) producing the same per-row `{level, lines, flags}` `createGraph` consumes.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';

import { createGraph, flattenVisible, OV_EXPANDED, OV_CHILDREN, OV_LAST } from '../src/tree/graph.js';
import type { TreeNode } from '../src/tree/graph.js';

// TV graphChars decode (§1) — the oracle glyphs, transcribed from source (not the implementation).
const LEVEL_MARK = '│'; // │
const FORK = '├'; // ├ (non-last)
const CORNER = '└'; // └ (last)
const H_FILL = '─'; // ─
const MARK_COLLAPSED = '+';
const MARK_EXPANDED = '─'; // ─

/** Terse node builder for fixtures (leaf = `children: []`). */
function node<T>(value: T, children: TreeNode<T>[] = []): TreeNode<T> {
  return { value, children };
}

/** The display-order code points of a graph string (all glyphs are width-1). */
function cells(graph: string): string[] {
  return [...graph];
}

// --- createGraph (ST-1…ST-5) -------------------------------------------------------------------

test('ST-1: createGraph(0, 0, OV_CHILDREN) — collapsed root with children ends in the `+` marker, width 3, no brackets', () => {
  const g = createGraph(0, 0, OV_CHILDREN);
  expect(cells(g)).toHaveLength(3); // END_WIDTH, level 0 has no ancestor columns
  expect(g.endsWith(MARK_COLLAPSED)).toBe(true);
  expect(g).not.toContain('['); // no `[+]`/`[-]` brackets — bare `+`
  expect(g).not.toContain(']');
  expect(cells(g)).toEqual([FORK, H_FILL, MARK_COLLAPSED]); // ├─+
});

test('ST-2: createGraph(0, 0, OV_CHILDREN|OV_EXPANDED) — expanded ends in `─`, not `+`', () => {
  const g = createGraph(0, 0, OV_CHILDREN | OV_EXPANDED);
  expect([...g].at(-1)).toBe(MARK_EXPANDED);
  expect(g.endsWith(MARK_COLLAPSED)).toBe(false);
  expect(cells(g)).toEqual([FORK, H_FILL, MARK_EXPANDED]); // ├──
});

test('ST-3: level-1 end graphic uses `└` when last, `├` when not; ancestor column is `│` iff its lines bit is set', () => {
  // Last child at level 1, lines=0 (ancestor level 0 has no continued sibling) → "   └──".
  const last = createGraph(1, 0, OV_LAST | OV_EXPANDED);
  expect(cells(last).slice(0, 3)).toEqual([' ', ' ', ' ']); // ancestor filler (bit unset → space)
  expect(cells(last)[3]).toBe(CORNER); // └

  // Non-last at level 1 → "   ├──".
  const nonLast = createGraph(1, 0, OV_EXPANDED);
  expect(cells(nonLast)[3]).toBe(FORK); // ├

  // lines bit 0 set → ancestor column renders `│` (a continued sibling below) → "│  └──".
  const continued = createGraph(1, 0b1, OV_LAST | OV_EXPANDED);
  expect(cells(continued)[0]).toBe(LEVEL_MARK); // │
  expect(cells(continued).slice(1, 3)).toEqual([' ', ' ']); // then 2 fillers
});

test('ST-4: a leaf (no children) shows the `─` marker column, never `+`', () => {
  // A leaf gets ovExpanded (traverseTree: `!children` ⇒ ovExpanded) and no ovChildren.
  const leaf = createGraph(0, 0, OV_EXPANDED);
  expect([...leaf].at(-1)).toBe(MARK_EXPANDED);
  expect(leaf).not.toContain(MARK_COLLAPSED);
  // Even with no flags at all, the marker is `─` (only collapsed-WITH-children shows `+`).
  expect([...createGraph(0, 0, 0)].at(-1)).toBe(MARK_EXPANDED);
});

test('ST-5: guides=false renders the `│├└─` connectors as spaces, keeps the marker column + total width', () => {
  const on = createGraph(1, 0b1, OV_CHILDREN); // "│  ├─+"
  const off = createGraph(1, 0b1, OV_CHILDREN, false); // "     +"
  expect(cells(off)).toHaveLength(cells(on).length); // identical width
  expect(off.endsWith(MARK_COLLAPSED)).toBe(true); // marker column unchanged
  expect(/[│├└─]/.test(off)).toBe(false); // no connector glyphs remain
  expect(on).toContain(LEVEL_MARK); // guides on DID draw them
  expect(on).toContain(FORK);
});

// --- flattenVisible (ST-6, ST-7) ---------------------------------------------------------------

test('ST-6: flattenVisible hides a collapsed subtree, re-includes it on expand in display order, with correct flags', () => {
  //   A
  //   ├ A1
  //   │ └ A1a
  //   └ A2
  const a1a = node('A1a');
  const a1 = node('A1', [a1a]);
  const a2 = node('A2');
  const a = node('A', [a1, a2]);
  const forest = [a];
  const expanded = new Set<TreeNode<string>>();
  const isExpanded = (n: TreeNode<string>): boolean => expanded.has(n);

  // Nothing expanded → only the root row (its children are hidden).
  const collapsed = flattenVisible(forest, isExpanded);
  expect(collapsed.map((r) => r.node)).toEqual([a]);
  expect(collapsed[0].flags & OV_LAST).toBeTruthy(); // A is the only root ⇒ last

  // Expand A → A1, A2 appear; A1a stays hidden (A1 still collapsed).
  expanded.add(a);
  const l1 = flattenVisible(forest, isExpanded);
  expect(l1.map((r) => r.node)).toEqual([a, a1, a2]);
  const rowA1 = l1[1];
  expect(rowA1.flags).toBe(0); // collapsed, non-last, with children ⇒ no OV_* bits
  const rowA2 = l1[2];
  expect(rowA2.flags & OV_LAST).toBeTruthy();
  expect(rowA2.flags & OV_EXPANDED).toBeTruthy(); // A2 is a leaf ⇒ ovExpanded

  // Expand A1 too → A1a appears between A1 and A2 (display order).
  expanded.add(a1);
  const l2 = flattenVisible(forest, isExpanded);
  expect(l2.map((r) => r.node)).toEqual([a, a1, a1a, a2]);
  expect(l2[1].flags & OV_CHILDREN).toBeTruthy(); // A1 now expanded-with-children
  expect(l2[1].flags & OV_EXPANDED).toBeTruthy();
});

test('ST-7: flattenVisible walks a forest of 2 roots in order; a pathological deep chain is depth-guarded (no throw)', () => {
  const r1a = node('R1a');
  const r2a = node('R2a');
  const r1 = node('R1', [r1a]);
  const r2 = node('R2', [r2a]);
  const forest = [r1, r2];
  const expandedAll = (): boolean => true; // everything expanded

  const rows = flattenVisible(forest, expandedAll);
  expect(rows.map((r) => r.node)).toEqual([r1, r1a, r2, r2a]);
  expect(rows[2].flags & OV_LAST).toBeTruthy(); // R2 is the last root
  expect(rows[0].flags & OV_LAST).toBeFalsy(); // R1 is NOT last (R2 continues below)
  // Forest continuation: R1a's ancestor column has a `│` (R2 below) ⇒ lines bit 0 set; R2a has none.
  expect(rows[1].lines & 0b1).toBeTruthy();
  expect(rows[3].lines & 0b1).toBeFalsy();

  // A pathological deep chain (well past any MAX_DEPTH guard) must terminate, not throw/overflow.
  let deep = node('leaf');
  for (let i = 0; i < 5000; i += 1) deep = node(`n${i}`, [deep]);
  expect(() => flattenVisible([deep], expandedAll)).not.toThrow();
});
