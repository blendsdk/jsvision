/**
 * Specification tests (immutable oracles) — Reactive core, effects.
 *
 * Source: RD-01 AC-5, AC-10 → ST-05, ST-10
 * (plans/reactive-core/07-testing-strategy.md). Expectations derive from the
 * acceptance criteria, never from the implementation.
 */
import { test, expect } from 'vitest';
import { signal, effect, untrack } from '../src/reactive/index.js';

// ST-05 / AC-5 — effect runs once on creation, re-runs on a changed dependency,
// and does not re-run on an equal write.
test('ST-05: effect runs once, re-runs on change, ignores equal writes', () => {
  const s = signal(1);
  let runs = 0;
  effect(() => {
    s();
    runs += 1;
  });
  expect(runs).toBe(1);

  s.set(2); // changed → one re-run
  expect(runs).toBe(2);

  s.set(2); // equal → no re-run
  expect(runs).toBe(2);
});

// ST-10 / AC-10 — untrack suspends subscription: reads inside untrack create no edge.
test('ST-10: untrack reads do not subscribe; only tracked deps re-run the effect', () => {
  const a = signal(0);
  const b = signal(0);
  let runs = 0;
  effect(() => {
    a();
    untrack(() => b());
    runs += 1;
  });
  expect(runs).toBe(1);

  b.set(1); // read under untrack → not a dependency → no re-run
  expect(runs).toBe(1);

  a.set(1); // tracked dependency → re-run
  expect(runs).toBe(2);
});
