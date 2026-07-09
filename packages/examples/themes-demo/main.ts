/**
 * `demo:themes` — a narrated headless walkthrough of `@jsvision/core`'s theming system.
 *
 * It drives the pure {@link DesignerState} machine through a theme switch (accent cycle), a mode
 * toggle, a depth change, a contrast check, and a JSON export, composing and printing a representative
 * widget frame after each step. The full interactive theme designer now lives in its own app,
 * `@jsvision/theme-designer` (`yarn workspace @jsvision/theme-designer start`); this demo is the
 * headless tour that runs anywhere.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:themes
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui` /
 * `@jsvision/core`), exactly as a consumer would. The `.js` extension in import specifiers is
 * required by NodeNext ESM resolution.
 */
import { resolveCapabilities, type CapabilityProfile, type ColorDepth } from '@jsvision/core';
import { createRenderRoot, createRoot, Group, Button, Text, Input, signal } from '@jsvision/ui';
import {
  currentTheme,
  cycleAccent,
  cycleMode,
  cycleDepth,
  exportJson,
  contrastWarnings,
  type DesignerState,
} from './designer.js';

/** The designer's starting seeds. */
const INITIAL: DesignerState = { mode: 'dark', accent: '#3b82f6', status: {}, depth: 'truecolor' };

/** A representative widget set (window bg + header + buttons + an input) for previewing a theme. */
function previewWidgets(label: string): Group {
  const g = new Group();
  g.background = 'window';
  const place = (view: Group | Text | Button | Input, x: number, y: number, w: number, h: number): void => {
    view.layout = { position: 'absolute', rect: { x, y, width: w, height: h } };
    g.add(view);
  };
  place(new Text(label), 1, 0, 30, 1);
  place(new Input({ value: signal('editable input') }), 1, 2, 24, 1);
  place(new Button('~O~K', { onClick: () => {} }), 1, 4, 8, 2);
  place(new Button('~C~ancel', { onClick: () => {} }), 10, 4, 12, 2);
  return g;
}

/** Caps pinned to a preview color depth. */
function capsFor(depth: ColorDepth): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: depth, unicode: { utf8: true } } })
    .profile;
}

/** Print a composed buffer as an ASCII grid under a title. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

/** Compose the preview widgets under a state's theme + depth and print the frame. */
function showState(heading: string, state: DesignerState): void {
  createRoot((dispose) => {
    const widgets = previewWidgets(`${state.mode} · accent ${state.accent} · depth ${state.depth}`);
    widgets.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 34, height: 7 } };
    const rr = createRenderRoot({ width: 34, height: 7 }, { caps: capsFor(state.depth), theme: currentTheme(state) });
    rr.mount(widgets);
    printFrame(heading, rr.buffer().rows());
    dispose();
  });
}

/** The narrated, headless walkthrough (drives the pure designer; no TTY). */
function runWalkthrough(): void {
  console.log('Theme designer walkthrough (demo:themes) — driving the pure DesignerState machine.\n');

  let state = INITIAL;
  console.log(`Start: ${state.mode} mode, accent ${state.accent}.`);
  showState('Initial theme', state);

  state = cycleAccent(state, +1);
  console.log(`\nTheme switch: accent cycled → ${state.accent}.`);
  showState('After accent cycle (theme switch)', state);

  state = cycleMode(state);
  console.log(`\nMode switch: → ${state.mode}.`);
  showState('After mode toggle', state);

  state = cycleDepth(state);
  console.log(`\nDepth change: preview depth → ${state.depth}.`);
  showState('After depth cycle (depth change)', state);

  const warnings = contrastWarnings(state);
  console.log(`\nContrast warnings (${warnings.length}): ${warnings.map((w) => w.pair).join(', ') || 'none'}.`);

  console.log('\nExported theme JSON:');
  console.log(exportJson(state));

  console.log('\nDone.');
}

runWalkthrough();
process.exit(0);
