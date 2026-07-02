/**
 * App subsystem barrel (RD-05) — the composition root + the `run()` lifecycle.
 *
 * `createApplication` composes the loop/desktop/chrome/overlay; the returned `Application.run()`
 * wires core's host and runs until `'quit'`. Re-exported through `@jsvision/ui`'s entry point.
 */
export { createApplication, syncOverlayVisible } from './application.js';
export type { Application, ApplicationOptions } from './application.js';
