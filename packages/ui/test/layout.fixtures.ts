/**
 * Shared layout-reading helpers for the `ui` test suite.
 *
 * `layout.rect` is typed optional — an `'absolute'` box declared without one collapses to a zero rect
 * rather than throwing — so every read of it is `Rect | undefined` to the compiler. In a test that has
 * placed the view, or driven a gesture that places it, a missing rect is not a state to handle: it is
 * a bug in the test. {@link rectOf} says exactly that, so the failure names the view instead of
 * surfacing as `Cannot read properties of undefined`.
 *
 * Assigning `layout.rect` directly used to narrow the type for every later read in the same scope, so
 * most of these reads needed no helper. Writing through `setLayout` does not narrow, which is how the
 * optionality became visible — it was always there.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Rect } from '../src/layout/index.js';
import type { View } from '../src/view/index.js';

/**
 * The view's solved layout rect, failing loudly if it has none.
 *
 * @param view  The view to read.
 * @param label What to call it in the failure message; defaults to its class name.
 * @returns The rect.
 * @throws Error when the view has no `layout.rect`.
 */
export function rectOf(view: View, label?: string): Rect {
  const rect = view.layout.rect;
  if (rect === undefined) throw new Error(`${label ?? view.constructor.name} has no layout rect`);
  return rect;
}
