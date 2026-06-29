/**
 * Implementation tests — Reactive core, signals (internals & edges; 07 §impl).
 *
 * These exercise behavior beyond the acceptance oracles: custom equality, non-subscribing
 * reads, and the `update` predecessor. Unlike the spec tests, they may reflect implementation
 * detail.
 */
import { test, expect } from 'vitest';
import { signal, effect } from '../src/reactive/index.js';

test('a custom equals predicate suppresses notification for "equal" writes', () => {
  // Values within 10 are treated as equal → an equal write is a no-op (no notify, no assign).
  const s = signal(0, { equals: (a, b) => Math.abs(a - b) < 10 });
  let runs = 0;
  effect(() => {
    s();
    runs += 1;
  });
  expect(runs).toBe(1);

  s.set(5); // |5 - 0| < 10 → equal
  expect(runs).toBe(1);
  expect(s()).toBe(0); // equal write does not assign

  s.set(20); // |20 - 0| >= 10 → changed
  expect(runs).toBe(2);
  expect(s()).toBe(20);
});

test('.peek() reads the current value without subscribing inside an effect', () => {
  const s = signal(1);
  let runs = 0;
  let lastPeek = 0;
  effect(() => {
    lastPeek = s.peek();
    runs += 1;
  });
  expect(runs).toBe(1);
  expect(lastPeek).toBe(1);

  s.set(2); // peek did not create an edge → no re-run
  expect(runs).toBe(1);
});

test('update receives the previous value and stores the derived one', () => {
  const s = signal(10);
  let received = -1;
  s.update((previous) => {
    received = previous;
    return previous + 5;
  });
  expect(received).toBe(10);
  expect(s()).toBe(15);
});
