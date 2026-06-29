/**
 * Specification tests (immutable oracles) — Reactive core, signals.
 *
 * Source: RD-01 AC-1, AC-2, AC-3 → ST-01, ST-02, ST-03
 * (plans/reactive-core/07-testing-strategy.md). Expectations derive from the
 * acceptance criteria, never from the implementation.
 */
import { test, expect, vi } from 'vitest';
import { signal, effect } from '../src/reactive/index.js';

// ST-01 / AC-1 — callable read; `.set` and `.update` write.
test('ST-01: signal reads its value and is updated by set/update', () => {
  const s = signal(1);
  expect(s()).toBe(1);

  s.set(2);
  expect(s()).toBe(2);

  s.update((n) => n + 1);
  expect(s()).toBe(3);
});

// ST-02 / AC-2 — Object.is default equality: an equal write notifies nothing.
test('ST-02: an equal write does not re-run a dependent effect; a changed one does', () => {
  const s = signal(1);
  let runs = 0;
  effect(() => {
    s();
    runs += 1;
  });
  expect(runs).toBe(1); // effect runs once on creation

  s.set(1); // equal under Object.is → no notification
  expect(runs).toBe(1);

  s.set(2); // changed → re-run
  expect(runs).toBe(2);
});

// ST-03 / AC-3 — `equals: false` always notifies, even on an equal write.
test('ST-03: equals:false re-runs a dependent effect on an equal write', () => {
  const s = signal(1, { equals: false });
  const spy = vi.fn();
  effect(() => {
    s();
    spy();
  });
  expect(spy).toHaveBeenCalledTimes(1); // initial run

  s.set(1); // equal value, but equals:false forces notification
  expect(spy).toHaveBeenCalledTimes(2);
});
