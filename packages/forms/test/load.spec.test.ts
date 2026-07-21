/**
 * Specification tests (immutable oracles) for @jsvision/forms async loading + baseline rebase —
 * ST-L1…ST-L12.
 *
 * Derived from RD-07's acceptance criteria and the plan's ambiguity register only — never from the
 * implementation. A failing spec test means the code is wrong, not the test.
 *
 * Idioms (from the store + async slices): **real zod** (never mocked); `vi.useFakeTimers()` +
 * `await vi.advanceTimersByTimeAsync(ms)` to drive the async re-validation debounce; a **controllable
 * deferred loader** (below) to pin exactly when a load settles for the ordering / concurrency /
 * disposal oracles. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { z } from 'zod';
import { createForm } from '../src/index.js';
import { Schema, makeInitial } from './fixtures.js';

/** The raw editing shape of the shared fixture — `load`'s `Promise<I>` record type. */
type Raw = ReturnType<typeof makeInitial>;

afterEach(() => {
  vi.useRealTimers();
});

/**
 * A loader whose settlement the test controls: each call records its `AbortSignal` and parks on a
 * fresh deferred the test resolves/rejects by index — so a test controls settle timing and order, and
 * (never reading `signal`) it doubles as the abort-ignoring loader the stale-guard oracle needs.
 * Mirrors `deferredValidator()` in `async.spec.test.ts`.
 */
function deferredLoader<I>(): {
  loader: (ctx: { signal: AbortSignal }) => Promise<I>;
  signals: AbortSignal[];
  resolve(index: number, record: I): void;
  reject(index: number, error: unknown): void;
} {
  const signals: AbortSignal[] = [];
  const resolvers: Array<(record: I) => void> = [];
  const rejecters: Array<(error: unknown) => void> = [];
  const loader = ({ signal }: { signal: AbortSignal }): Promise<I> =>
    new Promise<I>((res, rej) => {
      const i = signals.length;
      signals.push(signal);
      resolvers[i] = res;
      rejecters[i] = rej;
    });
  return {
    loader,
    signals,
    resolve: (index, record) => resolvers[index]?.(record),
    reject: (index, error) => rejecters[index]?.(error),
  };
}

// ST-L1 (AC-1) — Regression. A sync-only form that never calls load() behaves exactly as the store +
// async slices: baseline stays `initial`, dirty/reset/isValid/submit are unchanged. It references
// neither load() nor loading(), so it genuinely stays GREEN through the red phase.
test('ST-L1 a sync-only form is unchanged (baseline stays initial)', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  expect(f.rawValues()).toEqual({ name: '', port: '8080', tls: true });
  expect(f.dirty()).toBe(false);
  expect(f.isValid()).toBe(false); // name '' → invalid

  f.field('name').value.set('db');
  expect(f.isValid()).toBe(true);
  expect(f.dirty()).toBe(true);

  f.reset(); // restores the ORIGINAL initial (no rebase ever happened)
  expect(f.rawValues()).toEqual(makeInitial());
  expect(f.dirty()).toBe(false);

  f.field('name').value.set('db');
  const seen: unknown[] = [];
  await expect(f.submit((v) => void seen.push(v))).resolves.toBe(true);
  expect(seen).toEqual([{ name: 'db', port: 8080, tls: true }]);
});

// ST-L2 (AC-2) — Replace + rebase. A successful load replaces every value AND rebases the whole
// baseline to the loaded record, so dirty() is false immediately after.
test('ST-L2 load replaces every value and rebases the baseline; dirty() false', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  const ok = await f.load(async () => ({ name: 'Ada', port: '9090', tls: false }));
  expect(ok).toBe(true);
  expect(f.rawValues()).toEqual({ name: 'Ada', port: '9090', tls: false });
  expect(f.dirty()).toBe(false);
  expect(f.field('name').dirty()).toBe(false);
  expect(f.field('port').dirty()).toBe(false);
  expect(f.field('tls').dirty()).toBe(false);
});

// ST-L3 (AC-3) — reset() targets the LOADED record, not the blank initial (the rebase moved the
// baseline).
test('ST-L3 reset() returns to the loaded record, not the blank initial', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  await f.load(async () => ({ name: 'Ada', port: '9090', tls: false }));
  f.field('name').value.set('Zed');
  expect(f.dirty()).toBe(true);

  f.reset();
  expect(f.field('name').value()).toBe('Ada'); // the loaded value, not ''
  expect(f.dirty()).toBe(false);
});

// ST-L4 (AC-4) — Reload rebases again: load() is re-invokable (a Reload button / a different record).
test('ST-L4 a second load rebases again — re-invokable', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  await f.load(async () => ({ name: 'Ada', port: '9090', tls: false }));
  await f.load(async () => ({ name: 'Ben', port: '7070', tls: true }));
  expect(f.rawValues()).toEqual({ name: 'Ben', port: '7070', tls: true });

  f.field('name').value.set('edited');
  f.reset(); // targets the SECOND loaded record
  expect(f.rawValues()).toEqual({ name: 'Ben', port: '7070', tls: true });
  expect(f.dirty()).toBe(false);
});

// ST-L5 (AC-5) — Pristine. A load clears touched — INCLUDING a field touched before the load (here by
// a failed submit). AC-5 also clears the submit-attempted flag, but that signal is write-only with no
// accessor, so this oracle verifies only the observable touched() half (PF-207).
test('ST-L5 load leaves the form pristine — touched cleared, including a pre-load touch', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() }); // name '' → invalid
  await expect(f.submit(() => {})).resolves.toBe(false);
  expect(f.field('name').touched()).toBe(true);

  await f.load(async () => ({ name: 'Ada', port: '9090', tls: false }));
  expect(f.field('name').touched()).toBe(false);
  expect(f.field('port').touched()).toBe(false);
  expect(f.field('tls').touched()).toBe(false);
});

// ST-L6 (AC-6) — load resolves true and settles AFTER the batch applied: a synchronous dirty() read
// immediately after the await sees the rebased (false) state.
test('ST-L6 load resolves true and settles after the batch applied', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  const ok = await f.load(async () => ({ name: 'Ada', port: '9090', tls: false }));
  expect(ok).toBe(true);
  expect(f.dirty()).toBe(false); // synchronous read: the batch already committed
  expect(f.rawValues()).toEqual({ name: 'Ada', port: '9090', tls: false });
});

// ST-L7 (AC-7) — a rejecting loader resolves false and leaves state untouched; loading() returns to
// false; there is no loadError() engine surface.
test('ST-L7 a rejecting loader resolves false and leaves state untouched; no loadError surface', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.field('name').value.set('typed'); // pre-existing edit
  const before = f.rawValues();

  const ok = await f.load(async () => {
    throw new Error('boom');
  });
  expect(ok).toBe(false);
  expect(f.rawValues()).toEqual(before); // untouched
  expect(f.loading()).toBe(false);
  expect('loadError' in f).toBe(false);
});

// ST-L8 (AC-8) — loading() transitions on BOTH paths: true synchronously the moment load() is called
// (before the first await), false on success and on rejection.
test('ST-L8 loading() goes true synchronously then false on success and on rejection', async () => {
  vi.useFakeTimers();
  const f = createForm({ schema: Schema, initial: makeInitial() });
  const d = deferredLoader<Raw>();
  expect(f.loading()).toBe(false);

  const p0 = f.load(d.loader);
  expect(f.loading()).toBe(true); // set synchronously, before the first await
  d.resolve(0, { name: 'Ada', port: '9090', tls: false });
  await p0;
  expect(f.loading()).toBe(false);

  const p1 = f.load(d.loader);
  expect(f.loading()).toBe(true);
  d.reject(1, new Error('boom'));
  await p1;
  expect(f.loading()).toBe(false);
});

// ST-L9 (AC-9) — Concurrency / stale-guard. A newer load supersedes an older in-flight one: the older
// signal is aborted, the newer owns the result, and an out-of-order older settle is DROPPED (neither
// applies a value nor touches loading() — PF-206).
test('ST-L9 an older load is superseded and its out-of-order settle is dropped', async () => {
  vi.useFakeTimers();
  const f = createForm({ schema: Schema, initial: makeInitial() });
  const d = deferredLoader<Raw>();

  const p0 = f.load(d.loader); // gen 1
  const p1 = f.load(d.loader); // gen 2 — supersedes gen 1
  expect(f.loading()).toBe(true);
  expect(d.signals[0].aborted).toBe(true); // gen 1 aborted on supersede
  expect(d.signals[1].aborted).toBe(false);

  d.resolve(1, { name: 'Ben', port: '7070', tls: true });
  await p1;
  expect(f.rawValues()).toEqual({ name: 'Ben', port: '7070', tls: true });
  expect(f.loading()).toBe(false);

  d.resolve(0, { name: 'Ada', port: '9090', tls: false }); // out of order — must be dropped
  await p0;
  expect(f.rawValues()).toEqual({ name: 'Ben', port: '7070', tls: true }); // still Ben
  expect(f.loading()).toBe(false); // the dropped older settle did not touch loading()
});

// ST-L10 (AC-10 · AR-PL2) — Disposal. (a) dispose aborts an in-flight load; a resolve/reject AFTER
// dispose writes no value or baseline and does not clear loading() to reflect the dead run. (b) AR-PL2:
// calling load() on an already-disposed form resolves false and never invokes the loader.
test('ST-L10 dispose aborts an in-flight load; late settle is a no-op; load-after-dispose returns false', async () => {
  vi.useFakeTimers();

  // (a) resolve-after-dispose
  const f = createForm({ schema: Schema, initial: makeInitial() });
  const d = deferredLoader<Raw>();
  const before = f.rawValues();
  const p = f.load(d.loader);
  expect(f.loading()).toBe(true);
  f.dispose();
  expect(d.signals[0].aborted).toBe(true);
  d.resolve(0, { name: 'Ada', port: '9090', tls: false });
  await p;
  expect(f.rawValues()).toEqual(before); // no value applied
  expect(f.dirty()).toBe(false); // baseline unchanged
  expect(f.loading()).toBe(true); // NOT cleared — the dead run is a true no-op

  // reject-after-dispose is likewise a no-op
  const f2 = createForm({ schema: Schema, initial: makeInitial() });
  const d2 = deferredLoader<Raw>();
  const before2 = f2.rawValues();
  const p2 = f2.load(d2.loader);
  f2.dispose();
  d2.reject(0, new Error('boom'));
  await p2;
  expect(f2.rawValues()).toEqual(before2);

  // (b) AR-PL2 — load on an already-disposed form: false, and the loader is never called.
  const f3 = createForm({ schema: Schema, initial: makeInitial() });
  f3.dispose();
  const spy = vi.fn(async () => ({ name: 'Ada', port: '9090', tls: false }));
  const ok = await f3.load(spy);
  expect(ok).toBe(false);
  expect(spy).not.toHaveBeenCalled();
});

// ST-L11 (AC-11) — a load clears a field's asyncError UNCONDITIONALLY (a verdict describes one value,
// and the value changed) — including when the loaded value is itself sync-invalid.
test('ST-L11 load clears a field asyncError unconditionally (even to a sync-invalid loaded value)', async () => {
  vi.useFakeTimers();
  const schema = z.object({ username: z.string().min(3, 'Min 3') });
  const form = createForm({
    schema,
    initial: { username: '' },
    asyncValidators: { username: (v) => Promise.resolve(v === 'taken' ? 'Already in use' : null) },
  });
  const field = form.field('username');

  field.value.set('taken'); // sync-clean → debounced run resolves an async error
  await vi.advanceTimersByTimeAsync(300);
  await vi.advanceTimersByTimeAsync(0);
  expect(field.asyncError()).toBe('Already in use');

  // Load a DIFFERENT, sync-INVALID value ('ab', length 2): the change fires the trigger effect, which
  // clears asyncError unconditionally — before (and independent of) any sync-clean gate.
  await form.load(async () => ({ username: 'ab' }));
  expect(field.asyncError()).toBeNull();
});

// ST-L12 (AC-12) — async re-validation on load runs ONLY for a sync-clean loaded value: a sync-clean
// change schedules the validator with the loaded value; a sync-invalid one is gated out.
test('ST-L12 a sync-clean loaded value schedules the async validator; a sync-invalid one does not', async () => {
  vi.useFakeTimers();
  const schema = z.object({ username: z.string().min(3, 'Min 3') });
  const calls: string[] = [];
  const form = createForm({
    schema,
    initial: { username: '' },
    asyncValidators: {
      username: (v) => {
        calls.push(v);
        return Promise.resolve(null);
      },
    },
  });

  // sync-CLEAN, different value → schedules a debounced run WITH the loaded value.
  await form.load(async () => ({ username: 'clean' }));
  await vi.advanceTimersByTimeAsync(300);
  await vi.advanceTimersByTimeAsync(0);
  expect(calls).toEqual(['clean']);

  // sync-INVALID, different value → the sync-clean gate is closed → no run scheduled.
  await form.load(async () => ({ username: 'xy' })); // length 2 → invalid
  await vi.advanceTimersByTimeAsync(300);
  expect(calls).toEqual(['clean']); // unchanged — 'xy' never scheduled
});
