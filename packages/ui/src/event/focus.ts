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
import { devWarn } from '../shared/warnings.js';

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
  /**
   * Move focus to the next focusable view in tree order, bounded by `scope`: descend through nested
   * groups and, at a group's end, cross into the parent's next focusable sibling, wrapping at `scope`.
   * Continuous Tab is pure tree order — a wrap re-enters at the tree start, not the last-visited child;
   * container restore memory is kept only for a non-Tab entry. `scope` is the ceiling the loop supplies
   * (the top modal's subtree while a modal is open, else the mounted root); `null` is a no-op.
   */
  focusNext(scope: View | null): void;
  /**
   * Move focus to the previous focusable view — the exact inverse of {@link FocusManager.focusNext}
   * (reverse descent lands on a container's last leaf), bounded by and wrapping at `scope`.
   */
  focusPrev(scope: View | null): void;
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
   * Flip focus from an explicitly given previously-focused leaf `old` to `view`: point the pointer
   * chain at `view`, clear `old`'s `focused` flag, set `view`'s, and repaint both (the two repaints
   * coalesce into one frame).
   *
   * `old` is passed in rather than read here because Tab traversal resets the `current` pointers of the
   * groups it climbs out of *before* the flip — after that reset a fresh `getFocused()` can no longer
   * follow those pointers down to the leaf that was focused when the walk began. Capturing `old` up
   * front keeps the blur pointed at the right view.
   */
  const focusLeafFrom = (old: View | null, view: View): void => {
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

  /** Focus a specific view, flipping from whatever is focused now. The two repaints coalesce into one frame. */
  const focusLeaf = (view: View): void => focusLeafFrom(getFocused(), view);

  /** The last child of `group` that can receive focus — the reverse mirror of `children.find`, or `null`. */
  const findLastReceiver = (group: Group): View | null => {
    for (let i = group.children.length - 1; i >= 0; i -= 1) {
      const child = group.children[i];
      if (child !== undefined && canReceiveFocus(child)) return child;
    }
    return null;
  };

  /**
   * Descend into a target for FORWARD entry, flipping from `old`: a leaf is focused directly; a
   * container descends to its last-focused child (restore) or its FIRST focusable child, recursing to a
   * leaf. A focusable container with no focusable descendant is focused itself.
   */
  const descendForward = (view: View, old: View | null): void => {
    if (!(view instanceof Group)) {
      focusLeafFrom(old, view);
      return;
    }
    const saved = view.current !== null && canReceiveFocus(view.current) ? view.current : null;
    const target = saved ?? view.children.find(canReceiveFocus) ?? null;
    if (target !== null) {
      descendForward(target, old);
      return;
    }
    if (isFocusable(view)) focusLeafFrom(old, view); // focusable container, no focusable descendants
  };

  /**
   * Descend into a target for REVERSE entry — identical to {@link descendForward} except it falls to a
   * container's LAST focusable child (not its first), so Shift-Tab lands on the last leaf and stays the
   * exact inverse of Tab. Restore still wins when the container's saved child is present.
   */
  const descendLast = (view: View, old: View | null): void => {
    if (!(view instanceof Group)) {
      focusLeafFrom(old, view);
      return;
    }
    const saved = view.current !== null && canReceiveFocus(view.current) ? view.current : null;
    const target = saved ?? findLastReceiver(view);
    if (target !== null) {
      descendLast(target, old);
      return;
    }
    if (isFocusable(view)) focusLeafFrom(old, view);
  };

  /**
   * Focus into a target: a leaf is focused directly; a container descends to its last-focused child
   * (restore) or its first focusable child, recursing until a leaf is reached. A focusable container
   * with no focusable descendant is focused itself. Used by the non-traversal callers (click hit-test,
   * `healFocus`, the public `EventLoop.focusInto`, modal open); its restore-or-first contract is unchanged.
   */
  const focusInto = (view: View): void => descendForward(view, getFocused());

  /** The first focusable view in `view`'s subtree, in tree order, or `null` when there is none. */
  const firstFocusableIn = (view: View): View | null => {
    if (isFocusable(view)) return view;
    if (!(view instanceof Group)) return null;
    for (const child of view.children) {
      const found = firstFocusableIn(child);
      if (found !== null) return found;
    }
    return null;
  };

  /**
   * Explain, in terms a caller can act on, why focusing `view` did nothing.
   *
   * The common case by far is aiming at a composite widget rather than the leaf inside it — a data
   * grid, list, tree, tab view, combo box and date picker are all containers whose focusable part is
   * a child — so when the subtree does hold a focusable view, the message names it. The remaining
   * cases each have exactly one cause, and the order below reports the outermost one first: a view
   * that is not mounted yet cannot also be judged on its visibility.
   */
  const explainUnfocusable = (view: View): string => {
    const name = view.constructor.name;
    const target = firstFocusableIn(view);
    if (target !== null) {
      return (
        `focusView(${name}) did nothing: ${name} is not focusable itself, but its ` +
        `${target.constructor.name} child is. Focus that child directly, or use focusInto(${name}), ` +
        `which descends to the first focusable view for you.`
      );
    }
    if (!view.mounted) {
      return `focusView(${name}) did nothing: ${name} is not mounted yet. Focus it after it is added to the tree, e.g. from onMount().`;
    }
    if (!view.state.visible) {
      return `focusView(${name}) did nothing: ${name} is hidden (state.visible is false). A hidden view cannot hold focus.`;
    }
    if (view.state.disabled) {
      return `focusView(${name}) did nothing: ${name} is disabled. A disabled view cannot hold focus.`;
    }
    if (!noBlockingAncestor(view)) {
      return `focusView(${name}) did nothing: an ancestor of ${name} is hidden or disabled, which blocks focus for its whole subtree.`;
    }
    return (
      `focusView(${name}) did nothing: nothing in ${name}'s subtree is focusable. Set focusable = true ` +
      `on the view that should take keyboard input, or focus a control that is already focusable.`
    );
  };

  const focusView = (view: View): void => {
    if (isFocusable(view)) {
      focusLeaf(view);
      return;
    }
    // Focusing a non-focusable view stays a no-op — the diagnostic only explains the silence.
    devWarn('focus', explainUnfocusable(view));
  };

  /** Whether `view` is `scope` itself or a descendant of it. */
  const isWithin = (view: View, scope: View): boolean => {
    let node: View | null = view;
    while (node !== null) {
      if (node === scope) return true;
      node = node.parent;
    }
    return false;
  };

  /**
   * The focusable sibling of `child` within `group` in `direction`, or `null` when there is none in
   * that direction (so the caller bubbles up to the parent — wrapping happens only at the scope). If
   * `child` is itself no longer a candidate (it was disabled or removed), resume from the nearest
   * candidate in tree order in `direction` rather than skipping to an end.
   */
  const siblingCandidate = (group: Group, child: View, direction: 1 | -1): View | null => {
    const candidates = group.children.filter(canReceiveFocus);
    if (candidates.length === 0) return null;
    const idx = candidates.indexOf(child);
    if (idx !== -1) {
      const next = idx + direction;
      return next >= 0 && next < candidates.length ? (candidates[next] ?? null) : null;
    }
    // The anchor is no longer focusable: resume from the nearest candidate by tree order in `direction`.
    const anchorPos = group.children.indexOf(child);
    if (anchorPos === -1) return null;
    if (direction === 1) {
      return candidates.find((c) => group.children.indexOf(c) > anchorPos) ?? null;
    }
    for (let i = candidates.length - 1; i >= 0; i -= 1) {
      const cand = candidates[i];
      if (cand !== undefined && group.children.indexOf(cand) < anchorPos) return cand;
    }
    return null;
  };

  /** Direction-aware descent: forward reuses restore-or-first, reverse uses restore-or-last. */
  const descend = (view: View, direction: 1 | -1, old: View | null): void =>
    direction === 1 ? descendForward(view, old) : descendLast(view, old);

  /**
   * Enter `scope` at its end for `direction`: descend into its first (forward) or last (reverse)
   * focusable child, flipping from `old`; a focusable leaf/empty scope is focused directly. Backs both
   * the empty-start entry and the wrap at the ceiling.
   */
  const enterEnd = (scope: View, direction: 1 | -1, old: View | null): void => {
    if (scope instanceof Group) {
      const child = direction === 1 ? (scope.children.find(canReceiveFocus) ?? null) : findLastReceiver(scope);
      if (child !== null) {
        descend(child, direction, old);
        return;
      }
    }
    if (isFocusable(scope)) focusLeafFrom(old, scope);
  };

  /**
   * Move focus one step in `direction`, walking the view tree in document order bounded by `scope`:
   * from the focused leaf, take the next focusable sibling; when a group has none left, climb into its
   * parent and retry, until a sibling is found or `scope` is reached (there it wraps). The previously
   * focused leaf is captured FIRST, so the blur still targets it after the climb resets the `current`
   * pointer of every group it leaves — that reset is what makes a wrap re-enter at the tree end
   * (forward-first / reverse-last) instead of the last-visited child, i.e. pure tree order with no
   * relocated trap. A non-Tab focus change never runs this climb, so container restore survives for it.
   * With nothing focused (or focus outside `scope`) it enters `scope` at the end; `scope === null` is a
   * no-op.
   */
  const advance = (direction: 1 | -1, scope: View | null): void => {
    if (scope === null) return;
    const old = getFocused(); // capture BEFORE any memory reset — the blur must target this leaf
    if (old === null || !isWithin(old, scope)) {
      enterEnd(scope, direction, old); // nothing focused, or focus outside scope → enter at the end
      return;
    }

    // Climb toward the ceiling, taking the first sibling step in `direction`; remember each group left.
    let child: View = old;
    let group: View | null = old.parent;
    let target: View | null = null;
    const exited: Group[] = [];
    while (group instanceof Group && child !== scope) {
      const next = siblingCandidate(group, child, direction);
      if (next !== null) {
        target = next;
        break;
      }
      if (group === scope) break; // ceiling reached with nothing left → wrap
      exited.push(group); // left this group by Tab → its `current` is now stale
      child = group;
      group = group.parent;
    }

    for (const g of exited) g.current = null; // reset AFTER capturing old; a wrap now goes to the tree end

    if (target !== null) {
      descend(target, direction, old); // step to the sibling and descend into it
      return;
    }
    enterEnd(scope, direction, old); // wrap: descend into scope's first/last leaf (exited memory cleared)
  };

  return {
    getFocused,
    focusedLeafIn,
    focusView,
    focusInto,
    isFocusable,
    focusNext: (scope) => advance(1, scope),
    focusPrev: (scope) => advance(-1, scope),
  };
}
