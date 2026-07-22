/**
 * The event loop implementation — see {@link createEventLoop} for the public entry point.
 *
 * The loop builds and owns its render root and controls exactly when the screen repaints. Every
 * public method that can change what is on screen runs through one internal `runTick`, so a single
 * user action produces a single coalesced frame: it does the work, drains any commands the work
 * cascaded, calls `onIdle`, then repaints once. A method called from inside an event handler (e.g.
 * `emitCommand` from within `onEvent`) joins the tick already in progress instead of starting a new
 * one, so nested actions still collapse into one frame.
 */
import { createLogger, setClipboard } from '@jsvision/core';
import type { Logger, Keymap, ScreenBuffer, CapabilityProfile, Theme } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';
import { createRenderRoot, View } from '../view/index.js';
import type { RenderRoot, AppEvent, DispatchEvent, Point, PopupHost } from '../view/index.js';
import type { EventLoop, EventLoopOptions, ModalHostAware } from './types.js';
import { buildKeymap } from './default-keymap.js';
import { createCommandRegistry } from './commands.js';
import type { CommandRegistry } from './commands.js';
import { route } from './dispatch.js';
import type { RouteContext } from './dispatch.js';
import { createFocusManager } from './focus.js';
import type { FocusManager } from './focus.js';
import { hitTestRoute } from './hit-test.js';
import { createModalManager } from './modal.js';
import type { ModalManager } from './modal.js';

/**
 * The double-click window, in milliseconds. Two mouse-downs on the same cell within this span are
 * reported as a double-click via `DispatchEvent.clickCount`.
 */
const MULTI_CLICK_MS = 500;

/** A modal view that can veto its own close via a `valid(command)` gate (e.g. `Dialog`). */
interface QuitValidatable {
  valid(command: string): boolean;
}

/**
 * Whether a modal view vetoes a quit. A view with a `valid` method (a dialog) can refuse to close on
 * quit (e.g. because a field is invalid); a modal without one never vetoes.
 */
function isQuitVetoed(view: View, command: string): boolean {
  const candidate = view as Partial<QuitValidatable>;
  return typeof candidate.valid === 'function' && !candidate.valid(command);
}

/**
 * Holds the loop's command handlers, keyed by command name. The loop delivers every command event to
 * it first (before the tree's own dispatch), so a command with handlers runs them all and is marked
 * handled — stopping there. Each handler runs in its own try/catch, so one throwing handler neither
 * skips its siblings nor leaves the command unconsumed. It extends `View` only so the loop's
 * error-isolating `deliver` can hand it an event; it is never mounted, painted, or hit-tested.
 */
class CommandSink extends View {
  // Handlers are stored arg-aware so the built-in quit registration can read the numeric exit-code
  // argument; the public `register` wraps a zero-arg handler and drops the arg, so the exposed
  // `onCommand` contract never widens.
  private readonly handlers = new Map<string, Set<(arg?: unknown) => void>>();

  constructor(private readonly logger: Logger) {
    super();
  }

  draw(): void {
    // intentionally empty — the sink is never mounted or painted
  }

  /**
   * Add a handler and return an idempotent unsubscribe. The unsubscribe prunes the command's empty
   * entry only when it still holds this exact set, so a stale unsubscribe cannot drop a command that
   * was unregistered to empty and then registered afresh.
   */
  private addHandler(command: string, handler: (arg?: unknown) => void): () => void {
    let set = this.handlers.get(command);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(command, set);
    }
    const target = set;
    target.add(handler);
    return () => {
      target.delete(handler);
      if (target.size === 0 && this.handlers.get(command) === target) this.handlers.delete(command);
    };
  }

  /** The public contract: register a zero-arg handler for a named command. */
  register(command: string, handler: () => void): () => void {
    return this.addHandler(command, () => handler());
  }

  /** Internal: register a handler that also receives the command event's argument (built-in quit only). */
  registerInternal(command: string, handler: (arg?: unknown) => void): () => void {
    return this.addHandler(command, handler);
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'command') return;
    const set = this.handlers.get(inner.command);
    if (set === undefined || set.size === 0) return;
    // Snapshot so a handler may unsubscribe itself (or a sibling) mid-fire without corrupting the walk.
    // Each handler is isolated: a throwing one is logged and the rest still fire, and the command is
    // consumed regardless — a handled command must never fall through to the focus/post-process phases.
    for (const fn of [...set]) {
      try {
        fn(inner.arg);
      } catch (error) {
        this.logger.error('command', 'onCommand handler threw', { error: String(error) });
      }
    }
    ev.handled = true;
  }
}

/** Concrete event loop: owns the render root and paints one coalesced frame per tick. */
class EventLoopImpl implements EventLoop {
  readonly renderRoot: RenderRoot;
  private readonly logger: Logger;
  private readonly caps: CapabilityProfile;
  private readonly onIdle?: () => void;
  private readonly keymap?: Keymap;
  private readonly registry: CommandRegistry;
  private readonly focus: FocusManager;
  private readonly modal: ModalManager;
  /** The loop-owned command handlers, swept directly in `route` before the tree; never mounted. */
  private readonly commandSink: CommandSink;

  /** The mounted root view; `null` until `mount` is called. */
  private root: View | null = null;
  /** Events queued during the current tick — commands a handler raises land here and drain in the same tick. */
  private readonly queue: DispatchEvent[] = [];
  /** True while a tick is draining, so a re-entrant call joins it instead of starting a new one. */
  private draining = false;
  /** The pointer-capture target: while set, all mouse/wheel events go here. */
  private captureTarget: View | null = null;
  /**
   * The app-local clipboard buffer: the last text copied or cut within the app. Filled by the
   * dual-sink `setClipboard` and read back by `readClipboard`, so in-app paste works on every terminal
   * without reading the external OS clipboard. In-memory only — never serialized to disk or network.
   */
  private clipboardText = '';
  /** The command that terminates the app; a quit while modals are open cascades top-down. */
  private readonly quitCommand: string;
  /** Whether accelerator mode is armed (hotkeys revealed, bare letters fire accelerators). */
  private acceleratorMode = false;
  /** The key that toggles accelerator mode (default `'f12'`); `null` disables the feature. */
  private readonly revealKey: string | null;

  // --- Out-of-tick painter ----------------------------------------------------------------------
  /** How a deferred out-of-tick paint is enqueued (default `queueMicrotask`). */
  private readonly scheduleMicrotask: (cb: () => void) => void;
  /** True while a deferred out-of-tick paint is queued and not yet run — coalesces a burst to one paint. */
  private flushPending = false;
  /** True after `stop()` — the out-of-tick painter is gated so no deferred paint runs post-teardown. */
  private stopped = false;

  // --- Double-click tracking --------------------------------------------------------------------
  /** Clock for timing double-clicks (`opts.now ?? Date.now`). */
  private readonly clock: () => number;
  /** Timestamp of the previous mouse-down. */
  private lastClickTime = Number.NEGATIVE_INFINITY;
  /** Cell of the previous mouse-down; a repeat here within the window counts as a multi-click. */
  private lastClickCell: Point = { x: -1, y: -1 };
  /** Consecutive same-cell click count (1 = single, 2 = double, …). */
  private clickCount = 0;

  /** Called with the composed frame after each tick; wired to the host by `run()`. See {@link EventLoop.onFrame}. */
  onFrame?: (buffer: ScreenBuffer) => void;
  /** Called with the caret cell after each frame; wired to the host by `run()`. See {@link EventLoop.onCaret}. */
  onCaret?: (cell: Point | null) => void;
  /** Called with a clipboard sequence on copy/cut; wired to the host by `run()`. See {@link EventLoop.writeClipboard}. */
  writeClipboard?: (seq: string) => void;
  /** Called on resize after reflow; wired by the app. See {@link EventLoop.onResize}. */
  onResize?: (size: Size2D) => void;
  /** Host for anchored dropdown popups; wired by the app. See {@link EventLoop.popupHost}. */
  popupHost?: PopupHost;

  constructor(viewport: Size2D, opts: EventLoopOptions) {
    this.logger = opts.logger ?? createLogger();
    this.caps = opts.caps;
    this.onIdle = opts.onIdle;
    // Merge the framework's default clipboard keymap (Ctrl+A/C/X/V + classic aliases) with any keymap
    // the caller supplied; the caller wins on a conflicting chord. `'none'` + no caller keymap yields
    // undefined, so no chord is globalized.
    this.keymap = buildKeymap(opts.clipboardKeys, opts.keymap);
    this.quitCommand = opts.quitCommand ?? 'quit';
    this.revealKey = opts.revealKey === undefined ? 'f12' : opts.revealKey; // an explicit null disables it
    this.clock = opts.now ?? Date.now;
    // Real apps take the microtask default; a test injects a capturing seam to step the deferred paint.
    this.scheduleMicrotask = opts.scheduleMicrotask ?? ((cb) => queueMicrotask(cb));
    this.registry = createCommandRegistry({
      seed: opts.commands,
      enqueue: (ev) => this.queue.push(ev), // a raised command cascades onto the active tick
    });
    this.focus = createFocusManager(() => this.root);
    this.modal = createModalManager(this.focus);
    this.commandSink = new CommandSink(this.logger);
    // The quit command terminates the loop through the one command sink: register it internally so it
    // can read the numeric exit-code argument (the public `onCommand` handler is arg-less). A bare loop
    // with no `onQuit` leaves quit as an ordinary command with no special termination.
    if (opts.onQuit !== undefined) {
      const onQuit = opts.onQuit;
      this.commandSink.registerInternal(this.quitCommand, (arg) => onQuit(typeof arg === 'number' ? arg : 0));
    }
    // Build the render root with a schedule that the loop drives. In a tick, the render root must not
    // self-repaint (the tick's trailing paint covers it); OUTSIDE a tick — a timer, a promise, a
    // direct call between ticks — the loop coalesces the dirtying into one microtask-deferred paint so
    // the frame still reaches the host without waiting for the next input event.
    this.renderRoot = createRenderRoot(viewport, {
      caps: opts.caps,
      theme: opts.theme,
      logger: this.logger,
      schedule: () => {
        // In-tick, the tick's trailing paint already covers this; after stop(), never paint. Otherwise
        // set the coalescing guard and enqueue exactly one deferred paint for the whole burst. The
        // render root's own flush callback is ignored: paint() calls renderRoot.flush() itself AND does
        // the onFrame/caret steps that flush omits, so a wrong path would never reach the terminal.
        if (this.draining || this.stopped || this.flushPending) return;
        this.flushPending = true;
        this.scheduleMicrotask(() => {
          // A synchronous paint (a tick, resize, or mount) may have run first and cleared flushPending,
          // making this deferred paint redundant — skip it. Never paint after stop().
          if (this.stopped || !this.flushPending) return;
          this.paint();
        });
      },
      // When a group removes the currently focused child, move focus into that group (to its first
      // focusable descendant, or nowhere) inside a tick, so the focus change and its repaint stay
      // consistent. A view tree used without a loop leaves this unset and just clears its pointer.
      healFocus: (group) => this.runTick(() => this.focus.focusInto(group)),
    });
  }

  mount(root: View): void {
    this.root = root;
    this.renderRoot.mount(root); // paints the initial frame internally
    this.onFrame?.(this.renderRoot.buffer()); // hand the first frame to the host
    this.emitCaret(); // position the initial caret
    // Note: unlike resize, mount does NOT clear flushPending. The initial layout fires each view's
    // onMount → bind, whose first effect run marks the tree dirty again — so the render root is left
    // with a pending flush after this synchronous paint. That queued microtask is what drains it (its
    // paint() calls renderRoot.flush()); clearing flushPending here would strand the render root's
    // scheduled flag and block every later out-of-tick repaint.
  }

  stop(): void {
    // Gate the out-of-tick painter: the seam and any queued microtask early-return on `stopped`, so a
    // late timer/promise callback during or after teardown cannot write a frame to a stopped host.
    this.stopped = true;
  }

  dispose(): void {
    // Order matters: stop the painter first so unmounting (which disposes reactive scopes and may
    // dirty the tree as effects tear down) can never schedule a frame to a host that is going away.
    this.stop();
    this.renderRoot.unmount();
  }

  onCommand(command: string, handler: () => void): () => void {
    return this.commandSink.register(command, handler);
  }

  dispatch(event: AppEvent): void {
    this.runTick(() => {
      // Compute the consecutive same-cell click count for a mouse-down and attach it to the event as
      // `clickCount`, so a view can tell a single click from a double-click. Only mouse-downs carry
      // it; every other event queues with `clickCount` undefined.
      let clickCount: number | undefined;
      if (event.type === 'mouse' && event.kind === 'down') {
        const t = this.clock();
        const sameCell = event.x === this.lastClickCell.x && event.y === this.lastClickCell.y;
        this.clickCount = sameCell && t - this.lastClickTime <= MULTI_CLICK_MS ? this.clickCount + 1 : 1;
        this.lastClickTime = t;
        this.lastClickCell = { x: event.x, y: event.y };
        clickCount = this.clickCount;
      }
      this.queue.push({ event, handled: false, clickCount });
    });
  }

  resize(size: Size2D): void {
    // Resize reflows and repaints without going through the event queue.
    this.renderRoot.resize(size);
    this.renderRoot.flush(); // reflow first, so an onResize handler sees the settled new geometry
    // If a resize handler is wired, let it re-anchor viewport-sized chrome (re-fit maximized windows,
    // re-anchor the open menu) against the new geometry, then repaint the adjustment. Without one,
    // this is a single repaint.
    if (this.onResize !== undefined) {
      this.onResize(size);
      this.renderRoot.flush();
    }
    this.onFrame?.(this.renderRoot.buffer());
    this.emitCaret(); // the reflow may have moved the focused view, so re-report the caret
    this.flushPending = false; // resize ran outside a tick; this synchronous paint covers its deferred one
  }

  getFocused(): View | null {
    return this.focus.getFocused();
  }

  focusNext(): void {
    this.runTick(() => this.focus.focusNext(this.scopeRoot()));
  }

  focusPrev(): void {
    this.runTick(() => this.focus.focusPrev(this.scopeRoot()));
  }

  focusView(view: View): void {
    this.runTick(() => this.focus.focusView(view));
  }

  focusInto(view: View): void {
    // Descend to the innermost focusable view so a focusable container (e.g. a Window) hands focus to
    // the inner view that owns the caret and highlight, rather than parking focus on the container.
    this.runTick(() => this.focus.focusInto(view));
  }

  emitCommand(command: string, arg?: unknown): void {
    this.runTick(() => {
      // A quit while modals are open cascades top-down through the stack rather than being dispatched
      // into the top modal (where the app's quit handler would be unreachable).
      if (command === this.quitCommand && this.modal.isActive()) {
        this.cascadeQuit(command, arg);
      } else {
        this.registry.emit(command, arg);
      }
    });
  }

  /**
   * Resolve a quit against an open modal stack. Walk the stack top-down: a modal may veto (e.g. a
   * dialog whose validation fails), which stops the cascade and keeps the app and the remaining
   * modals open. Otherwise each modal closes (resolving its `execView` with the quit command) and the
   * walk continues; once the stack is empty the quit reaches the app's quit handler.
   */
  private cascadeQuit(command: string, arg: unknown): void {
    while (this.modal.isActive()) {
      const top = this.modal.topView();
      if (top !== null && isQuitVetoed(top, command)) return; // a modal vetoed — the app stays open
      this.modal.end(command); // close this modal, resolving its execView with the quit command
    }
    this.registry.emit(command, arg); // stack empty — hand the quit to the app's quit handler
  }

  enableCommand(command: string, on: boolean): void {
    this.registry.enable(command, on); // enablement is not on screen, so no repaint is needed
  }

  isCommandEnabled(command: string): boolean {
    return this.registry.isEnabled(command);
  }

  commandsVersion(): number {
    return this.registry.version();
  }

  execView<R>(view: View): Promise<R> {
    // The caller has already added `view` to the tree. Open the modal inside a tick so it paints one
    // frame on open; the returned promise resolves later, when endModal is called.
    this.captureTarget = null; // drop any in-flight drag so it cannot capture across the modal boundary
    // If the view opts into closing itself (a Dialog does), hand it the modal-host handle before it
    // opens so it can resolve this execView from its own event handling. Other views are untouched.
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
    this.captureTarget = null; // release any capture as the modal boundary changes
    this.runTick(() => this.modal.end(result));
  }

  setAcceleratorMode(on: boolean): void {
    this.runTick(() => this.applyAcceleratorMode(on));
  }

  setTheme(theme: Theme): void {
    // The render root is built with a no-op schedule, so a bare renderRoot.setTheme() would only mark
    // the frame dirty. Wrapping it in a tick reuses the trailing flush() + onFrame() push, so the swap
    // repaints immediately from any call context (a command handler, an async callback, a bare call
    // between ticks). A re-entrant call from inside a handler joins the active tick — still one frame.
    this.runTick(() => this.renderRoot.setTheme(theme));
  }

  /**
   * Turn accelerator mode on or off: set the flag and reveal (or hide) the underlined hotkeys within
   * the current dispatch scope, so what is revealed matches what a bare letter would fire. A no-op
   * when the feature is disabled. Runs inside the caller's tick so the reveal repaints in one frame.
   *
   * @param on Whether accelerator mode is armed.
   */
  private applyAcceleratorMode(on: boolean): void {
    if (this.revealKey === null) return; // feature disabled — nothing to do
    this.acceleratorMode = on;
    this.renderRoot.setRevealAccelerators(on, on ? this.scopeRoot() : null);
  }

  /**
   * Run one coalesced tick: do `work`, drain any events it queued, call `onIdle`, then repaint once.
   * A call made while a tick is already draining just contributes its `work` to that tick and returns,
   * so nested actions collapse into a single frame. The draining flag is cleared in a `finally`, so a
   * thrown handler can never leave the loop stuck.
   *
   * @param work Queues an event or performs a focus/command/modal change.
   */
  private runTick(work: () => void): void {
    if (this.draining) {
      work(); // join the active tick; the outer call drains and repaints
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
    this.onIdle?.(); // everything queued this tick has drained
    this.paint(); // one coalesced frame for the whole tick
  }

  /**
   * Paint one frame: flush the render root, hand the composed buffer to the host, then report the
   * caret. The step order matters — `onFrame` may only stash the frame while `onCaret` writes it to
   * the terminal together with the caret (see `run()`), so the caret step must follow the frame step.
   * Clears `flushPending` so any still-queued deferred paint becomes a no-op. It deliberately does not
   * call `onIdle`, which signals the end of a tick's command drain, not a repaint. Shared by the tick's
   * trailing paint and the coalesced out-of-tick painter so both take the exact same path.
   */
  private paint(): void {
    this.flushPending = false;
    this.renderRoot.flush();
    this.onFrame?.(this.renderRoot.buffer());
    this.emitCaret();
  }

  /**
   * Re-send the current caret cell out of band. `run()` uses it to position the initial cursor,
   * because the first frame is painted directly rather than through a tick. A no-op when `onCaret`
   * is unset.
   */
  refreshCaret(): void {
    this.emitCaret();
  }

  private emitCaret(): void {
    if (this.onCaret === undefined) return;
    // Read the caret position after the frame, from the focused view's requested caret plus its
    // persisted screen origin — never during compose — so it stays correct even on a partial repaint
    // that skipped the focused view. `null` when nothing is focused or the view wants no caret.
    const leaf = this.focus.focusedLeafIn(this.scopeRoot());
    const local = leaf?.desiredCaret() ?? null;
    const origin = leaf !== null && local !== null ? this.renderRoot.originOf(leaf) : null;
    this.onCaret(origin === null || local === null ? null : { x: origin.x + local.x, y: origin.y + local.y });
  }

  setCapture(view: View): void {
    this.captureTarget = view; // a later setCapture replaces this one
  }

  releaseCapture(): void {
    this.captureTarget = null;
  }

  /**
   * Route one event through the dispatch machine.
   *
   * The loop-owned command sink sees command events first — before the tree's own pre-process sweep —
   * so an `onCommand` handler fires ahead of any view. It is skipped while a modal owns the dispatch
   * scope, so general handlers stay dormant during a modal (the quit cascade re-emits quit once the
   * modals close, at which point the sink catches it). A consumed command stops here.
   *
   * @param ev The event to route.
   */
  private route(ev: DispatchEvent): void {
    if (ev.event.type === 'command' && !this.modal.isActive()) {
      this.deliver(this.commandSink, ev);
      if (ev.handled) return;
    }
    route(ev, this.routeContext());
  }

  /**
   * The subtree input is confined to: the top modal's subtree while a modal is open, otherwise the
   * mounted root. Confining every phase here keeps the tree outside an open modal inert.
   */
  private scopeRoot(): View | null {
    return this.modal.isActive() ? this.modal.topView() : this.root;
  }

  /** Build the {@link RouteContext} of operations the dispatch machine needs from this loop. */
  private routeContext(): RouteContext {
    // Never route to a capture target that has been removed — drop it first.
    if (this.captureTarget !== null && !this.captureTarget.mounted) {
      this.captureTarget = null;
    }
    const scope = this.scopeRoot();
    return {
      scopeRoot: scope,
      keymap: this.keymap,
      focusedLeaf: this.focus.focusedLeafIn(scope),
      emitCommand: (name, arg) => this.registry.emit(name, arg),
      // Exposed on each event as `ev.emit` / `ev.focusView` for a view to call from its onEvent.
      emit: (name, arg) => this.registry.emit(name, arg),
      focusView: (view) => this.focus.focusView(view),
      // Pointer capture a view requests from within its own onEvent (e.g. a scrollbar thumb-drag).
      setCapture: (view) => this.setCapture(view),
      releaseCapture: () => this.releaseCapture(),
      // A view checks this to detect that its capture was lost externally (a modal opened, the target
      // unmounted). The stale-target release above means this reflects the live capture.
      hasCapture: (view) => this.captureTarget === view,
      // Clipboard write a control requests from its onEvent (Input/Editor copy/cut). A dual sink: it
      // fills the app-local buffer (which powers in-app paste, unconditional so it works even when the
      // OS write is a headless no-op) AND encodes/sanitizes the text for the terminal, handing it to
      // the host writer.
      setClipboard: (text) => {
        this.clipboardText = text; // app-local buffer — independent of terminal capability
        const seq = setClipboard(text, this.caps);
        if (seq !== '') this.writeClipboard?.(seq);
      },
      // Clipboard read a control requests from its onEvent (Input/Editor paste). Returns the app-local
      // buffer, so paste works with no external OS-clipboard read; `''` before anything is copied.
      readClipboard: () => this.clipboardText,
      // The focus query + popup host a dropdown control reaches through to save/restore focus and
      // mount its anchored popup. `popupHost` is undefined headlessly, so opening a dropdown no-ops.
      getFocused: () => this.focus.getFocused(),
      popupHost: this.popupHost,
      // The accelerator-mode intercept reads these before any view. It already runs inside the active
      // tick, so it toggles the flag directly and the tick's repaint shows the reveal change.
      revealKey: this.revealKey,
      acceleratorMode: () => this.acceleratorMode,
      toggleAcceleratorMode: () => this.applyAcceleratorMode(!this.acceleratorMode),
      deliver: (view, ev) => this.deliver(view, ev),
      // Tab traversal runs inside the active tick, so it calls the focus manager directly. The scope
      // ceiling (already computed above) confines the walk to the open modal's subtree, else the root.
      focusNext: () => this.focus.focusNext(scope),
      focusPrev: () => this.focus.focusPrev(scope),
      hitTestRoute: (ev) =>
        hitTestRoute(ev, {
          scopeRoot: scope,
          captureTarget: this.captureTarget, // when set, mouse events short-circuit to it
          isFocusable: (view) => this.focus.isFocusable(view),
          focusInto: (view) => this.focus.focusInto(view),
          deliver: (view, mouseEv) => this.deliver(view, mouseEv),
        }),
    };
  }

  /**
   * Deliver an event to a view's `onEvent`, catching a throwing handler: the error is logged and the
   * loop moves on to the next view/event instead of crashing.
   *
   * @param view The target view.
   * @param ev   The event.
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
 * Whether `view` opts into closing itself (implements {@link ModalHostAware}) — so `execView` only
 * hands the modal-host handle to views that asked for it.
 *
 * @param view The view being opened as a modal.
 * @returns Whether `view` implements {@link ModalHostAware}.
 */
function isModalHostAware(view: View): view is View & ModalHostAware {
  return typeof (view as Partial<ModalHostAware>).attachModalHost === 'function';
}

/**
 * Create an event loop over a viewport of the given size.
 *
 * The loop is host-agnostic: you drive it by feeding decoded input to {@link EventLoop.dispatch} and
 * reading `loop.renderRoot.buffer()` for the composed frame — no terminal required, which is what
 * makes it usable headlessly and in tests. To connect it to a real terminal, wire the `onFrame`/
 * `onCaret`/`writeClipboard` sinks to a host, or use `createApplication`, which does that for you.
 *
 * @param viewport The initial viewport size in cells.
 * @param opts     Required `caps`, plus optional `theme`/`logger`/`keymap`/`commands`/`onIdle` and more.
 * @returns An `EventLoop` ready to `mount` a view tree and be driven with `dispatch`.
 * @example
 * import { resolveCapabilities } from '@jsvision/core';
 * import { View, Group, createEventLoop, type DrawContext, type DispatchEvent } from '@jsvision/ui';
 *
 * // A minimal focusable widget that reacts to Enter.
 * class Button extends View {
 *   focusable = true;
 *   constructor(private label: string, private onEnter: () => void) { super(); }
 *   draw(ctx: DrawContext) {
 *     ctx.text(1, 0, `${this.state.focused ? '>' : ' '} ${this.label}`, ctx.color('button'));
 *   }
 *   override onEvent(ev: DispatchEvent) {
 *     if (ev.event.type === 'key' && ev.event.key === 'enter') { this.onEnter(); ev.handled = true; }
 *   }
 * }
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const loop = createEventLoop({ width: 40, height: 10 }, { caps });
 *
 * const root = new Group();
 * root.add(new Button('OK', () => loop.emitCommand('ok')));
 * loop.mount(root);
 *
 * // Feed input: focus the button, then press Enter to emit the 'ok' command.
 * loop.focusNext();
 * loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift: false });
 *
 * // Read the composed frame (headless — no terminal needed).
 * const rows = loop.renderRoot.buffer().rows();
 */
export function createEventLoop(viewport: Size2D, opts: EventLoopOptions): EventLoop {
  return new EventLoopImpl(viewport, opts);
}
