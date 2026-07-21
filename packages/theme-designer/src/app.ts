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
  row,
  fixed,
  grow,
  signal,
  effect,
  untrack,
  createRoot,
  onCleanup,
} from '@jsvision/ui';
import type { Application, Signal, Size2D, TimerSeam } from '@jsvision/ui';
import type { CapabilityProfile, Color, ColorDepth, TimerHandle } from '@jsvision/core';
import type { FileSystem } from '@jsvision/files';

import { createDesignerModel, downsampleTheme, flashColor, flashColorFor, hexValidator } from './model/index.js';
import type { DesignerModel, EditTarget, PresetName } from './model/index.js';
import { buildRolesPanel } from './view/roles-panel.js';
import { buildPreviewPanel } from './view/preview-panel.js';
import { buildInspectorPanel } from './view/inspector-panel.js';
import { composeHex, normalizeHex, sameColor, toChannels } from './view/color-util.js';
import { defaultFileIoSeams, guardDirty, openTheme, saveTheme } from './host/file-io.js';
import type { FileIoDeps } from './host/file-io.js';

/** The generated + 2 literal presets, in menu order. */
const PRESETS: readonly { name: PresetName; label: string }[] = [
  { name: 'turbo-vision', label: 'Turbo Vision' },
  { name: 'monochrome', label: 'Monochrome' },
  { name: 'slate', label: 'Slate' },
  { name: 'nord', label: 'Nord' },
  { name: 'dracula', label: 'Dracula' },
  { name: 'solarized-dark', label: 'Solarized Dark' },
  { name: 'gruvbox-dark', label: 'Gruvbox Dark' },
  { name: 'janus', label: 'Janus (retro PC)' },
  { name: 'warp', label: 'Warp (OS/2)' },
  { name: 'solstice', label: 'Solstice (Unix WS)' },
  { name: 'platinum', label: 'Platinum (classic Mac)' },
  { name: 'workbench', label: 'Workbench (Amiga)' },
  { name: 'horizon', label: 'Horizon (enterprise)' },
];

/** Depth options for the View menu (drive the inspector's sample-strip highlight only). */
const DEPTHS: readonly ColorDepth[] = ['truecolor', '256', '16', 'mono'];

/** Per-toggle interval of the preview blink, in ms. */
const BLINK_MS = 90;

/** The default preview-blink timer: real `setTimeout`/`clearTimeout`. Tests inject a deterministic fake. */
function defaultTimer(): TimerSeam {
  return {
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}

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
  /** Timer seam driving the preview blink (default a `setTimeout`-backed one); inject a fake in tests. */
  timer?: TimerSeam;
}

/** A wired designer app: the shell plus the handles the entrypoint (and tests) drive. */
export interface DesignerApp {
  /** The underlying application shell. */
  readonly app: Application;
  /** The pure model. */
  readonly model: DesignerModel;
  /**
   * The inspector's channel + hex signals (what the sliders and hex field bind to) plus the field
   * toggle (`0` = background, `1` = foreground) for a role target.
   */
  readonly inspector: {
    r: Signal<number>;
    g: Signal<number>;
    b: Signal<number>;
    hex: Signal<string>;
    field: Signal<number>;
  };
  /** Point the inspector at an edit target and load its color (what the rail invokes). */
  selectTarget(target: EditTarget): void;
  /**
   * Briefly flash the given color across the live preview — the same blink the rail triggers when a
   * target is selected. Every cell currently painted in `color` toggles to a high-contrast substitute
   * a couple of times, so the widgets using it stand out. Drives the injected `timer` seam.
   */
  flashPreview(color: Color): void;
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
  // Which field of the selected target the inspector edits: 0 = background, 1 = foreground. Ignored for
  // an alias (a single color); meaningful only for a role, which has both a bg and an fg.
  const fieldIndex = signal(0);
  const fieldName = (): 'fg' | 'bg' => (fieldIndex() === 0 ? 'bg' : 'fg');
  // While syncing the inspector controls to a chosen color, the commit effects must not fire back.
  let syncing = false;
  let ready = false;

  // The current color of what the inspector edits (an alias color, or the selected field of a role).
  const editColor = (): Color => model.colorOf(model.state().selected, fieldName());
  const applyToModel = (c: Color): void => {
    const t = model.state().selected;
    // Idempotent: skip a write that matches the model's current value. This is what stops a bare
    // selection (which only LOADS a target's color into the controls) from re-committing that color —
    // a spurious re-commit would, e.g., drop a loaded preset's role snapshot and revert the theme.
    if (t.kind === 'alias') {
      if (!sameColor(c, model.colorOf(t))) model.setAlias(t.name, c);
    } else if (!sameColor(c, model.colorOf(t, fieldName()))) {
      model.setRole(t.name, fieldName() === 'fg' ? { fg: c } : { bg: c });
    }
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
    loadColor(model.colorOf(target, fieldName()));
  };

  // Preview blink: on select, momentarily recolor every cell painted in the target's color so the
  // widgets using it flash. `blinkLit` gates the flash; the theme effect reads it and both signals.
  const timer = opts.timer ?? defaultTimer();
  const blinkColor = signal<Color | null>(null);
  const blinkLit = signal(false);
  let blinkHandle: TimerHandle | undefined;
  const stopBlink = (): void => {
    if (blinkHandle !== undefined) {
      timer.clearTimer(blinkHandle);
      blinkHandle = undefined;
    }
  };
  const startBlink = (c: Color): void => {
    stopBlink();
    blinkColor.set(c);
    blinkLit.set(true);
    // A short on/off tail. While the user keeps navigating the rail, each restart cancels the pending
    // toggles and re-lights, so the preview holds the flash until they settle, then blinks out — no
    // strobing per keystroke. A settled selection plays the full on/off/on/off (two blinks).
    let toggles = 3;
    const step = (): void => {
      blinkLit.set(!blinkLit());
      toggles -= 1;
      blinkHandle = toggles <= 0 ? undefined : timer.setTimer(step, BLINK_MS);
    };
    blinkHandle = timer.setTimer(step, BLINK_MS);
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
  const preview = buildPreviewPanel(model);
  const inspector = buildInspectorPanel({
    r,
    g,
    b,
    hexText,
    color,
    fieldIndex,
    model,
    onSwatchInput: (c) => {
      if (ready) commitColor(c);
    },
  });
  // A workspace row filling the desktop (viewport minus the menu + status chrome rows). The rail and
  // the inspector hold a fixed width; the preview takes whatever is left.
  const workspace = row(fixed(rail.view, 28), grow(preview), fixed(inspector, 32));
  // The row direction is restated on every resize rather than assumed, so the workspace stays
  // independent of how its children were composed. `row()` above sets nothing else, so this writes the
  // same layout the group already had plus the new rect.
  const sizeWorkspace = (size: Size2D): void => {
    workspace.setLayout({
      position: 'absolute',
      rect: { x: 0, y: 0, width: size.width, height: Math.max(1, size.height - 2) },
      direction: 'row',
    });
  };
  // Size to the ACTUAL viewport the loop mounted at (the real terminal size on a live run), not the
  // 80×24 fallback: no resize event fires at startup, so a stale initial size would persist until the
  // user manually resized the terminal.
  const buffer = app.loop.renderRoot.buffer();
  sizeWorkspace({ width: buffer.width, height: buffer.height });
  app.desktop.add(workspace);
  // Chain (not replace) the app shell's resize handler, which re-fits the overlay/menu/desktop; then
  // re-size the workspace to the new viewport.
  const baseResize = app.loop.onResize;
  app.loop.onResize = (size) => {
    baseResize?.(size);
    sizeWorkspace(size);
  };

  // Reactive wiring, owned by one root for the app's lifetime.
  createRoot(() => {
    // Apply the model's theme to the whole app on every change (initial + each edit), downsampled to
    // the selected preview depth so the whole preview shows how the theme degrades on a shallower
    // terminal. The exported theme keeps its authored truecolor values — this is a preview transform.
    effect(() => {
      const base = model.theme();
      const depth = model.state().depth;
      const lit = blinkLit();
      const c = blinkColor();
      // On a lit blink frame, recolor every cell using the selected color before downsampling, so the
      // preview widgets that use it flash; otherwise apply the theme as authored.
      const themed = lit && c !== null ? flashColor(base, c, flashColorFor(c)) : base;
      app.setTheme(downsampleTheme(themed, depth));
    });
    // Field toggle (bg ↔ fg) → reload the selected target's color for that field into the controls.
    // Reading the model here is a load, never a write, so it is safe under the commit effects.
    effect(() => {
      fieldIndex();
      if (!ready) return;
      untrack(() => loadColor(editColor()));
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
      untrack(() => {
        selectTarget(rail.targets[index]);
        // Flash the just-selected color across the preview (skipped during the initial pre-`ready` load).
        if (ready) startBlink(editColor());
      });
    });
    // Stop any pending blink timer when the app tears down.
    onCleanup(stopBlink);
  });

  // Load the current selection into the inspector, then arm the commit effects.
  loadColor(editColor());
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
    inspector: { r, g, b, hex: hexText, field: fieldIndex },
    selectTarget,
    flashPreview: startBlink,
    open,
    save,
    loadPresetGuarded,
    quitGuarded,
    run: () => app.run(),
  };
}
