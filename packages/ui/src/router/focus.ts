/**
 * Focus-restore helpers for the navigation router.
 *
 * On returning to a screen, focus is restored in tiers: the exact saved view for a warm (kept-alive)
 * screen, an index-path resolve for a disposed+rebuilt screen, and a first-focusable floor. These
 * pure helpers implement the path capture/resolve and the floor; the exact tier is simply re-focusing
 * the saved view reference.
 */
import { Group } from '../view/index.js';
import type { View } from '../view/index.js';

/** Whether a view can take focus right now: visible, enabled, and marked focusable. */
function defaultIsFocusable(view: View): boolean {
  return view.focusable && view.state.visible && !view.state.disabled;
}

/**
 * The child-index path from `root` down to `target`: each number is an ancestor's index within its
 * parent's `children`, ordered root→target. Returns `null` when `target` is neither `root` nor a
 * descendant of it. An empty path `[]` means `target === root`.
 *
 * @param root   The screen root to resolve the path against.
 * @param target The focused view to capture.
 * @returns The index path root→target, or `null` if `target` is outside `root`.
 * @example
 * const path = focusPath(screenRoot, loop.getFocused()!); // e.g. [0, 1]
 */
export function focusPath(root: View, target: View): number[] | null {
  const path: number[] = [];
  let node: View | null = target;
  while (node !== null && node !== root) {
    const parent: View | null = node.parent;
    if (parent === null || !(parent instanceof Group)) return null;
    const index = parent.children.indexOf(node);
    if (index === -1) return null;
    path.push(index);
    node = parent;
  }
  if (node !== root) return null; // target was not under root
  return path.reverse();
}

/**
 * Resolve an index path (from {@link focusPath}) against `root`, returning the view at that position,
 * or `null` if the path does not fit the tree (a shorter or reshaped rebuild). An empty path returns
 * `root`.
 *
 * @param root The screen root to walk.
 * @param path The index path to follow.
 * @returns The view at the path, or `null` if it does not resolve.
 * @example
 * const view = viewAtPath(rebuiltRoot, savedPath);
 * if (view !== null) loop.focusView(view);
 */
export function viewAtPath(root: View, path: readonly number[]): View | null {
  let node: View = root;
  for (const index of path) {
    if (!(node instanceof Group)) return null;
    const child = node.children[index];
    if (child === undefined) return null;
    node = child;
  }
  return node;
}

/**
 * Find the view under `root` whose `keyOf(view)` equals `key` — the screen-cooperative restore tier
 * for a rebuilt screen that reshapes (so the index path no longer fits). Walks depth-first in paint
 * order and returns the first match, or `null` when none matches.
 *
 * @param root  The rebuilt screen root to search.
 * @param keyOf The route's `focusKey` — derives a stable key from a view.
 * @param key   The key captured from the previously focused view.
 * @returns The matching view, or `null` if no view yields `key`.
 * @example
 * const target = findFocusByKey(rebuiltRoot, route.focusKey!, savedKey);
 * if (target !== null) loop.focusView(target);
 */
export function findFocusByKey(root: View, keyOf: (view: View) => string, key: string): View | null {
  if (keyOf(root) === key) return root;
  if (root instanceof Group) {
    for (const child of root.children) {
      const found = findFocusByKey(child, keyOf, key);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * The first focusable leaf under `root` in paint order (depth-first, children in order) — the
 * best-effort floor when neither the exact view nor an index-path resolve is available.
 *
 * @param root        The screen root to search.
 * @param isFocusable Predicate for "can take focus now"; defaults to visible + enabled + focusable.
 * @returns The first focusable view, or `null` if none.
 * @example
 * const target = firstFocusableLeaf(screenRoot);
 * if (target !== null) loop.focusView(target);
 */
export function firstFocusableLeaf(root: View, isFocusable: (view: View) => boolean = defaultIsFocusable): View | null {
  if (isFocusable(root)) return root;
  if (root instanceof Group) {
    for (const child of root.children) {
      const found = firstFocusableLeaf(child, isFocusable);
      if (found !== null) return found;
    }
  }
  return null;
}
