/**
 * Typed errors for the reactive core.
 *
 * These extend `@jsvision/core`'s {@link TuiError} (rather than bare `Error`), so code that already
 * catches `TuiError` broadly also catches reactive failures.
 */
import { TuiError } from '@jsvision/core';

/**
 * Thrown when reactive propagation fails to settle within its fixed iteration limit — almost always
 * because an effect writes a signal it also depends on, creating an update loop that never
 * converges. Throwing (rather than looping forever) hands control back to the caller so the app
 * never hangs. When you see this, look for an effect that both reads and writes the same signal.
 *
 * @example
 * import { ReactiveCycleError, signal, effect, createRoot } from '@jsvision/ui';
 *
 * try {
 *   createRoot(() => {
 *     const n = signal(0);
 *     effect(() => n.set(n() + 1)); // reads AND writes n → never converges
 *   });
 * } catch (err) {
 *   if (err instanceof ReactiveCycleError) {
 *     console.error('reactive loop; hit', err.iterationLimit, 'iterations');
 *   }
 * }
 */
export class ReactiveCycleError extends TuiError {
  /** The propagation-iteration limit that was hit before giving up. */
  public readonly iterationLimit: number;

  /**
   * @param iterationLimit The propagation-iteration limit that was exceeded.
   * @param detail Optional message override for a computed-dependency cycle; when omitted, the
   *   default effect-write-loop message is used.
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
