/**
 * Implementation tests for @jsvision/forms async loading — the internals the ST-L* spec oracles do
 * not reach: the loader's AbortSignal firing on every teardown path, the enclosing-scope disposal
 * seam, the two-clone (value ≠ baseline) discipline, the changed-fields-only async re-validation
 * micro-edge, and the missing-key contract. Unlike the spec oracles these may probe internal shape.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { createRoot } from '@jsvision/ui';
import { createForm } from '../src/index.js';
import { Schema, makeInitial, ArraySchema, makeArrayInitial } from './fixtures.js';

type Raw = ReturnType<typeof makeInitial>;

afterEach(() => {
  vi.useRealTimers();
});

/** A loader whose settlement the test controls by index; records each call's AbortSignal. */
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

// The loader is handed a live AbortSignal that aborts when a newer load supersedes it and when the
// form is disposed directly. (The enclosing-scope teardown path is the next test.)
test('the loader receives a live AbortSignal that fires on supersede and on form.dispose()', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  const d = deferredLoader<Raw>();

  const p0 = f.load(d.loader);
  const p1 = f.load(d.loader); // supersede
  expect(d.signals[0].aborted).toBe(true); // superseded → aborted
  expect(d.signals[1].aborted).toBe(false); // current → still live

  f.dispose();
  expect(d.signals[1].aborted).toBe(true); // dispose aborts the in-flight load

  // Settle both so no promise dangles; both must drop (one superseded, one disposed) and apply nothing.
  d.resolve(0, { name: 'A', port: '1', tls: false });
  d.resolve(1, { name: 'B', port: '2', tls: false });
  await Promise.all([p0, p1]);
  expect(f.rawValues()).toEqual(makeInitial());
});

// The root-body onCleanup seam — not a returned dispose wrapper — is why an ENCLOSING scope's teardown
// (a parent createRoot the form was built inside) also aborts an in-flight load and no-ops its late
// settle. A wrapper would miss this: an owning parent never calls form.dispose().
test('enclosing-scope disposal aborts an in-flight load and no-ops its late settle', async () => {
  const { form, dispose: outerDispose } = createRoot((dispose) => ({
    form: createForm({ schema: Schema, initial: makeInitial() }),
    dispose,
  }));
  const d = deferredLoader<Raw>();

  const p = form.load(d.loader);
  expect(d.signals[0].aborted).toBe(false);
  const before = form.rawValues();

  outerDispose(); // tear down the ENCLOSING scope — NOT form.dispose()
  expect(d.signals[0].aborted).toBe(true); // the root-body onCleanup fired on parent teardown

  d.resolve(0, { name: 'Ada', port: '9090', tls: false });
  await p;
  expect(form.rawValues()).toEqual(before); // no value applied
  expect(form.dirty()).toBe(false); // baseline unchanged
  expect(form.loading()).toBe(true); // not cleared — the dead run is a true no-op
});

// PF-203 — the value signal and the baseline each get their OWN clone of the loaded field, so an
// in-place edit of the live array cannot leak into the baseline. A single shared clone would make the
// two alias and this dirty() would stay false (the bug).
test('load clones baseline and value independently — an in-place array edit does not touch baseline', async () => {
  const f = createForm({ schema: ArraySchema, initial: makeArrayInitial() });
  await f.load(async () => ({ flags: [false, true] }));
  expect(f.field('flags').dirty()).toBe(false);

  f.field('flags').value().push(true); // mutate the live array in place (no .set → no notify)
  expect(f.field('flags').dirty()).toBe(true); // baseline is an independent clone → divergence shows
});

// Changed-fields-only: load writes each value signal, but a signal skips an equal write, so the async
// trigger effect re-fires only for fields whose loaded value actually differs. An unchanged async
// field keeps its prior asyncError; a changed one has it cleared.
test('load re-validates only changed async fields; an equal write leaves asyncError intact', async () => {
  vi.useFakeTimers();
  const form = createForm({
    schema: z.object({ a: z.string(), b: z.string() }),
    initial: { a: '', b: '' },
    asyncValidators: {
      a: (v) => Promise.resolve(v === 'taken' ? 'A taken' : null),
      b: (v) => Promise.resolve(v === 'taken' ? 'B taken' : null),
    },
  });
  form.field('a').value.set('taken');
  form.field('b').value.set('taken');
  await vi.advanceTimersByTimeAsync(300);
  await vi.advanceTimersByTimeAsync(0);
  expect(form.field('a').asyncError()).toBe('A taken');
  expect(form.field('b').asyncError()).toBe('B taken');

  // Load CHANGES a (→ 'free') but leaves b EQUAL ('taken'): only a's effect fires.
  await form.load(async () => ({ a: 'free', b: 'taken' }));
  expect(form.field('a').asyncError()).toBeNull(); // changed → cleared
  expect(form.field('b').asyncError()).toBe('B taken'); // equal write → effect never fired → intact
});

// Missing-key contract: a loader that resolves a record omitting a key sets that field AND its
// baseline to `undefined`, so the field reads dirty() false (baseline matches the applied value).
test('a loader omitting a key sets that field and its baseline to undefined (dirty false)', async () => {
  const form = createForm({ schema: z.object({ a: z.string(), b: z.string() }), initial: { a: 'x', b: 'y' } });
  // The Promise<I> type normally forbids a partial record; the store's contract is that a missing key
  // becomes undefined. A Record view models the out-of-contract partial without an `any`/`unknown` cast.
  const partial: Record<string, unknown> = { a: 'loaded' }; // 'b' omitted
  await form.load(async () => partial as { a: string; b: string });

  expect(form.rawValues().a).toBe('loaded');
  expect(form.rawValues().b).toBeUndefined();
  expect(form.field('b').dirty()).toBe(false); // baseline is also undefined → matches
});

// File size stays inside the 200–500 target after the load additions (actual ≈ 280). A RANGE with
// headroom — not an exact count — so incidental ±line edits don't make this a brittle tripwire, while
// it still catches real bloat well before the 500 hard ceiling.
test('create-form.ts stays within the 200–500 line target after the load additions', () => {
  const src = readFileSync(new URL('../src/create-form.ts', import.meta.url), 'utf8');
  const lines = src.trimEnd().split('\n').length; // true line count (ignore the trailing newline)
  expect(lines).toBeGreaterThan(200);
  expect(lines).toBeLessThanOrEqual(300);
});
