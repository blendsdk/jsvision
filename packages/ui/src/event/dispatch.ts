/**
 * 3-phase dispatch router (RD-04, AR-51). Turbo Vision's faithful pre/focus/post routing with a
 * `handled` short-circuit, plus the key→command consume step (PA-1), the built-in Tab/Shift-Tab
 * focus traversal (PA-10), and the mouse/wheel hit-test branch.
 *
 * `route` is decoupled from the loop via a {@link RouteContext} of seams the loop provides: the
 * scope root (the top modal subtree, or the mounted root when no modal — 03-04), the keymap, the
 * focused leaf, command emission, the error-isolating `deliver`, focus traversal (Phase 3), and the
 * hit-test branch (Phase 4). This keeps the tree walks pure and testable while the loop owns the
 * mutable focus/command/modal state.
 *
 * Order (a key/paste/command event; mouse/wheel branch off early):
 *   key→command consume → built-in Tab → [mouse/wheel → hit-test] → pre (root→down) → focused chain
 *   (leaf→scopeRoot, clamped) → post. The first handler to set `ev.handled` halts everything after.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Keymap } from '@jsvision/core';
import { View, Group } from '../view/index.js';
import type { DispatchEvent, PopupHost } from '../view/index.js';

/** The seams `route` needs from the loop; the loop owns the mutable focus/command/modal state. */
export interface RouteContext {
  /** The dispatch scope: the top modal subtree, or the mounted root when no modal (03-04). */
  readonly scopeRoot: View | null;
  /** Optional keymap: a bound chord converts to a command and consumes the raw key (PA-1). */
  readonly keymap?: Keymap;
  /** The focused leaf at the end of the current-chain within `scopeRoot`, or `null` (AR-48). */
  readonly focusedLeaf: View | null;
  /** Raise a command and enqueue it onto the active tick, unless disabled (AR-52, PA-3). */
  emitCommand(name: string, arg?: unknown): void;
  /**
   * Raise a command from within a control's `onEvent` (RD-06 PA-1). Sourced onto every routed
   * envelope as `ev.emit`; identical effect to {@link emitCommand} (enqueue onto the active tick).
   */
  emit(name: string, arg?: unknown): void;
  /** Focus a view from within a control's `onEvent` (RD-06 PA-10). Sourced onto `ev.focusView`. */
  focusView(view: View): void;
  /** Capture the pointer to a view from within its `onEvent` (RD-11 PA-16). Sourced onto `ev.setCapture`. */
  setCapture(view: View): void;
  /** Release the pointer capture (RD-11 PA-16). Sourced onto `ev.releaseCapture`. */
  releaseCapture(): void;
  /** Whether `view` holds the pointer capture (RD-13 HR-14/PA-13). Sourced onto `ev.hasCapture`. */
  hasCapture(view: View): boolean;
  /** Write `text` to the system clipboard (RD-07 PA-5/PA-7). Sourced onto `ev.setClipboard`. */
  setClipboard(text: string): void;
  /** The currently-focused view (RD-14 PF-002). Sourced onto `ev.getFocused`. */
  getFocused(): View | null;
  /** The overlay host for anchored popups (RD-14 PF-002/PA-9), or `undefined`. Sourced onto `ev.popupHost`. */
  readonly popupHost?: PopupHost;
  /** Deliver an envelope to a view's `onEvent`, isolating a throwing handler (AR-66). */
  deliver(view: View, ev: DispatchEvent): void;
  /** Built-in Tab focus traversal — advance focus (PA-10; wired by Phase 3). */
  focusNext(): void;
  /** Built-in Shift-Tab focus traversal — retreat focus (PA-10; wired by Phase 3). */
  focusPrev(): void;
  /** Mouse/wheel hit-test routing (wired by Phase 4). */
  hitTestRoute(ev: DispatchEvent): void;
  // --- accelerator-overlay seams (optional; absent ⇒ the intercept is fully inert) ----------------
  /**
   * The accelerator-mode trigger key (accelerator-overlay AR-10), default `'f12'`. A non-`string`
   * value (`null`/`undefined`) disables the whole feature — no toggle, no armed intercept.
   */
  readonly revealKey?: string | null;
  /** Whether accelerator mode is currently armed (accelerator-overlay FR-2/AR-1). */
  acceleratorMode?(): boolean;
  /** Toggle accelerator mode on/off (accelerator-overlay AR-1); called for the trigger key + dismiss. */
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
 * The focus-chain path the focused phase walks: the focused leaf, then its ancestor groups up to
 * **and including** `scopeRoot`, then stop (the clamp — PA-12/PF-002 — keeps a modal's outer tree
 * inert). With no modal, `scopeRoot` is the mounted root, so this is the full leaf→root chain.
 *
 * @param leaf      The focused leaf, or `null` if there is no focus.
 * @param scopeRoot The clamp boundary (inclusive).
 * @returns The leaf→scopeRoot path.
 */
function focusChain(leaf: View | null, scopeRoot: View): View[] {
  if (leaf === null) return [];
  const chain: View[] = [];
  let node: View | null = leaf;
  while (node !== null) {
    chain.push(node);
    if (node === scopeRoot) break; // clamp at the scope root (PA-12)
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

  // Key→command consume: a bound chord converts to a command; the raw key is NOT dispatched (PA-1).
  if (inner.type === 'key' && ctx.keymap !== undefined) {
    const name = ctx.keymap.lookup(inner);
    if (name !== undefined) {
      ctx.emitCommand(name);
      return;
    }
  }

  // Built-in Tab/Shift-Tab focus traversal for an unbound tab key — consumed, not 3-phase-dispatched
  // (PA-10). A keymap-bound `tab` already returned above, so an app can repurpose it.
  if (inner.type === 'key' && inner.key === 'tab') {
    if (inner.shift) ctx.focusPrev();
    else ctx.focusNext();
    return;
  }

  // Accelerator-overlay intercept (accelerator-overlay AR-16): the trigger key toggles reveal+arm;
  // while armed, a plain letter is re-dispatched as `Alt+letter` (so every existing accelerator fires),
  // Esc dismisses, and any other key or a click dismisses + passes through. It sits BEFORE the `ev2`
  // enrichment so it sees the key ahead of every view (incl. preProcess MenuBar/TabView). Fully inert
  // unless the loop supplies the seams (`revealKey` a string ⇒ feature enabled).
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
          ctx.toggleAcceleratorMode(); // Esc dismisses, consumed (AR-3)
          ev.handled = true;
          return;
        }
        if (inner.key.length === 1 && !inner.alt && !inner.ctrl) {
          // A plain accelerator letter: dismiss FIRST (sticky ends on an action), then re-dispatch a
          // synthesized `Alt+letter` so the normal 3-phase sweep fires the match exactly like Alt.
          // The synth event carries `alt:true`, so it can never re-enter this armed branch (IT-1).
          ctx.toggleAcceleratorMode();
          route({ event: { ...inner, alt: true }, handled: false }, ctx);
          ev.handled = true;
          return;
        }
        ctx.toggleAcceleratorMode(); // any other key dismisses (AR-3) and falls through to dispatch
      }
    } else if (inner.type === 'mouse' && inner.kind === 'down' && ctx.acceleratorMode()) {
      ctx.toggleAcceleratorMode(); // a click dismisses (AR-3); the click still routes below
    }
  }

  // Single enrichment point (RD-06 PA-1/PA-10, RD-11 PA-16): `route()` is the one path every
  // dispatched event passes through before reaching a view, so source `emit`/`focusView`/`setCapture`/
  // `releaseCapture` onto ONE fresh envelope here and route the mouse branch + every sweep through it.
  // A fresh object respects the `readonly` envelope fields; the `hit-test.ts` `{ ...ev2, local }`
  // spread propagates all of them to mouse-locals.
  const ev2: DispatchEvent = {
    ...ev,
    emit: ctx.emit,
    focusView: ctx.focusView,
    setCapture: ctx.setCapture,
    releaseCapture: ctx.releaseCapture,
    hasCapture: ctx.hasCapture,
    setClipboard: ctx.setClipboard,
    getFocused: ctx.getFocused,
    popupHost: ctx.popupHost,
  };

  // Mouse/wheel skip the 3-phase focus path → hit-test (03-03).
  if (inner.type === 'mouse' || inner.type === 'wheel') {
    ctx.hitTestRoute(ev2);
    return;
  }

  // Phase 1 — pre-process sweep (root→down within scopeRoot).
  for (const view of collectSweep(scopeRoot, 'preProcess')) {
    if (!view.mounted) continue; // HR-42: a prior handler may have removed this view mid-sweep
    ctx.deliver(view, ev2);
    if (ev2.handled) return;
  }
  // Phase 2 — focused leaf + chain bubble (leaf→scopeRoot, clamped).
  for (const view of focusChain(ctx.focusedLeaf, scopeRoot)) {
    // HR-42: skip a view unmounted by an earlier delivery. HR-39: a key never reaches a disabled
    // view — even if it is still the `current` leaf, disabling it evicts it from key delivery.
    if (!view.mounted || view.state.disabled) continue;
    ctx.deliver(view, ev2);
    if (ev2.handled) return;
  }
  // Phase 3 — post-process sweep.
  for (const view of collectSweep(scopeRoot, 'postProcess')) {
    if (!view.mounted) continue; // HR-42: snapshot is stale if a handler removed a later view
    ctx.deliver(view, ev2);
    if (ev2.handled) return;
  }
}
