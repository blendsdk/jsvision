/**
 * Implementation tests — `runSpinner` timer helper (RD-18, 07 §impl + ST-10/ST-14). A fake
 * `TimerSeam` records armed callbacks + intervals and steps time deterministically (no wall-clock):
 * self-re-arming advance, default interval, and an idempotent, leak-free `stop()`. `.js` per NodeNext
 * ESM resolution.
 */
import { test, expect } from 'vitest';
import { signal } from '../src/reactive/index.js';
import { runSpinner } from '../src/feedback/index.js';
import type { TimerSeam } from '../src/feedback/index.js';

/** A deterministic fake timer: records armed intervals + clears, and fires the one pending callback. */
function fakeTimer() {
  let pending: (() => void) | null = null;
  const armedMs: number[] = [];
  let cleared = 0;
  let nextId = 1;
  const seam: TimerSeam = {
    setTimer: (fn: () => void, ms: number) => {
      pending = fn;
      armedMs.push(ms);
      return nextId++;
    },
    clearTimer: () => {
      cleared += 1;
      pending = null;
    },
  };
  const fire = () => {
    const p = pending;
    pending = null;
    p?.();
  };
  return {
    seam,
    fire,
    armedMs,
    get pending() {
      return pending;
    },
    get cleared() {
      return cleared;
    },
  };
}

test('ST-10: firing the pending callback advances frame; each arm requests intervalMs', () => {
  const frame = signal(0);
  const t = fakeTimer();
  runSpinner(frame, { intervalMs: 80, timer: t.seam });
  expect(t.armedMs, 'armed once on start').toEqual([80]);
  t.fire(); // 0 → 1, re-arm
  t.fire(); // 1 → 2, re-arm
  t.fire(); // 2 → 3, re-arm
  expect(frame(), 'advanced 0→3').toBe(3);
  expect(
    t.armedMs.every((ms) => ms === 80),
    'every arm used 80ms',
  ).toBe(true);
  expect(t.armedMs.length, 'initial + 3 re-arms').toBe(4);
});

test('default intervalMs is 80 when omitted', () => {
  const t = fakeTimer();
  runSpinner(signal(0), { timer: t.seam });
  expect(t.armedMs[0]).toBe(80);
});

test('stop() before the first fire clears the timer; frame never advances', () => {
  const frame = signal(0);
  const t = fakeTimer();
  const stop = runSpinner(frame, { timer: t.seam });
  stop();
  expect(t.cleared, 'the pending timer was cleared').toBe(1);
  expect(t.pending, 'no timer left armed').toBeNull();
  t.fire(); // nothing pending → no-op
  expect(frame(), 'frame unchanged').toBe(0);
});

test('stop() is idempotent and leak-free — no advance after stop, double-stop is a no-op', () => {
  const frame = signal(0);
  const t = fakeTimer();
  const stop = runSpinner(frame, { timer: t.seam });
  t.fire(); // 0 → 1
  expect(frame()).toBe(1);
  stop();
  expect(t.cleared).toBe(1);
  expect(t.pending, 'handle nulled — nothing armed').toBeNull();
  t.fire(); // no pending → no advance
  expect(frame(), 'no advance after stop').toBe(1);
  stop(); // second stop: handle already undefined → does NOT call clearTimer again
  expect(t.cleared, 'double-stop did not clear again (idempotent)').toBe(1);
});
