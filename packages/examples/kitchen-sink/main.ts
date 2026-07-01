/**
 * `demo:kitchen` — the jsvision **kitchen-sink showcase**: one live, interactive app that demos every
 * component, grown alongside the implementation (a Storybook-for-TUI). Run it in a real terminal:
 *
 *   yarn workspace @jsvision/examples demo:kitchen
 *
 * Navigate with the menu bar (F10 / Alt-letter → a category → a story), the clickable status hints,
 * or Ctrl+→ / Ctrl+← to cycle stories; F1 returns to the welcome catalog; Alt-X exits. Each story is
 * one `*.story.ts` in `stories/` (see `story.ts` + `codeops/kitchen-sink-gate.md` for the contract).
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { resolveCapabilities } from '@jsvision/core';
import { createShowcase } from './shell.js';

/** Compose and run the showcase until `quit`; returns the exit code. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'demo:kitchen needs a real interactive terminal (TTY).\n' +
        'Run it directly:  yarn workspace @jsvision/examples demo:kitchen\n',
    );
    return 0;
  }

  // Auto-detect, but force the glyphs the Turbo Vision look needs (SGR mouse, box-drawing,
  // half-blocks for the desktop + button shadows, UTF-8) — conservative detection often omits these.
  const caps = resolveCapabilities({
    override: {
      mouse: { sgr: true, drag: true, wheel: true },
      glyphs: { boxDrawing: true, halfBlocks: true },
      unicode: { utf8: true },
    },
  }).profile;

  return createShowcase(caps).run();
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
