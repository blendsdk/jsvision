/**
 * Implementation tests — Reactive core, effects (internals & edges; 07 §impl).
 *
 * Dynamic dependency re-collection (an untaken branch drops its old edge) and independent
 * tracking of nested effects.
 */
import { test, expect } from 'vitest';
import { signal, effect, createRoot } from '../src/reactive/index.js';

test('dynamic dependency drop: an untaken branch no longer re-runs the effect', () => {
  const cond = signal(true);
  const a = signal('a1');
  const b = signal('b1');
  let runs = 0;
  effect(() => {
    // tracks cond + (a or b) depending on the branch taken this run.
    if (cond()) {
      a();
    } else {
      b();
    }
    runs += 1;
  });
  expect(runs).toBe(1); // tracks cond + a

  a.set('a2'); // a is a live dependency
  expect(runs).toBe(2);

  cond.set(false); // re-run switches the branch → now tracks cond + b, drops a
  expect(runs).toBe(3);

  a.set('a3'); // a was dropped → no re-run
  expect(runs).toBe(3);

  b.set('b2'); // b is now a live dependency
  expect(runs).toBe(4);
});

test('nested effects track their own dependencies independently', () => {
  const outerSig = signal(0);
  const innerSig = signal(0);
  let outerRuns = 0;
  let innerRuns = 0;

  createRoot(() => {
    effect(() => {
      outerSig();
      outerRuns += 1;
      // Created once: the outer effect re-runs only on outerSig, so the inner effect is
      // not recreated by an innerSig change.
      if (outerRuns === 1) {
        effect(() => {
          innerSig();
          innerRuns += 1;
        });
      }
    });
  });
  expect(outerRuns).toBe(1);
  expect(innerRuns).toBe(1);

  innerSig.set(1); // only the inner effect tracks innerSig
  expect(innerRuns).toBe(2);
  expect(outerRuns).toBe(1);

  outerSig.set(1); // only the outer effect tracks outerSig
  expect(outerRuns).toBe(2);
  expect(innerRuns).toBe(2);
});
