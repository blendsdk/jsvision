/**
 * Timer helper that animates a {@link Spinner} by advancing its `frame` signal on an interval.
 *
 * The `Spinner` widget holds no clock; this helper drives it over an injectable one-shot timer, so a
 * fake timer can step time deterministically in tests without touching the wall clock. Real apps pass
 * the running app's runtime as the timer. It re-arms a one-shot timer after each tick (rather than
 * using a repeating interval) and returns an idempotent `stop()` that clears the pending timer, so
 * calling `stop()` more than once is safe and leaves no dangling timer.
 */
import type { RuntimeAdapter, TimerHandle } from '@jsvision/core';
import type { Signal } from '../reactive/index.js';

/** The injectable OS-timer subset `runSpinner` needs (real: the app's `RuntimeAdapter`; tests: a fake). */
export type TimerSeam = Pick<RuntimeAdapter, 'setTimer' | 'clearTimer'>;

/** Options for {@link runSpinner}. */
export interface RunSpinnerOptions {
  /** Advance cadence in ms. Default `80`. */
  readonly intervalMs?: number;
  /** Injectable OS-timer seam (real: the running app's `RuntimeAdapter`; tests: a fake). */
  readonly timer: TimerSeam;
}

/**
 * Advance `frame` by one every `intervalMs`, using the injectable one-shot timer (re-armed each tick).
 *
 * @param frame The caller-owned frame signal to advance (the same one handed to the `Spinner`).
 * @param opts  `intervalMs` (default `80`) + the `timer` seam.
 * @returns `stop()` — clears the pending timer and stops advancing; safe to call more than once.
 * @example
 * import { Group, Spinner, runSpinner, signal, type TimerSeam } from '@jsvision/ui';
 *
 * const frame = signal(0);
 * const g = new Group();
 * g.add(new Spinner({ frame, label: 'Working…' }));
 *
 * // Any object satisfying `TimerSeam` works — wrap the platform timer functions directly.
 * let handle: NodeJS.Timeout | undefined;
 * const timer: TimerSeam = {
 *   setTimer: (fn, ms) => (handle = setTimeout(fn, ms)),
 *   clearTimer: () => {
 *     if (handle !== undefined) clearTimeout(handle);
 *   },
 * };
 * const stop = runSpinner(frame, { timer, intervalMs: 80 });
 * // When the work finishes:
 * stop();
 */
export function runSpinner(frame: Signal<number>, opts: RunSpinnerOptions): () => void {
  const ms = opts.intervalMs ?? 80;
  let handle: TimerHandle | undefined;
  const tick = (): void => {
    frame.set(frame() + 1);
    handle = opts.timer.setTimer(tick, ms); // re-arm (one-shot contract)
  };
  handle = opts.timer.setTimer(tick, ms);
  return () => {
    if (handle !== undefined) {
      opts.timer.clearTimer(handle);
      handle = undefined;
    }
  };
}
