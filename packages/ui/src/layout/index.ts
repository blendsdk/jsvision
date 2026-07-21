/**
 * The cell-native, integer-correct layout engine — a flexbox-style layout solver
 * that works in whole terminal cells, so laid-out boxes always fill their
 * container exactly with no rounding gaps.
 *
 * Public surface, re-exported through the package entry point:
 * - the integer apportionment core + 1-D flex track solver (`apportion`,
 *   `solveTrack`, `TrackItem`);
 * - the `layout()` pass turning a `LayoutBox` tree + viewport into
 *   parent-relative integer rects, plus its node model (`LayoutBox`,
 *   `LayoutProps`, `Size`, `Justify`, `Align`, `Padding`, `Size2D`, `Rect`,
 *   `LayoutResult`, `Direction`).
 *
 * Internal helpers (prop normalization, axis projection) stay module-private.
 */
export { apportion, solveTrack } from './apportion.js';
export type { TrackItem } from './apportion.js';

export { layout } from './layout.js';
// Internal to the package: the erasure seams spread it; `ui/src/index.ts` does not re-export it.
export { CLEARED_LAYOUT } from './types.js';
export type {
  Align,
  Direction,
  Justify,
  LayoutBox,
  LayoutProps,
  LayoutResult,
  Padding,
  Rect,
  Size,
  Size2D,
} from './types.js';
