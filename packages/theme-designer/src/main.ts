/**
 * `@jsvision/theme-designer` entrypoint — an interactive TUI for authoring `@jsvision/core` themes.
 *
 * On a real terminal it launches the live three-pane designer (roles rail · live preview · inspector)
 * with menu/status commands for open/save, the presets, depth, and reset. Piped (no TTY), it runs the
 * narrated headless walkthrough instead and exits 0 — the deterministic path used by CI and demos.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/theme-designer start
 *
 * Imported by name (`@jsvision/core` / `@jsvision/ui` / `@jsvision/files`), exactly as a consumer
 * would. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { createDesignerApp } from './app.js';
import { runWalkthrough } from './host/walkthrough.js';

async function main(): Promise<number> {
  if (process.stdout.isTTY === true) return createDesignerApp().run();
  runWalkthrough();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
