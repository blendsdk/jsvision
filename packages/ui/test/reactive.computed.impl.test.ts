/**
 * Implementation tests — Reactive core, computeds (internals & edges; 07 §impl).
 *
 * The memo-equal short-circuit (CHECK→CLEAN demotion with no downstream re-run), nested
 * computeds memoizing correctly, and the `equals: false` always-notify computed.
 */
import { test, expect, vi } from 'vitest';
import { signal, computed, effect, createRoot } from '../src/reactive/index.js';

test('a computed that recomputes to an equal value does not re-run its observers', () => {
  // isEven changes only when the parity flips, not on every `a` change.
  const a = signal(2);
  const isEven = computed(() => a() % 2 === 0);
  let runs = 0;
  createRoot(() => {
    effect(() => {
      isEven();
      runs += 1;
    });
  });
  expect(runs).toBe(1);

  a.set(4); // a changed, but isEven stays true → CHECK resolves to CLEAN, no downstream re-run
  expect(runs).toBe(1);

  a.set(3); // parity flips → isEven changes → downstream re-runs
  expect(runs).toBe(2);
});

test('a computed reading another computed memoizes correctly', () => {
  const a = signal(1);
  const doubled = computed(() => a() * 2);
  const body = vi.fn(() => doubled() + 1);
  const plusOne = computed(body);

  expect(plusOne()).toBe(3);
  expect(body).toHaveBeenCalledTimes(1);

  expect(plusOne()).toBe(3); // memoized — no recompute without a dependency change
  expect(body).toHaveBeenCalledTimes(1);

  a.set(5);
  expect(plusOne()).toBe(11); // doubled = 10, plusOne = 11
  expect(body).toHaveBeenCalledTimes(2);
});

test('a computed with equals:false notifies observers on every recompute', () => {
  const a = signal(1);
  const body = vi.fn(() => {
    a();
    return 'constant'; // value never changes
  });
  const c = computed(body, { equals: false });
  let runs = 0;
  createRoot(() => {
    effect(() => {
      c();
      runs += 1;
    });
  });
  expect(runs).toBe(1);
  expect(body).toHaveBeenCalledTimes(1);

  a.set(2); // dependency changed → c recomputes to the same value, but equals:false forces notify
  expect(body).toHaveBeenCalledTimes(2);
  expect(runs).toBe(2); // downstream re-ran despite the equal value (contrast: default would skip)
});
