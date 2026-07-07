/**
 * The modal-window stack backing the event loop's `execView`/`endModal`.
 *
 * Opening a modal saves whatever was focused, pushes the modal onto the stack, and focuses into the
 * modal's subtree. While the stack is non-empty, input is confined to the top modal's subtree, so
 * the rest of the tree is inert. Closing pops the top modal (last-in, first-out), restores the saved
 * focus, and resolves the promise returned by `execView`. Modals are closed explicitly (there is no
 * built-in Esc/cancel here — a `Dialog` adds that). This module is internal to the loop.
 */
import type { View } from '../view/index.js';

/** One open modal: its subtree, the focus to restore when it closes, and its `execView` resolver. */
interface ModalFrame {
  readonly view: View;
  readonly savedFocus: View | null;
  /** The `execView<R>` resolver, stored as `unknown` because the stack mixes result types. */
  readonly resolve: (result: unknown) => void;
}

/** The focus operations the modal manager needs from the focus manager. */
export interface ModalFocus {
  getFocused(): View | null;
  focusInto(view: View): void;
  focusView(view: View): void;
}

/** The open-modal stack. While `isActive()`, input is confined to `topView()`. */
export interface ModalManager {
  /** Whether any modal is open. */
  isActive(): boolean;
  /** The top modal's subtree root (where input is confined), or `null` when none is open. */
  topView(): View | null;
  /** Open `view` as a modal: save the current focus, push it, and focus into it. */
  begin<R>(view: View, resolve: (result: R) => void): void;
  /** Close the top modal: restore the saved focus and resolve its promise. A no-op when none is open. */
  end<R>(result: R): void;
}

/**
 * Create a modal manager over the given focus operations.
 *
 * @param focus The focus operations used to save, restore, and focus into modals.
 * @returns A {@link ModalManager}.
 */
export function createModalManager(focus: ModalFocus): ModalManager {
  const stack: ModalFrame[] = [];

  const isActive = (): boolean => stack.length > 0;

  const topView = (): View | null => {
    const top = stack[stack.length - 1];
    return top !== undefined ? top.view : null;
  };

  const begin = <R>(view: View, resolve: (result: R) => void): void => {
    const savedFocus = focus.getFocused();
    // Each modal on the stack resolves with its own result type; erase the resolver to `unknown`
    // here and pass the caller's result back through it in `end`.
    stack.push({ view, savedFocus, resolve: resolve as (result: unknown) => void });
    focus.focusInto(view); // focus the modal's first focusable child (or the one it last had)
  };

  const end = <R>(result: R): void => {
    const frame = stack.pop();
    if (frame === undefined) return; // nothing open — ignore
    // Restore the focus that was saved when this modal opened; a no-op if that view is gone.
    if (frame.savedFocus !== null) focus.focusView(frame.savedFocus);
    frame.resolve(result);
  };

  return { isActive, topView, begin, end };
}
