/**
 * `Show` (RD-01, 03-03; AR-11) — a reactive conditional combinator.
 *
 * UI-independent: generic over the rendered child type `N`, returning a reactive accessor the
 * consumer reads (inside its own effect) to attach/detach the active branch's node. The branch
 * flips only when the condition's **boolean** value transitions — not on every dependency tick —
 * and each flip disposes the previous branch's owner scope exactly once (its `onCleanup`s fire),
 * then mounts the new branch under a fresh scope.
 */
import { computed } from './computed.js';
import { createRoot } from './owner.js';
import { untrack } from './scheduler.js';

/**
 * Mount one of two branches based on a reactive condition (AR-11).
 *
 * @param when Reactive predicate; only its **truthiness** drives branch selection (memoized,
 *   so a flip happens once per transition regardless of how often `when`'s deps change).
 * @param then Builds the node shown while the condition is truthy.
 * @param else_ Builds the node shown while falsy; omitted ⇒ `undefined` when falsy.
 * @returns A reactive accessor yielding the current branch's node (or `undefined`). Reading it
 *   zero or many times between flips changes nothing.
 */
export function Show<N>(when: () => boolean, then: () => N, else_?: () => N): () => N | undefined {
  // Memoized boolean: re-evaluates the branch only when the truthiness actually flips.
  const condition = computed(() => Boolean(when()));

  let disposeBranch: (() => void) | null = null;

  // The branch is itself a memo keyed on `condition`, so the flip is bound to condition
  // transitions and independent of how many times the returned accessor is read.
  const branch = computed<N | undefined>(() => {
    // Dispose the previous branch's scope before building the next (exactly once per flip).
    if (disposeBranch !== null) {
      disposeBranch();
      disposeBranch = null;
    }
    const active = condition();
    return createRoot((dispose) => {
      disposeBranch = dispose;
      // Build the branch untracked: only `condition` should drive a flip, not signals the
      // branch body reads (its own reactivity lives in effects it creates).
      return untrack(() => (active ? then() : else_ !== undefined ? else_() : undefined));
    });
  });

  return branch;
}
