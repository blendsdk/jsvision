/**
 * Implementation tests for the @jsvision/forms store — internals and edges beyond the
 * spec oracles. These MAY be derived from the implementation (defensive snapshotting,
 * array-dirty edges, async submit, non-aliasing of the coerced output).
 *
 * Note: the submit-attempted flag is intentionally latent this slice (set by submit(),
 * cleared by reset(), read by nothing), so it has no black-box assertion — reset()'s
 * observable effects (values + touched) are covered by the store spec.
 */
import { test, expect, vi } from 'vitest';
import { createForm } from '../src/index.js';
import { Schema, makeInitial, ArraySchema, makeArrayInitial } from './fixtures.js';

// Defensive snapshot: mutating a scalar in the caller's initial after createForm is inert.
test('impl: mutating initial after createForm does not affect the store', () => {
  const init = makeInitial();
  const f = createForm({ schema: Schema, initial: init });
  init.name = 'mutated';
  expect(f.rawValues().name).toBe('');
  expect(f.field('name').dirty()).toBe(false);
});

// Defensive snapshot: an initial array is copied, so in-place mutation of it is inert.
test('impl: an initial array is snapshotted (in-place mutation is inert)', () => {
  const init = makeArrayInitial();
  const f = createForm({ schema: ArraySchema, initial: init });
  init.flags.push(true); // mutate the original array in place
  expect(f.rawValues().flags).toEqual([true, false]);
  expect(f.field('flags').dirty()).toBe(false);
});

// Array dirty compares element-wise: same elements not dirty, length or element change dirty.
test('impl: array dirty edges — reference vs length vs element', () => {
  const f = createForm({ schema: ArraySchema, initial: makeArrayInitial() });
  f.field('flags').value.set([true, false]); // same elements, new reference
  expect(f.field('flags').dirty()).toBe(false);
  f.field('flags').value.set([true, false, true]); // different length
  expect(f.field('flags').dirty()).toBe(true);
  f.field('flags').value.set([false, false]); // same length, different element
  expect(f.field('flags').dirty()).toBe(true);
});

// submit awaits an async onValid before resolving true.
test('impl: submit awaits an async onValid before resolving true', async () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.field('name').value.set('db'); // valid
  let done = false;
  const pending = f.submit(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    done = true;
  });
  expect(done).toBe(false); // onValid is in flight, submit not yet resolved
  await expect(pending).resolves.toBe(true);
  expect(done).toBe(true);
});

// values() returns Zod's own coerced object, not the live rawValues object.
test('impl: values() is Zod data, not aliased to rawValues or the store signals', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.field('name').value.set('db'); // valid
  const vals = f.values()!;
  expect(vals).not.toBe(f.rawValues()); // distinct object
  // Mutating the coerced output never reaches the store's signals.
  (vals as { name: string }).name = 'HACKED';
  expect(f.rawValues().name).toBe('db');
  expect(f.field('name').value.peek()).toBe('db');
});

// The store performs no validation work beyond the one memoized parse (guards regressions
// that would re-read a stale spy).
test('impl: no dev warning is emitted across a full create/mutate/submit cycle', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.field('name').value.set('db');
  await f.submit(() => {});
  f.reset();
  expect(warn).not.toHaveBeenCalled();
  warn.mockRestore();
});
