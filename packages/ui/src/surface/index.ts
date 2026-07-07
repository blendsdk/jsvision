/**
 * Public surface of the surface family: {@link Surface}, an offscreen cell buffer you draw into once,
 * and {@link SurfaceView}, a passive scrollable viewport that pans over a `Surface` without redrawing
 * its contents. The internal clip/margin geometry helpers stay private to this package.
 */
export { Surface } from './surface.js';
export type { SurfaceOptions } from './surface.js';
export { SurfaceView } from './surface-view.js';
export type { SurfaceViewOptions, SurfaceSource } from './surface-view.js';
