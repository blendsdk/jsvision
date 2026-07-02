/**
 * Intrinsic ("natural") sizing for the layout engine (AR-21, PA-5).
 *
 * Resolves the content size an `auto` box wants, so the layout pass can
 * pre-resolve `auto` children to a fixed cell count before the integer track
 * solve (PA-5). A box with a `measure` callback reports its own size (e.g. a
 * label measuring its text); a container without `measure` derives its size
 * from its children along its own `direction`. Pure and recursive over the tree.
 */
import type { LayoutBox, Size2D } from './types.js';
import { crossOf, mainOf, normalizeProps, sizeFromAxis, toCells } from './types.js';

/**
 * The natural (content) size a box wants, used to resolve `auto` sizing.
 *
 * Resolution order (AR-21):
 * 1. **`measure` provided** — return `box.measure(available)`, clamped to
 *    integers ≥ 0. The engine learns a widget's size without knowing about it.
 * 2. **Container, no `measure`** — derive along the box's own `direction`:
 *    main = Σ child main sizes + `gap × (n − 1)` + main padding; cross = max
 *    child cross size + cross padding. A `fixed` child contributes its `cells`,
 *    an `auto` child its own natural main, and an `fr` child `0` (it has no
 *    intrinsic main extent — it only grows when there is leftover space).
 * 3. **`auto` leaf with no `measure`** — `{0,0}` (a real widget supplies `measure`).
 *
 * @param box The box to size.
 * @param available The content-box space the box may size itself against
 *   (the measuring container's rect inset by its padding); threaded down to children.
 * @returns The box's natural size in integer cells.
 */
export function naturalSize(box: LayoutBox, available: Size2D): Size2D {
  if (box.measure) {
    const measured = box.measure(available);
    return { width: toCells(measured.width), height: toCells(measured.height) };
  }

  const { direction, gap, padding } = normalizeProps(box.props);
  const mainPad = direction === 'row' ? padding.left + padding.right : padding.top + padding.bottom;
  const crossPad = direction === 'row' ? padding.top + padding.bottom : padding.left + padding.right;

  // Children are measured against this container's own content box.
  const childAvailable: Size2D = {
    width: toCells(available.width - padding.left - padding.right),
    height: toCells(available.height - padding.top - padding.bottom),
  };

  // HR-33: only flow children contribute to the intrinsic size — absolute children reserve no flow
  // space (mirrors the flow filter in layout.ts:74), so an `auto` container with a large absolute
  // child measures to its flow content, not the overlay.
  const flowChildren = box.children.filter((child) => normalizeProps(child.props).position !== 'absolute');

  let mainExtent = 0;
  let crossExtent = 0;
  for (const child of flowChildren) {
    const childSize = childMainAndCross(child, childAvailable, direction);
    mainExtent += childSize.main;
    crossExtent = Math.max(crossExtent, childSize.cross);
  }

  const gapTotal = flowChildren.length > 1 ? gap * (flowChildren.length - 1) : 0;
  return sizeFromAxis(mainExtent + gapTotal + mainPad, crossExtent + crossPad, direction);
}

/**
 * A child's natural contribution along its parent's main/cross axes. The main
 * contribution honors the child's own `size` token (`fixed` → its cells, `fr` →
 * 0, `auto`/other → its natural main); the cross contribution is always the
 * child's natural cross size.
 */
function childMainAndCross(
  child: LayoutBox,
  available: Size2D,
  parentDirection: 'row' | 'col',
): { main: number; cross: number } {
  const { size } = normalizeProps(child.props);
  const natural = naturalSize(child, available);
  const cross = crossOf(natural, parentDirection);

  if (size.kind === 'fixed') {
    return { main: size.cells, cross };
  }
  if (size.kind === 'fr') {
    return { main: 0, cross };
  }
  return { main: mainOf(natural, parentDirection), cross };
}
