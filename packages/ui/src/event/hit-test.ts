/**
 * Mouse hit-testing and focus-on-click: given a mouse or wheel event, find which view was under the
 * cursor and deliver the event to it.
 *
 * The event goes to the top-most (front-most) view whose visible, clipped bounds contain the point.
 * A mouse-down additionally moves focus to the nearest focusable view at the hit, and (before
 * delivery) raises the clicked window to the front. Coordinates delivered to a view are made
 * view-local via `ev.local`. This module is internal to the loop.
 */
import type { Rect } from '../layout/index.js';
import { View, Group, intersect, contains } from '../view/index.js';
import type { Point, DispatchEvent } from '../view/index.js';

/** The seams `hitTestRoute` needs from the loop. */
export interface HitContext {
  /** The subtree to hit-test within: the top modal's subtree while a modal is open, else the mounted root. */
  readonly scopeRoot: View | null;
  /**
   * The pointer-capture target: when set, every mouse/wheel event goes straight to it (with
   * view-local coordinates), bypassing hit-testing and focus-on-click. `null` ⇒ normal hit-testing.
   */
  readonly captureTarget: View | null;
  /** Whether a view is focusable — used to climb to the nearest focusable view at a click. */
  isFocusable(view: View): boolean;
  /**
   * Focus **into** a known-focusable view. A focusable container (e.g. a Window) descends to its
   * inner focused leaf; a leaf focuses itself. Descending keeps the `focused` flag on the actual
   * inner view, so clicking a window's frame does not steal the flag from the view that owns the caret.
   */
  focusInto(view: View): void;
  /** Deliver an event to a view's `onEvent`, catching and logging a throwing handler. */
  deliver(view: View, ev: DispatchEvent): void;
}

/** A resolved hit: the view plus its absolute top-left (to compute view-local coords). */
interface Hit {
  view: View;
  absX: number;
  absY: number;
}

/**
 * Walk the subtree rooted at `view` and return the deepest front-most view whose visible, clipped
 * bounds contain the point. A hidden or disabled subtree is skipped entirely. Returns `null` for no hit.
 *
 * @param view  The current view.
 * @param absX  The view's absolute x origin.
 * @param absY  The view's absolute y origin.
 * @param clip  The absolute clip rect (ancestor clip so far, intersected).
 * @param x     The 0-based target x.
 * @param y     The 0-based target y.
 */
function topMost(view: View, absX: number, absY: number, clip: Rect, x: number, y: number): Hit | null {
  if (!view.state.visible || view.state.disabled) return null; // skip a hidden/disabled subtree

  const viewRect: Rect = { x: absX, y: absY, width: view.bounds.width, height: view.bounds.height };
  const clipped = intersect(clip, viewRect);

  if (view instanceof Group) {
    // Children paint back-to-front, so walk them in reverse: the front-most sibling wins an overlap.
    for (let i = view.children.length - 1; i >= 0; i -= 1) {
      const child = view.children[i];
      if (child === undefined) continue;
      const hit = topMost(child, absX + child.bounds.x, absY + child.bounds.y, clipped, x, y);
      if (hit !== null) return hit;
    }
  }

  const point: Point = { x, y };
  if (contains(clipped, point)) return { view, absX, absY };
  return null;
}

/**
 * The view's absolute top-left origin, summed from its parent-relative position up through every
 * ancestor to the root. Used to translate a captured pointer into the capture target's local coords.
 */
function absoluteOrigin(view: View): Point {
  let x = 0;
  let y = 0;
  let node: View | null = view;
  while (node !== null) {
    x += node.bounds.x;
    y += node.bounds.y;
    node = node.parent;
  }
  return { x, y };
}

/**
 * Climb from the hit view to the nearest focusable view and focus into it; if there is none, leave
 * focus as it was. Focusing *into* (not merely *onto*) matters when the nearest focusable is a
 * container: clicking a window's frame must land focus on the window's inner view (the one that owns
 * the caret), not on the window group itself.
 *
 * A view with `grabsFocus === false` (e.g. a dialog Cancel button) short-circuits the climb without
 * moving focus, so clicking it never blurs the currently-focused view — no focus-leave side effect
 * (such as a field's blur-validation) fires. It stays reachable by `Tab`/`Space` via the normal path.
 */
function focusOnClick(hit: View, ctx: HitContext): void {
  let node: View | null = hit;
  while (node !== null) {
    if (node.grabsFocus === false) return; // acts on the click but keeps focus where it was
    if (ctx.isFocusable(node)) {
      ctx.focusInto(node);
      return;
    }
    node = node.parent;
  }
}

/**
 * On a mouse-down, raise the clicked window. Climb from the hit view to the first ancestor that
 * defines `selectByClick` (a `Window` marks itself select-on-click) and invoke it, then stop. This
 * runs before the click is delivered, so the window raises even if the interior view consumes the
 * click. The climb stops at `scopeRoot` so a click can never raise a window sitting behind an open
 * modal.
 */
function selectOnClick(hit: View, scopeRoot: View | null): void {
  let node: View | null = hit;
  while (node !== null) {
    if (node.selectByClick !== undefined) {
      node.selectByClick();
      return;
    }
    if (node === scopeRoot) return; // never climb past the dispatch scope (keeps a modal isolating)
    node = node.parent;
  }
}

/**
 * Route a mouse or wheel event: convert the 1-based terminal coordinates to 0-based, find the
 * top-most view under the point within the scope, move focus on a mouse-down, and deliver with
 * view-local `ev.local`. A point over empty space (or outside an open modal) is ignored. Never throws.
 *
 * @param ev  The mouse/wheel event.
 * @param ctx The loop-provided seams.
 */
export function hitTestRoute(ev: DispatchEvent, ctx: HitContext): void {
  const inner = ev.event;
  if (inner.type !== 'mouse' && inner.type !== 'wheel') return;

  const x = inner.x - 1; // terminal coordinates are 1-based; the view tree is 0-based
  const y = inner.y - 1;

  // While a target is captured, every mouse/wheel event goes to it with view-local coordinates,
  // bypassing hit-testing and focus-on-click — so a drag or resize keeps tracking the cursor even
  // after it leaves the affordance or moves over another view.
  if (ctx.captureTarget !== null) {
    const origin = absoluteOrigin(ctx.captureTarget);
    const local: Point = { x: x - origin.x, y: y - origin.y };
    ctx.deliver(ctx.captureTarget, { ...ev, local });
    return;
  }

  const scopeRoot = ctx.scopeRoot;
  if (scopeRoot === null) return;
  // The scope root's bounds are relative to its parent, so hit-testing must start from its absolute
  // origin — otherwise a scope root sitting below a menu bar shifts every click by that offset and
  // mis-delivers clicks near its edges.
  const origin = absoluteOrigin(scopeRoot);
  const rootRect: Rect = {
    x: origin.x,
    y: origin.y,
    width: scopeRoot.bounds.width,
    height: scopeRoot.bounds.height,
  };
  const hit = topMost(scopeRoot, origin.x, origin.y, rootRect, x, y);
  if (hit === null) return; // clicked empty space (or outside an open modal) — ignore

  // A mouse-down is handled in three steps: raise the owning window (so it comes to the front even if
  // an interior view consumes the click), move focus to the nearest focusable view at the hit, then
  // bubble the click from the hit view up its ancestors until one consumes it. This lets a leaf handle
  // a click while its container handles clicks the leaf ignores. Both the raise climb and the bubble
  // stop at the dispatch scope, so a click can never leak out of an open modal. Other mouse kinds and
  // wheel events are delivered to the hit view only, without bubbling.
  if (inner.type === 'mouse' && inner.kind === 'down') {
    selectOnClick(hit.view, scopeRoot);
    focusOnClick(hit.view, ctx);
    let node: View | null = hit.view;
    let ox = hit.absX; // absolute origin of `node`; subtract each view's offset as we climb to its parent
    let oy = hit.absY;
    while (node !== null) {
      const envelope: DispatchEvent = { ...ev, local: { x: x - ox, y: y - oy } };
      ctx.deliver(node, envelope);
      if (envelope.handled) {
        ev.handled = true; // report the click as consumed on the original event
        break;
      }
      if (node === scopeRoot) break; // never bubble past the dispatch scope
      ox -= node.bounds.x;
      oy -= node.bounds.y;
      node = node.parent;
    }
    return;
  }

  // A non-down mouse event or a wheel event goes to the top-most hit view only.
  const local: Point = { x: x - hit.absX, y: y - hit.absY };
  ctx.deliver(hit.view, { ...ev, local });
}
