/**
 * `graph.ts` — the pure, view-independent core of the RD-15 Tree: the faithful Turbo Vision tree-line
 * prefix builder (`createGraph`), the flatten-visible walk (`flattenVisible`), and the `TreeNode<T>`
 * data model + `FlatRow<T>`/`OV_*` shapes they share. No `View`, no signals — directly unit-testable
 * (the fidelity oracle diffs the produced strings) and keeps `tree-rows.ts` within budget (PA-7).
 *
 * **TV GATE-1 decode** (`magiblot/tvision` `source/tvision/toutline.cpp`, the fidelity oracle):
 *   • **`graphChars = "\x20\xB3\xC3\xC0\xC4\xC4+\xC4"`** (`:367`), CP437 → unambiguous-narrow Unicode
 *     (all width-1, avoiding EAW-ambiguous code points, per the project block-glyph convention):
 *     `0x20` space · `0xB3 │` U+2502 · `0xC3 ├` U+251C · `0xC0 └` U+2514 · `0xC4 ─` U+2500 (×2) ·
 *     `0x2B +` U+002B · `0xC4 ─` U+2500.
 *   • **`levelWidth = 3`, `endWidth = 3`** (`:366`) — 3 columns per ancestor level; a 3-column end graphic.
 *   • **`createGraph`** (`:165-205`): Phase 1 emits, per ancestor level, `[│ or space][levelWidth-1
 *     fillers]`; Phase 2 emits the end graphic `[fork/corner][─][marker]` (at endWidth=3 the inner
 *     End-Filler `memset` is skipped — the third `--endWidth>0` is false, so exactly 3 columns).
 *   • **flags** `ovExpanded=0x01 · ovChildren=0x02 · ovLast=0x04` (`outline.h:27-29`); `traverseTree`
 *     (`:262-322`) sets `ovLast` for the last sibling, `ovChildren` when expanded-with-children, and
 *     `ovExpanded` when expanded OR a leaf (`!children`). The forest is the TV root + its `getNext`
 *     siblings (`:310-320`).
 *
 * **Marker note (fidelity-equivalent):** TV's literal marker is `expanded ? '─' : '+'` (`:200`) —
 * `'+'` whenever `ovExpanded` is unset, ignoring `ovChildren`. This builder uses the plan's defensive
 * `expanded ? '─' : (children ? '+' : '─')` (03-02), which differs only for the input
 * `(¬expanded, ¬children)` — a case the flatten NEVER produces (a childless node always carries
 * `ovExpanded`). So for every real row the rendered marker is identical to TV; the defensive form just
 * renders a stray malformed input as `─` rather than a misleading `+`. (GATE-2 diffs rendered output.)
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */

/**
 * A plain, reactive-friendly tree node. Expand state is owned by the **view**, not the node
 * (AR-141) — a `TreeNode<T>` is just `{ value, children }`; a leaf is `children: []`.
 */
export interface TreeNode<T> {
  /** The user payload rendered via `getText`. */
  readonly value: T;
  /** Child nodes in display order (empty for a leaf). */
  readonly children: TreeNode<T>[];
}

/**
 * The per-row inputs `createGraph` needs — computed once by the flatten walk (mirrors the TV
 * `drawTree` args `level`/`lines`/`flags`, `toutline.cpp:54`).
 */
export interface FlatRow<T> {
  /** The node shown on this row. */
  readonly node: TreeNode<T>;
  /** 0-based depth (root = 0). */
  readonly level: number;
  /** Bitmask: bit L set ⇒ ancestor level L still has a continued sibling below (draw its `│`). */
  readonly lines: number;
  /** `OV_EXPANDED | OV_CHILDREN | OV_LAST`. */
  readonly flags: number;
}

/** TV `ovExpanded` (`outline.h:27`) — the node is expanded, or is a leaf. */
export const OV_EXPANDED = 0x01;
/** TV `ovChildren` (`outline.h:28`) — the node is expanded AND has children. */
export const OV_CHILDREN = 0x02;
/** TV `ovLast` (`outline.h:29`) — the node is the last child of its parent (draw `└`, not `├`). */
export const OV_LAST = 0x04;

/**
 * TV `graphChars` (`toutline.cpp:367`), CP437 → unambiguous-narrow Unicode. Index roles per the
 * GATE-1 decode above.
 */
const GRAPH = {
  /** 0x20 — ancestor level with no continued sibling. */
  levelFiller: ' ',
  /** 0xB3 U+2502 `│` — ancestor level with a continued sibling below. */
  levelMark: '│',
  /** 0xC3 U+251C `├` — end fork, non-last child. */
  fork: '├',
  /** 0xC0 U+2514 `└` — end corner, last child. */
  corner: '└',
  /** 0xC4 U+2500 `─` — horizontal fill / End-Child column / expanded marker. */
  hFill: '─',
  /** 0x2B `+` — collapsed-with-children marker. */
  markCollapsed: '+',
} as const;

/** TV `levelWidth` (`toutline.cpp:366`) — columns per ancestor level. */
const LEVEL_WIDTH = 3;
/** Depth cap for `flattenVisible` — a caller-built cycle can't drive an unbounded walk (AC-13). */
const MAX_DEPTH = 512;

/**
 * Build a row's tree-line prefix, faithful to TV `createGraph` (`toutline.cpp:165-205`) for the
 * default `levelWidth = endWidth = 3` (`getGraph`, `:364-370`).
 *
 * @param level  0-based depth (number of ancestor levels to indent).
 * @param lines  Bitmask of ancestor levels with a continued sibling below (bit L → level L draws `│`).
 * @param flags  `OV_EXPANDED | OV_CHILDREN | OV_LAST`.
 * @param guides When `false`, the `│├└─` connectors render as spaces (PA-6, flat-indent look); the
 *               marker column (`+`/`─`) and the total width are unchanged, so hit-testing stays stable.
 * @returns The prefix string; width = `level * 3 + 3` (all glyphs are width-1).
 */
export function createGraph(level: number, lines: number, flags: number, guides = true): string {
  const expanded = (flags & OV_EXPANDED) !== 0;
  const children = (flags & OV_CHILDREN) !== 0;
  const last = (flags & OV_LAST) !== 0;

  let out = '';
  // Phase 1 — ancestor level marks (toutline.cpp:181-186): `│`/space + (levelWidth-1) fillers per level.
  let bits = lines;
  for (let lv = 0; lv < level; lv += 1) {
    const continued = (bits & 1) === 1;
    out += continued && guides ? GRAPH.levelMark : GRAPH.levelFiller;
    out += GRAPH.levelFiller.repeat(LEVEL_WIDTH - 1);
    bits >>= 1;
  }

  // Phase 2 — the 3-column end graphic (toutline.cpp:188-201): fork/corner, End-Child `─`, then marker.
  out += guides ? (last ? GRAPH.corner : GRAPH.fork) : GRAPH.levelFiller;
  out += guides ? GRAPH.hFill : GRAPH.levelFiller;
  // Marker column is NOT gated by `guides` (PA-6). Defensive form (see header): a real leaf always
  // carries OV_EXPANDED, so this equals TV's `expanded ? '─' : '+'` for every flattened row.
  out += expanded ? GRAPH.hFill : children ? GRAPH.markCollapsed : GRAPH.hFill;
  return out;
}

/** The graph-prefix width (in cells) for a row at `level` — `level * 3 + 3`, guides-independent. */
export function graphWidth(level: number): number {
  return level * LEVEL_WIDTH + LEVEL_WIDTH;
}

/** A pending node to visit, carrying its display context (TV `traverseTree` args). */
interface Frame<T> {
  readonly node: TreeNode<T>;
  readonly level: number;
  readonly lines: number;
  readonly last: boolean;
}

/**
 * Push a sibling list onto the stack in reverse, so they pop in display (top-to-bottom) order; the
 * last sibling is flagged so its end graphic draws `└` (TV `Boolean(!next)`, `toutline.cpp:304`).
 */
function pushSiblings<T>(stack: Frame<T>[], nodes: TreeNode<T>[], level: number, lines: number): void {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    stack.push({ node: nodes[i], level, lines, last: i === nodes.length - 1 });
  }
}

/**
 * Flatten a forest into the ordered list of currently-visible rows — each root plus its
 * recursively-expanded descendants — computing every row's `level`/`lines`/`flags` for
 * {@link createGraph}. Iterative (explicit stack) + `MAX_DEPTH`-guarded (AC-13): the eager,
 * caller-bounded tree can't drive unbounded recursion, and a caller-built cycle stops at the guard.
 *
 * Faithful to TV `traverseTree` (`toutline.cpp:262-322`): the forest is the root + its `getNext`
 * siblings; a node descends only when expanded; a non-last node keeps its ancestor `│` alive for its
 * subtree (`childLines |= 1 << level`).
 *
 * @param roots      The forest (PA-2) — display order, top to bottom.
 * @param isExpanded Predicate over node identity (the view's expand `Set`, PA-4).
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
