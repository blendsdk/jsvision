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
import { boundPasteText, createLogger, setClipboard } from '@jsvision/core';
import type { Logger, Keymap, ScreenBuffer, CapabilityProfile, Theme } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';
import { createRenderRoot, View } from '../view/index.js';
import type {
  RenderRoot,
  AppEvent,
  DispatchEvent,
  Point,
  PointerCaptureLease,
  PointerCaptureLossReason,
  PointerCaptureLostHandler,
  PopupHost,
} from '../view/index.js';
import type { ClipboardTextReader, ClipboardTextWriter, EventLoop, EventLoopOptions, ModalHostAware } from './types.js';
import { buildKeymap } from './default-keymap.js';
import { normalizeFunctionKey } from './function-key-fallback.js';
import type { FunctionKeyFallback } from './function-key-fallback.js';
import { createCommandRegistry } from './commands.js';
import type { CommandRegistry } from './commands.js';
import { route } from './dispatch.js';
import type { RouteContext } from './dispatch.js';
import { createFocusManager } from './focus.js';
import type { FocusManager } from './focus.js';
import { hitTestRoute, hitTestViewAt } from './hit-test.js';
import { createModalManager } from './modal.js';
import type { ModalManager } from './modal.js';

/**
 * The double-click window, in milliseconds. Two mouse-downs on the same cell within this span are
 * reported as a double-click via `DispatchEvent.clickCount`.
 */
const MULTI_CLICK_MS = 500;

/** Stable command name whose unhandled route may request native clipboard text. */
const PASTE_COMMAND = 'paste';

/** One view and the reactive owner scope created for its captured mount incarnation. */
interface CapturedPasteRouteMember {
  readonly view: View;
  readonly mountScope: View['scope'];
}

/** Destination identity retained while a serialized native clipboard read is pending. */
interface CapturedPasteRequest {
  readonly lifecycleGeneration: number;
  readonly focusGeneration: number;
  readonly modalGeneration: number;
  readonly scopeRoot: View;
  readonly focusedLeaf: View;
  readonly route: readonly CapturedPasteRouteMember[];
}

/** Mutable queued work so teardown can release adapters and view routes behind a hung active read. */
interface QueuedNativePaste {
  request: CapturedPasteRequest | null;
  reader: ClipboardTextReader | null;
}

/** Normalized host-read outcome that never carries an exception object. */
interface NativeClipboardRead {
  readonly failed: boolean;
  readonly text: string;
}

/** Mutable ownership link retained by a lease; loss clears its only reference back to the loop. */
interface PointerCaptureLeaseState {
  release: (() => void) | null;
}

/** Public lease implementation that retains only its detachable state cell after capture loss. */
class PointerCaptureLeaseImpl implements PointerCaptureLease {
  readonly #state: PointerCaptureLeaseState;

  constructor(
    readonly generation: number,
    state: PointerCaptureLeaseState,
  ) {
    this.#state = state;
  }

  active(): boolean {
    return this.#state.release !== null;
  }

  release(): void {
    this.#state.release?.();
  }
}

/** One active pointer-capture generation and its detached-on-loss cleanup callback. */
interface PointerCaptureState {
  readonly target: View;
  readonly generation: number;
  readonly onLost: PointerCaptureLostHandler | null;
  readonly leaseState: PointerCaptureLeaseState | null;
}

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

  /** Drop every application handler when the owning loop is permanently disposed. */
  clear(): void {
    this.handlers.clear();
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
  /** Active pointer-capture generation, or `null` while routing uses normal hit testing. */
  private capture: PointerCaptureState | null = null;
  /** Last allocated public generation; values are never reused while stale leases may exist. */
  private lastCaptureGeneration = 0;
  /** Nested lifecycle boundaries reject reentrant capture until their loss transition is complete. */
  private captureBoundaryDepth = 0;
  /**
   * The app-local clipboard buffer: the last text copied or cut within the app. Filled by the
   * dual-sink `setClipboard` and read back by `readClipboard`, so in-app paste works on every terminal
   * without reading the external OS clipboard. In-memory only — never serialized to disk or network.
   */
  private clipboardText = '';
  /** Optional raw host reader backing the public runtime getter/setter. */
  private clipboardTextReader?: ClipboardTextReader;
  /** FIFO of native gestures waiting behind the single active reader. */
  private readonly clipboardReadQueue: QueuedNativePaste[] = [];
  /**
   * Mutable cell for the active read. Teardown clears its request so a host promise that never
   * settles cannot keep the destination view graph reachable through its async continuation.
   */
  private activeClipboardRead: QueuedNativePaste | null = null;
  /** Whether the asynchronous FIFO worker is scheduled or awaiting its one active reader. */
  private clipboardReadWorkerRunning = false;
  /** Incremented whenever an eligible native paste is appended to the serialized queue. */
  private clipboardReadScheduleVersion = 0;
  /** Incremented before the loop becomes stopped so late continuations can prove lifecycle staleness. */
  private lifecycleGeneration = 0;
  /** The command that terminates the app; a quit while modals are open cascades top-down. */
  private readonly quitCommand: string;
  /** Whether accelerator mode is armed (hotkeys revealed, bare letters fire accelerators). */
  private acceleratorMode = false;
  /** The key that toggles accelerator mode (default `'f12'`); `null` disables the feature. */
  private readonly revealKey: string | null;
  /** Application-level policy for portable F1–F12 aliases. */
  private readonly functionKeyFallback: FunctionKeyFallback;

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
  /** Called with raw clipboard text on copy/cut. See {@link EventLoop.writeClipboardText}. */
  writeClipboardText?: ClipboardTextWriter;
  /** Reads raw clipboard text for native paste commands. See {@link EventLoop.readClipboardText}. */
  get readClipboardText(): ClipboardTextReader | undefined {
    return this.clipboardTextReader;
  }
  set readClipboardText(reader: ClipboardTextReader | undefined) {
    if (this.clipboardTextReader === reader) return;
    this.clipboardTextReader = reader;
    this.registry.touch();
  }
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
    this.functionKeyFallback = opts.functionKeyFallback ?? 'none';
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
    this.writeClipboardText = opts.writeClipboardText;
    this.clipboardTextReader = opts.readClipboardText;
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
      onViewUnmounting: (view) => this.handleViewUnmounting(view),
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
    this.stopWithReason('stopped');
  }

  dispose(): void {
    // Order matters: stop the painter first so unmounting (which disposes reactive scopes and may
    // dirty the tree as effects tear down) can never schedule a frame to a host that is going away.
    this.stopWithReason('disposed');
    // Settle and release modal frames before unmounting their views. Disposal is not a user choice,
    // so pending modal promises receive `undefined` and no saved focus is restored.
    this.modal.dispose();
    this.renderRoot.unmount();
    // A disposed host must not retain focus paths, pointer capture, or application command closures.
    // Clearing the root also makes every later dispatch inert because there is no routing scope.
    this.root = null;
    this.capture = null;
    this.commandSink.clear();
    this.writeClipboardText = undefined;
    this.readClipboardText = undefined;
  }

  onCommand(command: string, handler: () => void): () => void {
    return this.commandSink.register(command, handler);
  }

  dispatch(event: AppEvent): void {
    const routedEvent = event.type === 'key' ? normalizeFunctionKey(event, this.functionKeyFallback) : event;
    const nativePasteGesture =
      this.clipboardTextReader !== undefined &&
      ((routedEvent.type === 'command' && routedEvent.command === PASTE_COMMAND) ||
        (routedEvent.type === 'key' && this.keymap?.lookup(routedEvent) === PASTE_COMMAND));
    this.runTick(() => {
      if (routedEvent.type === 'focus' && !routedEvent.focused) {
        this.runCaptureBoundary('host-lost', () => undefined);
      }
      // Host paste is another entry into the same clipboard pipeline. Adopt it before routing so
      // every editable control inserts the event and a later Ctrl+V repeats the same host text.
      if (routedEvent.type === 'paste') this.clipboardText = routedEvent.text;
      // Compute the consecutive same-cell click count for a mouse-down and attach it to the event as
      // `clickCount`, so a view can tell a single click from a double-click. Only mouse-downs carry
      // it; every other event queues with `clickCount` undefined.
      let clickCount: number | undefined;
      if (routedEvent.type === 'mouse' && routedEvent.kind === 'down') {
        const t = this.clock();
        const sameCell = routedEvent.x === this.lastClickCell.x && routedEvent.y === this.lastClickCell.y;
        this.clickCount = sameCell && t - this.lastClickTime <= MULTI_CLICK_MS ? this.clickCount + 1 : 1;
        this.lastClickTime = t;
        this.lastClickCell = { x: routedEvent.x, y: routedEvent.y };
        clickCount = this.clickCount;
      }
      this.queue.push({
        event: routedEvent,
        handled: false,
        clickCount,
        ...(routedEvent.type === 'mouse' && this.capture !== null
          ? { pointerCaptureGeneration: this.capture.generation }
          : {}),
      });
    }, nativePasteGesture);
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

  viewAt(point: Point): View | null {
    return hitTestViewAt(this.scopeRoot(), point);
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
    this.runTick(
      () => {
        // A quit while modals are open cascades top-down through the stack rather than being dispatched
        // into the top modal (where the app's quit handler would be unreachable).
        if (command === this.quitCommand && this.modal.isActive()) {
          this.cascadeQuit(command, arg);
        } else {
          this.emitRegisteredCommand(command, arg);
        }
      },
      command === PASTE_COMMAND && this.clipboardTextReader !== undefined,
    );
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
      this.endModalFrame(command); // close this modal, resolving its execView with the quit command
    }
    this.registry.emit(command, arg); // stack empty — hand the quit to the app's quit handler
  }

  enableCommand(command: string, on: boolean): void {
    this.registry.enable(command, on); // enablement is not on screen, so no repaint is needed
  }

  isCommandEnabled(command: string): boolean {
    if (command === PASTE_COMMAND && this.clipboardTextReader !== undefined) return true;
    return this.registry.isEnabled(command);
  }

  commandsVersion(): number {
    return this.registry.version();
  }

  execView<R>(view: View): Promise<R | undefined> {
    return new Promise<R | undefined>((resolve) => {
      this.runTick(() =>
        this.runCaptureBoundary('modal', () => {
          // Capture cleanup may synchronously stop or dispose the loop. Decline the modal instead of
          // installing a frame whose host can no longer guarantee progress or presentation.
          if (this.stopped) {
            resolve(undefined);
            return;
          }
          // Hand a self-closing modal its host only after lifecycle revalidation, so a declined view
          // never receives a handle into a terminal loop.
          if (isModalHostAware(view)) {
            view.attachModalHost({
              endModal: (result: unknown) => this.endModal(result),
              isCommandEnabled: (command: string) => this.isCommandEnabled(command),
            });
          }
          this.modal.begin(view, resolve);
        }),
      );
    });
  }

  endModal<R>(result: R): void {
    this.runTick(() => this.endModalFrame(result));
  }

  /** Close one modal through the same capture boundary used by public and quit-driven closure. */
  private endModalFrame<R>(result: R): void {
    this.runCaptureBoundary('modal', () => this.modal.end(result));
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
  private runTick(work: () => void, skipPaintWhenNativeScheduled = false): void {
    if (this.draining) {
      work(); // join the active tick; the outer call drains and repaints
      return;
    }
    const nativeScheduleBefore = this.clipboardReadScheduleVersion;
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
    // Starting an asynchronous read does not alter the retained view tree. Avoid emitting an empty
    // frame for a top-level native-paste gesture; the eventual ordinary PasteEvent owns the one
    // delivery frame. A command handled by the application never increments the schedule version
    // and therefore keeps the normal command paint.
    if (!skipPaintWhenNativeScheduled || this.clipboardReadScheduleVersion === nativeScheduleBefore) {
      this.paint();
    }
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

  /** Acquire pointer capture and return a generation-bound lease for cleanup-safe gestures. */
  acquireCapture(view: View, onLost: PointerCaptureLostHandler): PointerCaptureLease {
    const generation = this.allocateCaptureGeneration();
    const leaseState: PointerCaptureLeaseState = {
      release: () => this.releaseCaptureGeneration(generation, 'released'),
    };
    const lease = new PointerCaptureLeaseImpl(generation, leaseState);
    this.transitionCapture('replaced', { target: view, generation, onLost, leaseState });
    return Object.freeze(lease);
  }

  setCapture(view: View): void {
    const generation = this.allocateCaptureGeneration();
    this.transitionCapture('replaced', { target: view, generation, onLost: null, leaseState: null });
  }

  releaseCapture(): void {
    if (this.capture !== null) this.releaseCaptureGeneration(this.capture.generation, 'released');
  }

  /** End active capture when a host reports loss outside the decoded input stream. */
  notifyCaptureLost(): void {
    this.runCaptureBoundary('host-lost', () => undefined);
  }

  /** Allocate a positive public generation without ever reusing an identity visible to a stale lease. */
  private allocateCaptureGeneration(): number {
    if (this.stopped || this.captureBoundaryDepth > 0) {
      throw new Error('pointer capture is unavailable during lifecycle teardown');
    }
    if (this.lastCaptureGeneration >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('pointer capture generation exhausted');
    }
    this.lastCaptureGeneration += 1;
    return this.lastCaptureGeneration;
  }

  /** Install the next owner before notifying the previous owner, preserving reentrant acquisition. */
  private transitionCapture(reason: PointerCaptureLossReason, next: PointerCaptureState | null): void {
    const previous = this.capture;
    this.capture = next;
    const previousLeaseState = previous?.leaseState ?? null;
    if (previousLeaseState !== null) previousLeaseState.release = null;
    this.notifyCaptureHandler(previous?.onLost ?? null, reason);
  }

  /**
   * End capture before a modal, host, or loop lifecycle transition and reject reentrant acquisition
   * until that transition has completed.
   */
  private runCaptureBoundary<T>(reason: PointerCaptureLossReason, work: () => T): T {
    const finish = this.beginCaptureBoundary(reason);
    try {
      return work();
    } finally {
      finish();
    }
  }

  /** Enter a synchronous capture-loss boundary and return its idempotent completion callback. */
  private beginCaptureBoundary(reason: PointerCaptureLossReason | null): () => void {
    this.captureBoundaryDepth += 1;
    if (reason !== null && this.capture !== null) this.transitionCapture(reason, null);
    let active = true;
    return (): void => {
      if (!active) return;
      active = false;
      this.captureBoundaryDepth -= 1;
    };
  }

  /** Stop capture and asynchronous ingress with the caller-owned terminal loss reason. */
  private stopWithReason(reason: 'stopped' | 'disposed'): void {
    if (this.stopped) return;
    this.runCaptureBoundary(reason, () => {
      this.lifecycleGeneration += 1;
      this.stopped = true;
      this.clearQueuedNativePaste();
    });
  }

  /** End only the named generation, detaching its callback before any reentrant cleanup runs. */
  private releaseCaptureGeneration(generation: number, reason: PointerCaptureLossReason): void {
    if (this.capture?.generation !== generation) return;
    this.transitionCapture(reason, null);
  }

  /** Keep capture unavailable until a tearing-down subtree has disposed its complete reactive scope. */
  private handleViewUnmounting(view: View): () => void {
    return this.beginCaptureBoundary(this.captureBelongsTo(view) ? 'unmounted' : null);
  }

  /** Whether a target is the named view or one of its descendants while ancestry is intact. */
  private captureBelongsTo(view: View): boolean {
    let cursor = this.capture?.target ?? null;
    while (cursor !== null) {
      if (cursor === view) return true;
      cursor = cursor.parent;
    }
    return false;
  }

  /** Isolate application cleanup and diagnostic failures from capture ownership transitions. */
  private notifyCaptureHandler(handler: PointerCaptureLostHandler | null, reason: PointerCaptureLossReason): void {
    if (handler === null) return;
    try {
      handler(reason);
    } catch {
      try {
        this.logger.error('event', 'pointer capture loss handler threw');
      } catch {
        // A diagnostic sink is injected application code and cannot be allowed to break capture cleanup.
      }
    }
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
    if (ev.event.type === 'command' && ev.event.command === PASTE_COMMAND && this.clipboardTextReader !== undefined) {
      this.scheduleNativePaste();
      ev.handled = true;
      return;
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
    if (this.capture !== null && !this.capture.target.mounted) {
      this.transitionCapture('unmounted', null);
    }
    const scope = this.scopeRoot();
    return {
      scopeRoot: scope,
      keymap: this.keymap,
      focusedLeaf: this.focus.focusedLeafIn(scope),
      emitCommand: (name, arg) => this.emitRegisteredCommand(name, arg),
      // Exposed on each event as `ev.emit` / `ev.focusView` for a view to call from its onEvent.
      emit: (name, arg) => this.emitRegisteredCommand(name, arg),
      focusView: (view) => this.focus.focusView(view),
      // Pointer capture a view requests from within its own onEvent (e.g. a scrollbar thumb-drag).
      acquireCapture: (view, onLost) => this.acquireCapture(view, onLost),
      setCapture: (view) => this.setCapture(view),
      releaseCapture: () => this.releaseCapture(),
      // A view checks this to detect that its capture was lost externally (a modal opened, the target
      // unmounted). The stale-target release above means this reflects the live capture.
      hasCapture: (view) => this.capture?.target === view,
      // Clipboard write a control requests from its onEvent (Input/Editor copy/cut). Commit locally
      // first, then offer raw text to a modern host adapter. Direct terminal integrations that still
      // use the legacy sink receive a capability-gated OSC 52 sequence instead.
      setClipboard: (text) => {
        this.clipboardText = text;
        if (this.writeClipboardText !== undefined) {
          this.mirrorClipboardText(text);
          return;
        }
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
          captureTarget: this.capture?.target ?? null, // when set, mouse events short-circuit to it
          isFocusable: (view) => this.focus.isFocusable(view),
          focusInto: (view) => this.focus.focusInto(view),
          deliver: (view, mouseEv) => this.deliver(view, mouseEv),
        }),
    };
  }

  /**
   * Notify the raw-text host sink without allowing host failures to affect local clipboard state.
   *
   * Clipboard payloads are deliberately absent from diagnostics. A browser permission error may
   * include host-controlled text, so logging the thrown value could disclose clipboard contents.
   */
  private mirrorClipboardText(text: string): void {
    const sink = this.writeClipboardText;
    if (sink === undefined) return;
    try {
      const pending = sink(text);
      if (pending !== undefined) {
        void pending.catch(() => {
          if (!this.stopped) this.logger.warn('clipboard', 'host clipboard write failed');
        });
      }
    } catch {
      this.logger.warn('clipboard', 'host clipboard write failed');
    }
  }

  /**
   * Enqueue a command while allowing a configured native reader to make paste available even when
   * the ordinary registry override disables local paste.
   */
  private emitRegisteredCommand(command: string, arg?: unknown): void {
    if (command !== PASTE_COMMAND || this.clipboardTextReader === undefined) {
      this.registry.emit(command, arg);
      return;
    }
    const event =
      arg === undefined ? { type: 'command' as const, command } : { type: 'command' as const, command, arg };
    this.queue.push({ event, handled: false });
  }

  /** Capture the exact currently focused route, or return `null` when paste has no eligible target. */
  private captureNativePasteRequest(): CapturedPasteRequest | null {
    if (this.stopped) return null;
    const scopeRoot = this.scopeRoot();
    const focusedLeaf = this.focus.focusedLeafIn(scopeRoot);
    if (scopeRoot === null || focusedLeaf === null || !this.focus.isFocusable(focusedLeaf)) return null;

    const route: CapturedPasteRouteMember[] = [];
    let node: View | null = focusedLeaf;
    while (node !== null) {
      if (!node.mounted || node.scope === null) return null;
      route.push({ view: node, mountScope: node.scope });
      if (node === scopeRoot) break;
      node = node.parent;
    }
    if (route[route.length - 1]?.view !== scopeRoot) return null;

    return {
      lifecycleGeneration: this.lifecycleGeneration,
      focusGeneration: this.focus.version(),
      modalGeneration: this.modal.version(),
      scopeRoot,
      focusedLeaf,
      route,
    };
  }

  /** Add one eligible gesture to the serial native-read FIFO without awaiting it. */
  private scheduleNativePaste(): void {
    const reader = this.clipboardTextReader;
    const request = this.captureNativePasteRequest();
    if (reader === undefined || request === null) return;

    this.clipboardReadQueue.push({ request, reader });
    this.clipboardReadScheduleVersion += 1;
    if (this.clipboardReadWorkerRunning) return;
    this.clipboardReadWorkerRunning = true;
    void Promise.resolve()
      .then(() => this.drainNativePasteQueue())
      .catch(() => this.reportNativePasteDeliveryFailure());
  }

  /**
   * Invoke a reader and normalize every sync/async outcome without retaining the callback or error.
   *
   * @param reader The callback captured for one eligible gesture.
   * @returns A payload-free failure marker or a successful string.
   */
  private startNativeClipboardRead(reader: ClipboardTextReader): Promise<NativeClipboardRead> {
    try {
      return Promise.resolve(reader()).then(
        (result: unknown) =>
          typeof result === 'string' ? { failed: false, text: result } : { failed: true, text: '' },
        () => ({ failed: true, text: '' }),
      );
    } catch {
      return Promise.resolve({ failed: true, text: '' });
    }
  }

  /** Drain queued gestures one at a time, recovering from every read or delivery-side exception. */
  private async drainNativePasteQueue(): Promise<void> {
    try {
      while (this.clipboardReadQueue.length > 0) {
        const job = this.clipboardReadQueue.shift();
        if (job === undefined) continue;
        let reader = job.reader;
        job.reader = null;
        if (job.request === null || reader === null || !this.isNativePasteRequestValid(job.request)) {
          job.request = null;
          continue;
        }

        this.activeClipboardRead = job;
        const read = this.startNativeClipboardRead(reader);
        reader = null;
        const outcome = await read;
        const request = job.request;
        job.request = null;
        if (this.activeClipboardRead === job) this.activeClipboardRead = null;
        if (request === null) continue;
        try {
          this.deliverNativePaste(request, outcome);
        } catch {
          this.reportNativePasteDeliveryFailure();
        }
      }
    } finally {
      if (this.activeClipboardRead !== null) {
        this.activeClipboardRead.request = null;
        this.activeClipboardRead.reader = null;
        this.activeClipboardRead = null;
      }
      this.clipboardReadWorkerRunning = false;
      if (!this.stopped && this.clipboardReadQueue.length > 0) {
        this.clipboardReadWorkerRunning = true;
        void Promise.resolve()
          .then(() => this.drainNativePasteQueue())
          .catch(() => this.reportNativePasteDeliveryFailure());
      }
    }
  }

  /** Deliver one normalized result atomically after the captured destination passes its final guard. */
  private deliverNativePaste(request: CapturedPasteRequest, outcome: NativeClipboardRead): void {
    if (!this.isNativePasteRequestValid(request)) return;
    if (outcome.failed) {
      try {
        this.logger.warn('clipboard', 'host clipboard read failed');
      } catch {
        // Logging is injected host code. Recovery must continue without exposing or rethrowing it.
      }
      // The warning callback may re-enter focus, modality, or lifecycle APIs. Revalidate before
      // reading the ordered fallback and dispatching it to the still-authoritative destination.
      if (!this.isNativePasteRequestValid(request)) return;
      this.dispatch({ type: 'paste', text: this.clipboardText, truncated: false });
      return;
    }

    const bounded = boundPasteText(outcome.text);
    this.dispatch({ type: 'paste', text: bounded.text, truncated: bounded.truncated });
  }

  /** Release every adapter and destination route, including the cell held across the active await. */
  private clearQueuedNativePaste(): void {
    if (this.activeClipboardRead !== null) {
      this.activeClipboardRead.request = null;
      this.activeClipboardRead.reader = null;
      this.activeClipboardRead = null;
    }
    for (const job of this.clipboardReadQueue) {
      job.request = null;
      job.reader = null;
    }
    this.clipboardReadQueue.length = 0;
  }

  /** Report an unexpected delivery-side failure without allowing an injected logger to reject work. */
  private reportNativePasteDeliveryFailure(): void {
    if (this.stopped) return;
    try {
      this.logger.error('clipboard', 'native paste delivery failed');
    } catch {
      // The scheduler is already normalized; a throwing diagnostic sink is deliberately ignored.
    }
  }

  /** Prove the captured lifecycle, modal scope, focus route, and every mount incarnation still match. */
  private isNativePasteRequestValid(request: CapturedPasteRequest): boolean {
    if (
      this.stopped ||
      this.lifecycleGeneration !== request.lifecycleGeneration ||
      this.focus.version() !== request.focusGeneration ||
      this.modal.version() !== request.modalGeneration ||
      this.scopeRoot() !== request.scopeRoot ||
      this.focus.focusedLeafIn(request.scopeRoot) !== request.focusedLeaf ||
      !this.focus.isFocusable(request.focusedLeaf)
    ) {
      return false;
    }

    for (let index = 0; index < request.route.length; index += 1) {
      const member = request.route[index];
      if (member === undefined || !member.view.mounted || member.view.scope !== member.mountScope) return false;
      const expectedParent = request.route[index + 1]?.view ?? null;
      if (member.view !== request.scopeRoot && member.view.parent !== expectedParent) return false;
    }
    return true;
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
