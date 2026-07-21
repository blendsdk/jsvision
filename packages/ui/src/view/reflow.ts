/**
 * The reflow pass — the bridge between the widget tree and the layout engine. Each pass builds a
 * fresh layout-box tree from the currently-visible views, runs the layout engine over the viewport,
 * and writes each computed parent-relative rect back onto the corresponding `view.bounds`. A view
 * with `visible: false` (and its whole subtree) is left out, so its siblings reflow to fill the
 * freed space — the equivalent of CSS `display: none`.
 *
 * The pass is pure with respect to the view tree apart from the intended `bounds` writes, and it
 * fires any pending `onMount` callbacks once the views finally have bounds.
 */
import { layout } from '../layout/index.js';
import type { LayoutBox, Size2D } from '../layout/index.js';
import { View } from './view.js';
import { Group } from './group.js';
import { checkLayoutFootguns } from './layout-warnings.js';

/**
 * Reflow the view tree into the viewport: compute every visible view's parent-relative `bounds`,
 * then fire pending `onMount` callbacks for the views that just received bounds.
 *
 * @param root     The root view of the tree to lay out.
 * @param viewport The available size in cells.
 */
export function reflow(root: View, viewport: Size2D): void {
  const boxToView = new Map<LayoutBox, View>();
  const rootBox = buildBox(root, boxToView);
  if (rootBox === null) return; // root itself is hidden — nothing to lay out

  const rects = layout(rootBox, viewport);
  for (const [box, rect] of rects) {
    const view = boxToView.get(box);
    if (view === undefined) continue;
    view.bounds = rect;
    // Piggy-backed on the write-back walk so the dev diagnostics cost no extra traversal.
    checkLayoutFootguns(view, rect);
  }

  applyCentering(root);
  firePendingMounts(root);
}

/**
 * Recentre every visible `centered` view within its parent, in the same pass as layout, so the first
 * frame is already centered with no one-frame jump. It sets `origin = (parentSize - viewSize) / 2`
 * on both axes. It runs after all `bounds` are written (so each parent's laid-out size is known) and
 * moves only the origin, never the size, so a centered view nested inside a centered parent stays
 * consistent. Integer-truncated for the normal case where the view is smaller than its parent.
 *
 * @param view The subtree root to walk.
 */
function applyCentering(view: View): void {
  if (!view.state.visible) return;
  if (view.centered && view.parent !== null) {
    const { width: pw, height: ph } = view.parent.bounds;
    view.bounds = {
      ...view.bounds,
      x: Math.trunc((pw - view.bounds.width) / 2),
      y: Math.trunc((ph - view.bounds.height) / 2),
    };
  }
  if (view instanceof Group) {
    for (const child of view.children) applyCentering(child);
  }
}

/**
 * Build a `LayoutBox` for a view (depth-first), recording the box→view mapping. Returns `null` for a
 * `visible: false` view so it (and its subtree) is omitted from the layout tree entirely.
 */
function buildBox(view: View, map: Map<LayoutBox, View>): LayoutBox | null {
  if (!view.state.visible) return null;

  const children: LayoutBox[] = [];
  if (view instanceof Group) {
    for (const child of view.children) {
      const childBox = buildBox(child, map);
      if (childBox !== null) children.push(childBox);
    }
  }

  const box: LayoutBox = {
    props: view.layout,
    children,
    measure: view.measure !== undefined ? view.measure.bind(view) : undefined,
  };
  map.set(box, view);
  return box;
}

/** Fire `onMount` once for every mounted, visible view now that the reflow has given it bounds. */
function firePendingMounts(view: View): void {
  if (!view.state.visible) return;
  if (view.mounted) view.runPendingMounts();
  if (view instanceof Group) {
    for (const child of view.children) firePendingMounts(child);
  }
}
