/**
 * The interactive theme designer: a three-pane TUI (roles rail · live preview · inspector) over the
 * pure {@link DesignerModel}. Every edit flows into the model and repaints the whole app via
 * `app.setTheme`, so the preview gallery re-colors live. File open/save, the presets, and the unsaved-
 * changes guard are wired to menu/status commands; their modal + filesystem boundaries are injectable
 * seams so the whole app-core can be exercised headlessly.
 */
import {
  createApplication,
  menuBar,
  subMenu,
  item,
  separator,
  statusLine,
  statusItem,
  Commands,
  Group,
  signal,
  effect,
  untrack,
  createRoot,
} from '@jsvision/ui';
import type { Application, Signal, Size2D } from '@jsvision/ui';
import type { CapabilityProfile, Color, ColorDepth } from '@jsvision/core';
import type { FileSystem } from '@jsvision/files';

import { createDesignerModel, hexValidator } from './model/index.js';
import type { DesignerModel, EditTarget, PresetName } from './model/index.js';
import { buildRolesPanel } from './view/roles-panel.js';
import { buildPreviewPanel } from './view/preview-panel.js';
import { buildInspectorPanel } from './view/inspector-panel.js';
import { composeHex, normalizeHex, toChannels } from './view/color-util.js';
import { defaultFileIoSeams, guardDirty, openTheme, saveTheme } from './host/file-io.js';
import type { FileIoDeps } from './host/file-io.js';

/** The 5 derived + 2 literal presets, in menu order. */
const PRESETS: readonly { name: PresetName; label: string }[] = [
  { name: 'turbo-vision', label: 'Turbo Vision' },
  { name: 'monochrome', label: 'Monochrome' },
  { name: 'slate', label: 'Slate' },
  { name: 'nord', label: 'Nord' },
  { name: 'dracula', label: 'Dracula' },
  { name: 'solarized-dark', label: 'Solarized Dark' },
  { name: 'gruvbox-dark', label: 'Gruvbox Dark' },
];

/** Depth options for the View menu (drive the inspector's sample-strip highlight only). */
const DEPTHS: readonly ColorDepth[] = ['truecolor', '256', '16', 'mono'];

/** Options for {@link createDesignerApp}. Modal/filesystem boundaries are injectable for headless tests. */
export interface DesignerAppOptions {
  /** An existing model, or a fresh one is created. */
  model?: DesignerModel;
  /** Terminal capabilities (default `'auto'`). */
  caps?: CapabilityProfile | 'auto';
  /** Viewport size in cells. */
  viewport?: Size2D;
  /** Input stream (default `process.stdin`); inject a fake to run headlessly. */
  input?: NodeJS.ReadStream;
  /** Output stream (default `process.stdout`). */
  output?: NodeJS.WriteStream;
  /** Require an interactive TTY at `run()` (default true). */
  requireTty?: boolean;
  /** File read/write seam (default `nodeFileSystem`). */
  fs?: Pick<FileSystem, 'readFile' | 'writeFile'>;
  /** Path-prompt seam (default the `@jsvision/files` FileDialog). */
  openPath?: (save: boolean) => Promise<string | null>;
  /** Unsaved-changes confirm seam (default a `confirm` dialog). */
  confirmDiscard?: () => Promise<boolean>;
  /** Error-report seam (default an error box). */
  showError?: (message: string) => Promise<void>;
}

/** A wired designer app: the shell plus the handles the entrypoint (and tests) drive. */
export interface DesignerApp {
  /** The underlying application shell. */
  readonly app: Application;
  /** The pure model. */
  readonly model: DesignerModel;
  /** The inspector's channel + hex signals (what the sliders and hex field bind to). */
  readonly inspector: { r: Signal<number>; g: Signal<number>; b: Signal<number>; hex: Signal<string> };
  /** Point the inspector at an edit target and load its color (what the rail invokes). */
  selectTarget(target: EditTarget): void;
  /** Open a theme file (guarded, via the injected seams). */
  open(): Promise<void>;
  /** Save the theme (`saveAs` forces the path prompt). */
  save(saveAs?: boolean): Promise<void>;
  /** Load a preset behind the unsaved-changes guard. */
  loadPresetGuarded(name: PresetName): Promise<void>;
  /** Quit behind the unsaved-changes guard. */
  quitGuarded(): Promise<void>;
  /** Connect to the terminal and run until quit. */
  run(): Promise<number>;
}

/**
 * Create the interactive theme designer.
 *
 * @param opts All optional — a model, capabilities/viewport/streams, and the injectable file/modal seams.
 * @returns A {@link DesignerApp}.
 * @example
 * import { createDesignerApp } from './app.js';
 * const designer = createDesignerApp();
 * const code = await designer.run();
 */
export function createDesignerApp(opts: DesignerAppOptions = {}): DesignerApp {
  const model = opts.model ?? createDesignerModel();

  const bar = menuBar([
    subMenu('~F~ile', [
      item('~O~pen…', 'file:open', 'F3'),
      item('~S~ave', 'file:save', 'F2'),
      item('Save ~A~s…', 'file:saveas'),
      separator(),
      item('E~x~it', 'file:quit', 'Alt+X'),
    ]),
    subMenu('~T~heme', [
      ...PRESETS.map((p) => item(p.label, `preset:${p.name}`)),
      separator(),
      item('~R~eset', 'theme:reset'),
    ]),
    subMenu(
      '~V~iew',
      DEPTHS.map((d) => item(d, `depth:${d}`)),
    ),
  ]);
  const status = statusLine([
    statusItem('~F2~ Save', 'file:save', 'F2'),
    statusItem('~F3~ Open', 'file:open', 'F3'),
    statusItem('~R~eset', 'theme:reset', 'Alt+R'),
    statusItem('E~x~it', 'file:quit', 'Alt+X'),
  ]);

  const app = createApplication({
    caps: opts.caps ?? 'auto',
    viewport: opts.viewport,
    input: opts.input,
    output: opts.output,
    requireTty: opts.requireTty,
    menuBar: bar,
    statusLine: status,
    theme: model.theme(),
  });

  // Inspector state (owned here so the reactive wiring lives in one place; the panels only bind it).
  const r = signal(0);
  const g = signal(0);
  const b = signal(0);
  const hexText = signal('#000000');
  const color = signal<Color>('#000000');
  // While syncing the inspector controls to a chosen color, the commit effects must not fire back.
  let syncing = false;
  let ready = false;

  const applyToModel = (c: Color): void => {
    const t = model.state().selected;
    if (t.kind === 'alias') model.setAlias(t.name, c);
    else model.setRole(t.name, { bg: c });
  };
  const syncControls = (c: Color): void => {
    syncing = true;
    color.set(c);
    const ch = toChannels(c);
    r.set(ch.r);
    g.set(ch.g);
    b.set(ch.b);
    hexText.set(normalizeHex(c));
    syncing = false;
  };
  const commitColor = (c: Color): void => {
    syncControls(c);
    applyToModel(c);
  };
  const loadColor = (c: Color): void => {
    syncControls(c); // load into the controls without writing back to the model
  };
  const selectTarget = (target: EditTarget): void => {
    model.select(target);
    loadColor(model.colorOf(target));
  };

  // File I/O + guard seams (defaults bound to the app; each field overridable for tests).
  let lastPath: string | null = null;
  const seams = defaultFileIoSeams(app);
  const fileDeps: FileIoDeps = {
    model,
    fs: opts.fs ?? seams.fs,
    openPath: opts.openPath ?? seams.openPath,
    confirmDiscard: opts.confirmDiscard ?? seams.confirmDiscard,
    showError: opts.showError ?? seams.showError,
    getLastPath: () => lastPath,
    setLastPath: (p) => {
      lastPath = p;
    },
  };
  const open = (): Promise<void> => openTheme(fileDeps);
  const save = (saveAs = false): Promise<void> => saveTheme(fileDeps, saveAs);
  const loadPresetGuarded = async (name: PresetName): Promise<void> => {
    if (!(await guardDirty(fileDeps))) return;
    model.loadPreset(name);
  };
  const resetGuarded = async (): Promise<void> => {
    if (!(await guardDirty(fileDeps))) return;
    model.reset();
  };
  const quitGuarded = async (): Promise<void> => {
    if (!(await guardDirty(fileDeps))) return;
    app.loop.emitCommand(Commands.quit);
  };

  // The three panels.
  const rail = buildRolesPanel(model);
  rail.view.layout = { size: { kind: 'fixed', cells: 28 }, direction: 'col' };
  const preview = buildPreviewPanel();
  preview.layout = { size: { kind: 'fr', weight: 1 }, direction: 'col' };
  const inspector = buildInspectorPanel({
    r,
    g,
    b,
    hexText,
    color,
    model,
    onSwatchInput: (c) => {
      if (ready) commitColor(c);
    },
  });
  inspector.layout = { size: { kind: 'fixed', cells: 32 }, direction: 'col' };

  // A workspace row filling the desktop (viewport minus the menu + status chrome rows).
  const workspace = new Group();
  const sizeWorkspace = (size: Size2D): void => {
    workspace.layout = {
      position: 'absolute',
      rect: { x: 0, y: 0, width: size.width, height: Math.max(1, size.height - 2) },
      direction: 'row',
    };
    workspace.invalidate();
  };
  sizeWorkspace(opts.viewport ?? { width: 80, height: 24 });
  workspace.add(rail.view);
  workspace.add(preview);
  workspace.add(inspector);
  app.desktop.add(workspace);
  app.loop.onResize = (size) => sizeWorkspace(size);

  // Reactive wiring, owned by one root for the app's lifetime.
  createRoot(() => {
    // Apply the model's theme to the whole app on every change (initial + each edit).
    effect(() => {
      app.setTheme(model.theme());
    });
    // Sliders → model (a channel change composes the color and commits it to the selected target).
    // Track only r/g/b; the commit reads and writes model state, so run it untracked to avoid a cycle.
    effect(() => {
      const composed = composeHex(r(), g(), b());
      if (!ready || syncing) return;
      untrack(() => commitColor(composed));
    });
    // Hex field → model (only when the text is a complete valid color).
    effect(() => {
      const text = hexText();
      if (!ready || syncing) return;
      if (hexValidator.isValid(text)) untrack(() => commitColor(text as Color));
    });
    // Rail highlight → select the target (safe: select never dirties). Track only the index; the
    // select/load reads and writes model state, so run it untracked.
    effect(() => {
      const index = rail.focused();
      untrack(() => selectTarget(rail.targets[index]));
    });
  });

  // Load the current selection into the inspector, then arm the commit effects.
  loadColor(model.colorOf(model.state().selected));
  ready = true;
  app.loop.focusView(rail.rows);

  // Command wiring (fire-and-forget for the async ones — their own error boxes handle failures).
  app.onCommand('file:open', () => void open());
  app.onCommand('file:save', () => void save(false));
  app.onCommand('file:saveas', () => void save(true));
  app.onCommand('file:quit', () => void quitGuarded());
  app.onCommand('theme:reset', () => void resetGuarded());
  for (const p of PRESETS) app.onCommand(`preset:${p.name}`, () => void loadPresetGuarded(p.name));
  for (const d of DEPTHS) app.onCommand(`depth:${d}`, () => model.setDepth(d));

  return {
    app,
    model,
    inspector: { r, g, b, hex: hexText },
    selectTarget,
    open,
    save,
    loadPresetGuarded,
    quitGuarded,
    run: () => app.run(),
  };
}
