/**
 * `createApplication` — the top-level entry point that assembles a complete terminal app.
 *
 * It lays out, top to bottom, an optional menu bar, a desktop window manager that fills the middle,
 * an optional status line, and a full-screen popup overlay on top, all driven by an event loop, and
 * registers the standard window-management commands. The returned {@link Application} exposes the
 * `desktop` and `loop` for you to populate, and a `run()` that connects everything to a real terminal.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { CapabilityProfile, Theme, Logger, Keymap, RuntimeAdapter } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';
import { Group, View } from '../view/index.js';
import type { DispatchEvent } from '../view/index.js';
import { createEventLoop } from '../event/index.js';
import type { EventLoop } from '../event/index.js';
import { Desktop } from '../desktop/index.js';
import type { MenuBar } from '../menu/index.js';
import { Commands } from '../status/index.js';
import type { StatusLine } from '../status/index.js';
import { runApplication } from './run.js';
import type { QuitState } from './run.js';

/** Options for {@link createApplication}. Everything is optional — an app starts with no arguments. */
export interface ApplicationOptions {
  /**
   * Terminal capability profile that drives color-depth encoding for every painted frame. Defaults to
   * `'auto'`, which detects the running terminal's capabilities via `resolveCapabilities()`. Pass an
   * explicit profile to override the detection (used verbatim, no re-resolution).
   */
  caps?: CapabilityProfile | 'auto';
  /** Initial viewport size in cells. Defaults to the output terminal's size, or 80×24 if unknown. */
  viewport?: Size2D;
  /** Color/style theme applied to every view; defaults to the built-in `defaultTheme`. */
  theme?: Theme;
  /** Logger that receives errors thrown from a view's `draw()`/`onEvent()`; defaults to a no-op logger. */
  logger?: Logger;
  /** Key-chord → command map (from core's `createKeymap`) applied across the whole app. */
  keymap?: Keymap;
  /** Optional menu bar shown as the top row. Build one with `menuBar(...)`. */
  menuBar?: MenuBar;
  /** Optional status line shown as the bottom row. Build one with `statusLine(...)`. */
  statusLine?: StatusLine;
  /**
   * The key that toggles accelerator mode (default `'f12'`): while on, every `~X~` hotkey is
   * underlined and a bare letter fires the matching accelerator. Pass `null` to disable the feature.
   */
  revealKey?: string | null;
  /** OS boundary the host runs against; defaults to the real Node runtime. Inject a fake in tests. */
  runtime?: RuntimeAdapter;
  /** Input stream to read from; defaults to `process.stdin`. Inject a fake TTY stream to run headlessly. */
  input?: NodeJS.ReadStream;
  /** Output stream to write to; defaults to `process.stdout`. */
  output?: NodeJS.WriteStream;
  /**
   * On a real terminal, warn once at startup if the terminal renders the ambiguous-width frame glyphs
   * double-width (which shifts alignment). Default `true`; pass `false` to skip the probe in tests.
   */
  warnAmbiguousWidth?: boolean;
  /**
   * On a real terminal, automatically switch to ASCII-safe frame chrome if the startup probe finds
   * the ambiguous-width glyphs render double-width. Default `true`; pass `false` to skip the probe.
   */
  adaptAmbiguousWidth?: boolean;
}

/** A ready-to-run terminal application. Populate `desktop`/`loop`, then call `run()`. */
export interface Application {
  /** The desktop window manager. Add windows with `desktop.addWindow(...)`. */
  readonly desktop: Desktop;
  /** The underlying event loop. Use it to emit commands, manage focus, or run modals. */
  readonly loop: EventLoop;
  /**
   * Connect to the terminal and run until the `'quit'` command, resolving to the exit code. The
   * terminal is always restored on exit — normal, thrown, or signalled.
   */
  run(): Promise<number>;
}

/** Fixed cell height of the menu/status chrome rows. */
const CHROME_ROW_HEIGHT = 1;

/**
 * A hidden view that ends `run()` when it sees the `'quit'` command. It is invisible (never painted
 * or hit-tested) but still participates in the pre-process phase, so it catches `'quit'` before any
 * other view could consume it.
 */
class QuitCommandSink extends View {
  constructor(private readonly onQuit: (code: number) => void) {
    super();
    this.preProcess = true;
    this.state.visible = false;
  }

  draw(): void {
    // intentionally empty — the sink never paints (visible:false)
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'command' && inner.command === Commands.quit) {
      // The exit code is the command's numeric argument, or 0 if none was given.
      const code = typeof inner.arg === 'number' ? inner.arg : 0;
      this.onQuit(code);
      ev.handled = true;
    }
  }
}

/**
 * Resolve the capability option to a concrete profile: when it is absent or `'auto'`, detect the
 * running terminal's capabilities; an explicit profile is returned unchanged. Called once at the top
 * of {@link createApplication}, so `'auto'` never reaches the loop or `run()`.
 */
function resolveCaps(caps: ApplicationOptions['caps']): CapabilityProfile {
  return caps === undefined || caps === 'auto' ? resolveCapabilities().profile : caps;
}

/**
 * Resolve the initial viewport: an explicit `opts.viewport`, else the output terminal's size, else
 * 80×24. The terminal's first resize event corrects it to the live size.
 */
function resolveViewport(opts: ApplicationOptions): Size2D {
  if (opts.viewport !== undefined) return opts.viewport;
  const fromStream = streamSize(opts.output) ?? streamSize(process.stdout);
  return fromStream ?? { width: 80, height: 24 };
}

/** A stream's `columns`×`rows` as a {@link Size2D}, or `undefined` when either is unavailable. */
function streamSize(stream: { columns?: number; rows?: number } | undefined): Size2D | undefined {
  if (stream === undefined) return undefined;
  const { columns, rows } = stream;
  if (typeof columns === 'number' && typeof rows === 'number') return { width: columns, height: rows };
  return undefined;
}

/**
 * Show the shared popup overlay while it hosts any popup, and hide it once empty.
 *
 * The single full-screen overlay is shared by every popup client (menu popups, dropdown popups). Its
 * visibility is derived from whether it currently has any child, so two clients cannot fight over an
 * explicit visible/hidden flag — it stays visible while any popup is mounted and hides only when the
 * last one is removed. Call it after adding to or removing from the overlay. The child list and the
 * visible flag are plain (non-reactive) values, so the update is done imperatively, including the
 * `invalidate()` that schedules the repaint.
 *
 * @param overlay The shared popup overlay group.
 * @example
 * import { Group } from '@jsvision/ui';
 * import { syncOverlayVisible } from '@jsvision/ui';
 *
 * const overlay = new Group();
 * overlay.add(myPopup);
 * syncOverlayVisible(overlay); // overlay becomes visible
 *
 * overlay.remove(myPopup);
 * syncOverlayVisible(overlay); // overlay hides again now that it is empty
 */
export function syncOverlayVisible(overlay: Group): void {
  overlay.state.visible = overlay.children.length > 0;
  overlay.invalidate();
}

/**
 * Create a terminal application: assemble the event loop, desktop, optional menu bar/status line, and
 * popup overlay, register the standard window-management commands, and return an {@link Application}.
 *
 * The whole view tree is built and mounted in one pass; the menu bar and status line are wired to the
 * loop after it exists. Populate the returned `desktop` with windows and call `run()` to start.
 *
 * @param opts All optional: `caps` (auto-detected by default), viewport/theme/logger/keymap/menu/status/runtime/streams.
 * @returns The assembled {@link Application}.
 * @example
 * import { createApplication, Window, menuBar, subMenu, item, statusLine, statusItem, Commands } from '@jsvision/ui';
 *
 * // Zero-config: capabilities are auto-detected and everything imports from one package.
 * const bar = menuBar([
 *   subMenu('~W~indow', [item('~T~ile', Commands.tile), item('~C~ascade', Commands.cascade), item('E~x~it', Commands.quit)]),
 * ]);
 * const status = statusLine([statusItem('~T~ile', Commands.tile, 'F4'), statusItem('~Q~uit', Commands.quit, 'Alt+X')]);
 *
 * const app = createApplication({ menuBar: bar, statusLine: status });
 *
 * const win = new Window('Editor');
 * win.layout.rect = { x: 1, y: 2, width: 30, height: 8 };
 * app.desktop.addWindow(win);
 *
 * const code = await app.run(); // runs until the 'quit' command; restores the terminal on exit
 * process.exit(code);
 */
export function createApplication(opts: ApplicationOptions): Application {
  const caps = resolveCaps(opts.caps); // a concrete profile from here down — 'auto' never leaks past this
  const viewport = resolveViewport(opts);

  // The owned desktop fills the column below the menu and above the status row.
  const desktop = new Desktop();
  desktop.layout = { size: { kind: 'fr', weight: 1 } };

  // The full-screen overlay popups mount into. It sits on top and stays hidden (so it neither paints
  // nor intercepts clicks) until a popup is added.
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height } };
  overlay.state.visible = false;

  // The app root is a top-to-bottom column: [quit sink, menu bar?, desktop, status line?, overlay].
  // The overlay is added last so it paints over everything else.
  const root = new Group();
  root.layout = { direction: 'col' };

  const quitState: QuitState = { resolve: null };
  const sink = new QuitCommandSink((code) => quitState.resolve?.(code));
  root.add(sink);
  if (opts.menuBar !== undefined) {
    opts.menuBar.layout = { size: { kind: 'fixed', cells: CHROME_ROW_HEIGHT } };
    root.add(opts.menuBar);
  }
  root.add(desktop);
  if (opts.statusLine !== undefined) {
    opts.statusLine.layout = { size: { kind: 'fixed', cells: CHROME_ROW_HEIGHT } };
    root.add(opts.statusLine);
  }
  root.add(overlay);

  // Build the loop and mount the tree, then wire the parts that need the loop to exist first.
  const loop = createEventLoop(viewport, {
    caps,
    theme: opts.theme,
    logger: opts.logger,
    keymap: opts.keymap,
    commands: Object.values(Commands),
    quitCommand: Commands.quit, // a quit while a dialog is open cascades top-down through the modals
    revealKey: opts.revealKey, // undefined leaves the loop's F12 default in place
  });
  loop.mount(root);
  desktop.attachLoop(loop);

  // The app is the default popup host: a dropdown control mounts its popup into this overlay and
  // saves/restores focus through the loop. Wired after mount so the loop and overlay both exist.
  loop.popupHost = {
    overlay,
    focusView: (view) => loop.focusView(view),
    getFocused: () => loop.getFocused(),
  };

  // Connect the menu bar to the overlay (where its popups mount) and the loop (to emit commands, move
  // focus, and dismiss accelerator mode when a menu opens). Done after mount so the overlay has a
  // laid-out rect for positioning popups.
  if (opts.menuBar !== undefined) {
    opts.menuBar.attach(overlay, {
      emitCommand: (command, arg) => loop.emitCommand(command, arg),
      isCommandEnabled: (command) => loop.isCommandEnabled(command),
      focusView: (view) => loop.focusView(view),
      getFocused: () => loop.getFocused(),
      dismissAccelerators: () => loop.setAcceleratorMode(false), // an open menu owns plain letters
    });
  }

  // Connect the status line to the loop so its items can emit commands, grey out when disabled, and
  // capture the pointer for press-and-release feedback.
  if (opts.statusLine !== undefined) {
    opts.statusLine.attach({
      emitCommand: (command, arg) => loop.emitCommand(command, arg),
      isCommandEnabled: (command) => loop.isCommandEnabled(command),
      setCapture: (view) => loop.setCapture(view),
      releaseCapture: () => loop.releaseCapture(),
    });
  }

  // On resize, keep the overlay full-screen, re-anchor the open menu's outside-click catcher, and
  // re-fit maximized windows to the new size. The loop fires this after the reflow settles the
  // desktop bounds, then repaints once more, on both real and headless resizes.
  const menu = opts.menuBar;
  loop.onResize = (size) => {
    overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: size.width, height: size.height } };
    overlay.invalidateLayout();
    menu?.controller?.resize();
    desktop.handleViewportResize();
  };

  return {
    desktop,
    loop,
    run: () =>
      runApplication({
        loop,
        caps,
        runtime: opts.runtime,
        input: opts.input,
        output: opts.output,
        warnAmbiguousWidth: opts.warnAmbiguousWidth,
        adaptAmbiguousWidth: opts.adaptAmbiguousWidth,
        quitState,
      }),
  };
}
