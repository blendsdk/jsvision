/**
 * Typed errors for the reactive core (RD-01, 03-02; AR-13).
 *
 * Extending `@jsvision/core`'s {@link TuiError} (rather than bare `Error`) means a consumer
 * catching `TuiError` broadly also catches reactive failures. Importing `TuiError` from
 * `@jsvision/core` is the subsystem's only non-Node import and does not violate `check:deps`
 * (it is a workspace dependency, not a native one).
 */
import { TuiError } from '@jsvision/core';

/**
 * Thrown when reactive propagation fails to converge within the fixed iteration bound
 * (AR-18) — almost always because an effect writes a signal it depends on. Throwing
 * (rather than looping forever) returns control to the caller so the event loop never hangs.
 */
export class ReactiveCycleError extends TuiError {
  /** The propagation-iteration limit that was hit (1000 in v1; not configurable — AR-18). */
  public readonly iterationLimit: number;

  /**
   * @param iterationLimit The propagation-iteration bound that was exceeded.
   * @param detail Optional message override for a non-iteration cycle (HR-28's compute-cycle case);
   *   when omitted, the default effect-write-loop message is used.
   */
  public constructor(iterationLimit: number, detail?: string) {
    super(
      detail ??
        `Reactive propagation did not converge within ${iterationLimit} iterations ` +
          `(an effect likely writes a signal it depends on).`,
    );
    this.iterationLimit = iterationLimit;
  }
}
