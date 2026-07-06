/**
 * The shared `growMode` reflow plumbing for the resizable file dialogs (`FileDialog`/`ChDirDialog`),
 * a small port of the TV `TGroup::changeBounds → child->calcBounds` walk (`tgroup.cpp` /
 * `tview.cpp:134-158`). Each dialog declares a `[view, growMode]` table at construction; on resize
 * the WM calls the dialog's `onResized()`, which reruns {@link applyGrowMode} to reposition every
 * child before the next reflow reads their `layout.rect`.
 *
 * The design-size rects (captured once, at construction) are the baseline; the delta is
 * `owner − designSize`, pinned to `≥ 0` because each dialog floors its resize at the design size
 * (TV `sizeLimits`). Pure aside from the intended `view.layout` writes. `.js` per NodeNext.
 */
import type { Rect, View } from '@jsvision/ui';
import { growRect } from './grow.js';

/** A child view + its design-size rect + its TV `growMode` (the OR of {@link GrowMode} flags). */
export interface GrowItem {
  /** The child whose `layout.rect` is repositioned on resize. */
  readonly view: View;
  /** The design-size (owner-relative) rect captured at construction. */
  readonly base: Rect;
  /** The child's `growMode` — which edges follow the owner's size change. */
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
 * Reposition every item for an `owner` grown from `(designW, designH)` to `owner.{width,height}`,
 * writing each child's new `layout.rect` (TV `calcBounds`).
 *
 * @param items   The captured grow table.
 * @param owner   The dialog's current outer rect (`padding:0`, so children are owner-relative).
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
