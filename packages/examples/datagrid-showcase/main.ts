/**
 * `demo:datagrid` — the **DataGrid Showcase**: one live, interactive app that demos every shipped
 * `@jsvision/datagrid` capability, one navigable demo at a time (a Storybook-for-TUI). Run it in a real
 * terminal:
 *
 *   yarn workspace @jsvision/examples demo:datagrid
 *
 * Navigate with the sidebar or the menu bar (F10 / Alt-letter → a category → a demo), the clickable
 * status hints, or Ctrl+→ / Ctrl+← to cycle demos; F1 returns to the welcome catalog; Alt-X exits.
 * Each demo is one `*.story.ts` under `stories/` (see `story.ts` for the contract).
 *
 * Dev-only example — not part of the published package. Demos import `@jsvision/datagrid` by name,
 * exactly as a consumer would. The `.js` extension in import specifiers is required by NodeNext ESM.
 */
import { resolveCapabilities } from '@jsvision/core';
import { createDatagridShowcase } from './shell.js';

/** Compose and run the showcase until `quit`; returns the exit code. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'demo:datagrid needs a real interactive terminal (TTY).\n' +
        'Run it directly:  yarn workspace @jsvision/examples demo:datagrid\n',
    );
    return 0;
  }

  // Auto-detect, forcing only SGR mouse + UTF-8. Box-drawing / half-block glyphs are derived from the
  // detected UTF-8 locale, so a run in a non-UTF-8 locale renders the honest ASCII fallback.
  const caps = resolveCapabilities({
    override: {
      mouse: { sgr: true, drag: true, wheel: true },
      unicode: { utf8: true },
    },
  }).profile;

  return createDatagridShowcase(caps).run();
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
