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

/** The smallest width and height a window can be dragged down to. */
export const MIN_WIDTH = 10;
export const MIN_HEIGHT = 3;

/** An in-progress drag: moving a window, resizing its bottom-right corner, or resizing its bottom-left. */
export type Gesture =
  | { kind: 'move'; target: Window; grabDX: number; grabDY: number } // offset of the grab point within the window
  | { kind: 'resize'; target: Window; originX: number; originY: number } // bottom-right — top-left stays fixed
  | { kind: 'resize-left'; target: Window; anchorRight: number; originY: number }; // bottom-left — right edge + top stay fixed

/** Clamp `n` into `[lo, hi]` (`lo` wins if the range is empty). */
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** The window's current rect, or a minimum-size fallback if it has none yet. */
function rectOf(w: Window): Rect {
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
  g.target.layout.rect = { x, y, width: rect.width, height: rect.height };
  g.target.invalidateLayout();
}

/**
 * Resize the window's bottom-right corner: keep the top-left fixed and set the size so the corner
 * follows the pointer, floored at the window's minimum. Contents reflow live into the new interior.
 *
 * @param g     The active resize gesture.
 * @param local The desktop-local pointer position.
 */
export function applyResize(g: Extract<Gesture, { kind: 'resize' }>, local: Point): void {
  const rect = rectOf(g.target);
  const width = Math.max(g.target.minWidth, local.x - g.originX + 1);
  const height = Math.max(g.target.minHeight, local.y - g.originY + 1);
  g.target.layout.rect = { x: rect.x, y: rect.y, width, height };
  g.target.onResized(); // re-pin the window's children to the new size before the repaint reads them
  g.target.invalidateLayout();
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
  const x = Math.min(local.x, g.anchorRight - g.target.minWidth + 1);
  const width = g.anchorRight - x + 1;
  const height = Math.max(g.target.minHeight, local.y - g.originY + 1);
  g.target.layout.rect = { x, y: g.originY, width, height };
  g.target.onResized(); // re-pin the window's children to the new size before the repaint reads them
  g.target.invalidateLayout();
}
