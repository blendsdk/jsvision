/**
 * Specification tests (immutable oracles) — Reactive core, scheduling.
 *
 * Source: RD-01 AC-6, AC-7, AC-11, AC-18 → ST-06, ST-07, ST-11, ST-18
 * (plans/reactive-core/07-testing-strategy.md). Expectations derive from the
 * acceptance criteria, never from the implementation.
 */
import { test, expect } from 'vitest';
import { signal, computed, effect, batch, ReactiveCycleError } from '../src/reactive/index.js';

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

// ST-07 / AC-7 — diamond glitch-freedom: two computeds derived from one signal feed one
// effect; a single source change re-runs the effect exactly once, never on a mixed old/new
// pair.
test('ST-07: a diamond re-runs the effect once, never observing a mixed old/new pair', () => {
  const a = signal(0);
  const b = computed(() => a());
  const d = computed(() => a());
  const seen: number[] = [];
  let runs = 0;
  effect(() => {
    seen.push(b() + d());
    runs += 1;
  });
  expect(runs).toBe(1);
  expect(seen).toEqual([0]);

  a.set(1);

  expect(runs).toBe(2); // exactly one re-run (not two)
  // Never a glitched intermediate of 1 (= new b + old d, or old b + new d).
  expect(seen).toEqual([0, 2]);
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
