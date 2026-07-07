/**
 * Window subsystem entry point — the titled, framed {@link Window} plus its frame drawing/geometry
 * helpers.
 *
 * `Window` is part of the public `@jsvision/ui` API. The `drawFrame`/`frameZoneAt` helpers are used
 * internally by the desktop and are exported here for that, not from the package entry point.
 */
export { Window } from './window.js';
export type { WindowManager } from './window.js';
export { drawFrame, frameZoneAt } from './frame.js';
export type { FrameZone, FrameState, WindowFlags, FrameRole } from './frame.js';
