/**
 * The dispatch router: the machine that decides which view(s) an event reaches, in what order.
 *
 * A key, paste, or command event is offered to views in three phases with a `handled` short-circuit
 * — the first view to set `ev.handled` stops all remaining delivery:
 *
 *   1. **pre-process** sweep (root → down): views that opted into `preProcess` see the event first
 *      (menu bars, tab strips, global hotkey catchers).
 *   2. **focused chain** (focused leaf → up its ancestors): the focused view, then each ancestor
 *      group, so a leaf can handle a key and its container can handle what the leaf ignored.
 *   3. **post-process** sweep: `postProcess` views see whatever survived (status lines, the desktop's
 *      window-management commands).
 *
 * Two steps run before the phases: a keymapped chord is converted to a command (and the raw key is
 * swallowed), and an unbound `Tab`/`Shift-Tab` moves focus. Mouse and wheel events skip the phases
 * entirely and go through hit-testing instead.
 *
 * `route` is pure with respect to loop state: everything it needs — the dispatch scope, the keymap,
 * the focused leaf, command emission, focus traversal, hit-testing, error-isolated delivery — is
 * supplied through a {@link RouteContext}, which keeps the tree walks testable.
 */
import type { Keymap } from '@jsvision/core';
import { View, Group } from '../view/index.js';
import type { DispatchEvent, PopupHost } from '../view/index.js';

/** The seams `route` needs from the loop; the loop owns the mutable focus/command/modal state. */
export interface RouteContext {
  /** The subtree events are confined to: the top modal's subtree while a modal is open, else the mounted root. */
  readonly scopeRoot: View | null;
  /** Optional keymap: a matched chord becomes a command and the raw key is swallowed. */
  readonly keymap?: Keymap;
  /** The currently focused leaf within `scopeRoot`, or `null`. */
  readonly focusedLeaf: View | null;
  /** Raise a command onto the active tick, unless it is disabled. */
  emitCommand(name: string, arg?: unknown): void;
  /** Raise a command from within a view's `onEvent`. Exposed on each event as `ev.emit`; same effect as {@link emitCommand}. */
  emit(name: string, arg?: unknown): void;
  /** Focus a view from within a view's `onEvent`. Exposed on each event as `ev.focusView`. */
  focusView(view: View): void;
  /** Capture the pointer to a view from within its `onEvent`. Exposed as `ev.setCapture`. */
  setCapture(view: View): void;
  /** Release the pointer capture. Exposed as `ev.releaseCapture`. */
  releaseCapture(): void;
  /** Whether `view` currently holds the pointer capture. Exposed as `ev.hasCapture`. */
  hasCapture(view: View): boolean;
  /** Write text to the system clipboard. Exposed as `ev.setClipboard`. */
  setClipboard(text: string): void;
  /** Read the app-local clipboard buffer (the last text copied/cut in the app). Exposed as `ev.readClipboard`. */
  readClipboard(): string;
  /** The currently focused view. Exposed as `ev.getFocused`. */
  getFocused(): View | null;
  /** The host for anchored dropdown popups, or `undefined`. Exposed as `ev.popupHost`. */
  readonly popupHost?: PopupHost;
  /** Deliver an event to a view's `onEvent`, catching and logging a throwing handler. */
  deliver(view: View, ev: DispatchEvent): void;
  /** Advance focus to the next focusable view (backs the built-in `Tab`). */
  focusNext(): void;
  /** Retreat focus to the previous focusable view (backs the built-in `Shift-Tab`). */
  focusPrev(): void;
  /** Route a mouse/wheel event through hit-testing. */
  hitTestRoute(ev: DispatchEvent): void;
  // --- accelerator-mode seams (optional; when absent the accelerator feature is inert) -----------
  /** The key that toggles accelerator mode (default `'f12'`). A non-string value disables the feature. */
  readonly revealKey?: string | null;
  /** Whether accelerator mode is currently armed. */
  acceleratorMode?(): boolean;
  /** Toggle accelerator mode on/off. */
  toggleAcceleratorMode?(): void;
}

/**
 * Collect the views in `scopeRoot`'s subtree (pre-order, root→down) carrying the given sweep flag.
 *
 * @param scopeRoot The subtree root the sweep is confined to.
 * @param flag      Which sweep: `'preProcess'` or `'postProcess'`.
 * @returns The flagged views in pre-order.
 */
function collectSweep(scopeRoot: View, flag: 'preProcess' | 'postProcess'): View[] {
  const out: View[] = [];
  const visit = (view: View): void => {
    if (view[flag]) out.push(view);
    if (view instanceof Group) {
      for (const child of view.children) visit(child);
    }
  };
  visit(scopeRoot);
  return out;
}

/**
 * The path the focused phase walks: the focused leaf, then each ancestor group up to **and
 * including** `scopeRoot`, then stop. Stopping at `scopeRoot` keeps the tree outside an open modal
 * inert. With no modal, `scopeRoot` is the mounted root, so this is the full leaf→root chain.
 *
 * @param leaf      The focused leaf, or `null` if there is no focus.
 * @param scopeRoot The boundary to stop at (inclusive).
 * @returns The leaf→scopeRoot path.
 */
function focusChain(leaf: View | null, scopeRoot: View): View[] {
  if (leaf === null) return [];
  const chain: View[] = [];
  let node: View | null = leaf;
  while (node !== null) {
    chain.push(node);
    if (node === scopeRoot) break; // never bubble past the dispatch scope (keeps a modal isolating)
    node = node.parent;
  }
  return chain;
}

/**
 * Route one dispatch envelope through the 3-phase machine.
 *
 * @param ev  The envelope (a decoded input event or an internal command, + the `handled` flag).
 * @param ctx The loop-provided seams.
 */
export function route(ev: DispatchEvent, ctx: RouteContext): void {
  const scopeRoot = ctx.scopeRoot;
  if (scopeRoot === null) return; // nothing mounted

  const inner = ev.event;

  // A keymapped chord becomes a command and the raw key is swallowed — it never reaches a view.
  if (inner.type === 'key' && ctx.keymap !== undefined) {
    const name = ctx.keymap.lookup(inner);
    if (name !== undefined) {
      ctx.emitCommand(name);
      return;
    }
  }

  // An unbound Tab moves focus (Shift-Tab retreats) and is swallowed. A keymap-bound `tab` already
  // returned above, so an app that wants Tab for something else can bind it.
  if (inner.type === 'key' && inner.key === 'tab') {
    if (inner.shift) ctx.focusPrev();
    else ctx.focusNext();
    return;
  }

  // Accelerator-mode intercept: the reveal key toggles the mode; while armed, a plain letter is
  // re-dispatched as `Alt+letter` (so every existing accelerator fires), Esc dismisses, and any other
  // key or a click dismisses and passes through. It runs before the event is enriched below so it sees
  // keys ahead of every view (including pre-process menu bars / tab strips). Inert unless the loop
  // supplies the seams (a string `revealKey` enables the feature).
  if (
    typeof ctx.revealKey === 'string' &&
    ctx.acceleratorMode !== undefined &&
    ctx.toggleAcceleratorMode !== undefined
  ) {
    if (inner.type === 'key') {
      if (inner.key === ctx.revealKey) {
        ctx.toggleAcceleratorMode(); // toggle whether currently on or off
        ev.handled = true;
        return;
      }
      if (ctx.acceleratorMode()) {
        if (inner.key === 'escape') {
          ctx.toggleAcceleratorMode(); // Esc dismisses the mode
          ev.handled = true;
          return;
        }
        if (inner.key.length === 1 && !inner.alt && !inner.ctrl) {
          // A plain accelerator letter: dismiss the mode first, then re-dispatch a synthetic
          // `Alt+letter` so the normal sweep fires the matching accelerator exactly like Alt would.
          // The synthetic event carries `alt:true`, so it can never re-enter this armed branch.
          ctx.toggleAcceleratorMode();
          route({ event: { ...inner, alt: true }, handled: false }, ctx);
          ev.handled = true;
          return;
        }
        ctx.toggleAcceleratorMode(); // any other key dismisses the mode and then dispatches normally
      }
    } else if (inner.type === 'mouse' && inner.kind === 'down' && ctx.acceleratorMode()) {
      ctx.toggleAcceleratorMode(); // a click dismisses the mode; the click still routes below
    }
  }

  // Enrich the event once, here: route() is the single path every event passes through before
  // reaching a view, so this is where the `ev.emit`/`ev.focusView`/`ev.setCapture`/etc. helpers a
  // view calls from its `onEvent` get attached. A fresh object is used because the event's fields are
  // readonly; the hit-test's `{ ...ev2, local }` spread carries these helpers onto mouse events too.
  const ev2: DispatchEvent = {
    ...ev,
    emit: ctx.emit,
    focusView: ctx.focusView,
    setCapture: ctx.setCapture,
    releaseCapture: ctx.releaseCapture,
    hasCapture: ctx.hasCapture,
    setClipboard: ctx.setClipboard,
    readClipboard: ctx.readClipboard,
    getFocused: ctx.getFocused,
    popupHost: ctx.popupHost,
  };

  // Mouse and wheel events skip the focus phases and go through hit-testing.
  if (inner.type === 'mouse' || inner.type === 'wheel') {
    ctx.hitTestRoute(ev2);
    return;
  }

  // Phase 1 — pre-process sweep (root → down).
  for (const view of collectSweep(scopeRoot, 'preProcess')) {
    if (!view.mounted) continue; // an earlier handler may have removed this view mid-sweep
    ctx.deliver(view, ev2);
    if (ev2.handled) return;
  }
  // Phase 2 — focused leaf, then up its ancestor chain.
  for (const view of focusChain(ctx.focusedLeaf, scopeRoot)) {
    // Skip a view removed by an earlier delivery, and never deliver a key to a disabled view even if
    // it is still the focused leaf — disabling a view takes it out of key handling immediately.
    if (!view.mounted || view.state.disabled) continue;
    ctx.deliver(view, ev2);
    if (ev2.handled) return;
  }
  // Phase 3 — post-process sweep.
  for (const view of collectSweep(scopeRoot, 'postProcess')) {
    if (!view.mounted) continue; // the snapshot is stale if a handler removed a later view
    ctx.deliver(view, ev2);
    if (ev2.handled) return;
  }
}
