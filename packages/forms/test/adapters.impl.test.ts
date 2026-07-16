/**
 * Implementation tests for the choice adapters — `.update` routing, out-of-range / flag-length edges,
 * and empty options. These cover internals and edges beyond the ST oracles.
 */
import { test, expect } from 'vitest';
import { z } from 'zod';
import { createForm, bindRadio, bindCheck } from '../src/index.js';

test('bindRadio.update routes through set(fn(peek()))', () => {
  const form = createForm({ schema: z.object({ pick: z.string() }), initial: { pick: 'a' } });
  const field = form.field('pick');
  const sel = bindRadio(field, ['a', 'b', 'c']);
  sel.update((i) => i + 1); // 0 → 1
  expect(field.value()).toBe('b');
  sel.update((i) => i + 1); // 1 → 2
  expect(field.value()).toBe('c');
});

test('bindRadio.set out of range writes undefined (documented no-guard)', () => {
  const form = createForm({ schema: z.object({ pick: z.string() }), initial: { pick: 'a' } });
  const field = form.field('pick');
  const sel = bindRadio(field, ['a', 'b', 'c']);
  sel.set(9);
  expect(field.value()).toBeUndefined();
  sel.set(-1);
  expect(field.value()).toBeUndefined();
});

test('bindRadio over empty options reads -1', () => {
  const form = createForm({ schema: z.object({ pick: z.string() }), initial: { pick: 'a' } });
  const sel = bindRadio(form.field('pick'), []);
  expect(sel()).toBe(-1);
  expect(sel.peek()).toBe(-1);
});

test('bindCheck.update routes through set(fn(peek()))', () => {
  const form = createForm({
    schema: z.object({ tags: z.array(z.enum(['x', 'y', 'z'])) }),
    initial: { tags: ['x'] as Array<'x' | 'y' | 'z'> },
  });
  const field = form.field('tags');
  const chk = bindCheck(field, ['x', 'y', 'z']);
  chk.update((flags) => flags.map((f, i) => (i === 1 ? true : f))); // also select 'y'
  expect(field.value()).toEqual(['x', 'y']);
});

test('bindCheck.set tolerates a shorter or longer flag array', () => {
  const form = createForm({
    schema: z.object({ tags: z.array(z.enum(['x', 'y', 'z'])) }),
    initial: { tags: [] as Array<'x' | 'y' | 'z'> },
  });
  const field = form.field('tags');
  const chk = bindCheck(field, ['x', 'y', 'z']);

  chk.set([true]); // shorter than options → only the provided flags count
  expect(field.value()).toEqual(['x']);

  chk.set([true, false, true, true]); // longer than options → extra flags ignored
  expect(field.value()).toEqual(['x', 'z']);
});

test('bindCheck over empty options reads [] and set([]) leaves []', () => {
  const form = createForm({ schema: z.object({ tags: z.array(z.string()) }), initial: { tags: [] } });
  const field = form.field('tags');
  const chk = bindCheck(field, []);
  expect(chk()).toEqual([]);
  chk.set([]);
  expect(field.value()).toEqual([]);
});
