/**
 * Event-loop public types (RD-04). The `EventLoop` facade and its construction `EventLoopOptions`.
 *
 * The event-handler **contract types** (`CommandEvent`/`AppEvent`/`DispatchEvent`) are declared in
 * `../view/types.ts` (PA-8 — alongside `View`, to avoid a `view/`→`event/` import cycle) and
 * re-exported through this module's barrel (`event/index.ts`), so `@jsvision/ui` exposes them as
 * RD-04 symbols.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { CapabilityProfile, Theme, Logger, Keymap, ScreenBuffer } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';
import type { View, RenderRoot, AppEvent, Point, PopupHost } from '../view/index.js';

/**
 * The modal-host handle a modal view is given so it can close itself (RD-11 PA-1). One additive
 * intra-package loop seam (precedent: the AR-82/AR-84 `setCapture`/`onFrame` seams — the loop is
 * *composed*, not reshaped). The `Dialog` catches its terminating command, runs its `valid()` gate,
 * then calls `endModal(command)` to resolve the `execView` promise.
 */
export interface ModalHost {
  /** Resolve the active `execView` promise with `result` (the Dialog passes its terminating command). */
  endModal(result: unknown): void;
  /** Whether a command is currently enabled (the Dialog gates its terminating-command catch on it). */
  isCommandEnabled(command: string): boolean;
}

/**
 * A view opts into self-closing modality by implementing this (RD-11 PA-1). `execView` duck-types the
 * method and, when present, injects the {@link ModalHost} before `modal.begin`. Non-modal views
 * (everything today) never implement it and are unaffected.
 */
export interface ModalHostAware {
  /** Receive the loop's modal-host handle when opened via `execView` (RD-11 PA-1). */
  attachModalHost(host: ModalHost): void;
}

/** Construction options for {@link EventLoop}. `caps` is required; the rest are optional seams. */
export interface EventLoopOptions {
  /** REQUIRED — depth-aware encoding, built into the loop's `RenderRoot` (AR-44, AR-61). */
  caps: CapabilityProfile;
  /** Active theme forwarded to the `RenderRoot`; defaults to core's `defaultTheme` (AR-35). */
  theme?: Theme;
  /** Logger for `onEvent()` (and `draw()`) errors; defaults to a disabled logger (AR-66). */
  logger?: Logger;
  /** Core `createKeymap` result: bound chords convert to commands (consume, AR-62, PA-1). */
  keymap?: Keymap;
  /** Upfront command hint; an unlisted command is still enabled by default (PA-3). */
  commands?: Iterable<string>;
  /** Fires once when a dispatch tick's cascade queue drains (AR-58). */
  onIdle?: () => void;
  /**
   * The app-terminating command (default `'quit'`). A quit emitted while modals are open cascades
   * **top-down** through the modal stack — each modal resolves via `endModal(quitCommand)`, a
   * `Dialog.valid(quitCommand)` gate may veto and stop the cascade — before reaching the root sink
   * (HR-38 / PA-2; TV `cmQuit` + `TGroup::execute`'s `while(!valid(endState))`).
   */
  quitCommand?: string;
}

/**
 * The host-agnostic dispatch mechanism (AR-47). It builds and owns a `RenderRoot`, routes events
 * through the 3-phase machine, manages focus/commands/modality, and drives exactly one coalesced
 * frame per tick. Real host/`run()` wiring is RD-05; RD-04 is driven purely via `dispatch()`.
 */
export interface EventLoop {
  /** The loop-built render root (host integration + tests, AR-61). */
  readonly renderRoot: RenderRoot;
  /** Mount a view tree into the loop's render root. */
  mount(root: View): void;
  /** The single pure input entry: wrap `event` in a `DispatchEvent` and route it 3-phase (AR-49). */
  dispatch(event: AppEvent): void;
  /** Resize the viewport: reflow + exactly one frame (AR-54). */
  resize(size: Size2D): void;
  /** Advance focus to the next focusable view in traversal order (wrap, AR-57). */
  focusNext(): void;
  /** Move focus to the previous focusable view in traversal order (wrap, AR-57). */
  focusPrev(): void;
  /** Focus exactly `view`; a no-op if `view` is non-focusable (PA-5). */
  focusView(view: View): void;
  /** Focus **into** a container: descend to its saved `current` (restore) or first focusable leaf (AR-53). */
  focusInto(view: View): void;
  /** The current globally-focused view (root→leaf `current` chain), or `null` (AR-48). */
  getFocused(): View | null;
  /** Raise a `CommandEvent` and route it through the 3-phase machine, unless disabled (AR-52, PA-3). */
  emitCommand(command: string, arg?: unknown): void;
  /** Enable/disable a command; a disabled command's `emitCommand` is dropped (PA-3). */
  enableCommand(command: string, on: boolean): void;
  /** Whether a command is currently enabled (unregistered ⇒ enabled by default, PA-3). */
  isCommandEnabled(command: string): boolean;
  /** Open `view` as a modal, capturing input to its subtree; resolves when `endModal` is called (AR-53). */
  execView<R>(view: View): Promise<R>;
  /** Close the top modal, restoring focus and resolving the matching `execView` promise (AR-53). */
  endModal<R>(result: R): void;

  // --- RD-05 additive seams (the loop is composed, not re-shaped) -------------------------------
  /**
   * Pointer capture (RD-05 PA-5 / AR-82): while a target is set, **all** mouse/wheel events route to
   * `view` (target-local `ev.local`) until {@link releaseCapture}, bypassing the hit-test and
   * suppressing focus-on-click — so a drag/resize keeps tracking past the affordance. Last-writer-
   * wins if a capture is already set; auto-released when a modal opens/closes or the target unmounts.
   */
  setCapture(view: View): void;
  /** Clear the pointer-capture target; a no-op if none is set (RD-05 PA-5). */
  releaseCapture(): void;
  /**
   * Frame sink (RD-05 PA-6 / AR-84): when set, fired after every coalesced flush (end of a dispatch
   * tick, on resize, after mount) with the live composed buffer so the host can paint. A **settable
   * member** (not an `EventLoopOptions` field) because `run()` wires it to `host.render` only after
   * the host exists — `createApplication` builds the loop first (PA-18 / PF-04). `undefined` until
   * set ⇒ flushes still happen but push nothing (headless tests/demos read `renderRoot.buffer()`).
   */
  onFrame?: (buffer: ScreenBuffer) => void;
  /**
   * Hardware-caret sink (RD-07 PA-5). A sibling of {@link onFrame}, fired right **after** it at every
   * frame point (tick, resize, mount) with the focused view's **absolute** caret cell — computed by
   * the loop from `getFocused()` + `leaf.desiredCaret()` + `renderRoot.originOf(leaf)` — or `null`
   * when focus is lost / the focused view requests no caret. A settable member (not an
   * `EventLoopOptions` field) because `run()` wires it to the real cursor only after the host exists.
   * Independent of which views repainted this frame — it reads the persisted origin, so the caret
   * survives a partial recompose that skips the focused view (PF-002). `undefined` ⇒ no caret output.
   */
  onCaret?: (cell: Point | null) => void;
  /**
   * Resize sink (HR-36 / HR-41): fired inside {@link EventLoop.resize} **after** the reflow settles
   * the new viewport bounds, so a handler can re-anchor viewport-sized chrome against fresh geometry —
   * the app wires it to re-zoom desktop windows + clamp their `restoredRect` and to re-anchor the open
   * menu's outside-click catcher. A settable member (the app sets it after composing the loop).
   * `undefined` ⇒ resize only reflows (the base behavior). The loop repaints once more afterward so any
   * adjustment the handler makes is composed into the resized frame.
   */
  onResize?: (size: Size2D) => void;
  /**
   * Re-emit the current hardware-caret cell to {@link onCaret} out of band (RD-07 PA-5). `run()` calls
   * it once after painting the first frame — which is a direct `host.render`, not a loop tick, so no
   * `onCaret` fired yet — to position the initial cursor. A no-op when `onCaret` is unset (headless).
   */
  refreshCaret(): void;
  /**
   * Clipboard-write sink (RD-07 PA-5/PA-7). Receives a fully-formed OSC-52 sequence (already
   * base64-encoded + sanitized + caps-gated by core `setClipboard`) that `run()` writes to the
   * co-owned output stream — the same stream as {@link onCaret}. Sourced onto each envelope's
   * `ev.setClipboard(text)`: the loop encodes `text`→sequence and calls this. A settable member for
   * the same reason as {@link onFrame}. `undefined` ⇒ clipboard writes are dropped (headless).
   */
  writeClipboard?: (seq: string) => void;
  /**
   * Popup-host seam (RD-14 PF-002/PA-9): the overlay + focus host an app-created dropdown control
   * reaches through its `ev.popupHost` to mount + focus an anchored popup. A settable member (like
   * {@link onFrame}) because `createApplication` wires it only after the overlay + loop exist; the
   * loop sources it onto every routed envelope. `undefined` ⇒ no host (headless / no shell), so a
   * control's open is a safe no-op. A bare `Dialog` without an app shell can supply its own.
   */
  popupHost?: PopupHost;
}
