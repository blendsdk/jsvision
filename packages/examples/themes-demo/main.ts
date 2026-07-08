/**
 * `demo:themes` — the theme designer for `@jsvision/core`'s theming system.
 *
 * On a real terminal it runs a live {@link createApplication} designer: a window of representative
 * widgets over a status line whose items cycle the accent, light/dark mode, and preview color depth,
 * calling `app.setTheme` on each change so everything repaints live; it can also export the current
 * theme to JSON. Piped (no TTY), it runs a narrated headless walkthrough instead — the same pure
 * {@link DesignerState} machine driven through a theme switch, a depth change, and a JSON export,
 * printing a composed ASCII frame after each step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:themes
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui` /
 * `@jsvision/core`), exactly as a consumer would. The `.js` extension in import specifiers is
 * required by NodeNext ESM resolution.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolveCapabilities, parseTheme, type CapabilityProfile, type ColorDepth, type Theme } from '@jsvision/core';
import {
  createApplication,
  createRenderRoot,
  createRoot,
  statusLine,
  statusItem,
  Commands,
  Window,
  Group,
  Button,
  Text,
  Input,
  signal,
} from '@jsvision/ui';
import {
  currentTheme,
  cycleAccent,
  cycleMode,
  cycleDepth,
  exportJson,
  contrastWarnings,
  type DesignerState,
} from './designer.js';

/** Where the live designer writes an exported theme. */
const EXPORT_PATH = 'theme.json';

/** The designer's starting seeds. */
const INITIAL: DesignerState = { mode: 'dark', accent: '#3b82f6', status: {}, depth: 'truecolor' };

/** Load a theme from a JSON file (examples-layer fs; the core stays pure). */
export function loadTheme(path: string): Theme {
  return parseTheme(readFileSync(path, 'utf8'));
}

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

/** The live, interactive designer on a real terminal. */
async function runLive(): Promise<number> {
  let state = INITIAL;
  const status = statusLine([
    statusItem('~A~ccent', 'theme:accent', 'Alt+A'),
    statusItem('~M~ode', 'theme:mode', 'Alt+M'),
    statusItem('~D~epth', 'theme:depth', 'Alt+D'),
    statusItem('~E~xport', 'theme:export', 'Alt+E'),
    statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
  ]);
  const app = createApplication({ statusLine: status });
  app.desktop.shadow = true;

  const win = new Window('Theme designer');
  const preview = previewWidgets('Live preview — cycle the theme from the status line');
  preview.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 34, height: 7 } };
  win.add(preview);
  win.layout.rect = { x: 2, y: 1, width: 40, height: 12 };
  app.desktop.addWindow(win);

  const apply = (): void => {
    app.setTheme(currentTheme(state));
    win.title.set(`Theme designer — ${state.mode} · ${state.accent} · ${state.depth}`);
  };
  app.onCommand('theme:accent', () => {
    state = cycleAccent(state, +1);
    apply();
  });
  app.onCommand('theme:mode', () => {
    state = cycleMode(state);
    apply();
  });
  app.onCommand('theme:depth', () => {
    state = cycleDepth(state);
    apply();
  });
  app.onCommand('theme:export', () => {
    writeFileSync(EXPORT_PATH, exportJson(state));
  });
  apply();

  return app.run();
}

async function main(): Promise<number> {
  if (process.stdout.isTTY === true) return runLive();
  runWalkthrough();
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
