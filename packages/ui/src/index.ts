/**
 * `@jsvision/ui` — public entry point of the Turbo Vision-style widget framework.
 *
 * The UI layer of jsvision: a **retained widget tree** with **fine-grained signal
 * reactivity** (the "disciplined hybrid" model), built on the `@jsvision/core`
 * engine (rendering, input, host, color, capability detection).
 *
 * First subsystem landed: the cell-native **layout** core (ADR-008) — integer
 * apportionment + a 1-D flex track solver. The reactive core, the view/group
 * spine, and the widgets follow per `plans/tui-ui/01-component-map.md`, each
 * re-exporting its public symbols through this single entry point.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution
 * (it resolves to the `.ts` source during development).
 */
export { VERSION } from './version.js';

// Layout (ADR-008) — cell-native, integer-correct.
export { apportion, solveTrack } from './layout/index.js';
export type { TrackItem } from './layout/index.js';
