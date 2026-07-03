/**
 * `runSpinner` — the optional timer helper that animates a {@link Spinner}'s `frame` (RD-18, AR-190).
 *
 * The `Spinner` widget is deliberately pure (no clock); this helper drives it over the shipped,
 * injectable `RuntimeAdapter` one-shot-timer seam (`host/types.ts:126-129`), so a fake `TimerSeam`
 * steps time deterministically in tests (no wall-clock). It re-arms `setTimer` after each tick (the
 * one-shot contract) rather than using a repeating interval, and returns an **idempotent** `stop()`
 * that clears the pending timer and nulls the handle (no leak, AC-10/AC-14). The `.js` extension in
 * import specifiers is required by NodeNext ESM resolution.
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
 * @returns `stop()` — clears the pending timer and stops advancing; idempotent, no leak (AC-10).
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
