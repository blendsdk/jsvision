/**
 * Implementation tests — Reactive core, ownership (internals & edges; 07 §impl).
 *
 * Idempotent disposal, depth-first teardown order, the no-scope `onCleanup` no-op, and the
 * `ReactiveCycleError` shape (`iterationLimit === 1000`, `instanceof TuiError`).
 */
import { test, expect, vi } from 'vitest';
import { TuiError } from '@jsvision/core';
import { signal, effect, createRoot, onCleanup, ReactiveCycleError } from '../src/reactive/index.js';

test('dispose() twice is a safe no-op (idempotent)', () => {
  let cleanups = 0;
  const dispose = createRoot((disposeScope) => {
    onCleanup(() => {
      cleanups += 1;
    });
    return disposeScope;
  });

  dispose();
  dispose(); // second call must not re-run cleanups
  expect(cleanups).toBe(1);
});

test('disposal is depth-first: child scopes tear down before their parent', () => {
  const order: string[] = [];
  const dispose = createRoot((disposeScope) => {
    onCleanup(() => order.push('parent'));
    createRoot(() => {
      onCleanup(() => order.push('child'));
    });
    return disposeScope;
  });

  dispose();
  expect(order).toEqual(['child', 'parent']);
});

test('onCleanup outside any computation or owner is a no-op with a dev warning', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const previousEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    expect(() => onCleanup(() => {})).not.toThrow();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  } finally {
    process.env.NODE_ENV = previousEnv;
    warnSpy.mockRestore();
  }
});

test('ReactiveCycleError carries iterationLimit 1000 and is a TuiError', () => {
  const constructed = new ReactiveCycleError(1000);
  expect(constructed.iterationLimit).toBe(1000);
  expect(constructed).toBeInstanceOf(TuiError);

  // The error actually thrown by the runaway guard has the same shape.
  const s = signal(0);
  let thrown: unknown;
  try {
    effect(() => {
      const v = s();
      s.set(v + 1);
    });
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(ReactiveCycleError);
  expect(thrown).toBeInstanceOf(TuiError);
  if (thrown instanceof ReactiveCycleError) {
    expect(thrown.iterationLimit).toBe(1000);
  }
});
