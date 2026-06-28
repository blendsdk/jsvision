/**
 * `@jsvision/ui` — public entry point of the Turbo Vision-style widget framework.
 *
 * The UI layer of jsvision: a **retained widget tree** with **fine-grained signal
 * reactivity** (the "disciplined hybrid" model), built on the `@jsvision/core`
 * engine (rendering, input, host, color, capability detection).
 *
 * This package is currently a **scaffold**. Subsystems land here per the component
 * map in `plans/tui-ui/01-component-map.md` — the reactive core, the layout engine,
 * the view/group spine, then the widgets — each re-exporting its public symbols
 * through this single entry point.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution
 * (it resolves to the `.ts` source during development).
 */
export { VERSION } from './version.js';
