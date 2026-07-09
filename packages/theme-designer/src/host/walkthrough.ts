/**
 * The headless narrated walkthrough — what the designer runs when launched without a TTY (piped).
 * It drives the pure model through a representative editing session (edit an alias, override a role,
 * load a preset, change the preview depth, review contrast, export) and, for each visual step,
 * composes the preview gallery under the current theme + depth into an offscreen buffer and prints an
 * ASCII frame. Deterministic and side-effect-free apart from stdout, so it doubles as the integration
 * oracle.
 */
import { createRenderRoot, createRoot } from '@jsvision/ui';
import { resolveCapabilities } from '@jsvision/core';
import type { CapabilityProfile, ColorDepth, Theme } from '@jsvision/core';

import { createDesignerModel, contrastRows } from '../model/index.js';
import { buildGallery } from '../view/gallery.js';

const WIDTH = 46;
const HEIGHT = 18;

/** Capabilities pinned to a preview color depth (so a frame shows the depth's downsampling). */
function capsFor(depth: ColorDepth): CapabilityProfile {
  return resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: depth, unicode: { utf8: true } },
  }).profile;
}

/** Print a composed buffer as a bordered ASCII grid under a title. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

/** Compose the preview gallery under a theme + depth and print the frame. */
function showTheme(heading: string, theme: Theme, depth: ColorDepth): void {
  createRoot((dispose) => {
    const gallery = buildGallery();
    gallery.layout = { position: 'absolute', rect: { x: 0, y: 0, width: WIDTH, height: HEIGHT } };
    const rr = createRenderRoot({ width: WIDTH, height: HEIGHT }, { caps: capsFor(depth), theme });
    rr.mount(gallery);
    printFrame(heading, rr.buffer().rows());
    dispose();
  });
}

/**
 * Run the narrated headless walkthrough (drives a fresh model; prints to stdout; no TTY needed).
 *
 * @example
 * import { runWalkthrough } from './host/walkthrough.js';
 * runWalkthrough(); // prints the frames + narration, returns void
 */
export function runWalkthrough(): void {
  const model = createDesignerModel();
  console.log('Theme designer walkthrough — driving the pure DesignerModel.\n');

  const depth = (): ColorDepth => model.state().depth;
  console.log(`Start: ${model.state().selected.name} selected, ${depth()} preview.`);
  showTheme('Initial theme', model.theme(), depth());

  model.setAlias('accent', '#e11d48');
  console.log('\nAlias edit: accent → #e11d48 (re-derives the theme).');
  showTheme('After alias edit', model.theme(), depth());

  model.setRole('button', { bg: '#16a34a' });
  console.log('\nRole override: button.bg → #16a34a (last edit wins).');
  showTheme('After role override', model.theme(), depth());

  model.loadPreset('nord');
  console.log('\nPreset: loaded Nord (resets edits).');
  showTheme('After preset load', model.theme(), depth());

  model.setDepth('256');
  console.log('\nDepth change: preview depth → 256 (frame shows downsampling).');
  showTheme('After depth change', model.theme(), depth());

  const rows = contrastRows(model.theme());
  const below = rows.filter((r) => r.level === 'fail');
  console.log(`\nContrast: ${rows.length} pairs checked, ${below.length} below AA.`);
  for (const row of rows) console.log(`  ${row.pair}: ${row.ratio.toFixed(2)} ${row.level}`);

  console.log('\nExported theme JSON:');
  console.log(model.exportJson());

  console.log('\nDone.');
}
