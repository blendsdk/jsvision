/**
 * `scroll/` barrel (RD-11) — the scrolling container subsystem.
 *
 * Public symbols land per phase and are re-exported through `@jsvision/ui`'s single entry point
 * (`src/index.ts`, explicit named re-exports per the AR-102 convention):
 *   • Phase 1 — `ScrollBar` (TV `tscrlbar.cpp`).
 *   • Phase 2 — `Scroller` (TV `tscrolle.cpp`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
export { ScrollBar } from './scroll-bar.js';
export type { ScrollBarOptions } from './scroll-bar.js';
