/**
 * Cleanup-draining helper (RD-01, 03-02; AR-03).
 *
 * A leaf utility shared by the scheduler (fires a computation's `onCleanup`s before each
 * re-run and on abort) and the owner tree (fires them once at disposal). Kept in its own
 * dependency-free module so `scheduler.ts` and `owner.ts` can both use it **without an
 * import cycle** — honouring the "no cyclic concrete imports between scheduler and owner"
 * layering rule (02-current-state §Layering).
 */

/**
 * Run every callback in `cleanups` in **LIFO** order, then empty the array.
 *
 * LIFO mirrors construction order being torn down last-registered-first (the conventional
 * teardown order). The array is emptied in place so the same list can accumulate a fresh
 * batch of cleanups for the next run.
 *
 * @param cleanups The callback list to drain; mutated to empty. A callback that throws is
 *   not caught here — the caller (scheduler/owner) decides how a throwing teardown surfaces.
 */
export function runCleanups(cleanups: Array<() => void>): void {
  for (let i = cleanups.length - 1; i >= 0; i -= 1) {
    cleanups[i]();
  }
  cleanups.length = 0;
}
