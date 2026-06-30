/**
 * Window subsystem barrel (RD-05) — the titled, framed window + its frame helper.
 *
 * `Window` is public (re-exported through `@jsvision/ui`); the `frame.ts` drawing/geometry helper is
 * internal to the package (PA-8) — exported here for the desktop + tests, not from the entry point.
 */
export { Window } from './window.js';
export type { WindowManager } from './window.js';
export { drawFrame, frameZoneAt } from './frame.js';
export type { FrameZone, FrameState, WindowFlags, FrameRole } from './frame.js';
