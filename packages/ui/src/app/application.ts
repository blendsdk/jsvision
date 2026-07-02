/**
 * `createApplication` — the app-shell composition root (RD-05 AR-71/AR-75).
 *
 * Composes the RD-04 `EventLoop`, an owned `Desktop`, optional `MenuBar`/`StatusLine`, an absolute
 * full-viewport `overlay` layer, and a quit-command sink into the full-screen column layout, then
 * registers the standard commands and returns an {@link Application}. `run()` (in `run.ts`) wires the
 * real terminal to the composed loop. Composition over inheritance (AR-75): the loop is composed,
 * not re-shaped.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
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

/** Options for the application: loop/render config + optional chrome + the injectable OS boundary. */
export interface ApplicationOptions {
  /** REQUIRED — depth-aware encoding for the loop-built RenderRoot's `serialize()` (AR-44). */
  caps: CapabilityProfile;
  /** Initial viewport; default = the output stream's `columns`×`rows`, else 80×24 (PA-3). */
  viewport?: Size2D;
  /** Active theme; defaults to core's `defaultTheme` (incl. the `windowInactive` role, AR-73). */
  theme?: Theme;
  /** Screen-safe logger for `draw()`/`onEvent()` errors (AR-42/AR-66). */
  logger?: Logger;
  /** Key-chord → command keymap (core `createKeymap`, AR-62). */
  keymap?: Keymap;
  /** Optional top menu bar chrome. */
  menuBar?: MenuBar;
  /** Optional bottom status line chrome. */
  statusLine?: StatusLine;
  /** Injectable OS boundary (default real Node runtime); tests inject a fake (AR-71/PA-14). */
  runtime?: RuntimeAdapter;
  /**
   * Injectable input stream forwarded to `createHost` (default `process.stdin`). Tests inject a fake
   * TTY stream so `run()` is exercised headlessly (PA-14). Intra-package — forwards an existing core
   * `HostOptions` field; AC-21 (only cross-package edit = `windowInactive`) holds.
   */
  input?: NodeJS.ReadStream;
  /** Injectable output stream forwarded to `createHost` (default `process.stdout`); see {@link input}. */
  output?: NodeJS.WriteStream;
  /**
   * Warn once at startup (real TTY only) when the terminal renders our ambiguous-width chrome glyphs
   * double-width. Forwards core's `HostOptions.warnAmbiguousWidth`. Default `true` (zero-config); tests
   * that simulate a TTY without a live terminal pass `false` to skip the probe.
   */
  warnAmbiguousWidth?: boolean;
  /**
   * Adapt to ASCII-safe chrome when the terminal renders our ambiguous-width chrome glyphs
   * double-width (real TTY only). Forwards core's `HostOptions.adaptAmbiguousWidth`. Default `true`
   * (zero-config); tests that simulate a TTY without a live terminal pass `false` to skip the probe.
   */
  adaptAmbiguousWidth?: boolean;
}

/** The composed application (composition over inheritance, AR-75). */
export interface Application {
  /** The owned window-manager desktop. */
  readonly desktop: Desktop;
  /** The composed event loop driving dispatch + frames. */
  readonly loop: EventLoop;
  /** Wire `createHost` → dispatch, run until `'quit'`, resolve the exit code; restore on every path (AR-71). */
  run(): Promise<number>;
}

/** Fixed cell height of the menu/status chrome rows. */
const CHROME_ROW_HEIGHT = 1;

/**
 * A hidden, pre-process command handler that terminates `run()` on the `'quit'` command (PA-12). It
 * is `visible:false` — omitted from reflow/paint/hit-test — yet still swept in the pre-process phase
 * (the sweep does not gate on visibility), so it catches `'quit'` before any view consumes it.
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
      // Coerce the exit code: a numeric arg is the code, otherwise default 0 (AR-86).
      const code = typeof inner.arg === 'number' ? inner.arg : 0;
      this.onQuit(code);
      ev.handled = true;
    }
  }
}

/**
 * Resolve the initial viewport (PA-3): explicit `opts.viewport`, else the output stream's
 * `columns`×`rows` (real or injected), else `process.stdout`, else `80×24`. The host's first
 * `onResize` corrects it against the live terminal.
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
 * Derive the shared overlay's visibility from whether it currently hosts any child (RD-14 PA-5/PF-001).
 *
 * The one full-viewport overlay is shared by every top-z client (the `MenuBar`'s popups + any
 * dropdown popup). Deriving `state.visible` from the live child count is the coexistence rule — the
 * overlay stays visible while **any** client has a child mounted and hides only when the last
 * unmounts, so a menu and a dropdown popup no longer stomp each other's explicit visibility flag.
 *
 * Computed **imperatively** (not via a reactive `effect`): `overlay.children` is a plain `View[]`
 * (`group.ts`) and `state.visible` a plain boolean mutated in place (`view.ts`) — neither is a
 * reactive source, so an effect reading them would subscribe to nothing. Every client already drives
 * repaint imperatively (`overlay.add` → `invalidateLayout`), so this must too — hence the
 * `invalidate()` after the flag flip (PF-001). Call it after each `overlay.add`/`remove`.
 *
 * @param overlay The shared top-z overlay group.
 */
export function syncOverlayVisible(overlay: Group): void {
  overlay.state.visible = overlay.children.length > 0;
  overlay.invalidate();
}

/**
 * Construct the application — composes the loop/desktop/chrome/overlay and registers the standard
 * commands (AR-71, AR-75). The chrome children are added to the app root before the loop mounts it,
 * so the whole tree mounts in one pass; the loop seam is injected after the loop exists (PA-7).
 *
 * @param opts Required `caps` + optional viewport/theme/logger/keymap/chrome/runtime/streams.
 * @returns The composed {@link Application}.
 */
export function createApplication(opts: ApplicationOptions): Application {
  const viewport = resolveViewport(opts);

  // The owned desktop fills the column below the menu and above the status row.
  const desktop = new Desktop();
  desktop.layout = { size: { kind: 'fr', weight: 1 } };

  // The absolute, full-viewport overlay: top-z, paint/hit-inert until a popup mounts (PF-10).
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: viewport.width, height: viewport.height } };
  overlay.state.visible = false;

  // The app root: a column of [sink, menuBar?, desktop, statusLine?, overlay] (overlay paints last).
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

  // Build the loop, mount the composed tree, then inject the loop seam into the desktop (PA-7).
  const loop = createEventLoop(viewport, {
    caps: opts.caps,
    theme: opts.theme,
    logger: opts.logger,
    keymap: opts.keymap,
    commands: Object.values(Commands),
    quitCommand: Commands.quit, // HR-38: a quit during a modal cascades top-down (PA-2)
  });
  loop.mount(root);
  desktop.attachLoop(loop);

  // RD-14 PF-002/PA-9: the app shell is the default popup host — a dropdown leaf reaches this overlay
  // + focus save/restore through its `ev.popupHost`. Wired after mount so the loop + overlay exist.
  loop.popupHost = {
    overlay,
    focusView: (view) => loop.focusView(view),
    getFocused: () => loop.getFocused(),
  };

  // Wire the menu bar's controller to the overlay + loop seam (PA-7). Done after mount so the loop
  // exists and the overlay has its composed rect for popup positioning.
  if (opts.menuBar !== undefined) {
    opts.menuBar.attach(overlay, {
      emitCommand: (command, arg) => loop.emitCommand(command, arg),
      isCommandEnabled: (command) => loop.isCommandEnabled(command),
      focusView: (view) => loop.focusView(view),
      getFocused: () => loop.getFocused(),
    });
  }

  // Wire the status line's loop seam for activation + greying + press-capture (PA-7 / RD-10 AR-88).
  if (opts.statusLine !== undefined) {
    opts.statusLine.attach({
      emitCommand: (command, arg) => loop.emitCommand(command, arg),
      isCommandEnabled: (command) => loop.isCommandEnabled(command),
      setCapture: (view) => loop.setCapture(view),
      releaseCapture: () => loop.releaseCapture(),
    });
  }

  // HR-36 / HR-41: on a viewport resize, keep the absolute overlay full-screen, re-anchor the open
  // menu's outside-click catcher, and re-fit the desktop's zoomed windows to the new geometry. The
  // loop fires this after the reflow settles (so `desktop.bounds` is current), then repaints once
  // more. Runs on BOTH the real-host resize (`run.ts` → `loop.resize`) and a headless `loop.resize`.
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
        caps: opts.caps,
        runtime: opts.runtime,
        input: opts.input,
        output: opts.output,
        warnAmbiguousWidth: opts.warnAmbiguousWidth,
        adaptAmbiguousWidth: opts.adaptAmbiguousWidth,
        quitState,
      }),
  };
}
