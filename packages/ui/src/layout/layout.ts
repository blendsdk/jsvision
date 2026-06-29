/**
 * The recursive two-axis layout pass (RD-02).
 *
 * Turns a {@link LayoutBox} tree + viewport into a {@link LayoutResult} of
 * parent-relative integer rectangles. Built on the node model + intrinsic
 * sizing (`measure.ts`) and the spike's `solveTrack`: each container resolves
 * its children's main-axis cell counts (`auto` pre-resolved via `naturalSize`,
 * then `solveTrack`), places them along the main axis, sizes/aligns them on the
 * cross axis, and recurses.
 *
 * Phase 1 scope: main-axis sizing + `gap` + recursion, with `justify` fixed to
 * `start` and `align` to `stretch` (the defaults). `justify`/`align`/non-zero
 * `padding` placement land in Phase 2; `col`/overflow/degenerate hardening in
 * Phase 3.
 */
import { solveTrack, type TrackItem } from './apportion.js';
import { naturalSize } from './measure.js';
import type { LayoutBox, LayoutResult, Rect, ResolvedProps, Size2D } from './types.js';
import { crossOf, mainOf, normalizeProps, sizeFromAxis, toCells } from './types.js';

/**
 * Lay out a box tree within a viewport. Pure: mutates neither `root` nor
 * anything reachable from it; returns a fresh map with one entry per box.
 *
 * @param root The root of the layout input tree.
 * @param viewport The available area; clamped to integers ≥ 0. The root is
 *   placed at origin `(0,0)` with this size (its own `size` prop is not used —
 *   the root always fills the viewport). (AR-27)
 * @returns A {@link LayoutResult} mapping every box to its parent-relative rect.
 */
export function layout(root: LayoutBox, viewport: Size2D): LayoutResult {
  const result: LayoutResult = new Map();
  const rootRect: Rect = {
    x: 0,
    y: 0,
    width: toCells(viewport.width),
    height: toCells(viewport.height),
  };
  result.set(root, rootRect);
  layoutContainer(root, rootRect, result);
  return result;
}

/**
 * Lay out one container's direct children within its assigned rect, then recurse
 * into each child. Records every child's parent-relative rect in `result`.
 */
function layoutContainer(box: LayoutBox, rect: Rect, result: LayoutResult): void {
  if (box.children.length === 0) {
    return;
  }
  const props = normalizeProps(box.props);
  const content = contentBox(rect, props);
  const direction = props.direction;
  const contentMain = mainOf(content, direction);
  const contentCross = crossOf(content, direction);

  // Children are sized/measured against the container's content box.
  const childAvailable: Size2D = { width: content.width, height: content.height };
  const mainSizes = solveMainSizes(box.children, contentMain, props, childAvailable);

  // Phase 1: justify = start (sequential run from offset 0, `gap` between children).
  let mainOffset = 0;
  for (let i = 0; i < box.children.length; i++) {
    const child = box.children[i];
    const main = mainSizes[i];
    // Phase 1: align = stretch — child fills the content cross extent at offset 0.
    const cross = contentCross;
    const crossOffset = 0;

    const childRect = assembleRect(content, mainOffset, crossOffset, main, cross, direction);
    result.set(child, childRect);
    layoutContainer(child, childRect, result);

    mainOffset += main + props.gap;
  }
}

/**
 * Inset a rect by its padding to the content box, each extent clamped to ≥ 0.
 */
function contentBox(rect: Rect, props: ResolvedProps): Rect {
  const { padding } = props;
  return {
    x: rect.x + padding.left,
    y: rect.y + padding.top,
    width: toCells(rect.width - padding.left - padding.right),
    height: toCells(rect.height - padding.top - padding.bottom),
  };
}

/**
 * Resolve each child's main-axis cell count: `fixed` → its cells, `auto` →
 * pre-resolved natural main extent, `fr` → flex share — then distribute via the
 * integer-exact `solveTrack` (PA-5).
 */
function solveMainSizes(
  children: readonly LayoutBox[],
  contentMain: number,
  props: ResolvedProps,
  available: Size2D,
): number[] {
  const direction = props.direction;
  const items: TrackItem[] = children.map((child) => {
    const { size } = normalizeProps(child.props);
    if (size.kind === 'fixed') {
      return { kind: 'fixed', size: size.cells };
    }
    if (size.kind === 'fr') {
      return { kind: 'flex', weight: size.weight };
    }
    // auto → pre-resolve to a fixed natural main extent (PA-5).
    return { kind: 'fixed', size: mainOf(naturalSize(child, available), direction) };
  });
  return solveTrack(contentMain, items, props.gap);
}

/**
 * Build a child's parent-relative rect from its main/cross offsets and sizes,
 * mapped back to `(x,y,width,height)` for the container's direction. Offsets are
 * relative to the content-box origin, so the rect already includes padding (AR-27).
 */
function assembleRect(
  content: Rect,
  mainOffset: number,
  crossOffset: number,
  mainSize: number,
  crossSize: number,
  direction: 'row' | 'col',
): Rect {
  const origin = sizeFromAxis(mainOffset, crossOffset, direction);
  const size = sizeFromAxis(mainSize, crossSize, direction);
  return {
    x: content.x + origin.width,
    y: content.y + origin.height,
    width: size.width,
    height: size.height,
  };
}
