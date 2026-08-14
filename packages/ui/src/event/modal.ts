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
  /** Monotonic counter incremented whenever the active modal stack changes. */
  version(): number;
  /** Whether any modal is open. */
  isActive(): boolean;
  /** The top modal's subtree root (where input is confined), or `null` when none is open. */
  topView(): View | null;
  /** Open `view` as a modal: save the current focus, push it, and focus into it. */
  begin<R>(view: View, resolve: (result: R | undefined) => void): void;
  /** Close the top modal: restore the saved focus and resolve its promise. A no-op when none is open. */
  end<R>(result: R): void;
  /** Close `view` only when it is the active modal; nested modals make this a safe no-op. */
  endView<R>(view: View, result: R): boolean;
  /**
   * Permanently release every modal frame during loop disposal.
   *
   * Pending modal promises resolve with `undefined` because their host has been detached and can no
   * longer produce a user result. Focus is not restored into the tree being torn down.
   */
  dispose(): void;
}

/**
 * Create a modal manager over the given focus operations.
 *
 * @param focus The focus operations used to save, restore, and focus into modals.
 * @returns A {@link ModalManager}.
 */
export function createModalManager(focus: ModalFocus): ModalManager {
  const stack: ModalFrame[] = [];
  let generation = 0;

  const isActive = (): boolean => stack.length > 0;

  const topView = (): View | null => {
    const top = stack[stack.length - 1];
    return top !== undefined ? top.view : null;
  };

  const begin = <R>(view: View, resolve: (result: R | undefined) => void): void => {
    const savedFocus = focus.getFocused();
    // Each modal on the stack resolves with its own result type; erase the resolver to `unknown`
    // here and pass the caller's result back through it in `end`.
    stack.push({ view, savedFocus, resolve: resolve as (result: unknown) => void });
    generation += 1;
    focus.focusInto(view); // focus the modal's first focusable child (or the one it last had)
  };

  const end = <R>(result: R): void => {
    const frame = stack.pop();
    if (frame === undefined) return; // nothing open — ignore
    generation += 1;
    // Restore the focus that was saved when this modal opened; a no-op if that view is gone.
    if (frame.savedFocus !== null) focus.focusView(frame.savedFocus);
    frame.resolve(result);
  };

  const endView = <R>(view: View, result: R): boolean => {
    if (topView() !== view) return false;
    end(result);
    return true;
  };

  const dispose = (): void => {
    if (stack.length > 0) generation += 1;
    for (const frame of stack.splice(0).reverse()) frame.resolve(undefined);
  };

  return { version: () => generation, isActive, topView, begin, end, endView, dispose };
}
