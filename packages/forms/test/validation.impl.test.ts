/**
 * Implementation tests for @jsvision/forms validation — routing edges beyond the spec
 * oracles (form-level vs field-routed issue separation, first-issue ordering).
 */
import { test, expect } from 'vitest';
import { z } from 'zod';
import { createForm } from '../src/index.js';
import { Schema, makeInitial } from './fixtures.js';

// When every issue is field-routed, form.errors() (path-less) is empty.
test('impl: errors() holds only path-less issues, never field-routed ones', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.field('port').value.set('23'); // tls already true → refine at ['port']
  // name:'' is a field issue, the refine is field-routed to ['port'] → nothing path-less.
  expect(f.errors()).toEqual([]);
  expect(f.field('name').error()).not.toBeNull();
  expect(f.field('port').error()?.message).toBe('TLS not on 23');
});

// field.error() returns the FIRST issue when a field fails several checks.
test('impl: field.error() returns the first issue for a field', () => {
  const schema = z.object({
    code: z.string().min(5, 'too short').regex(/^\d+$/, 'digits only'),
  });
  const f = createForm({ schema, initial: { code: 'ab' } }); // fails min AND regex
  const err = f.field('code').error();
  expect(err).not.toBeNull();
  expect(err!.message).toBe('too short'); // checks run in declared order
});

// A valid form surfaces no field errors and no form-level errors.
test('impl: a valid form has no field or form-level errors', () => {
  const f = createForm({ schema: Schema, initial: makeInitial() });
  f.field('name').value.set('db');
  expect(f.isValid()).toBe(true);
  expect(f.errors()).toEqual([]);
  expect(f.field('name').error()).toBeNull();
  expect(f.field('port').error()).toBeNull();
  expect(f.field('tls').error()).toBeNull();
});
