/**
 * The shared resize-reflow plumbing for the resizable file dialogs ({@link FileDialog} /
 * {@link ChDirDialog}). Each dialog declares a `[view, growMode]` table at construction; when the
 * window manager resizes the dialog it calls `onResized()`, which reruns {@link applyGrowMode} to
 * reposition every child before the next layout pass reads their rectangles.
 *
 * The design-size rects, captured once at construction, are the baseline; the size delta is
 * `container − design`, never negative because each dialog floors its resize at the design size. Pure
 * apart from the intended `view.layout` writes.
 */
import type { Rect, View } from '@jsvision/ui';
import { growRect } from './grow.js';

/** A child view paired with its design-size rect and the {@link GrowMode} flags that reposition it. */
export interface GrowItem {
  /** The child whose rectangle is repositioned on resize. */
  readonly view: View;
  /** The design-size rectangle (relative to the container) captured at construction. */
  readonly base: Rect;
  /** Which edges follow the container's size change (the OR of {@link GrowMode} flags). */
  readonly growMode: number;
}

/**
 * Snapshot each `[view, growMode]` pair's current `layout.rect` as its design-size baseline. Call
 * once, after all children are placed at their design rects.
 *
 * @param pairs The `[child, growMode]` table.
 * @returns The captured {@link GrowItem}s.
 */
export function captureGrowItems(pairs: ReadonlyArray<readonly [View, number]>): GrowItem[] {
  return pairs.map(([view, growMode]) => ({ view, growMode, base: { ...(view.layout.rect as Rect) } }));
}

/**
 * Reposition every item for an `owner` grown from `(designW, designH)` to its current size, writing
 * each child's new rectangle.
 *
 * @param items   The captured grow table.
 * @param owner   The dialog's current outer rect (children are positioned relative to it).
 * @param designW The design width (the resize floor / baseline).
 * @param designH The design height.
 */
export function applyGrowMode(items: readonly GrowItem[], owner: Rect, designW: number, designH: number): void {
  const dW = owner.width - designW;
  const dH = owner.height - designH;
  for (const { view, base, growMode } of items) {
    view.layout = { ...view.layout, rect: growRect(base, growMode, dW, dH, owner.width, owner.height) };
  }
}
