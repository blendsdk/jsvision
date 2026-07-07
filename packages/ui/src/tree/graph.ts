/**
 * The pure, view-independent core of the {@link Tree} widget: the tree-line prefix builder
 * ({@link createGraph}), the flatten-visible walk ({@link flattenVisible}), and the
 * {@link TreeNode} data model plus the {@link FlatRow} / `OV_*` flag shapes they share. No `View` and
 * no signals, so every function here is deterministic and directly testable.
 *
 * Each row's prefix is built from box-drawing glyphs, all chosen to be single-width (width 1) so
 * column math is exact:
 *   `│` U+2502 · `├` U+251C · `└` U+2514 · `─` U+2500 · `+` U+002B · space.
 * Each ancestor level occupies 3 columns; the row's own end graphic occupies another 3 columns
 * (fork/corner, a horizontal fill, then the expand marker). The marker is `─` when the node is
 * expanded or is a leaf, and `+` when it is a collapsed node with children.
 */

/**
 * A plain, reactive-friendly tree node. Expand state is owned by the {@link Tree} view, not the node
 * — a `TreeNode<T>` is just `{ value, children }`, and a leaf is `children: []`. This keeps the node
 * data immutable and shareable; the same node can appear in multiple trees with independent expand
 * state.
 */
export interface TreeNode<T> {
  /** The user payload rendered via `getText`. */
  readonly value: T;
  /** Child nodes in display order (empty for a leaf). */
  readonly children: TreeNode<T>[];
}

/**
 * One flattened, visible tree row — the per-row inputs {@link createGraph} needs, computed once by
 * the flatten walk.
 */
export interface FlatRow<T> {
  /** The node shown on this row. */
  readonly node: TreeNode<T>;
  /** 0-based depth (root = 0). */
  readonly level: number;
  /** Bitmask: bit L set ⇒ ancestor level L still has a continued sibling below (draw its `│`). */
  readonly lines: number;
  /** Node state bitmask: `OV_EXPANDED | OV_CHILDREN | OV_LAST`. */
  readonly flags: number;
}

/** Flag: the node is expanded, or is a leaf (draws the `─` marker). */
export const OV_EXPANDED = 0x01;
/** Flag: the node is expanded AND has children. */
export const OV_CHILDREN = 0x02;
/** Flag: the node is the last child of its parent (draw `└`, not `├`). */
export const OV_LAST = 0x04;

/** The box-drawing glyphs used to build a row's tree-line prefix (all single-width). */
const GRAPH = {
  /** Ancestor level with no continued sibling. */
  levelFiller: ' ',
  /** `│` — ancestor level with a continued sibling below. */
  levelMark: '│',
  /** `├` — end fork, non-last child. */
  fork: '├',
  /** `└` — end corner, last child. */
  corner: '└',
  /** `─` — horizontal fill and the expanded marker. */
  hFill: '─',
  /** `+` — collapsed-with-children marker. */
  markCollapsed: '+',
} as const;

/** Columns per ancestor level (also the width of the row's own end graphic). */
const LEVEL_WIDTH = 3;
/** Depth cap for {@link flattenVisible}, so a caller-built cycle can't drive an unbounded walk. */
const MAX_DEPTH = 512;

/**
 * Build one row's tree-line prefix: the ancestor `│`/space guides, then the node's fork/corner and
 * expand marker.
 *
 * @param level  0-based depth (the number of ancestor levels to indent).
 * @param lines  Bitmask of ancestor levels with a continued sibling below (bit L → level L draws `│`).
 * @param flags  Node state: `OV_EXPANDED | OV_CHILDREN | OV_LAST`.
 * @param guides When `false`, the `│├└─` connectors render as spaces (a flat-indent look); the marker
 *               column (`+`/`─`) and the total width are unchanged, so hit-testing stays stable.
 * @returns The prefix string; its width is `level * 3 + 3` cells (every glyph is width 1).
 */
export function createGraph(level: number, lines: number, flags: number, guides = true): string {
  const expanded = (flags & OV_EXPANDED) !== 0;
  const last = (flags & OV_LAST) !== 0;

  let out = '';
  // Phase 1 — ancestor level marks: `│`/space + filler columns, one group per ancestor level.
  let bits = lines;
  for (let lv = 0; lv < level; lv += 1) {
    const continued = (bits & 1) === 1;
    out += continued && guides ? GRAPH.levelMark : GRAPH.levelFiller;
    out += GRAPH.levelFiller.repeat(LEVEL_WIDTH - 1);
    bits >>= 1;
  }

  // Phase 2 — the node's own end graphic: fork/corner, a horizontal fill, then the expand marker.
  out += guides ? (last ? GRAPH.corner : GRAPH.fork) : GRAPH.levelFiller;
  out += guides ? GRAPH.hFill : GRAPH.levelFiller;
  // The marker column is drawn regardless of `guides`: `─` for an expanded node or a leaf, `+` for a
  // collapsed node with children.
  out += expanded ? GRAPH.hFill : GRAPH.markCollapsed;
  return out;
}

/** The prefix width (in cells) for a row at `level` — `level * 3 + 3`, independent of `guides`. */
export function graphWidth(level: number): number {
  return level * LEVEL_WIDTH + LEVEL_WIDTH;
}

/** A pending node to visit during the flatten walk, carrying its display context. */
interface Frame<T> {
  readonly node: TreeNode<T>;
  readonly level: number;
  readonly lines: number;
  readonly last: boolean;
}

/**
 * Push a sibling list onto the stack in reverse, so they pop in display (top-to-bottom) order; the
 * last sibling is flagged so its end graphic draws `└` instead of `├`.
 */
function pushSiblings<T>(stack: Frame<T>[], nodes: TreeNode<T>[], level: number, lines: number): void {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    stack.push({ node: nodes[i], level, lines, last: i === nodes.length - 1 });
  }
}

/**
 * Flatten a forest into the ordered list of currently-visible rows — each root plus its
 * recursively-expanded descendants — computing every row's `level`/`lines`/`flags` for
 * {@link createGraph}. A node descends only when it is expanded; a non-last node keeps its ancestor
 * `│` alive down its subtree. The walk is iterative (explicit stack) and depth-guarded, so a
 * caller-built cycle stops at the depth cap rather than looping forever.
 *
 * @param roots      The forest, in display order (top to bottom); a single-root tree is the 1-element case.
 * @param isExpanded Predicate over node identity (typically the view's expand `Set`'s `has`).
 * @returns The visible rows in display order.
 */
export function flattenVisible<T>(roots: TreeNode<T>[], isExpanded: (node: TreeNode<T>) => boolean): FlatRow<T>[] {
  const out: FlatRow<T>[] = [];
  const stack: Frame<T>[] = [];
  pushSiblings(stack, roots, 0, 0);

  while (stack.length > 0) {
    const frame = stack.pop();
    if (frame === undefined) break;
    const { node, level, lines, last } = frame;
    if (level > MAX_DEPTH) continue; // guard: skip this node + subtree past the cap

    const hasChildren = node.children.length > 0;
    const expanded = isExpanded(node);

    let flags = 0;
    if (last) flags |= OV_LAST;
    if (hasChildren && expanded) flags |= OV_CHILDREN;
    if (!hasChildren || expanded) flags |= OV_EXPANDED;
    out.push({ node, level, lines, flags });

    if (hasChildren && expanded) {
      // A non-last node keeps a continued sibling below ⇒ its subtree draws `│` at this level.
      const childLines = last ? lines : lines | (1 << level);
      pushSiblings(stack, node.children, level + 1, childLines);
    }
  }
  return out;
}
