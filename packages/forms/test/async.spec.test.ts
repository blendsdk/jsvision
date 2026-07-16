/**
 * Specification tests (immutable oracles) for @jsvision/forms async validation — ST-A1…A16.
 *
 * Derived from RD-06's acceptance criteria and the plan's ambiguity register only — never from the
 * implementation. A failing spec test means the code is wrong, not the test.
 *
 * Idioms (from the first slice): `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(ms)` to
 * drive the debounce; a resolvable-deferred helper to control exactly when a validator settles for
 * the stale-guard/ordering oracles; **real zod** (never mocked). The `.js` extension in import
 * specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { createForm } from '../src/index.js';
import type { AsyncValidator } from '../src/index.js';
import { Schema, makeInitial } from './fixtures.js';

afterEach(() => {
  vi.useRealTimers();
});

/**
 * A string-field validator whose settlement the test controls: each call records the value + its
 * `AbortSignal` and parks on a fresh deferred the test resolves by index. It never reads `signal`, so
 * it doubles as the "abort-ignoring but in-contract" validator the AR-P11 stale-guard oracle needs.
 */
function deferredValidator(): {
  validator: AsyncValidator<string>;
  calls: string[];
  signals: AbortSignal[];
  resolve(index: number, message: string | null): void;
} {
  const calls: string[] = [];
  const signals: AbortSignal[] = [];
  const resolvers: Array<(message: string | null) => void> = [];
  const validator: AsyncValidator<string> = (value, { signal }) => {
    const index = calls.length;
    calls.push(value);
    signals.push(signal);
    return new Promise<string | null>((res) => {
      resolvers[index] = res;
    });
  };
  return {
    validator,
    calls,
    signals,
    resolve: (index, message) => resolvers[index]?.(message),
  };
}

// ─── Phase 1 — surface back-compat + schema-async guard ────────────────────────────────────────

// ST-A1 (AC-1) — a sync-only form (no asyncValidators) is behaviourally identical to the first slice:
// the async surface is present but inert, and dispose() is idempotent + safe.
test('ST-A1 a sync-only form is inert on the async surface and unchanged elsewhere', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });

  // The async surface exists but is constant (no validators were constructed to run).
  expect(f.field('name').validating()).toBe(false);
  expect(f.field('name').asyncError()).toBeNull();
  expect(f.field('port').asyncError()).toBeNull();
  expect(f.validating()).toBe(false);

  // First-slice accessors are unchanged: sync error is live pre-touch; isValid/values track the parse.
  expect(f.field('name').error()?.message).toBe('Required');
  expect(f.isValid()).toBe(false);
  expect(f.values()).toBeNull();

  f.field('name').value.set('db'); // now the whole object is sync-valid
  expect(f.isValid()).toBe(true);
  expect(f.values()).toEqual({ name: 'db', port: 8080, tls: true });

  // submit gates on the sync parse exactly as before and calls onValid with the coerced values.
  const seen: unknown[] = [];
  await expect(
    f.submit((v) => {
      seen.push(v);
    }),
  ).resolves.toBe(true);
  expect(seen).toEqual([{ name: 'db', port: 8080, tls: true }]);

  // reset restores the baseline.
  f.reset();
  expect(f.field('name').value()).toBe('');
  expect(f.dirty()).toBe(false);

  // dispose() is idempotent and safe on a form that never subscribed anything async.
  expect(() => {
    f.dispose();
    f.dispose();
  }).not.toThrow();
});

// ST-A10 (AC-10) — an in-schema async `.refine` makes the synchronous parse throw ($ZodAsyncError);
// every accessor that reaches the parse rethrows the engine's NAMED error (message names
// `asyncValidators`), not the raw Zod error and not a silent wrong result.
test('ST-A10 an in-schema async refinement throws the named async-schema error from every accessor', () => {
  const asyncSchema = z.object({ name: z.string() }).refine(async () => true, { message: 'never reached' });
  const f = createForm({ schema: asyncSchema, initial: { name: 'a' } });

  expect(() => f.isValid()).toThrow(/asyncValidators/);
  expect(() => f.values()).toThrow(/asyncValidators/);
  expect(() => f.errors()).toThrow(/asyncValidators/);
  expect(() => f.field('name').error()).toThrow(/asyncValidators/);

  // It is a plain named Error, not the raw $ZodAsyncError leaking through.
  let caught: unknown;
  try {
    f.isValid();
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as { constructor: { name: string } }).constructor.name).toBe('Error');
});

// ─── Phase 2 — the per-field async trigger ─────────────────────────────────────────────────────

// ST-A2 (AC-2) — validating() goes true (while the run is in flight) then false; asyncError() is null
// for a clean result.
test('ST-A2 validating() flips true→false and asyncError() is null on a clean result', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  const field = f.field('username');
  expect(field.validating()).toBe(false);

  field.value.set('ada'); // sync-clean change → schedule the debounce
  await vi.advanceTimersByTimeAsync(300); // fire → run() sets validating=true, awaits the (pending) validator
  expect(field.validating()).toBe(true);
  expect(d.calls).toEqual(['ada']);

  d.resolve(0, null);
  await vi.advanceTimersByTimeAsync(0); // flush run()'s continuation
  expect(field.validating()).toBe(false);
  expect(field.asyncError()).toBeNull();
});

// ST-A3 (AC-3) — the async message lands on asyncError(); error() stays the (null) sync ZodIssue —
// the two surfaces are distinct.
test('ST-A3 asyncError() carries the async message while error() stays the sync ZodIssue', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string().min(3, 'Min 3') }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  const field = f.field('username');
  field.value.set('ada'); // sync-clean (length 3)
  await vi.advanceTimersByTimeAsync(300);
  d.resolve(0, 'Already in use');
  await vi.advanceTimersByTimeAsync(0);

  expect(field.asyncError()).toBe('Already in use');
  expect(field.error()).toBeNull(); // the async string is never fabricated into a ZodIssue
});

// ST-A4 (AC-4) — an older in-flight run superseded by a newer one is dropped (out-of-order
// resolution) and the older run's AbortSignal is aborted.
test('ST-A4 an out-of-order stale result is dropped and its AbortSignal is aborted', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  const field = f.field('username');

  field.value.set('A');
  await vi.advanceTimersByTimeAsync(300); // A's run is now in flight
  expect(d.calls).toEqual(['A']);

  field.value.set('B'); // supersedes A (aborts A's controller, bumps the generation)
  await vi.advanceTimersByTimeAsync(300); // B's run is now in flight
  expect(d.calls).toEqual(['A', 'B']);
  expect(d.signals[0].aborted).toBe(true); // A's signal was aborted on supersede

  d.resolve(1, 'B-verdict'); // B settles first
  await vi.advanceTimersByTimeAsync(0);
  expect(field.asyncError()).toBe('B-verdict');

  d.resolve(0, 'A-verdict'); // A settles last (out of order) — must be dropped
  await vi.advanceTimersByTimeAsync(0);
  expect(field.asyncError()).toBe('B-verdict'); // A never clobbered B
});

// ST-A5 (AC-5) — rapid changes within the debounce coalesce to one run with the final value; a custom
// asyncDebounceMs is honoured.
test('ST-A5 rapid changes coalesce to one run with the final value; custom debounceMs is honoured', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  for (const v of ['a', 'ab', 'abc', 'abcd', 'abcde']) f.field('username').value.set(v);
  await vi.advanceTimersByTimeAsync(300);
  expect(d.calls).toEqual(['abcde']); // one run, the final value

  const d2 = deferredValidator();
  const f2 = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d2.validator },
    asyncDebounceMs: 50,
  });
  f2.field('username').value.set('x');
  await vi.advanceTimersByTimeAsync(49);
  expect(d2.calls).toEqual([]); // not yet
  await vi.advanceTimersByTimeAsync(1);
  expect(d2.calls).toEqual(['x']); // fired at exactly 50ms
});

// ST-A6 (AC-6) — the validator runs only while the field is synchronously clean.
test('ST-A6 an async validator runs only while the field is sync-clean', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string().min(3, 'Min 3') }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  const field = f.field('username');
  field.value.set('ab'); // sync-INVALID (length 2)
  await vi.advanceTimersByTimeAsync(300);
  expect(d.calls).toEqual([]); // gate closed → no run

  field.value.set('abc'); // now sync-clean
  await vi.advanceTimersByTimeAsync(300);
  expect(d.calls).toEqual(['abc']);
});

// ST-A7 (AC-7) — isValid() reflects a resolved async error but is optimistic about pending checks (a
// not-yet-run or in-flight validator does not flip it false).
test('ST-A7 isValid() reflects async errors but is optimistic about pending checks', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  const field = f.field('username');

  expect(f.isValid()).toBe(true); // (c) sync-valid, async not yet run → optimistic true

  field.value.set('taken');
  expect(f.isValid()).toBe(true); // still before the debounce fires → optimistic true
  await vi.advanceTimersByTimeAsync(300);
  d.resolve(0, 'Already in use');
  await vi.advanceTimersByTimeAsync(0);
  expect(field.asyncError()).toBe('Already in use');
  expect(f.isValid()).toBe(false); // (a) resolved async error → false

  field.value.set('free'); // clears asyncError immediately; run resolves clean
  await vi.advanceTimersByTimeAsync(300);
  d.resolve(1, null);
  await vi.advanceTimersByTimeAsync(0);
  expect(field.asyncError()).toBeNull();
  expect(f.isValid()).toBe(true); // (b) sync-valid + async-clean → true
});

// ST-A8 (AC-8) — form.validating() is the OR over fields: true while any is in flight, false once all
// settle.
test('ST-A8 form.validating() is true while any field is in flight and false once all settle', async () => {
  vi.useFakeTimers();
  const dA = deferredValidator();
  const dB = deferredValidator();
  const f = createForm({
    schema: z.object({ a: z.string(), b: z.string() }),
    initial: { a: '', b: '' },
    asyncValidators: { a: dA.validator, b: dB.validator },
  });
  f.field('a').value.set('x');
  f.field('b').value.set('y');
  await vi.advanceTimersByTimeAsync(300);
  expect(f.validating()).toBe(true); // both in flight

  dA.resolve(0, null);
  await vi.advanceTimersByTimeAsync(0);
  expect(f.validating()).toBe(true); // b still in flight

  dB.resolve(0, null);
  await vi.advanceTimersByTimeAsync(0);
  expect(f.validating()).toBe(false); // all settled
});

// ST-A11 (AC-11) — dispose() removes the standing effect: a later change never runs the validator, and
// a second dispose() is a safe no-op.
test('ST-A11 dispose() stops the standing effect; a later change never runs the validator', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  f.dispose();
  f.field('username').value.set('ada');
  await vi.advanceTimersByTimeAsync(300);
  expect(d.calls).toEqual([]); // the effect is gone
  expect(() => f.dispose()).not.toThrow(); // idempotent
});

// ST-A12 (AC-12 / PF-002) — per-field isolation: editing one async field does not abort or re-run
// another that is mid-flight (the sync-clean gate is read untracked).
test('ST-A12 editing one async field does not disturb another that is in flight', async () => {
  vi.useFakeTimers();
  const dA = deferredValidator();
  const dB = deferredValidator();
  const f = createForm({
    schema: z.object({ a: z.string(), b: z.string() }),
    initial: { a: '', b: '' },
    asyncValidators: { a: dA.validator, b: dB.validator },
  });
  f.field('b').value.set('bbb');
  await vi.advanceTimersByTimeAsync(300);
  expect(dB.calls).toEqual(['bbb']); // B in flight
  expect(dB.signals[0].aborted).toBe(false);

  f.field('a').value.set('aaa'); // edit A while B is mid-flight
  await vi.advanceTimersByTimeAsync(300);
  expect(dA.calls).toEqual(['aaa']); // A ran independently
  // B is untouched: still one call, its signal is not aborted, still validating.
  expect(dB.calls).toEqual(['bbb']);
  expect(dB.signals[0].aborted).toBe(false);
  expect(f.field('b').validating()).toBe(true);
});

// ST-A13 (AR-P7) — the mount run is skipped: a sync-clean initial value with no user change never runs
// the validator.
test('ST-A13 the mount run is skipped — no change means no validation', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: 'prefilled' }, // sync-clean initial
    asyncValidators: { username: d.validator },
  });
  await vi.advanceTimersByTimeAsync(1000); // no user change
  expect(d.calls).toEqual([]); // the firstRun guard skipped the mount run
  expect(f.field('username').validating()).toBe(false);
});

// ST-A14 (AR-P8) — changing the value clears a stale asyncError immediately (synchronously, before the
// next run), so isValid() is not held false during the debounce+network window.
test('ST-A14 a value change clears a stale asyncError immediately', async () => {
  vi.useFakeTimers();
  const d = deferredValidator();
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  const field = f.field('username');
  field.value.set('admin');
  await vi.advanceTimersByTimeAsync(300);
  d.resolve(0, 'Already in use');
  await vi.advanceTimersByTimeAsync(0);
  expect(field.asyncError()).toBe('Already in use');
  expect(f.isValid()).toBe(false);

  field.value.set('adminx'); // change → the effect clears asyncError synchronously
  expect(field.asyncError()).toBeNull();
  expect(f.isValid()).toBe(true); // not held false during the window
});

// ST-A16 (AR-P11 / AC-4) — an abort-ignoring but in-contract validator: its stale result, resolved
// during the NEXT value's debounce window (before that value's run starts), is dropped by the
// generation bump on supersede. Closes the abort-independent window ST-A4's timing does not reach.
test('ST-A16 an abort-ignoring validator’s stale result is dropped mid-debounce of the next value', async () => {
  vi.useFakeTimers();
  const d = deferredValidator(); // never reads its signal → ignores abort
  const f = createForm({
    schema: z.object({ username: z.string() }),
    initial: { username: '' },
    asyncValidators: { username: d.validator },
  });
  const field = f.field('username');

  field.value.set('v1');
  await vi.advanceTimersByTimeAsync(300); // v1's run is in flight
  expect(d.calls).toEqual(['v1']);
  expect(field.validating()).toBe(true);

  field.value.set('v2'); // supersede: bump generation, reset validating→false, asyncError→null; v2 debouncing
  expect(field.validating()).toBe(false); // not stranded true

  d.resolve(0, 'stale'); // v1 resolves NOW — before v2's run starts, ignoring its (aborted) signal
  await vi.advanceTimersByTimeAsync(0);
  expect(field.asyncError()).toBeNull(); // dropped by the generation guard — never wrote 'stale'
  expect(field.validating()).toBe(false);

  await vi.advanceTimersByTimeAsync(300); // v2's debounce fires
  expect(d.calls).toEqual(['v1', 'v2']);
  d.resolve(1, null);
  await vi.advanceTimersByTimeAsync(0);
  expect(field.asyncError()).toBeNull(); // only v2 wrote the verdict
  expect(field.validating()).toBe(false);
});

// ─── Phase 3 — async-aware submit() ────────────────────────────────────────────────────────────

// ST-A9 (AC-9) — submit() force-runs the async validators (even with no debounce elapsed) and gates
// on them: an async rejection fails the submit; an async-clean object passes and calls onValid.
test('ST-A9 submit() force-runs async and gates on the result', async () => {
  vi.useFakeTimers();
  const mk = () =>
    createForm({
      schema: z.object({ username: z.string().min(3, 'Min 3') }),
      initial: { username: '' },
      asyncValidators: {
        username: (value) => Promise.resolve(value === 'taken' ? 'Already in use' : null),
      },
    });

  // (a) sync-valid but the async rule rejects the value → submit resolves false, onValid not called,
  //     even though no debounce elapsed (submit force-runs).
  const seenA: unknown[] = [];
  const fa = mk();
  fa.field('username').value.set('taken');
  await expect(fa.submit((v) => seenA.push(v))).resolves.toBe(false);
  expect(seenA).toEqual([]);
  expect(fa.field('username').asyncError()).toBe('Already in use');

  // (b) sync-valid + async-clean → submit resolves true, onValid called once with the coerced values.
  const seenB: unknown[] = [];
  const fb = mk();
  fb.field('username').value.set('free');
  await expect(fb.submit((v) => seenB.push(v))).resolves.toBe(true);
  expect(seenB).toEqual([{ username: 'free' }]);
});

// ST-A15 (AR-P9) — a synchronously-invalid submit short-circuits false WITHOUT invoking any async
// validator (no pointless round-trip on a doomed submit; no malformed value handed to a validator).
test('ST-A15 submit() short-circuits on sync-invalid without invoking any async validator', async () => {
  vi.useFakeTimers();
  const spy = vi.fn((value: string) => Promise.resolve(value === 'taken' ? 'x' : null));
  const seen: unknown[] = [];
  const f = createForm({
    schema: z.object({ username: z.string().min(3, 'Min 3') }),
    initial: { username: 'ab' }, // sync-INVALID (length 2)
    asyncValidators: { username: spy },
  });
  await expect(f.submit((v) => seen.push(v))).resolves.toBe(false);
  expect(spy).not.toHaveBeenCalled(); // no async call on a doomed submit
  expect(seen).toEqual([]);
});
