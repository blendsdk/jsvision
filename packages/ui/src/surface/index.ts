/**
 * `surface/` barrel — RD-19 Surface family. Re-exports the public `Surface` (offscreen cell buffer,
 * a `TDrawSurface` port wrapping core `ScreenBuffer`) + `SurfaceView` (the passive `delta`-viewport,
 * a `TSurfaceView::draw()` decode) and their option types. The pure `surface-geometry.ts` helpers
 * stay INTERNAL (mirroring `color-grid.ts`); `Point`/`Rect` are reused from `view`/`layout` (PA-13).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
export { Surface } from './surface.js';
export type { SurfaceOptions } from './surface.js';
export { SurfaceView } from './surface-view.js';
export type { SurfaceViewOptions, SurfaceSource } from './surface-view.js';
