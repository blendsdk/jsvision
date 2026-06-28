/**
 * Layout subsystem (ADR-008) — a cell-native, integer-correct layout engine.
 *
 * Public symbols are re-exported through the package entry point. Currently the
 * apportionment core + a 1-D flex track solver (flex first; grid is Tier 2,
 * added behind this same surface).
 */
export { apportion, solveTrack } from './apportion.js';
export type { TrackItem } from './apportion.js';
