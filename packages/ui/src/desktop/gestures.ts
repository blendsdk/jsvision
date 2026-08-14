/**
 * The math behind dragging and resizing windows.
 *
 * While the desktop is tracking a drag, it feeds each pointer position to {@link applyMove} or the
 * resize helpers, which update the target window's `layout.rect` (clamped to keep it usable) so the
 * window moves on the next repaint. A window's position and size live in its `layout.rect`.
 */
import type { Rect } from '../layout/index.js';
import type { Point } from '../view/index.js';
import type { Window } from '../window/index.js';
import { clamp } from '../shared/clamp.js';

/** The smallest width and height a window can be dragged down to. */
export const MIN_WIDTH = 10;
export const MIN_HEIGHT = 3;

/** An in-progress drag: moving a window, resizing its bottom-right corner, or resizing its bottom-left. */
export type Gesture =
  | { kind: 'move'; target: Window; grabDX: number; grabDY: number } // offset of the grab point within the window
  | {
      kind: 'resize';
      target: Window;
      originX: number;
      originY: number;
      mode: 'live' | 'outline';
      committed: Rect;
      candidate: Rect;
    }
  | {
      kind: 'resize-left';
      target: Window;
      anchorRight: number;
      originY: number;
      mode: 'live' | 'outline';
      committed: Rect;
      candidate: Rect;
    };

/**
 * The window's current rect, or a minimum-size fallback if it has none yet.
 *
 * Read-only: this hands back the live `layout.rect`, and a mutable alias would let a caller move the
 * window a field at a time without ever requesting a reflow.
 */
function rectOf(w: Window): Readonly<Rect> {
  return w.layout.rect ?? { x: 0, y: 0, width: MIN_WIDTH, height: MIN_HEIGHT };
}

/**
 * Move the window to follow the pointer (minus the grab offset), clamped so its title row stays on
 * the desktop and at least one frame column stays inside — so a window can never be dragged fully
 * off-screen and lost.
 *
 * @param g       The active move gesture.
 * @param local   The desktop-local pointer position.
 * @param deskW   Desktop width in cells.
 * @param deskH   Desktop height in cells.
 */
export function applyMove(g: Extract<Gesture, { kind: 'move' }>, local: Point, deskW: number, deskH: number): void {
  const rect = rectOf(g.target);
  const x = clamp(local.x - g.grabDX, 1 - rect.width, deskW - 1);
  const y = clamp(local.y - g.grabDY, 0, deskH - 1);
  g.target.setLayout({ rect: { x, y, width: rect.width, height: rect.height } });
}

/**
 * Resize the window's bottom-right corner: keep the top-left fixed and set the size so the corner
 * follows the pointer, floored at the window's minimum. Contents reflow live into the new interior.
 *
 * @param g     The active resize gesture.
 * @param local The desktop-local pointer position.
 */
export function applyResize(g: Extract<Gesture, { kind: 'resize' }>, local: Point): void {
  commitResize(g.target, resizeCandidate(g, local));
}

/** Calculate a bottom-right resize candidate without mutating or reflowing the Window. */
export function resizeCandidate(g: Extract<Gesture, { kind: 'resize' }>, local: Point): Rect {
  const rect = rectOf(g.target);
  const width = Math.max(g.target.minWidth, local.x - g.originX + 1);
  const height = Math.max(g.target.minHeight, local.y - g.originY + 1);
  return { x: rect.x, y: rect.y, width, height };
}

/** Apply one committed resize and notify subclasses after the new rectangle is authoritative. */
export function commitResize(target: Window, rect: Rect): void {
  target.setLayout({ rect });
  target.onResized(); // re-pin the window's children to the new size before the repaint reads them
  // Kept rather than folded into the `setLayout` above, and not a no-op in every host: a reflow
  // request is a coalesced flag, so under the default deferred scheduler the pass runs after this
  // whole function and already sees the re-pinned children. Under a synchronous scheduler it does
  // not -- `setLayout`'s request flushes inline, before the re-pin -- and this is what schedules the
  // pass that sees it.
  target.invalidateLayout();
}

/**
 * Resize the window's bottom-left corner: keep the right edge and top fixed while the left edge
 * follows the pointer and the bottom edge grows like {@link applyResize}. The left edge is clamped
 * only by the minimum width; like the bottom-right resize the dragged edge may otherwise run past the
 * desktop edge.
 *
 * @param g     The active left-resize gesture.
 * @param local The desktop-local pointer position.
 */
export function applyResizeLeft(g: Extract<Gesture, { kind: 'resize-left' }>, local: Point): void {
  commitResize(g.target, resizeLeftCandidate(g, local));
}

/** Calculate a bottom-left resize candidate without mutating or reflowing the Window. */
export function resizeLeftCandidate(g: Extract<Gesture, { kind: 'resize-left' }>, local: Point): Rect {
  const x = Math.min(local.x, g.anchorRight - g.target.minWidth + 1);
  const width = g.anchorRight - x + 1;
  const height = Math.max(g.target.minHeight, local.y - g.originY + 1);
  return { x, y: g.originY, width, height };
}
