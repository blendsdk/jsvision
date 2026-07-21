/**
 * Specification tests (immutable oracles) for @jsvision/forms validation — ST-11…ST-17.
 * Derived from the requirements only; a failing spec test means the implementation is wrong.
 */
import { test, expect, vi } from 'vitest';
import { createForm } from '../src/index.js';
import { Schema, makeInitial, CrossSchema, makeCrossInitial } from './fixtures.js';

// ST-11 — one memoized safeParse recompute per raw change drives every derivation.
test('ST-11 a single safeParse recompute serves all readers after one change', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.isValid(); // prime the memoized validation computed
  const spy = vi.spyOn(Schema, 'safeParse');
  f.field('name').value.set('db'); // exactly one raw change
  // Many readers…
  f.field('name').error();
  f.field('port').error();
  f.isValid();
  f.values();
  f.errors();
  // …one recompute.
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});

// ST-12 — field.error() is the first issue for that field, live before any touch.
test('ST-12 field.error() is the first field issue, live pre-touch', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  expect(f.field('name').error()?.message).toBe('Required');
  f.field('name').value.set('db');
  expect(f.field('name').error()).toBeNull();
});

// ST-13 — a path-less refine issue routes to form.errors(), never a field.
test('ST-13 a path-less refine routes to form.errors(), not any field', () => {
  const f = createForm({ schema: CrossSchema, initial: makeCrossInitial() });
  f.field('a').value.set('x'); // a='x', b='' → a≠b (path-less refine fails) and b still invalid
  expect(f.errors().some((i) => i.message === 'a and b must match')).toBe(true);
  // The cross message surfaces in NO field.
  expect(f.field('a').error()?.message).not.toBe('a and b must match');
  expect(f.field('b').error()?.message).not.toBe('a and b must match');
  // 'a' is now valid and field-clean; 'b' keeps its own issue.
  expect(f.field('a').error()).toBeNull();
  expect(f.field('b').error()).not.toBeNull();
});

// ST-14 — a refine carrying path:['port'] surfaces at field('port').
test('ST-14 a field-routed refine surfaces at that field', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.field('name').value.set('db'); // isolate the refine
  f.field('port').value.set('23'); // tls already true → refine fails at ['port']
  expect(f.field('port').error()?.message).toBe('TLS not on 23');
});

// ST-15 — z.coerce.number() coercion on success and failure.
test('ST-15 coercion succeeds to a number and fails cleanly', () => {
  const ok = createForm({ schema: Schema, initial: makeInitial() });
  ok.field('name').value.set('db');
  ok.field('port').value.set('42');
  expect(ok.values()?.port).toBe(42);

  const bad = createForm({ schema: Schema, initial: makeInitial() });
  bad.field('name').value.set('db');
  bad.field('port').value.set('x'); // not coercible → invalid
  expect(bad.field('port').error()).not.toBeNull();
  expect(bad.values()).toBeNull();
});

// ST-16 — the author's custom message is surfaced verbatim.
test('ST-16 the schema message passes through verbatim', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.field('name').value.set('db');
  f.field('port').value.set('0'); // below min(1)
  expect(f.field('port').error()?.message).toBe('Min 1');
});

// ST-17 — submit() sets every touched signal; error() is never gated by touched.
test('ST-17 submit() sets all touched; error() is ungated by touched', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  const before = f.field('name').error();
  expect(before?.message).toBe('Required');
  expect(f.field('name').touched()).toBe(false);

  await f.submit(() => {}); // marks all touched

  expect(f.field('name').touched()).toBe(true);
  expect(f.field('port').touched()).toBe(true);
  expect(f.field('tls').touched()).toBe(true);
  const after = f.field('name').error();
  expect(after?.message).toBe(before?.message); // identical regardless of touched
});
