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
import { CLEARED_LAYOUT } from '../layout/index.js';
import { Group } from '../view/index.js';
import { col } from '../view/dsl/index.js';
import type { View } from '../view/index.js';
import { createEventLoop } from '../event/index.js';
import type { EventLoop, ClipboardKeys } from '../event/index.js';
import { Desktop } from '../desktop/index.js';
import type { MenuBar, MenuItem } from '../menu/index.js';
import { Commands, StatusItemView, statusItem } from '../status/index.js';
import type { StatusLine } from '../status/index.js';
import type { ChromeHost, ChromeHostAware, FocusHostAware } from '../router/types.js';
import { runApplication } from './run.js';
import type { QuitState } from './run.js';

/** Options for {@link createApplication}. Everything is optional — an app starts with no arguments. */
export interface ApplicationOptions {
  /**
   * The app body: the single view that fills the middle of the shell (below the menu bar, above the
   * status line). Defaults to a {@link Desktop} window manager — the classic overlapping-windows
   * shape. Pass any view (e.g. a router) for a full-screen, non-windowed app; when you do, the app
   * exposes no `desktop` and does not register the window-management commands.
   */
  content?: View;
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
  /**
   * Which clipboard key set the framework binds by default (default `'both'` — modern Ctrl+A/C/X/V
   * plus the classic Ctrl+Insert/Shift+Insert/Shift+Delete aliases). Any `keymap` you supply merges on
   * top and wins on a conflicting chord. Use `'none'` to bind no clipboard chords (e.g. an app hosting
   * a WordStar-mode `Editor`) and supply your own keymap instead.
   */
  clipboardKeys?: ClipboardKeys;
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
  /**
   * Require an interactive TTY at startup. When `true` (the default), `run()` asserts the terminal
   * essentials before taking over the screen and throws `EssentialsNotMetError` when there is no
   * interactive terminal at all — a cron/CI job, a container with no tty, or stdin and stdout both
   * redirected with no controlling terminal — instead of silently starting a keyboard-less app.
   * (Piping output while a controlling terminal exists still works: the host binds `/dev/tty`.) Set
   * `false` for headless/automated runs that drive the loop without a real terminal.
   *
   * @example
   * // A headless integration test drives run() without a terminal:
   * const app = createApplication({ caps, requireTty: false });
   * const exit = app.run(); // starts against injected streams; no EssentialsNotMetError
   */
  requireTty?: boolean;
}

/** A ready-to-run terminal application. Populate `desktop`/`loop`, then call `run()`. */
export interface Application {
  /**
   * The desktop window manager, or `undefined` when the app was created with a custom `content` body
   * (a router app manages its own body and registers no window commands). A no-`content` app always
   * has one — and `createApplication` returns the precise {@link DesktopApplication} type there, so
   * you never need a null check for the default case.
   */
  readonly desktop: Desktop | undefined;
  /** The underlying event loop. Use it to emit commands, manage focus, or run modals. */
  readonly loop: EventLoop;
  /**
   * Register an app-wide handler for a named command; returns a function that unregisters it. Every
   * handler registered for a command runs when that command is emitted, and a handled command is
   * consumed there. Forwards to `loop.onCommand` — see it for the pre-process ordering and the
   * modal-open caveat.
   *
   * @param command The command name to handle (e.g. a menu/status item's command).
   * @param handler Called when the command is emitted.
   * @returns A function that unregisters this handler (idempotent).
   * @example
   * const off = app.onCommand('about', () => messageBox(app, { title: 'About', text: '…' }));
   * // later: off(); // stop handling 'about'
   */
  onCommand(command: string, handler: () => void): () => void;
  /**
   * Replace the active theme at runtime and repaint every view with the new colors in one coalesced
   * frame. Forwards to `loop.setTheme`, so it is safe to call from a command handler or a bare
   * imperative call — the repainted frame reaches the terminal even outside an input tick.
   *
   * @param theme The theme to switch to (a preset, a `createTheme` result, or a `parseTheme` result).
   * @example
   * app.onCommand('theme:nord', () => app.setTheme(nordTheme));
   */
  setTheme(theme: Theme): void;
  /**
   * A **fresh** copy of the application's base status items — the global affordances (e.g. quit/help)
   * a screen composes with its own hints via `withBase`. Each call rebuilds new item views, because a
   * view has a single parent: composing with the live base bar's own instances would re-parent them
   * and corrupt the fallback bar. Only command items are reproduced (spacers/widgets are not part of a
   * composable base).
   *
   * @returns Fresh status-item views mirroring the base bar's command items (empty if no status line).
   * @example
   * // A screen's status = the app base plus a screen-specific action:
   * status: withBase(app.statusBase(), [statusItem('~E~dit', 'detail.edit')]);
   */
  statusBase(): View[];
  /**
   * The application's base menu items — the top-level menu nodes `createApplication({ menuBar })` was
   * given. Menu items are plain data (not views), so this returns a shallow copy safe to compose with
   * `withBase`.
   *
   * @returns A copy of the base menu's top-level items (empty if no menu bar).
   * @example
   * menu: withBase(app.menuBase(), [subMenu('~S~creen', [item('~E~dit', 'detail.edit')])]);
   */
  menuBase(): MenuItem[];
  /**
   * Connect to the terminal and run until the `'quit'` command, resolving to the exit code. The
   * terminal is always restored on exit — normal, thrown, or signalled.
   */
  run(): Promise<number>;
}

/** An application whose body is the default {@link Desktop} window manager (no `content` was given). */
export interface DesktopApplication extends Application {
  /** The desktop window manager — always present for a no-`content` app. */
  readonly desktop: Desktop;
}

/** An application whose body is a custom `content` view (e.g. a router); it has no window manager. */
export interface RouterApplication extends Application {
  /** No window manager: a `content` app manages its own body. */
  readonly desktop: undefined;
}

/**
 * The precise application type for a given options object: a {@link RouterApplication} when `content`
 * is a view, otherwise a {@link DesktopApplication}. This is what lets `createApplication({...})`
 * return a `desktop`-bearing app for the default case with no null check.
 */
export type CreatedApplication<O extends ApplicationOptions> = O extends { content: View }
  ? RouterApplication
  : DesktopApplication;

/** Fixed cell height of the menu/status chrome rows. */
const CHROME_ROW_HEIGHT = 1;

/**
 * The command names a {@link Desktop} handles (window management). Registered only for a Desktop body,
 * so a router app never lists a live-looking Tile/Cascade and emitting one is simply unhandled.
 */
const WINDOW_COMMANDS = new Set<string>([
  Commands.close,
  Commands.zoom,
  Commands.next,
  Commands.prev,
  Commands.cascade,
  Commands.tile,
]);

/** Whether an app body opts into driving the shared chrome (implements {@link ChromeHostAware}). */
function isChromeHostAware(view: View): view is View & ChromeHostAware {
  return typeof (view as Partial<ChromeHostAware>).attachChromeHost === 'function';
}

/** Whether an app body opts into save/restore focus across navigation (implements {@link FocusHostAware}). */
function isFocusHostAware(view: View): view is View & FocusHostAware {
  return typeof (view as Partial<FocusHostAware>).attachFocusHost === 'function';
}

/**
 * A fresh copy of a status line's command items — new {@link StatusItemView}s reconstructed from each
 * item's `text`/`command`/`key`. A view has one parent, so a composable base must hand out fresh
 * instances; passive segments (spacers/widgets) are not part of the base. Read once at startup, before
 * any screen swaps the live bar.
 */
function freshStatusBase(statusLine: StatusLine | undefined): () => View[] {
  const specs = statusLine
    ? statusLine.children
        .filter((child): child is StatusItemView => child instanceof StatusItemView)
        .map((child) => ({ text: child.text, command: child.command, key: child.key }))
    : [];
  return () => specs.map((spec) => statusItem(spec.text, spec.command, spec.key));
}

/**
 * Build the {@link ChromeHost} a router body drives: it swaps the real menu/status bars to a screen's
 * items and restores the captured base on `null`. Captures the base status items and menu nodes at
 * construction (after the bars are wired), so `setStatus(null)`/`setMenu(null)` restore them.
 */
function buildChromeHost(menuBar: MenuBar | undefined, statusLine: StatusLine | undefined): ChromeHost {
  const baseStatus: View[] = statusLine ? [...statusLine.children] : [];
  const baseMenu: readonly MenuItem[] = menuBar ? menuBar.items : [];
  return {
    setStatus: (items) => statusLine?.setItems(items ?? baseStatus),
    setMenu: (items) => menuBar?.setItems(items ?? baseMenu),
  };
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
 * import { Group, syncOverlayVisible } from '@jsvision/ui';
 *
 * const overlay = new Group();
 * const myPopup = new Group();
 *
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
 * @param opts All optional: `content` (the body — a Desktop by default), `caps` (auto-detected),
 *   viewport/theme/logger/keymap/menu/status/runtime/streams.
 * @returns The assembled application. With no `content` it is a {@link DesktopApplication} (so
 *   `app.desktop` is a `Desktop`, no null check); with a `content` view it is a
 *   {@link RouterApplication} (`app.desktop` is `undefined`).
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
 * win.setLayout({ rect: { x: 1, y: 2, width: 30, height: 8 } });
 * app.desktop.addWindow(win); // `desktop` is a Desktop here — no `content` was passed
 *
 * const code = await app.run(); // runs until the 'quit' command; restores the terminal on exit
 * process.exit(code);
 */
export function createApplication<O extends ApplicationOptions = ApplicationOptions>(
  opts: O = {} as O,
): CreatedApplication<O> {
  const caps = resolveCaps(opts.caps); // a concrete profile from here down — 'auto' never leaks past this
  const viewport = resolveViewport(opts);

  // The app body fills the column below the menu and above the status row: the caller's `content`
  // view, or the default Desktop window manager. Only a Desktop body gets window commands + focus.
  const body: View = opts.content ?? new Desktop();
  const isDesktop = body instanceof Desktop;
  // Every other prop is reset explicitly, not merely left unset: a caller's own layout on the content
  // view is intentionally discarded, so the shell governs the body's sizing no matter what the caller
  // set. An explicit `undefined` clears a prop back to its layout default.
  body.setLayout({ ...CLEARED_LAYOUT, size: { kind: 'fr', weight: 1 } });

  // The full-screen overlay popups mount into. It sits on top and stays hidden (so it neither paints
  // nor intercepts clicks) until a popup is added.
  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height } });
  overlay.state.visible = false;

  if (opts.menuBar !== undefined) {
    // Only pin the height — the bar keeps whatever internal layout it set itself (e.g. its own `direction`).
    opts.menuBar.setLayout({ size: { kind: 'fixed', cells: CHROME_ROW_HEIGHT } });
  }
  if (opts.statusLine !== undefined) {
    // Height only: the status line keeps its internal `direction: 'row'` — it lays its children out itself.
    opts.statusLine.setLayout({ size: { kind: 'fixed', cells: CHROME_ROW_HEIGHT } });
  }

  // The shared cell the loop's built-in quit registration resolves through; `run()` fills it in.
  const quitState: QuitState = { resolve: null };

  // The app root is a top-to-bottom column: [menu bar?, body, status line?, overlay]. An absent
  // menu bar or status line is skipped, so the column holds only the rows that exist. The overlay
  // comes last so it paints over everything else. The leading `{}` is load-bearing: the builder
  // reads a non-view first argument as its own props, and `menuBar` comes from the caller.
  const root = col({}, opts.menuBar, body, opts.statusLine, overlay);

  // Build the loop and mount the tree, then wire the parts that need the loop to exist first. Window
  // commands are handled by a Desktop, so register them only for a Desktop body — a router app then
  // never lists a live-looking Tile/Cascade and emitting one is simply unhandled.
  const commandSeed = isDesktop
    ? Object.values(Commands)
    : Object.values(Commands).filter((command) => !WINDOW_COMMANDS.has(command));
  const loop = createEventLoop(viewport, {
    caps,
    theme: opts.theme,
    logger: opts.logger,
    keymap: opts.keymap,
    clipboardKeys: opts.clipboardKeys, // undefined ⇒ the loop's `'both'` default
    commands: commandSeed,
    quitCommand: Commands.quit, // a quit while a dialog is open cascades top-down through the modals
    onQuit: (code) => quitState.resolve?.(code), // the loop registers quit through its command sink
    revealKey: opts.revealKey, // undefined leaves the loop's F12 default in place
  });
  loop.mount(root);
  if (isDesktop) (body as Desktop).attachLoop(loop);

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
      commandsVersion: () => loop.commandsVersion(),
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
      commandsVersion: () => loop.commandsVersion(),
      setCapture: (view) => loop.setCapture(view),
      releaseCapture: () => loop.releaseCapture(),
    });
  }

  // Hand a chrome seam to a router-style body (opted in via `attachChromeHost`) so each screen can
  // swap the shared menu/status bars. Done after the bars are attached, so their base items are the
  // ones captured for `setStatus(null)`/`setMenu(null)`. A Desktop body ignores this.
  if (isChromeHostAware(body)) {
    body.attachChromeHost(buildChromeHost(opts.menuBar, opts.statusLine));
  }

  // Hand the same body a focus seam so it can save/restore keyboard focus across navigation. Without
  // it, the loop's own focus-healing still floors focus into a new screen's first focusable.
  if (isFocusHostAware(body)) {
    body.attachFocusHost({ focusView: (view) => loop.focusView(view), getFocused: () => loop.getFocused() });
  }

  // Capture the base chrome once, before any screen swaps the live bars, so `statusBase`/`menuBase`
  // reproduce the app's global affordances for `withBase` composition.
  const statusBase = freshStatusBase(opts.statusLine);
  const baseMenu: readonly MenuItem[] = opts.menuBar ? [...opts.menuBar.items] : [];

  // On resize, keep the overlay full-screen, re-anchor the open menu's outside-click catcher, and
  // re-fit maximized windows to the new size. The loop fires this after the reflow settles the body
  // bounds, then repaints once more, on both real and headless resizes.
  const menu = opts.menuBar;
  loop.onResize = (size) => {
    overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: size.width, height: size.height } });
    menu?.controller?.resize();
    if (isDesktop) (body as Desktop).handleViewportResize();
  };

  const app: Application = {
    desktop: isDesktop ? (body as Desktop) : undefined,
    loop,
    onCommand: (command, handler) => loop.onCommand(command, handler),
    setTheme: (theme) => loop.setTheme(theme), // forwards to the loop seam so the swap repaints from any call site
    statusBase, // fresh copies of the base command items, for `withBase` composition
    menuBase: () => [...baseMenu], // a shallow copy of the base menu items (plain data)
    run: () =>
      runApplication({
        loop,
        caps,
        runtime: opts.runtime,
        input: opts.input,
        output: opts.output,
        warnAmbiguousWidth: opts.warnAmbiguousWidth,
        adaptAmbiguousWidth: opts.adaptAmbiguousWidth,
        requireTty: opts.requireTty,
        quitState,
      }),
  };
  // The runtime shape matches whichever branch `content` took; the mapped return type narrows it for
  // callers (a no-`content` call sees `desktop: Desktop`, a `content` call sees `desktop: undefined`).
  return app as CreatedApplication<O>;
}
