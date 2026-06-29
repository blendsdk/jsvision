/**
 * Node model and resolved-prop helpers for the cell-native layout engine (RD-02).
 *
 * Defines the public geometry/box types the layout pass operates on and the
 * internal normalizers that fill `LayoutProps` defaults (PA-3, CSS-flex-parity)
 * and clamp every cell count to a non-negative integer — so the pass never has
 * to branch on `undefined` or guard negatives in the hot path.
 *
 * `Size2D`/`Rect`/`Padding` are defined here, not imported: `@jsvision/core`
 * exports no geometry type (PA-2).
 */

/** Cell dimensions (width × height) in integer terminal cells. */
export interface Size2D {
  width: number;
  height: number;
}

/** A parent-relative rectangle in integer cells. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Per-side content inset, in integer cells (AR-29). */
export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** How a box is sized along its parent's main axis (AR-20). */
export type Size =
  | { kind: 'fixed'; cells: number } // exact integer cells
  | { kind: 'fr'; weight: number } // grow-weight share of leftover space
  | { kind: 'auto' }; // size to content (via measure() / children)

/** Main-axis distribution of leftover space (AR-24). */
export type Justify = 'start' | 'center' | 'end' | 'space-between';

/** Cross-axis alignment of children (AR-25). */
export type Align = 'start' | 'center' | 'end' | 'stretch';

/** The main axis of a container: `row` = horizontal, `col` = vertical (AR-22). */
export type Direction = 'row' | 'col';

/**
 * Layout properties of a box; all optional with CSS-flex-parity defaults (PA-3):
 * `direction:'row'`, `size:'auto'`, `justify:'start'`, `align:'stretch'`,
 * `gap:0`, `padding:0`.
 */
export interface LayoutProps {
  /** Container main axis (default `'row'`). */
  direction?: Direction;
  /** Size within the parent's main axis (default `{ kind:'auto' }`). */
  size?: Size;
  /** Main-axis distribution of leftover space (default `'start'`). */
  justify?: Justify;
  /** Cross-axis alignment (default `'stretch'`). */
  align?: Align;
  /** Integer cells between adjacent children (default `0`). */
  gap?: number;
  /** Content inset; a number applies to all sides (default `0`). */
  padding?: number | Padding;
}

/**
 * A node in the layout input tree (AR-23).
 *
 * Precondition (caller contract, not runtime-guarded): the tree is **acyclic**
 * and every box instance is **distinct** (no node reused at two positions). The
 * pass is a single bounded traversal with no cycle/visited check; a cycle would
 * recurse unboundedly and a reused instance would collide in {@link LayoutResult}
 * (keyed by box identity → last write wins). Callers (RD-03's view spine) only
 * ever build fresh trees.
 */
export interface LayoutBox {
  props: LayoutProps;
  children: readonly LayoutBox[];
  /**
   * Natural content size for an `auto` box given the available content space
   * (e.g. a label measuring its text). Omitted ⇒ the natural size is derived
   * from `children`; an `auto` leaf with no `measure` resolves to `{0,0}`. (AR-21)
   */
  measure?: (available: Size2D) => Size2D;
}

/** The computed rect for every box, keyed by box identity (parent-relative). */
export type LayoutResult = Map<LayoutBox, Rect>;

/** Fully-resolved props: defaults applied, all cell counts clamped to ≥ 0 integers. */
export interface ResolvedProps {
  direction: Direction;
  size: Size;
  justify: Justify;
  align: Align;
  gap: number;
  padding: Padding;
}

/**
 * Clamp a value to a non-negative integer cell count. Non-finite input → `0`,
 * keeping degenerate inputs from propagating `NaN`/`Infinity` into rects
 * (RD-02 §Security: degenerate inputs resolve to zero, never throw).
 *
 * @param n Raw cell count (may be fractional, negative, or non-finite).
 * @returns `max(0, floor(n))`, or `0` when `n` is not finite.
 */
export function toCells(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * Normalize the `padding` shorthand into a per-side {@link Padding}, each side
 * clamped to a non-negative integer.
 *
 * @param padding A uniform number, a per-side object, or `undefined` (→ all 0).
 */
export function normalizePadding(padding: number | Padding | undefined): Padding {
  if (padding === undefined) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (typeof padding === 'number') {
    const c = toCells(padding);
    return { top: c, right: c, bottom: c, left: c };
  }
  return {
    top: toCells(padding.top),
    right: toCells(padding.right),
    bottom: toCells(padding.bottom),
    left: toCells(padding.left),
  };
}

/**
 * Normalize a {@link Size} token, clamping its magnitude to ≥ 0 (a negative
 * `fixed.cells`/`fr.weight` becomes 0). `undefined` → `{ kind:'auto' }` (PA-3).
 */
export function normalizeSize(size: Size | undefined): Size {
  if (size === undefined) {
    return { kind: 'auto' };
  }
  if (size.kind === 'fixed') {
    return { kind: 'fixed', cells: toCells(size.cells) };
  }
  if (size.kind === 'fr') {
    return { kind: 'fr', weight: Math.max(0, size.weight) };
  }
  return { kind: 'auto' };
}

/**
 * Apply CSS-flex-parity defaults (PA-3) and clamps to a box's props so the
 * layout pass works against a fully-resolved, branch-free shape.
 */
export function normalizeProps(props: LayoutProps): ResolvedProps {
  return {
    direction: props.direction ?? 'row',
    size: normalizeSize(props.size),
    justify: props.justify ?? 'start',
    align: props.align ?? 'stretch',
    gap: toCells(props.gap ?? 0),
    padding: normalizePadding(props.padding),
  };
}

/** The main-axis component of a {@link Size2D} for the given direction (row → width, col → height). */
export function mainOf(size: Size2D, direction: Direction): number {
  return direction === 'row' ? size.width : size.height;
}

/** The cross-axis component of a {@link Size2D} for the given direction (row → height, col → width). */
export function crossOf(size: Size2D, direction: Direction): number {
  return direction === 'row' ? size.height : size.width;
}

/** Build a {@link Size2D} from main/cross extents for the given direction (inverse of {@link mainOf}/{@link crossOf}). */
export function sizeFromAxis(main: number, cross: number, direction: Direction): Size2D {
  return direction === 'row' ? { width: main, height: cross } : { width: cross, height: main };
}
