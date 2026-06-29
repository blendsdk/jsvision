/**
 * Layout subsystem (ADR-008 / RD-02) — a cell-native, integer-correct layout
 * engine.
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
