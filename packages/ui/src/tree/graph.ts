/**
 * The pure, view-independent core of the {@link Tree} widget: the tree-line prefix builder
 * ({@link createGraph}), the flatten-visible walk ({@link flattenVisible}), and the
 * {@link TreeNode} data model plus the {@link FlatRow} / `OV_*` flag shapes they share. No `View` and
 * no signals, so every function here is deterministic and directly testable.
 *
 * Each row's prefix is built from box-drawing glyphs, all chosen to be single-width (width 1) so
 * column math is exact:
 *   `│` U+2502 · `├` U+251C · `└` U+2514 · `─` U+2500 · `+` U+002B · space.
 * Each ancestor level occupies 3 columns. The row's own end graphic is the fork/corner (`├`/`└`), a
 * horizontal fill (`─`), then the expand marker. In the default `tv` style the marker is a single
 * cell drawn flush against the node text (`+` collapsed, `─` expanded or leaf). The `brackets` and
 * `triangle` styles instead keep one space between the marker and the text, and a leaf carries no
 * marker — just that single separating space — so its end graphic is narrower than a parent's (leaf
 * and folder text are intentionally ragged, not column-aligned, in those styles).
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
  /** `▸` — collapsed marker for the `triangle` style (single-width). */
  triCollapsed: '▸',
  /** `▾` — expanded marker for the `triangle` style (single-width). */
  triExpanded: '▾',
} as const;

/**
 * How a {@link Tree} draws its per-row expand/collapse marker.
 *
 * - `'tv'` — the default: a single `+` on a collapsed node, `─` on an expanded node or a leaf, drawn
 *   flush against the node text (no separating space).
 * - `'brackets'` — pure-ASCII `[+]`/`[-]` on collapsible nodes, each followed by one space before the
 *   text; a leaf shows just that single space. The most legible option and the safe fallback when
 *   Unicode is unavailable.
 * - `'triangle'` — `▸`/`▾` on collapsible nodes, each followed by one space; a leaf shows just that
 *   single space. Needs a Unicode terminal and degrades to `'brackets'` when the caps report no
 *   Unicode.
 *
 * In `'brackets'` and `'triangle'` a leaf's end graphic is narrower than a parent's (no marker), so
 * leaf and folder text are intentionally ragged rather than column-aligned; `'tv'` keeps every marker
 * one cell, so its columns line up.
 */
export type MarkerStyle = 'tv' | 'brackets' | 'triangle';

/**
 * The expand marker for a node under a given style — the text that follows the fork/corner + fill.
 * `flags` distinguishes the three node states: collapsed-with-children (`!OV_EXPANDED`),
 * expanded-with-children (`OV_EXPANDED | OV_CHILDREN`), and leaf (`OV_EXPANDED` alone). `'brackets'`
 * and `'triangle'` append one space so the text has breathing room, and a leaf collapses to that
 * single space (no marker); `'tv'` returns a single flush cell. The returned string's cell count is
 * the marker field width used by {@link graphWidth}.
 */
function marker(style: MarkerStyle, flags: number): string {
  const expanded = (flags & OV_EXPANDED) !== 0;
  const hasChildren = (flags & OV_CHILDREN) !== 0;
  const leaf = expanded && !hasChildren;
  switch (style) {
    case 'brackets':
      if (leaf) return ' '; // no marker — just the single space before the text
      return expanded ? '[-] ' : '[+] '; // expanded | collapsed, one trailing space
    case 'triangle':
      if (leaf) return ' ';
      return expanded ? `${GRAPH.triExpanded} ` : `${GRAPH.triCollapsed} `; // ▾ | ▸, one trailing space
    case 'tv':
    default:
      // Faithful single char, flush against the text: `─` for an expanded node or a leaf, `+` for a
      // collapsed node.
      return expanded ? GRAPH.hFill : GRAPH.markCollapsed;
  }
}

/** Columns per ancestor level. */
const LEVEL_WIDTH = 3;
/** Fixed cells before the marker in a row's end graphic: the fork/corner glyph + the horizontal fill. */
const CONNECTOR_WIDTH = 2;
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
 *               column and the total width are unchanged, so hit-testing stays stable.
 * @param style  The expand-marker style (default `'tv'`): `'tv'` `+`/`─`, `'brackets'` `[+]`/`[-]`,
 *               `'triangle'` `▸`/`▾`. Only the marker changes — the ancestor guides and fork/corner
 *               are identical across styles. Pass the caller-resolved effective style (the
 *               `triangle`→`brackets` no-Unicode fallback is decided by the renderer, not here).
 * @returns The prefix string; its width is `graphWidth(level, style, flags)` cells (every glyph is
 *          width 1). In `'brackets'`/`'triangle'` a leaf's prefix is narrower than a parent's.
 */
export function createGraph(
  level: number,
  lines: number,
  flags: number,
  guides = true,
  style: MarkerStyle = 'tv',
): string {
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

  // Phase 2 — the node's own end graphic: fork/corner, a horizontal fill, then the style marker.
  out += guides ? (last ? GRAPH.corner : GRAPH.fork) : GRAPH.levelFiller;
  out += guides ? GRAPH.hFill : GRAPH.levelFiller;
  // The marker is drawn regardless of `guides` — it is the only expand cue.
  out += marker(style, flags);
  return out;
}

/**
 * The prefix width (in cells) for a row at `level` under `style`, given the node's `flags` —
 * `level * 3 + 2 + <marker field width>`, independent of `guides`. In `'tv'` the marker is always one
 * cell, so the width is the classic `level * 3 + 3` for every node. In `'brackets'`/`'triangle'` the
 * width is node-dependent: a collapsed/expanded node includes the marker plus one trailing space,
 * while a leaf includes only that single space — so a leaf's prefix is narrower. The tree's mouse
 * toggle-zone reads this, so the hit-zone tracks each row's actual graphic.
 *
 * @param level The 0-based depth.
 * @param style The marker style (default `'tv'`).
 * @param flags The node state (`OV_EXPANDED | OV_CHILDREN | OV_LAST`); defaults to a collapsed node.
 * @returns The prefix width in cells.
 */
export function graphWidth(level: number, style: MarkerStyle = 'tv', flags = 0): number {
  return level * LEVEL_WIDTH + CONNECTOR_WIDTH + [...marker(style, flags)].length;
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
