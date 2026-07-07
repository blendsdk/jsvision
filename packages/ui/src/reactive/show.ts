/**
 * `Show` — a reactive conditional: pick one of two branches based on a live condition.
 *
 * Generic over the produced node type `N`, so it works for view trees or any other value. It
 * returns a reactive accessor you read (inside an effect, or hand to a container's dynamic-child
 * slot) to get whichever branch is currently active. The branch swaps only when the condition's
 * **boolean** result flips — not on every dependency change — and each swap disposes the previous
 * branch's scope (firing its `onCleanup`s) before building the new one under a fresh scope, so
 * branch-local reactive state is torn down cleanly.
 */
import { computed } from './computed.js';
import { createRoot } from './owner.js';
import { untrack } from './scheduler.js';

/**
 * Choose between two branches based on a reactive condition.
 *
 * @param when Reactive predicate; only its **truthiness** selects the branch (memoized, so the swap
 *   happens once per transition no matter how often the values `when` reads change).
 * @param then Builds the node shown while the condition is truthy.
 * @param else_ Builds the node shown while falsy; omit it to get `undefined` when falsy.
 * @returns A reactive accessor yielding the active branch's node (or `undefined`). Reading it zero
 *   or many times between swaps changes nothing.
 * @example
 * import { signal, effect, Show } from '@jsvision/ui';
 *
 * const loggedIn = signal(false);
 * const screen = Show(
 *   () => loggedIn(),
 *   () => 'Dashboard',
 *   () => 'Login',
 * );
 * effect(() => console.log(screen())); // "Login"
 * loggedIn.set(true);                  // "Dashboard"
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
