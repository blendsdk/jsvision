/**
 * `createEventLoop` — the host-agnostic dispatch mechanism (RD-04, AR-47/AR-49/AR-54/AR-61).
 *
 * The loop **builds and owns** a `RenderRoot`, constructing it with a **deferring** `schedule` seam
 * so the root never self-flushes; the loop drives `renderRoot.flush()` itself exactly once per
 * dispatch tick (AR-61/AR-64). Every public mutator that can change focus/command/modal state and
 * the buffer routes through the single internal `runTick`, so each produces exactly one coalesced
 * frame (PA-11): do work → drain the cascade queue → `onIdle?.()` → one `flush()`. A re-entrant call
 * (e.g. `emitCommand` from inside a handler) joins the active tick rather than starting a new one.
 *
 * The full 3-phase router (`dispatch.ts`), command registry (`commands.ts`), and focus manager
 * (`focus.ts`) are wired in below; the mouse hit-test (Phase 4) and modal stack (Phase 5) plug into
 * the marked seams.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { createLogger, setClipboard } from '@jsvision/core';
import type { Logger, Keymap, ScreenBuffer, CapabilityProfile } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';
import { createRenderRoot } from '../view/index.js';
import type { View, RenderRoot, AppEvent, DispatchEvent, Point, PopupHost } from '../view/index.js';
import type { EventLoop, EventLoopOptions, ModalHostAware } from './types.js';
import { createCommandRegistry } from './commands.js';
import type { CommandRegistry } from './commands.js';
import { route } from './dispatch.js';
import type { RouteContext } from './dispatch.js';
import { createFocusManager } from './focus.js';
import type { FocusManager } from './focus.js';
import { hitTestRoute } from './hit-test.js';
import { createModalManager } from './modal.js';
import type { ModalManager } from './modal.js';

/** A modal view that exposes a TV-style `valid(command)` close-gate (e.g. `Dialog`). */
interface QuitValidatable {
  valid(command: string): boolean;
}

/**
 * Whether a modal view vetoes a quit via its `valid()` gate (HR-38 / PA-2). Duck-typed so non-modal
 * modal roots (which have no `valid`) never veto; a `Dialog` runs its child-sweep validation.
 */
function isQuitVetoed(view: View, command: string): boolean {
  const candidate = view as Partial<QuitValidatable>;
  return typeof candidate.valid === 'function' && !candidate.valid(command);
}

/** Concrete event loop. Builds + owns the render root; drives one coalesced frame per tick. */
class EventLoopImpl implements EventLoop {
  readonly renderRoot: RenderRoot;
  private readonly logger: Logger;
  private readonly caps: CapabilityProfile;
  private readonly onIdle?: () => void;
  private readonly keymap?: Keymap;
  private readonly registry: CommandRegistry;
  private readonly focus: FocusManager;
  private readonly modal: ModalManager;

  /** The mounted root view, for focus/hit-test walks; `null` until `mount`. */
  private root: View | null = null;
  /** The tick's cascade queue: events (and the commands they raise) drained in one tick (AR-64). */
  private readonly queue: DispatchEvent[] = [];
  /** True while a tick is draining; a re-entrant `runTick` joins the active tick instead (PA-11). */
  private draining = false;
  /** The pointer-capture target: while set, all mouse/wheel events route here (RD-05 PA-5). */
  private captureTarget: View | null = null;
  /** The app-terminating command; a quit while modals are open cascades top-down (HR-38/PA-2). */
  private readonly quitCommand: string;

  /** Frame sink wired by `run()` after the host exists; `undefined` ⇒ flushes push nothing (PA-6). */
  onFrame?: (buffer: ScreenBuffer) => void;
  /** Hardware-caret sink wired by `run()` after the host exists (RD-07 PA-5). @see EventLoop.onCaret */
  onCaret?: (cell: Point | null) => void;
  /** Clipboard-write sink wired by `run()` (RD-07 PA-5/PA-7). @see EventLoop.writeClipboard */
  writeClipboard?: (seq: string) => void;
  /** Resize sink wired by the app after composition (HR-36/HR-41). @see EventLoop.onResize */
  onResize?: (size: Size2D) => void;
  /** Popup host wired by the app after the overlay exists (RD-14 PF-002). @see EventLoop.popupHost */
  popupHost?: PopupHost;

  constructor(viewport: Size2D, opts: EventLoopOptions) {
    this.logger = opts.logger ?? createLogger();
    this.caps = opts.caps;
    this.onIdle = opts.onIdle;
    this.keymap = opts.keymap;
    this.quitCommand = opts.quitCommand ?? 'quit';
    this.registry = createCommandRegistry({
      seed: opts.commands,
      enqueue: (ev) => this.queue.push(ev), // a command cascades onto the active tick (03-01)
    });
    this.focus = createFocusManager(() => this.root);
    this.modal = createModalManager(this.focus);
    // Build the render root with a DEFERRING schedule: the callback is dropped, so the root never
    // self-flushes; the loop owns frame timing and calls `renderRoot.flush()` once per tick (AR-61).
    this.renderRoot = createRenderRoot(viewport, {
      caps: opts.caps,
      theme: opts.theme,
      logger: this.logger,
      schedule: () => {
        // deferring seam — intentionally drops the flush callback (the loop drives flush itself)
      },
      // RD-13 HR-10/PA-10 — when a group removes the currently-focused child, re-home focus through
      // the loop's focus mutator (focusInto → first focusable descendant, else nothing), inside a
      // tick so the focus-flip repaint + focus-change signals stay consistent. A detached view-only
      // tree (no loop) leaves this unset and just clears its `current` pointer.
      healFocus: (group) => this.runTick(() => this.focus.focusInto(group)),
    });
  }

  mount(root: View): void {
    this.root = root;
    this.renderRoot.mount(root); // RenderRoot.mount flushes the initial frame once, internally
    this.onFrame?.(this.renderRoot.buffer()); // deliver the first frame to the host sink (PA-6)
    this.emitCaret(); // report the initial hardware-caret cell (PA-5)
  }

  dispatch(event: AppEvent): void {
    this.runTick(() => {
      this.queue.push({ event, handled: false });
    });
  }

  resize(size: Size2D): void {
    // The one path outside the queue: a reflow with no event cascade, then exactly one frame (AR-54).
    this.renderRoot.resize(size);
    this.renderRoot.flush(); // reflow first, so onResize handlers see fresh desktop/overlay bounds
    // HR-36/HR-41: only when a handler is wired, let it re-anchor viewport-sized chrome (re-zoom
    // windows, re-anchor the menu catcher) against the new geometry, then repaint the adjustment. With
    // no handler (the bare loop) this is a single flush — the base "exactly one frame" contract holds.
    if (this.onResize !== undefined) {
      this.onResize(size);
      this.renderRoot.flush();
    }
    this.onFrame?.(this.renderRoot.buffer()); // push the resized frame to the host sink (PA-6)
    this.emitCaret(); // the reflow may move the focused caret — re-report it (PA-5)
  }

  getFocused(): View | null {
    return this.focus.getFocused();
  }

  focusNext(): void {
    // Standalone traversal owns a tick so the focus-flip repaint paints exactly one frame (PA-11).
    this.runTick(() => this.focus.focusNext());
  }

  focusPrev(): void {
    this.runTick(() => this.focus.focusPrev());
  }

  focusView(view: View): void {
    this.runTick(() => this.focus.focusView(view));
  }

  emitCommand(command: string, arg?: unknown): void {
    // Route through runTick so a standalone emitCommand drains its cascade + paints once (PA-11);
    // a re-entrant emit (from inside a handler) joins the active tick.
    this.runTick(() => {
      // HR-38 (PA-2): a quit while modals are open cascades top-down through the stack instead of
      // dispatching into the top modal subtree (where the root quit sink is unreachable).
      if (command === this.quitCommand && this.modal.isActive()) {
        this.cascadeQuit(command, arg);
      } else {
        this.registry.emit(command, arg);
      }
    });
  }

  /**
   * Resolve a quit against an open modal stack (HR-38 / PA-2). Walk the stack top-down: each modal's
   * `valid(quitCommand)` gate may veto (TV `TGroup::execute`'s `while(!valid(endState))`, so `valid`
   * is consulted per-modal at `endModal` time), stopping the cascade — the app stays and the remaining
   * modals stay open. Otherwise `endModal(quitCommand)` resolves that modal's `execView` promise and
   * the walk continues. When the stack empties, the quit command reaches the root sink.
   */
  private cascadeQuit(command: string, arg: unknown): void {
    while (this.modal.isActive()) {
      const top = this.modal.topView();
      if (top !== null && isQuitVetoed(top, command)) return; // valid() veto → app stays
      this.modal.end(command); // resolve this modal's execView with the quit command
    }
    this.registry.emit(command, arg); // stack empty → the root quit sink handles it
  }

  enableCommand(command: string, on: boolean): void {
    this.registry.enable(command, on); // toggling enablement changes no visual state — no tick
  }

  isCommandEnabled(command: string): boolean {
    return this.registry.isEnabled(command);
  }

  execView<R>(view: View): Promise<R> {
    // Open inside a runTick so the modal paints exactly one coalesced frame on open (PA-11/PF-009);
    // the returned Promise resolves later, on endModal. The caller has added `view` to the tree.
    this.captureTarget = null; // a stale gesture must not capture across modality (PA-5)
    // RD-11 PA-1: if the view opts into self-closing modality, hand it the modal-host seam before
    // `modal.begin` so it can resolve this `execView` (via `endModal`) from its own event handling.
    // Duck-typed so non-modal views (everything today) are untouched — no behaviour change.
    if (isModalHostAware(view)) {
      view.attachModalHost({
        endModal: (result: unknown) => this.endModal(result),
        isCommandEnabled: (command: string) => this.registry.isEnabled(command),
      });
    }
    return new Promise<R>((resolve) => {
      this.runTick(() => this.modal.begin(view, resolve));
    });
  }

  endModal<R>(result: R): void {
    // Close inside a runTick so the restore-focus repaint paints one frame (PA-11).
    this.captureTarget = null; // release any capture as modality changes (PA-5)
    this.runTick(() => this.modal.end(result));
  }

  /**
   * Run one coalesced tick: do `work` (enqueue an event or mutate focus/command/modal state), drain
   * the cascade queue, fire `onIdle`, then flush exactly one frame. A re-entrant call (while already
   * draining) just contributes its `work` to the active tick and returns (PA-11). The `draining`
   * flag is reset in a `finally` so a throw can never wedge the loop.
   *
   * @param work A thunk that enqueues an event or performs a focus/command/modal mutation.
   */
  private runTick(work: () => void): void {
    if (this.draining) {
      work(); // join the active tick; the owner drains + flushes
      return;
    }
    this.draining = true;
    try {
      work();
      while (this.queue.length > 0) {
        const ev = this.queue.shift();
        if (ev !== undefined) this.route(ev);
      }
    } finally {
      this.draining = false;
    }
    this.onIdle?.(); // the cascade drained (AR-58)
    this.renderRoot.flush(); // exactly one coalesced frame for the tick (AR-54, AR-64)
    this.onFrame?.(this.renderRoot.buffer()); // deliver that one frame to the host sink (PA-6/PF-003)
    this.emitCaret(); // re-report the hardware-caret cell after the frame (PA-5)
  }

  /**
   * Compute the focused leaf's absolute caret cell and deliver it to the hardware-caret sink (PA-5).
   * Queried **post-flush** from the focus manager + the leaf's `desiredCaret()` + the render root's
   * persisted origin — never collected during compose — so it stays correct across partial recomposes
   * (PF-002). Delivers `null` when nothing is focused or the focused view wants no caret (blur, a
   * non-text control). A no-op when no `onCaret` sink is wired (headless).
   */
  refreshCaret(): void {
    this.emitCaret(); // public out-of-band re-emit (run() uses it to position the initial cursor)
  }

  private emitCaret(): void {
    if (this.onCaret === undefined) return;
    const leaf = this.focus.focusedLeafIn(this.scopeRoot());
    const local = leaf?.desiredCaret() ?? null;
    const origin = leaf !== null && local !== null ? this.renderRoot.originOf(leaf) : null;
    this.onCaret(origin === null || local === null ? null : { x: origin.x + local.x, y: origin.y + local.y });
  }

  setCapture(view: View): void {
    this.captureTarget = view; // last-writer-wins; routed in `routeContext` → `hitTestRoute` (PA-5)
  }

  releaseCapture(): void {
    this.captureTarget = null;
  }

  /**
   * Route one dispatch envelope through the full 3-phase machine (`dispatch.ts`): keymap consume →
   * built-in Tab → mouse/wheel hit-test → pre/focus/post sweeps with `handled` short-circuit.
   *
   * @param ev The dispatch envelope to route.
   */
  private route(ev: DispatchEvent): void {
    route(ev, this.routeContext());
  }

  /**
   * The dispatch/hit-test scope: the top modal subtree when a modal is active (capture, AR-53), else
   * the mounted root. Confining all phases to this subtree — including the Phase-2 focused-chain
   * bubble clamp (PA-12) — keeps the outer tree inert while a modal is open.
   */
  private scopeRoot(): View | null {
    return this.modal.isActive() ? this.modal.topView() : this.root;
  }

  /** Build the {@link RouteContext} of seams the 3-phase router needs from this loop. */
  private routeContext(): RouteContext {
    // PA-5: never route to a detached capture target — auto-release if it has unmounted.
    if (this.captureTarget !== null && !this.captureTarget.mounted) {
      this.captureTarget = null;
    }
    const scope = this.scopeRoot();
    return {
      scopeRoot: scope,
      keymap: this.keymap,
      focusedLeaf: this.focus.focusedLeafIn(scope),
      emitCommand: (name, arg) => this.registry.emit(name, arg),
      // RD-06 PA-1/PA-10 — sourced onto every routed envelope as `ev.emit` / `ev.focusView`.
      emit: (name, arg) => this.registry.emit(name, arg),
      focusView: (view) => this.focus.focusView(view),
      // RD-11 PA-16 — pointer capture from within a view's `onEvent` (the ScrollBar thumb-drag).
      // Pure mutations of `captureTarget` (inside the active tick), mirroring the public seams.
      setCapture: (view) => this.setCapture(view),
      releaseCapture: () => this.releaseCapture(),
      // RD-13 HR-14/PA-13 — read-only capture query. `routeContext` above already auto-released a
      // captureTarget that has unmounted, so this reflects the live capture (false after any external loss).
      hasCapture: (view) => this.captureTarget === view,
      // RD-07 PA-5/PA-7 — clipboard write from within a control's `onEvent` (Input copy/cut). The
      // loop encodes `text`→OSC-52 via core `setClipboard(text, caps)` (base64 + sanitize; '' when the
      // terminal lacks clipboard52) and hands the sequence to the run()-wired `writeClipboard` sink.
      // The control never touches I/O; headless (`writeClipboard` unset) it is a safe no-op.
      setClipboard: (text) => {
        const seq = setClipboard(text, this.caps);
        if (seq !== '') this.writeClipboard?.(seq);
      },
      // RD-14 PF-002 — the focus query + overlay host a dropdown leaf reaches through its envelope to
      // save/restore focus and mount its anchored popup. `popupHost` is `undefined` headless / no shell.
      getFocused: () => this.focus.getFocused(),
      popupHost: this.popupHost,
      deliver: (view, ev) => this.deliver(view, ev),
      // The built-in Tab handler runs inside the active dispatch tick, so it calls the focus
      // manager's pure mutation directly (no nested runTick) — the tick's flush paints (PA-11).
      focusNext: () => this.focus.focusNext(),
      focusPrev: () => this.focus.focusPrev(),
      hitTestRoute: (ev) =>
        hitTestRoute(ev, {
          scopeRoot: scope,
          captureTarget: this.captureTarget, // RD-05 PA-5: short-circuit to the capture target
          isFocusable: (view) => this.focus.isFocusable(view),
          focusView: (view) => this.focus.focusView(view), // pure mutation (inside the active tick)
          deliver: (view, mouseEv) => this.deliver(view, mouseEv),
        }),
    };
  }

  /**
   * Deliver an envelope to a view's `onEvent`, isolating a throwing handler: the error is logged via
   * the injected logger and the loop continues to the next phase/event (AR-66).
   *
   * @param view The target view.
   * @param ev   The dispatch envelope.
   */
  private deliver(view: View, ev: DispatchEvent): void {
    try {
      view.onEvent(ev);
    } catch (error) {
      this.logger.error('event', 'onEvent() threw', { error: String(error) });
    }
  }
}

/**
 * Duck-typed guard: does `view` opt into self-closing modality (RD-11 PA-1)? True iff it exposes an
 * `attachModalHost` method — so `execView` injects the modal-host seam only into views that want it.
 *
 * @param view The view being opened as a modal.
 * @returns Whether `view` implements {@link ModalHostAware}.
 */
function isModalHostAware(view: View): view is View & ModalHostAware {
  return typeof (view as Partial<ModalHostAware>).attachModalHost === 'function';
}

/**
 * Create a host-agnostic {@link EventLoop} over a `viewport`-cell render root.
 *
 * @param viewport The initial viewport size in cells.
 * @param opts     Required `caps` + optional `theme`/`logger`/`keymap`/`commands`/`onIdle` seams.
 * @returns An `EventLoop` ready to `mount` a view tree and be driven via `dispatch`.
 */
export function createEventLoop(viewport: Size2D, opts: EventLoopOptions): EventLoop {
  return new EventLoopImpl(viewport, opts);
}
