/**
 * Implementation tests — Reactive core, scheduling (internals & edges; 07 §impl).
 *
 * Untracked writes still propagate; `batch` returns its result; a multi-throw cascade
 * rethrows the first error as-is and reports the rest via `console.error` (PA-2); and the
 * tracking context is restored after a throw.
 */
import { test, expect, vi } from 'vitest';
import { signal, effect, batch, untrack, createRoot } from '../src/reactive/index.js';

test('a write inside untrack still propagates to other observers', () => {
  const s = signal(0);
  let runs = 0;
  effect(() => {
    s();
    runs += 1;
  });
  expect(runs).toBe(1);

  untrack(() => {
    s.set(1); // untrack suspends *reads*; a write still notifies subscribers
  });
  expect(runs).toBe(2);
});

test('batch returns the value of its function', () => {
  expect(batch(() => 42)).toBe(42);
});

test('a multi-throw cascade rethrows the first error and console.errors the rest (PA-2)', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const s = signal(0);
    let n1 = 0;
    let n2 = 0;
    createRoot(() => {
      effect(() => {
        s();
        n1 += 1;
        if (n1 > 1) throw new Error('first');
      });
      effect(() => {
        s();
        n2 += 1;
        if (n2 > 1) throw new Error('second');
      });
    });

    // The triggering write drains both effects; the first error surfaces as-is.
    expect(() => s.set(1)).toThrow('first');

    // The surplus error is reported (not gated, not swallowed).
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'second' }));
  } finally {
    errorSpy.mockRestore();
  }
});

test('the tracking context is restored after a throw', () => {
  const s = signal(0);
  createRoot(() => {
    effect(() => {
      s();
      if (s.peek() > 0) throw new Error('boom');
    });
  });
  expect(() => s.set(1)).toThrow('boom');

  // If currentObserver/batchDepth leaked, these would misbehave.
  const s2 = signal(0);
  let runs = 0;
  effect(() => {
    s2();
    runs += 1;
  });
  expect(runs).toBe(1);
  s2.set(1);
  expect(runs).toBe(2); // currentObserver was restored — fresh effect tracks normally
  expect(batch(() => 7)).toBe(7); // batchDepth was restored — batch still flushes
});
