/**
 * Implementation tests for @jsvision/forms async validation — internals + edges the spec oracles
 * (`async.spec.test.ts`) do not reach: validator-rejection handling (AR-P4), live `AbortSignal`
 * delivery + abort-on-supersede, `dispose()` teardown of a pending timer / in-flight run, and eager
 * form-level aggregation that never depends on `field()` (PF-004).
 *
 * Fake timers drive the debounce; a resolvable-deferred controls settlement. The `.js` extension in
 * import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { createForm } from '../src/index.js';
import type { AsyncValidator } from '../src/index.js';

afterEach(() => {
  vi.useRealTimers();
});

/** A string-field validator whose settlement the test controls (records value + signal per call). */
function deferredValidator(): {
  validator: AsyncValidator<string>;
  calls: string[];
  resolve(index: number, message: string | null): void;
} {
  const calls: string[] = [];
  const resolvers: Array<(message: string | null) => void> = [];
  const validator: AsyncValidator<string> = (value) => {
    const index = calls.length;
    calls.push(value);
    return new Promise<string | null>((res) => {
      resolvers[index] = res;
    });
  };
  return { validator, calls, resolve: (index, message) => resolvers[index]?.(message) };
}

// AR-P4 — a validator that rejects (throws) is caught: the run yields "no async error", validating
// clears, and no unhandled rejection escapes.
test('a rejected validator is treated as no async error and clears validating', async () => {
  vi.useFakeTimers();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: () => Promise.reject(new Error('network down')) },
  });
  const field = f.field('username');
  field.value.set('ada');
  await vi.advanceTimersByTimeAsync(300);
  await vi.advanceTimersByTimeAsync(0); // flush the rejection's catch continuation

  expect(field.validating()).toBe(false);
  expect(field.asyncError()).toBeNull();
});

// The validator receives a real, live AbortSignal; superseding the run fires `abort` on the prior
// signal — the idiom a real fetch-based validator (and RD-07's load({signal})) relies on.
test('the validator gets a live AbortSignal that fires abort when the run is superseded', async () => {
  vi.useFakeTimers();
  let aborted = false;
  let firstSignal: AbortSignal | undefined;
  const validator: AsyncValidator<string> = (_value, { signal }) => {
    if (firstSignal === undefined) {
      firstSignal = signal;
      signal.addEventListener('abort', () => {
        aborted = true;
      });
    }
    return new Promise<string | null>(() => {}); // never settles
  };
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: validator },
  });
  f.field('username').value.set('a');
  await vi.advanceTimersByTimeAsync(300); // first run in flight; the listener is attached
  expect(firstSignal).toBeInstanceOf(AbortSignal);
  expect(aborted).toBe(false);

  f.field('username').value.set('b'); // supersede → the effect aborts the prior controller
  expect(aborted).toBe(true); // the abort listener fired synchronously on supersede
});

// dispose() while a debounce is pending clears the timer — the validator never runs afterwards.
test('dispose() clears a pending debounce timer so no late run fires', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  f.field('username').value.set('a'); // schedules the debounce
  f.dispose(); // before it fires
  await vi.advanceTimersByTimeAsync(300);
  expect(d.calls).toEqual([]); // the onCleanup at dispose cleared the timer
});

// dispose() while a run is in flight aborts its controller.
test('dispose() aborts an in-flight run', async () => {
  vi.useFakeTimers();
  let aborted = false;
  const validator: AsyncValidator<string> = (_value, { signal }) => {
    signal.addEventListener('abort', () => {
      aborted = true;
    });
    return new Promise<string | null>(() => {}); // never settles
  };
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: validator },
  });
  f.field('username').value.set('a');
  await vi.advanceTimersByTimeAsync(300); // run in flight
  f.dispose();
  expect(aborted).toBe(true); // dispose's onCleanup aborted the in-flight controller
});

// PF-004 — the form-level aggregates read the eager per-field signals, not memoized `field()`
// handles: `form.validating()` / `form.isValid()` are correct without ever reading the per-field
// `validating()` / `asyncError()` accessors.
test('form.validating()/isValid() aggregate the eager signals without per-field accessor reads', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  // Correct immediately, no field() handle touched for reading state.
  expect(f.validating()).toBe(false);
  expect(f.isValid()).toBe(true);

  f.field('username').value.set('taken'); // field() used only to reach the value signal
  await vi.advanceTimersByTimeAsync(300);
  expect(f.validating()).toBe(true); // aggregate reflects the in-flight run

  d.resolve(0, 'Already in use');
  await vi.advanceTimersByTimeAsync(0);
  expect(f.validating()).toBe(false);
  expect(f.isValid()).toBe(false); // isValid ANDs allAsyncClean → false on the async error
});

// A submit force-run supersedes a debounced run that had ALREADY STARTED before submit cancelled
// timers: run()'s abort-before-reassign aborts the in-flight request and the generation guard drops
// its late result, so submit gates on the force-run's verdict (PF-102).
test('a force-run supersedes an already-started debounced run; its late result is dropped', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const seen: unknown[] = [];
  const f = createForm({
    schema: z.object({ username: z.string().min(3, 'Min 3') }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  f.field('username').value.set('abcd');
  await vi.advanceTimersByTimeAsync(300); // the debounced run (call 0) is now in flight
  expect(d.calls).toEqual(['abcd']);

  const submitP = f.submit((v) => seen.push(v)); // force-run (call 1) starts, aborting call 0
  await vi.advanceTimersByTimeAsync(0);
  expect(d.calls).toEqual(['abcd', 'abcd']); // the validator was re-invoked by the force-run

  d.resolve(0, 'stale'); // the superseded debounced run resolves late — must be dropped
  await vi.advanceTimersByTimeAsync(0);

  d.resolve(1, null); // the force-run resolves clean — submit gates on THIS
  await expect(submitP).resolves.toBe(true);
  expect(seen).toEqual([{ username: 'abcd' }]);
  expect(f.field('username').asyncError()).toBeNull(); // 'stale' never landed
});
