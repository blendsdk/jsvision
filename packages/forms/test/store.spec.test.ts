/**
 * Specification tests (immutable oracles) for the @jsvision/forms store — ST-01…ST-10.
 * Derived from the requirements only; a failing spec test means the implementation is wrong.
 */
import { test, expect, vi } from 'vitest';
import { createForm, FormFieldError } from '../src/index.js';
import { Schema, makeInitial, ArraySchema, makeArrayInitial } from './fixtures.js';

// ST-01 — the value model is the store-owned raw signal, written two-way.
test('ST-01 field.value is the store-owned signal (two-way, stable ref)', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  const field = f.field('name');
  field.value.set('db');
  expect(f.rawValues().name).toBe('db');
  // Re-reading the handle yields the same signal reference.
  expect(f.field('name').value).toBe(field.value);
});

// ST-02 — field handles are stable (memoized) per name.
test('ST-02 field(name) returns the same handle every call', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  expect(f.field('name')).toBe(f.field('name'));
});

// ST-03 — rawValues() is always available, independent of validity.
test('ST-03 rawValues() reflects the current raw snapshot', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  expect(f.rawValues()).toEqual({ name: '', port: '8080', tls: true });
  f.field('port').value.set('9090');
  expect(f.rawValues()).toEqual({ name: '', port: '9090', tls: true });
});

// ST-04 — values() is the coerced output only when valid, else null.
test('ST-04 values() is coerced when valid and null when invalid', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  expect(f.values()).toBeNull(); // name:'' → invalid
  f.field('name').value.set('db');
  expect(f.values()).toEqual({ name: 'db', port: 8080, tls: true }); // port coerced to a number
  expect(typeof f.values()!.port).toBe('number');
});

// ST-05 — dirty tracking, including element-wise array comparison.
test('ST-05 dirty() reflects divergence from baseline (arrays compared element-wise)', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  expect(f.field('name').dirty()).toBe(false);
  expect(f.dirty()).toBe(false);
  f.field('name').value.set('x');
  expect(f.field('name').dirty()).toBe(true);
  expect(f.dirty()).toBe(true);

  const fa = createForm({ schema: ArraySchema, initial: makeArrayInitial() });
  expect(fa.field('flags').dirty()).toBe(false);
  fa.field('flags').value.set([true, false]); // same elements, new array reference
  expect(fa.field('flags').dirty()).toBe(false); // element-wise ⇒ not dirty
  fa.field('flags').value.set([false, false]); // changed element
  expect(fa.field('flags').dirty()).toBe(true);
});

// ST-06 — reset() restores baseline values and clears dirty + touched.
test('ST-06 reset() restores values and clears dirty + touched', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.field('name').value.set('x');
  await f.submit(() => {}); // marks every field touched
  expect(f.field('name').touched()).toBe(true);

  f.reset();
  expect(f.rawValues()).toEqual(makeInitial());
  expect(f.field('name').dirty()).toBe(false);
  expect(f.dirty()).toBe(false);
  expect(f.field('name').touched()).toBe(false);
});

// ST-07 — isValid() reflects actual validity, live before any touch.
test('ST-07 isValid() is live pre-touch', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  expect(f.isValid()).toBe(false); // all-empty required form
  f.field('name').value.set('db');
  expect(f.isValid()).toBe(true); // without touching anything
});

// ST-08 — submit() marks all touched, gates onValid on validity, passes coerced values.
test('ST-08 submit() gates onValid and passes coerced values', async () => {
  const invalid = createForm({ schema: Schema, initial: makeInitial() });
  const spy = vi.fn();
  await expect(invalid.submit(spy)).resolves.toBe(false);
  expect(spy).not.toHaveBeenCalled();
  expect(invalid.field('name').touched()).toBe(true);
  expect(invalid.field('port').touched()).toBe(true);
  expect(invalid.field('tls').touched()).toBe(true);

  const valid = createForm({ schema: Schema, initial: makeInitial() });
  valid.field('name').value.set('db');
  const onValid = vi.fn();
  await expect(valid.submit(onValid)).resolves.toBe(true);
  expect(onValid).toHaveBeenCalledTimes(1);
  expect(onValid.mock.calls[0][0]).toEqual({ name: 'db', port: 8080, tls: true });
  expect(typeof onValid.mock.calls[0][0].port).toBe('number');
});

// ST-09 — an unknown field key throws FormFieldError.
test('ST-09 field(unknown) throws FormFieldError naming the field', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  expect(() => f.field('nope' as never)).toThrow(FormFieldError);
  expect(() => f.field('nope' as never)).toThrow(/nope/);
});

// ST-10 — the store is owner-scoped: no dev warning, no public dispose.
test('ST-10 createForm emits no dev warning and exposes no dispose', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const f = createForm({ schema: Schema, initial: makeInitial() });
  expect(warn).not.toHaveBeenCalled();
  expect('dispose' in (f as object)).toBe(false);
  warn.mockRestore();
});
