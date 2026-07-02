/**
 * Implementation tests — reactive core hardening (RD-13, HR-03).
 *
 * Edge coverage beyond the ST oracles: disposing a SIBLING scope mid-flush leaves the surviving
 * sibling reactive; nested `createRoot` disposal is depth-first and final; a disposed computed is
 * never recomputed. Covers the 03-04 "Testing Requirements → Impl tests" bullets.
 */
import { test, expect } from 'vitest';
import { signal, effect, computed, createRoot, batch } from '../src/reactive/index.js';

test('disposing a sibling scope mid-batch leaves the other sibling reactive', () => {
  const s = signal(0);
  let aRuns = 0;
  let bRuns = 0;

  const disposeA = createRoot((d) => {
    effect(() => {
      s();
      aRuns += 1;
    });
    return d;
  });
  createRoot(() => {
    effect(() => {
      s();
      bRuns += 1;
    });
  });
  expect(aRuns).toBe(1);
  expect(bRuns).toBe(1);

  // Write (dirties both) then dispose only A, all in one batch.
  batch(() => {
    s.set(1);
    disposeA();
  });
  expect(aRuns).toBe(1); // A disposed: not resurrected
  expect(bRuns).toBe(2); // B survived: ran on the write

  s.set(2);
  expect(aRuns).toBe(1); // A still inert
  expect(bRuns).toBe(3); // B still reactive
});

test('nested createRoot disposal is depth-first and final', () => {
  const s = signal(0);
  let innerRuns = 0;

  const disposeOuter = createRoot((d) => {
    createRoot(() => {
      effect(() => {
        s();
        innerRuns += 1;
      });
    });
    return d;
  });
  expect(innerRuns).toBe(1);

  disposeOuter(); // tears down the nested scope too
  s.set(1);
  expect(innerRuns).toBe(1); // the nested effect is disposed with its ancestor
});

test('a disposed computed is not recomputed by a later dependency write', () => {
  const s = signal(1);
  let evals = 0;

  let read: (() => number) | null = null;
  const dispose = createRoot((d) => {
    const c = computed(() => {
      evals += 1;
      return s() * 2;
    });
    read = c;
    // Prime the memo so it has evaluated once.
    effect(() => {
      c();
    });
    return d;
  });
  expect(evals).toBe(1);

  dispose();
  s.set(5); // would recompute if the computed were still live
  expect(evals).toBe(1); // disposed: never recomputed
  // A stale read returns the last memo without re-evaluating.
  expect(read?.()).toBe(2);
  expect(evals).toBe(1);
});
