/**
 * Specification tests (immutable oracles) — Reactive core, computeds.
 *
 * Source: RD-01 AC-4 → ST-04 (plans/reactive-core/07-testing-strategy.md). A computed is
 * lazy (its body does not run until first read) and memoized (repeated reads with no
 * dependency change do not recompute). Expectations derive from the acceptance criterion,
 * never from the implementation.
 */
import { test, expect, vi } from 'vitest';
import { signal, computed } from '../src/reactive/index.js';

// ST-04 / AC-4 — lazy + memoized.
test('ST-04: a computed is lazy until first read, then memoized until a dependency changes', () => {
  const a = signal(1);
  const body = vi.fn(() => a() * 2);
  const c = computed(body);

  expect(body).not.toHaveBeenCalled(); // lazy — not evaluated at creation

  expect(c()).toBe(2);
  expect(body).toHaveBeenCalledTimes(1); // evaluated on first read

  expect(c()).toBe(2); // second read, no dependency change
  expect(body).toHaveBeenCalledTimes(1); // memoized — not re-evaluated

  a.set(5); // dependency changed
  expect(c()).toBe(10);
  expect(body).toHaveBeenCalledTimes(2); // recomputed on the next read
});
