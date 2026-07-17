/**
 * The recursive two-axis layout pass.
 *
 * Turns a {@link LayoutBox} tree + viewport into a {@link LayoutResult} of
 * parent-relative integer rectangles. Each container resolves its children's
 * main-axis cell counts (`auto` children sized to their content first, then the
 * flexible track solved), places them along the main axis, sizes and aligns them
 * on the cross axis, and recurses.
 *
 * Covers main-axis sizing + `gap` + `padding` content-box inset, `justify`
 * main-axis placement, cross-axis sizing + `align`, `row`/`col` via a shared axis
 * abstraction, overflow (fixed/auto extend past the edge, `fr` → 0), degenerate
 * viewports (zero-size rects, no throw), and recursion.
 *
 * Each container lays out its children in its **own local coordinate frame**
 * (box origin `(0,0)`), so every child rect is **parent-relative** — relative to
 * its parent's content-box origin, padding included. A renderer reconstructs
 * absolute screen coordinates by summing ancestor origins down the tree.
 */
import { apportion, solveTrack, type TrackItem } from './apportion.js';
import { naturalSize } from './measure.js';
import type { Align, Direction, Justify, LayoutBox, LayoutResult, Rect, ResolvedProps, Size2D } from './types.js';
import { crossOf, mainOf, normalizeProps, sizeFromAxis, toCells } from './types.js';

/**
 * Lay out a box tree within a viewport. Pure: mutates neither `root` nor
 * anything reachable from it; returns a fresh map with one entry per box.
 *
 * The result maps each box to a **parent-relative** rect (relative to its
 * parent's content-box origin). To get absolute screen coordinates, sum the
 * origins of a box's ancestors as you walk down the tree.
 *
 * @param root The root of the layout input tree.
 * @param viewport The available area; clamped to integers ≥ 0. The root is
 *   placed at origin `(0,0)` with this size (its own `size` prop is not used —
 *   the root always fills the viewport).
 * @returns A {@link LayoutResult} mapping every box to its parent-relative rect.
 * @example
 * import { layout, type LayoutBox } from '@jsvision/ui';
 *
 * // A classic sidebar + main split across an 80×24 terminal, 1 cell of gap.
 * const sidebar: LayoutBox = { props: { size: { kind: 'fixed', cells: 20 } }, children: [] };
 * const main: LayoutBox = { props: { size: { kind: 'fr', weight: 1 } }, children: [] };
 * const root: LayoutBox = { props: { direction: 'row', gap: 1 }, children: [sidebar, main] };
 *
 * const rects = layout(root, { width: 80, height: 24 });
 * rects.get(sidebar); // → { x: 0,  y: 0, width: 20, height: 24 }
 * rects.get(main);    // → { x: 21, y: 0, width: 59, height: 24 }  (fills the rest exactly)
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
  layoutContainer(root, { width: rootRect.width, height: rootRect.height }, result);
  return result;
}

/**
 * Lay out one container's direct children within its own local frame (box origin
 * `(0,0)` and the given size), then recurse into each child. Records every
 * child's parent-relative rect in `result`.
 *
 * @param box The container being laid out.
 * @param size The container's own width/height (its rect's extent); its position
 *   within its parent is not needed here — children are placed relative to this
 *   box's origin, keeping every rect parent-relative.
 */
function layoutContainer(box: LayoutBox, size: Size2D, result: LayoutResult): void {
  if (box.children.length === 0) {
    return;
  }
  const props = normalizeProps(box.props);
  const content = contentBox(size, props);
  const direction = props.direction;
  const contentMain = mainOf(content, direction);
  const contentCross = crossOf(content, direction);

  // Children are sized/measured against the container's content box. Out-of-flow children
  // (`absolute` and `fill`) are removed from the flex flow: they consume no main-axis space and never
  // shift flow siblings, so only the flow subset feeds `solveMainSizes`/`mainAxisOffsets`/`crossPlacement`.
  const childAvailable: Size2D = { width: content.width, height: content.height };
  const resolved = box.children.map((child) => ({ child, props: normalizeProps(child.props) }));
  const flowChildren = resolved.filter((c) => c.props.position === 'flow').map((c) => c.child);
  const mainSizes = solveMainSizes(flowChildren, contentMain, props, childAvailable);
  const mainOffsets = mainAxisOffsets(mainSizes, props.gap, contentMain, props.justify);

  let flowIndex = 0;
  for (const { child, props: childProps } of resolved) {
    if (childProps.position === 'absolute') {
      const rect = childProps.rect ?? { x: 0, y: 0, width: 0, height: 0 };
      // Absolute rects are content-relative — offset by the content origin so padding is honored.
      placeOutOfFlow(
        child,
        { x: content.x + rect.x, y: content.y + rect.y, width: rect.width, height: rect.height },
        result,
      );
      continue;
    }
    if (childProps.position === 'fill') {
      // A fill overlay takes the whole content box (padding honored via the content origin).
      placeOutOfFlow(child, { ...content }, result);
      continue;
    }
    const main = mainSizes[flowIndex];
    const { size: cross, offset: crossOffset } = crossPlacement(
      child,
      childAvailable,
      direction,
      props.align,
      contentCross,
    );

    const childRect = assembleRect(content, mainOffsets[flowIndex], crossOffset, main, cross, direction);
    result.set(child, childRect);
    layoutContainer(child, { width: childRect.width, height: childRect.height }, result);
    flowIndex += 1;
  }
}

/**
 * Place an out-of-flow child (`absolute` or `fill`) at an already-resolved parent-relative
 * {@link Rect}: record it as the child's rect, then recurse so the child's own interior flows within
 * that rect. Out-of-flow children overlap freely and may overflow the parent (any overflow is clipped
 * later, when the tree is composed).
 */
function placeOutOfFlow(child: LayoutBox, childRect: Rect, result: LayoutResult): void {
  result.set(child, childRect);
  layoutContainer(child, { width: childRect.width, height: childRect.height }, result);
}

/**
 * The content box in the container's local frame: origin at the top-left padding
 * inset `(padding.left, padding.top)`, each extent the box size minus padding,
 * clamped to ≥ 0 (a padding larger than the box collapses content to zero).
 */
function contentBox(size: Size2D, props: ResolvedProps): Rect {
  const { padding } = props;
  return {
    x: padding.left,
    y: padding.top,
    width: toCells(size.width - padding.left - padding.right),
    height: toCells(size.height - padding.top - padding.bottom),
  };
}

/**
 * Resolve each child's main-axis cell count: `fixed` → its cells, `auto` →
 * natural content extent measured first, `fr` → flex share — then distribute via
 * the integer-exact `solveTrack`.
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
      return { kind: 'flex', weight: size.weight, min: size.min };
    }
    // auto → measure the child's natural content extent and treat it as fixed.
    return { kind: 'fixed', size: mainOf(naturalSize(child, available), direction) };
  });
  return solveTrack(contentMain, items, props.gap);
}

/**
 * Compute each child's main-axis offset from the run of main sizes, honoring
 * `justify`. `free = max(0, contentMain − used)` is the leftover space when no
 * `fr` child absorbed it; the `max(0, …)` clamp is load-bearing for overflow:
 * when children overflow, `free` is 0 and every `justify` runs from offset 0, so
 * children extend past the far edge — never a negative offset past the near edge.
 *
 * - `start` → run at 0; `end` → run at `free`; `center` → run at `floor(free/2)`;
 * - `space-between` → distribute `free` into the inter-child gaps (integer-exact
 *   via `apportion`) on top of the base `gap`; a single child behaves like `start`.
 */
function mainAxisOffsets(mainSizes: readonly number[], gap: number, contentMain: number, justify: Justify): number[] {
  const n = mainSizes.length;
  const offsets = new Array<number>(n).fill(0);
  const baseGapTotal = n > 1 ? gap * (n - 1) : 0;
  const used = mainSizes.reduce((sum, s) => sum + s, 0) + baseGapTotal;
  const free = Math.max(0, contentMain - used);

  if (justify === 'space-between' && n > 1) {
    const extra = apportion(free, new Array<number>(n - 1).fill(1));
    let offset = 0;
    for (let i = 0; i < n; i++) {
      offsets[i] = offset;
      offset += mainSizes[i] + gap + (i < n - 1 ? extra[i] : 0);
    }
    return offsets;
  }

  let offset = justify === 'end' ? free : justify === 'center' ? Math.floor(free / 2) : 0;
  for (let i = 0; i < n; i++) {
    offsets[i] = offset;
    offset += mainSizes[i] + gap;
  }
  return offsets;
}

/**
 * Resolve a child's cross-axis size and offset for the container's `align`.
 * `stretch` (default) fills the content cross extent at offset 0; the
 * others take the child's natural cross size (clamped to the content cross
 * extent) positioned at the near edge / centered / far edge.
 */
function crossPlacement(
  child: LayoutBox,
  available: Size2D,
  direction: Direction,
  align: Align,
  contentCross: number,
): { size: number; offset: number } {
  if (align === 'stretch') {
    return { size: contentCross, offset: 0 };
  }
  const natural = crossOf(naturalSize(child, available), direction);
  const size = Math.min(natural, contentCross);
  if (align === 'center') {
    return { size, offset: Math.floor((contentCross - size) / 2) };
  }
  if (align === 'end') {
    return { size, offset: contentCross - size };
  }
  return { size, offset: 0 }; // 'start'
}

/**
 * Build a child's parent-relative rect from its main/cross offsets and sizes,
 * mapped back to `(x,y,width,height)` for the container's direction. Offsets are
 * relative to the content-box origin, so the rect already includes padding.
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
