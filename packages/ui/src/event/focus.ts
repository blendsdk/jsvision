/**
 * The focus manager backing the event loop's focus methods.
 *
 * Focus is stored *in the tree*: each group remembers which child is focused (its `current` pointer),
 * and following those pointers from the root leads to the focused leaf. Because the pointers persist,
 * a container that loses focus and later regains it restores the child that was focused before — not
 * the first one. This is how focus survives switching windows or opening and closing a dialog.
 *
 * The mutations here set pointers and flags but do **not** repaint; the loop wraps each public call
 * so a standalone focus change paints one frame, while the built-in Tab handler calls them directly
 * because it already runs inside a paint cycle. This module is internal — callers use the
 * {@link EventLoop} focus methods.
 */
import { View, Group } from '../view/index.js';

/** Tracks and moves focus over the mounted view tree. */
export interface FocusManager {
  /** The currently focused leaf, or `null` if nothing is focused. */
  getFocused(): View | null;
  /** The focused leaf within `scope`, or `null` — used to confine dispatch to an open modal's subtree. */
  focusedLeafIn(scope: View | null): View | null;
  /** Focus exactly `view`; a no-op if `view` is not currently focusable. */
  focusView(view: View): void;
  /** Focus into a container: restore its last-focused child, else focus its first focusable descendant. */
  focusInto(view: View): void;
  /** Whether `view` is a focusable leaf right now (used to climb to the nearest focusable on a click). */
  isFocusable(view: View): boolean;
  /** Move focus to the next focusable view, wrapping and descending into a focusable container. */
  focusNext(): void;
  /** Move focus to the previous focusable view, wrapping. */
  focusPrev(): void;
}

/**
 * Create a focus manager over the mounted root, read lazily via `getRoot` (the loop supplies the root
 * once it is mounted).
 *
 * @param getRoot Accessor for the current mounted root view (or `null` before mount).
 * @returns A {@link FocusManager}.
 */
export function createFocusManager(getRoot: () => View | null): FocusManager {
  // A view cannot receive focus if any ancestor is hidden or disabled, even if the view itself is fine.
  const noBlockingAncestor = (view: View): boolean => {
    let ancestor = view.parent;
    while (ancestor !== null) {
      if (!ancestor.state.visible || ancestor.state.disabled) return false;
      ancestor = ancestor.parent;
    }
    return true;
  };

  /**
   * Whether `view` can be focused right now: it must be mounted, visible, enabled, marked focusable,
   * and have no blocking ancestor. The `mounted` check matters — a detached view has no parent, so
   * the ancestor check would trivially pass; requiring `mounted` makes focusing a detached view a
   * genuine no-op instead of silently blurring the real focus.
   */
  const isFocusable = (view: View): boolean =>
    view.mounted && view.state.visible && !view.state.disabled && view.focusable && noBlockingAncestor(view);

  /** Whether a group contains at least one focusable descendant. */
  const isFocusableContainer = (group: Group): boolean => {
    for (const child of group.children) {
      if (isFocusable(child)) return true;
      if (child instanceof Group && isFocusableContainer(child)) return true;
    }
    return false;
  };

  /** Whether `view` can receive focus: a focusable leaf, or a container with a focusable descendant. */
  const canReceiveFocus = (view: View): boolean => {
    if (view instanceof Group) return isFocusable(view) || isFocusableContainer(view);
    return isFocusable(view);
  };

  /** Follow the `current` chain down from `scope` to the focused leaf, or `null` if `scope` holds none. */
  const focusedLeafIn = (scope: View | null): View | null => {
    if (!(scope instanceof Group) || scope.current === null) return null;
    let node: View = scope.current;
    while (node instanceof Group && node.current !== null) {
      node = node.current;
    }
    return node;
  };

  const getFocused = (): View | null => focusedLeafIn(getRoot());

  /** Point every ancestor's `current` at the child on the path to `view`, so root→…→view leads to it. */
  const setCurrentChain = (view: View): void => {
    let child: View = view;
    let parent = view.parent;
    while (parent instanceof Group) {
      parent.current = child;
      child = parent;
      parent = parent.parent;
    }
  };

  /**
   * Focus a specific view: point the pointer chain at it, then clear the old view's `focused` flag
   * and set the new one, repainting both. The two repaints coalesce into one frame.
   */
  const focusLeaf = (view: View): void => {
    const old = getFocused();
    setCurrentChain(view);
    if (old === view) return; // already focused — nothing to flip
    if (old !== null) {
      old.state.focused = false;
      old.invalidate();
      old.focusTick?.set(undefined); // notify anything observing the old view's focus (no-op if none)
    }
    view.state.focused = true;
    view.invalidate();
    view.focusTick?.set(undefined); // notify anything observing the new view's focus (no-op if none)
  };

  /**
   * Focus into a target: a leaf is focused directly; a container descends to its last-focused child
   * (restore) or its first focusable child, recursing until a leaf is reached. A focusable container
   * with no focusable descendant is focused itself.
   */
  const focusInto = (view: View): void => {
    if (!(view instanceof Group)) {
      focusLeaf(view);
      return;
    }
    const saved = view.current !== null && canReceiveFocus(view.current) ? view.current : null;
    const target = saved ?? view.children.find(canReceiveFocus) ?? null;
    if (target !== null) {
      focusInto(target);
      return;
    }
    if (isFocusable(view)) focusLeaf(view); // focusable container, no focusable descendants
  };

  const focusView = (view: View): void => {
    if (isFocusable(view)) focusLeaf(view); // focusing a non-focusable view is a no-op
  };

  /**
   * Move focus within the active group (the focused leaf's parent, or the root when nothing is
   * focused): pick the next/previous focusable child in child order, wrapping at the ends, and
   * descend into it if it is a container. A no-op when the active group has no focusable children.
   */
  const advance = (direction: 1 | -1): void => {
    const root = getRoot();
    if (root === null) return;
    const focused = getFocused();
    const active =
      focused !== null && focused.parent instanceof Group ? focused.parent : root instanceof Group ? root : null;
    if (active === null) return;

    const candidates = active.children.filter(canReceiveFocus);
    if (candidates.length === 0) return; // nothing focusable in this group

    const currentChild = active.current;
    const inCandidates = currentChild !== null ? candidates.indexOf(currentChild) : -1;
    let nextIndex: number;
    if (inCandidates !== -1) {
      nextIndex = (inCandidates + direction + candidates.length) % candidates.length;
    } else {
      // The anchor is no longer focusable (it was disabled or removed, or nothing was focused).
      // Resume from the nearest candidate by tree order in the travel direction rather than jumping
      // to an end and skipping views; fall back to the appropriate end when there is nothing beyond it.
      const anchorPos = currentChild !== null ? active.children.indexOf(currentChild) : -1;
      if (anchorPos === -1) {
        nextIndex = direction === 1 ? 0 : candidates.length - 1;
      } else if (direction === 1) {
        const found = candidates.findIndex((c) => active.children.indexOf(c) > anchorPos);
        nextIndex = found === -1 ? 0 : found; // none after the anchor → wrap to the first
      } else {
        let found = -1;
        for (let i = candidates.length - 1; i >= 0; i -= 1) {
          if (active.children.indexOf(candidates[i]) < anchorPos) {
            found = i;
            break;
          }
        }
        nextIndex = found === -1 ? candidates.length - 1 : found; // none before → wrap to the last
      }
    }

    const chosen = candidates[nextIndex];
    if (chosen !== undefined) focusInto(chosen);
  };

  return {
    getFocused,
    focusedLeafIn,
    focusView,
    focusInto,
    isFocusable,
    focusNext: () => advance(1),
    focusPrev: () => advance(-1),
  };
}
