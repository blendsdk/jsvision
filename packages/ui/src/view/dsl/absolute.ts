/**
 * Absolute-placement builders — one blessed absolute primitive (`at`) and two single-child overlay
 * primitives (`cover`, `center`), all in the `grow`/`fixed` shape: set one `layout` prop
 * (merge-preserving), return the same view, never touch a parent.
 *
 * These are the escape hatch for canvases, dialog frames, and pixel-exact geometry — **prefer
 * `col`/`row`; reach for these only when flex flow can't express the placement.** Because they only
 * set ordinary `layout` props, the result reflows exactly like a hand-built tree.
 */
import { View } from '../view.js';
import type { Rect } from '../../layout/index.js';

/**
 * Place a view absolutely at a parent-content-relative rectangle, and return the same view for inline
 * composition. Accepts either four numbers (`x, y, width, height`) or a single {@link Rect}.
 *
 * **Merge-preserving:** it sets only `position:'absolute'` and `rect`, keeping every other `layout`
 * prop (e.g. a container's `direction`) — unlike a hand-rolled `view.layout = { … }` that would drop
 * them. **Pure:** it never adds the view to a parent; composition stays the caller's job (`g.add(at(v,
 * …))`, or nest it inside a `col`/`row`/`stack`). An `at()`-placed view used as a `col`/`row` child
 * is honored as an **out-of-flow** overlay — it paints over the content box and reserves no flow
 * space (the engine already excludes `absolute` children from flex flow).
 *
 * A degenerate rect (negative or fractional) is forwarded as-is; the engine clamps each side to a
 * non-negative integer at solve time.
 *
 * @param view The view to place.
 * @param spec Either `x, y, width, height` (four numbers) or a single `{ x, y, width, height }` rect.
 * @returns The same `view`, for inline chaining.
 * @example
 * import { col, grow, at } from '@jsvision/ui';
 *
 * // An absolute toast overlay as an out-of-flow child of a column — it reserves no flow space.
 * const screen = col(header, grow(body), at(toast, 2, 1, 30, 3));
 *
 * // The rect form, for a site that already has a { x, y, width, height }.
 * at(panel, { x: 0, y: 0, width: 80, height: 24 });
 */
export function at<V extends View>(
  view: V,
  ...spec: [x: number, y: number, width: number, height: number] | [rect: Rect]
): V {
  const rect: Rect = spec.length === 1 ? spec[0] : { x: spec[0], y: spec[1], width: spec[2], height: spec[3] };
  view.layout = { ...view.layout, position: 'absolute', rect };
  return view;
}

/**
 * Make a view cover its parent's whole content box as an out-of-flow overlay, and return the same
 * view — standalone, no `stack()` wrapper. Sets `position:'fill'`, merge-preserving every other
 * `layout` prop; the box overlaps its siblings, reserves no flow space, and re-solves for free when
 * the parent resizes.
 *
 * Distinct from the `Flex.fill` shorthand: `Flex.fill` (a `col`/`row` prop) means `grow: 1` — take a
 * flex share of the flow; `cover()` sets `position:'fill'` — an overlay that leaves the flow entirely.
 *
 * @param view The view to make an overlay.
 * @returns The same `view`, for inline chaining.
 * @example
 * import { cover } from '@jsvision/ui';
 *
 * // A canvas that fills its parent and overlaps whatever is behind it.
 * cover(canvasView);
 */
export function cover<V extends View>(view: V): V {
  view.layout = { ...view.layout, position: 'fill' };
  return view;
}

/**
 * Center a fixed-size view in its parent as an out-of-flow overlay, re-centering on resize, and
 * return the same view — standalone, no `stack()` wrapper. Sets an absolute origin rect plus the
 * `View.centered` flag, which the engine re-solves lag-free in the reflow pass; every other `layout`
 * prop is merge-preserved.
 *
 * Distinct from the stack-layer `centered()` tag: `centered()` only takes effect inside a `stack()`;
 * `center()` acts directly on any view.
 *
 * @param view The view to center.
 * @param width Fixed width in cells.
 * @param height Fixed height in cells.
 * @returns The same `view`, for inline chaining.
 * @example
 * import { center } from '@jsvision/ui';
 *
 * // A 40×12 dialog centered in its parent, staying centered as the parent resizes.
 * center(confirmDialog, 40, 12);
 */
export function center<V extends View>(view: V, width: number, height: number): V {
  view.layout = { ...view.layout, position: 'absolute', rect: { x: 0, y: 0, width, height } };
  view.centered = true;
  return view;
}
