/**
 * Internal cleanup-draining helper.
 *
 * Shared by the scheduler (which fires a computation's `onCleanup`s before each re-run and on abort)
 * and the owner tree (which fires them once at disposal). It lives in its own dependency-free module
 * so those two can share it without importing each other.
 */

/**
 * Run every callback in `cleanups` in **last-registered-first** order, then empty the array.
 *
 * LIFO teardown mirrors construction order: the thing set up last is torn down first, so a cleanup
 * never runs after something it depends on has already been released. The array is emptied in place
 * so the same list can accumulate a fresh batch of cleanups for the next run.
 *
 * @param cleanups The callback list to drain; mutated to empty. A callback that throws is not caught
 *   here — the caller decides how a throwing teardown surfaces.
 */
export function runCleanups(cleanups: Array<() => void>): void {
  for (let i = cleanups.length - 1; i >= 0; i -= 1) {
    cleanups[i]();
  }
  cleanups.length = 0;
}
