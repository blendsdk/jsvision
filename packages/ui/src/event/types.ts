/**
 * Public types for the event loop: the `EventLoop` handle and its `EventLoopOptions`, plus the
 * modal-host seam a self-closing modal view (e.g. a `Dialog`) opts into.
 */
import type { CapabilityProfile, Theme, Logger, Keymap, ScreenBuffer } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';
import type { View, RenderRoot, AppEvent, Point, PopupHost } from '../view/index.js';

/**
 * The handle a self-closing modal view receives so it can close itself from its own event handling.
 *
 * When you open a view with {@link EventLoop.execView} and that view implements
 * {@link ModalHostAware}, the loop hands it a `ModalHost` before the modal opens. A `Dialog` uses it
 * to catch its terminating command (OK/Cancel), run its validation gate, then call `endModal` to
 * resolve the `execView` promise. You rarely implement this yourself — `Dialog` already does.
 */
export interface ModalHost {
  /** Resolve the active `execView` promise with `result` (e.g. the command that closed the dialog). */
  endModal(result: unknown): void;
  /** Whether a command is currently enabled (a dialog gates its close-on-command on this). */
  isCommandEnabled(command: string): boolean;
}

/**
 * Implement this on a view to opt into self-closing modality. When such a view is opened with
 * {@link EventLoop.execView}, the loop injects a {@link ModalHost} via {@link attachModalHost}
 * before the modal opens, so the view can later close itself. Views that do not implement it (the
 * common case) are opened as plain modals and closed by an external `endModal` call.
 */
export interface ModalHostAware {
  /** Receive the loop's modal-host handle when this view is opened via `execView`. */
  attachModalHost(host: ModalHost): void;
}

/** Options for {@link createEventLoop}. Only `caps` is required; everything else is optional. */
export interface EventLoopOptions {
  /** Required. Terminal capability profile that drives color-depth encoding for every painted frame. */
  caps: CapabilityProfile;
  /** Color/style theme applied to every view; defaults to the built-in `defaultTheme`. */
  theme?: Theme;
  /** Logger that receives errors thrown from a view's `onEvent()`/`draw()`; defaults to a no-op logger. */
  logger?: Logger;
  /** Key-chord → command map (from core's `createKeymap`): a matched chord fires the command and swallows the key. */
  keymap?: Keymap;
  /** Optional list of command names known up front. Commands are enabled by default whether listed or not. */
  commands?: Iterable<string>;
  /** Called once per dispatch tick after all cascaded events drain, just before the frame is painted. */
  onIdle?: () => void;
  /**
   * Clock used to time double-clicks (defaults to `Date.now`). Two mouse-downs on the same cell
   * within the multi-click window are reported as a double-click via `DispatchEvent.clickCount`.
   * Inject a controllable clock in headless tests to drive exact timestamps.
   */
  now?: () => number;
  /**
   * The command that terminates the app (default `'quit'`). If a quit is emitted while modal windows
   * are open, it cascades top-down through the modal stack: each modal is asked to close, and a
   * modal that vetoes (e.g. a dialog whose validation fails) stops the cascade and keeps the app
   * running. Once the stack is empty the quit reaches the app's quit handler.
   */
  quitCommand?: string;
  /**
   * The key that toggles "accelerator mode" (default `'f12'`). While it is on, every reachable
   * `~X~` hotkey in the current scope is underlined and pressing a bare letter fires the matching
   * accelerator as if you had pressed `Alt`+letter. Pass `null` to disable the feature entirely.
   */
  revealKey?: string | null;
  /**
   * Called when the {@link quitCommand} is emitted, with the exit code carried by the command (0 when
   * none was given). This is how the loop terminates: `createApplication` wires it to resolve `run()`.
   * When unset (a bare loop), the quit command is a plain command with no special termination.
   */
  onQuit?: (code: number) => void;
}

/**
 * The event loop: a host-agnostic engine that owns a render root, routes input and commands, manages
 * focus, commands, and modal windows, and paints exactly one coalesced frame per dispatch tick.
 *
 * You drive it entirely through `dispatch()` (decoded input) and the imperative methods below — no
 * terminal is required, which is what makes it testable and embeddable. To connect it to a real
 * terminal, either wire the `on*`/`write*` sinks to a host yourself, or use `createApplication`,
 * which does that wiring for you. Create one with {@link createEventLoop}.
 */
export interface EventLoop {
  /** The render root the loop builds and owns — read `renderRoot.buffer()` to inspect the composed frame. */
  readonly renderRoot: RenderRoot;
  /** Mount a view tree as the loop's root and paint the first frame. Call once before dispatching. */
  mount(root: View): void;
  /** Feed one decoded input event (key/mouse/wheel/paste) into the loop; it routes and repaints in one tick. */
  dispatch(event: AppEvent): void;
  /** Resize the viewport: reflow the tree and paint exactly one frame. */
  resize(size: Size2D): void;
  /** Move focus to the next focusable view in traversal order, wrapping at the end. */
  focusNext(): void;
  /** Move focus to the previous focusable view in traversal order, wrapping at the start. */
  focusPrev(): void;
  /** Focus exactly `view`. A no-op if `view` is not currently focusable. */
  focusView(view: View): void;
  /** Focus **into** a container: restore its last-focused child, or focus its first focusable descendant. */
  focusInto(view: View): void;
  /** The currently focused view, or `null` if nothing is focused. */
  getFocused(): View | null;
  /** Emit a command, routing it to any handler. Dropped silently if the command is disabled. */
  emitCommand(command: string, arg?: unknown): void;
  /** Enable or disable a command. While disabled, `emitCommand` for it is dropped. */
  enableCommand(command: string, on: boolean): void;
  /** Whether a command is currently enabled. Commands are enabled by default until disabled. */
  isCommandEnabled(command: string): boolean;
  /**
   * Open `view` as a modal: input is captured to its subtree until it closes. Returns a promise that
   * resolves with the value passed to {@link endModal}. `await` it to run a dialog and read its result.
   */
  execView<R>(view: View): Promise<R>;
  /** Close the top-most modal, restore the previously focused view, and resolve its `execView` promise with `result`. */
  endModal<R>(result: R): void;
  /**
   * Turn accelerator mode on or off. When on, every reachable `~X~` hotkey is underlined and a bare
   * letter fires the matching accelerator like `Alt`+letter. The reveal key (default `F12`) toggles
   * this for you; call it directly to arm/dismiss the mode programmatically. A no-op when the feature
   * is disabled (`revealKey: null`).
   */
  setAcceleratorMode(on: boolean): void;
  /**
   * Register a handler for a named command; returns a function that unregisters it. Every handler
   * registered for a command runs (in registration order) when that command is emitted, and a handled
   * command is consumed there — a downstream view matching the same command does not also receive it.
   *
   * Handlers run in the pre-process phase, so an `onCommand` handler fires before a focused view could
   * handle the same command. One exception: while a modal (e.g. a `Dialog`) owns the dispatch scope,
   * commands are confined to the modal subtree, so a general `onCommand` handler does not fire until
   * the modal closes.
   *
   * @param command The command name to handle.
   * @param handler Called when the command is emitted.
   * @returns A function that unregisters this handler (idempotent).
   */
  onCommand(command: string, handler: () => void): () => void;

  // --- Host-integration sinks -------------------------------------------------------------------
  /**
   * Capture the pointer to `view`: while captured, **all** mouse/wheel events go to `view` (with
   * view-local `ev.local` coordinates), bypassing hit-testing and focus-on-click — this is how a
   * drag or resize keeps tracking even after the cursor leaves the affordance. Setting a new target
   * replaces any current one; capture is released automatically when a modal opens/closes or the
   * target unmounts.
   */
  setCapture(view: View): void;
  /** Release the pointer capture. A no-op if nothing is captured. */
  releaseCapture(): void;
  /**
   * Called with the composed buffer after every frame (each dispatch tick, resize, and mount) so a
   * host can paint it. Set this to `host.render` (or your own writer) after the host exists;
   * `createApplication` wires it for you. While unset, frames are still composed but not pushed —
   * headless tests read `renderRoot.buffer()` directly.
   */
  onFrame?: (buffer: ScreenBuffer) => void;
  /**
   * Called right after {@link onFrame} at every frame with the focused view's absolute caret cell,
   * or `null` when nothing is focused or the focused view wants no visible caret. Wire it to move the
   * terminal's hardware cursor. It reads the persisted view origin, so the caret position stays
   * correct even on a partial repaint that skips the focused view. `undefined` ⇒ no caret output.
   */
  onCaret?: (cell: Point | null) => void;
  /**
   * Called inside {@link resize} after the reflow settles the new geometry, so a handler can
   * re-anchor viewport-sized chrome against fresh bounds (the app uses it to re-fit maximized windows
   * and re-anchor the open menu). The loop repaints once more afterward so the adjustment is visible.
   * `undefined` ⇒ resize only reflows.
   */
  onResize?: (size: Size2D) => void;
  /**
   * Re-send the current caret cell to {@link onCaret} out of band. `run()` calls it once after the
   * first frame (which is painted directly, not through a tick) to position the initial cursor. A
   * no-op when `onCaret` is unset.
   */
  refreshCaret(): void;
  /**
   * Called with a ready-to-write terminal clipboard sequence when a control copies/cuts text (the
   * loop encodes and sanitizes it for you). Wire it to your output stream. `undefined` ⇒ clipboard
   * writes are dropped, so copy/cut is a safe no-op headlessly.
   */
  writeClipboard?: (seq: string) => void;
  /**
   * The host that anchored dropdown popups (menus, combo boxes, date/color pickers) mount into.
   * `createApplication` wires it to the app's overlay + focus. `undefined` ⇒ no host, so opening a
   * dropdown is a safe no-op; a standalone `Dialog` can supply its own.
   */
  popupHost?: PopupHost;
}
