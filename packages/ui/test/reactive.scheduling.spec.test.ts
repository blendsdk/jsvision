/**
 * Specification tests (immutable oracles) — Reactive core, scheduling.
 *
 * Source: RD-01 AC-6, AC-11, AC-18 → ST-06, ST-11, ST-18
 * (plans/reactive-core/07-testing-strategy.md). The diamond glitch-freedom case
 * (ST-07 / AC-7) is added in Phase 2 once `computed` exists. Expectations derive
 * from the acceptance criteria, never from the implementation.
 */
import { test, expect } from 'vitest';
import { signal, effect, batch, ReactiveCycleError } from '../src/reactive/index.js';

// ST-06 / AC-6 — batch coalesces writes: the effect re-runs once, seeing the last value.
test('ST-06: batch coalesces writes to a single re-run observing the final value', () => {
  const s = signal('init');
  const seen: string[] = [];
  effect(() => {
    seen.push(s());
  });
  expect(seen).toEqual(['init']); // initial run

  batch(() => {
    s.set('a');
    s.set('b');
  });

  expect(seen).toEqual(['init', 'b']); // exactly one re-run, observing 'b'
});

// ST-18 / AC-18 — nested batch joins the outer: still a single flush at the outermost close.
test('ST-18: nested batch joins the outer and flushes once observing the final value', () => {
  const s = signal('init');
  const seen: string[] = [];
  effect(() => {
    seen.push(s());
  });
  expect(seen).toEqual(['init']);

  batch(() => {
    batch(() => {
      s.set('a');
      s.set('b');
    });
  });

  expect(seen).toEqual(['init', 'b']);
});

// ST-11 / AC-11 — runaway guard: an effect that writes a signal it reads cannot
// converge; propagation is bounded and throws ReactiveCycleError (control returns).
test('ST-11: a self-writing effect throws ReactiveCycleError (no hang)', () => {
  const s = signal(0);
  expect(() => {
    effect(() => {
      const v = s();
      s.set(v + 1); // writes a signal it reads → never converges
    });
  }).toThrow(ReactiveCycleError);
});
