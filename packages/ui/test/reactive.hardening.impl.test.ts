/**
 * Implementation tests — reactive core hardening (RD-13, HR-03).
 *
 * Edge coverage beyond the ST oracles: disposing a SIBLING scope mid-flush leaves the surviving
 * sibling reactive; nested `createRoot` disposal is depth-first and final; a disposed computed is
 * never recomputed. Covers the 03-04 "Testing Requirements → Impl tests" bullets.
 */
import { test, expect } from 'vitest';
import { signal, effect, computed, createRoot, batch, ReactiveCycleError } from '../src/reactive/index.js';

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

// ---------------------------------------------------------------------------
// Phase-6 impl edges: 3-node cycle, throwing-computed recovery (HR-27/28)
// ---------------------------------------------------------------------------

// HR-28: a cycle through THREE computeds (a → b → c → a) is detected on read.
test('a three-node computed cycle throws ReactiveCycleError', () => {
  createRoot((dispose) => {
    let readC: () => number = () => 0;
    const a = computed(() => readC());
    const b = computed(() => a());
    const c = computed(() => b());
    readC = c; // a → c → b → a
    expect(() => a()).toThrow(ReactiveCycleError);
    dispose();
  });
});

// HR-27: a computed that throws only while a source is in a bad state recovers once the source changes.
test('a throwing computed recovers after its source stops triggering the throw', () => {
  createRoot((dispose) => {
    const s = signal(0);
    const c = computed(() => {
      if (s() === 0) throw new Error('bad state');
      return s() * 10;
    });
    expect(() => c()).toThrow('bad state'); // throws while s === 0
    s.set(3);
    expect(c()).toBe(30); // re-evaluates and succeeds after the source changes (never stuck undefined)
    dispose();
  });
});
