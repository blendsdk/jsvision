# 03-02 · Graph builder + flatten + node model

> **Document**: 03-02-graph-and-model.md
> **Parent**: [Index](00-index.md)
> **Decode source**: [03-01 §1-3](03-01-tree.md) (`toutline.cpp:165-205,364-370`)

`graph.ts` holds the pure, view-independent pieces: the faithful line-prefix builder, the
flatten-visible walk, and the `FlatRow` shape they share. Keeping them pure (no `View`/signals) makes
them directly unit-testable (the fidelity oracle diffs the produced strings) and keeps `tree-rows.ts`
within budget (PA-7).

## Types

```ts
/** The per-row inputs `createGraph` needs — computed once by the flatten walk. */
export interface FlatRow<T> {
  readonly node: TreeNode<T>;
  readonly level: number;      // 0-based depth (root = 0)
  readonly lines: number;      // bitmask: bit L set ⇒ ancestor level L has a continued sibling below
  readonly flags: number;      // ovExpanded | ovChildren | ovLast (see below)
}

/** TV node flags (outline.h:27-29). */
export const OV_EXPANDED = 0x01;
export const OV_CHILDREN = 0x02;
export const OV_LAST     = 0x04;
```

## `graphChars` + widths (faithful — 03-01 §1-2)

```ts
/** TV graphChars (toutline.cpp:367), CP437→unambiguous-narrow Unicode. Index roles in 03-01 §1. */
const GRAPH = {
  levelFiller: ' ',   // 0x20
  levelMark:   '│',   // 0xB3  U+2502
  fork:        '├',   // 0xC3  U+251C  (non-last)
  corner:      '└',   // 0xC0  U+2514  (last)
  hFill:       '─',   // 0xC4  U+2500
  markCollapsed: '+', // 0x2B  U+002B  (collapsed w/ children)
  markExpanded:  '─', // 0xC4  U+2500  (expanded)
} as const;
const LEVEL_WIDTH = 3;   // toutline.cpp:364
const END_WIDTH   = 3;   // toutline.cpp:364
```

## `createGraph`

```ts
/**
 * Build a row's tree-line prefix, faithful to TV `createGraph` (toutline.cpp:165-205).
 * @param level  0-based depth.
 * @param lines  bitmask of ancestor levels with a continued sibling below.
 * @param flags  OV_EXPANDED | OV_CHILDREN | OV_LAST.
 * @param guides when false, the │├└─ connectors render as spaces (PA-6) — the expand marker column
 *               is unchanged, so `+`/`─` still appears at the same width.
 * @returns the prefix string (width = level*LEVEL_WIDTH + END_WIDTH).
 */
export function createGraph(level: number, lines: number, flags: number, guides = true): string;
```
- **Phase 1** (03-01 §3): per ancestor level, `(lines >> L) & 1 ? levelMark : levelFiller` +
  `LEVEL_WIDTH-1` fillers; when `guides === false`, `levelMark`→space (connectors hidden).
- **Phase 2**: `flags & OV_LAST ? corner : fork` + `hFill` + `hFill`/children + marker
  (`flags & OV_EXPANDED ? markExpanded : (flags & OV_CHILDREN ? markCollapsed : markExpanded)`).
  A **leaf** (no children) shows `markExpanded` (`─`), never `+`. When `guides === false` the fork/
  corner/fillers render as spaces but the marker column stays.
- Width is **guides-independent** so hit-testing (`mouse.x < graphWidth`) and column math are stable.

## `flattenVisible`

```ts
/**
 * Flatten a forest into the ordered list of currently-visible rows (root + recursively-expanded
 * descendants), computing each row's level/lines/flags for `createGraph`. Iterative + depth-guarded
 * (AC-13) — no unbounded recursion beyond the caller-supplied tree.
 * @param roots     the forest (PA-2).
 * @param isExpanded predicate over node identity (the view's expand Set, PA-4).
 */
export function flattenVisible<T>(
  roots: TreeNode<T>[],
  isExpanded: (node: TreeNode<T>) => boolean,
): FlatRow<T>[];
```
Walk each root's subtree in display order. For a node at `level` with sibling context:
- `flags = (children.length ? OV_CHILDREN : 0) | (isExpanded(node) ? OV_EXPANDED : 0) |
  (isLastSibling ? OV_LAST : 0)`;
- `lines` carries a bit for each ancestor level that still has a sibling below (so `│` continues);
- descend into `children` **only if** `isExpanded(node)` (collapsed subtrees contribute no rows).
Depth is bounded by the materialized tree; a `MAX_DEPTH` guard (e.g. 512) protects against a
caller-built cycle (defensive — the eager model shouldn't contain cycles).

## `TreeNode<T>` (re-exported from `tree.ts`)

```ts
export interface TreeNode<T> {
  readonly value: T;
  readonly children: TreeNode<T>[];
}
```
Plain data (AR-141). No `expanded` field — the view owns expand state (PA-3/PA-4). A leaf is
`children: []`. Helper `treeNode(value, children = [])` may be provided for terse construction.

## Expand-state model (in `tree.ts`)

- `expandedSet: Set<TreeNode<T>>` (object identity, PA-4) + `expandVersion = signal(0)`.
- `isExpanded(node) = expandedSet.has(node)`; `expand`/`collapse`/`toggle` mutate the Set then
  `expandVersion(expandVersion() + 1)` to trigger re-flatten.
- Construction: if `expandedByDefault`, walk the forest adding every node with children to the Set;
  else start empty (all collapsed, PA-3).
- `expandAll()`/`collapseAll()` (PA-6): fill/clear the Set over the whole forest, one version bump.
- The renderer reads `roots()` **and** `expandVersion()` inside `bind`, so any structural or expand
  change re-flattens and repaints (RD-01 reactivity, `view/view.ts:162-174`).
