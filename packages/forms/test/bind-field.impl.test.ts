/**
 * Implementation tests for bindField + direct binding — idempotency, the foreign-handle throw, focus
 * cycles, and the store→widget direction. These cover internals and edges beyond the spec oracles.
 */
import { test, expect, vi } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, Input, Switch, createEventLoop, signal } from '@jsvision/ui';
import { z } from 'zod';
import { createForm, bindField, FormFieldError } from '../src/index.js';
import type { Field } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

function row(loop: ReturnType<typeof createEventLoop>, width: number, y = 0): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let x = 0; x < width; x++) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

/** Build a two-input form + mounted loop, with bindField wired on inputA. */
function twoInputForm() {
  const form = createForm({ schema: z.object({ a: z.string(), b: z.string() }), initial: { a: '', b: '' } });
  const fieldA = form.field('a');
  const inputA = new Input({ value: fieldA.value });
  const inputB = new Input({ value: form.field('b').value });
  const root = new Group();
  root.layout = { direction: 'col' };
  inputA.layout = { size: { kind: 'fixed', cells: 1 } };
  inputB.layout = { size: { kind: 'fixed', cells: 1 } };
  root.add(inputA);
  root.add(inputB);
  return { form, fieldA, inputA, inputB, root };
}

test('bindField is idempotent per (field, view): a repeat call wires the effect once', () => {
  const { fieldA, inputA } = twoInputForm();
  const spy = vi.spyOn(inputA, 'onMount'); // spy AFTER construction (the Input's own onMount already ran)
  bindField(fieldA, inputA);
  bindField(fieldA, inputA);
  bindField(fieldA, inputA);
  expect(spy).toHaveBeenCalledTimes(1);
});

test('bindField throws FormFieldError for a foreign field handle', () => {
  const foreign: Field<string> = {
    name: 'ghost',
    value: signal(''),
    error: () => null,
    touched: () => false,
    dirty: () => false,
    validating: () => false,
    asyncError: () => null,
  };
  const view = new Input({ value: signal('') });
  expect(() => bindField(foreign, view)).toThrow(FormFieldError);
  expect(() => bindField(foreign, view)).toThrow(/ghost/);
});

test('bindField: focus-in without a leave never touches; repeated enter/leave keep touched true', () => {
  const { fieldA, inputA, inputB, root } = twoInputForm();
  bindField(fieldA, inputA);
  const loop = createEventLoop({ width: 12, height: 4 }, { caps });
  loop.mount(root);

  loop.focusView(inputA); // enter, no leave
  expect(fieldA.touched()).toBe(false);
  loop.focusView(inputB); // first leave
  expect(fieldA.touched()).toBe(true);
  loop.focusView(inputA); // re-enter
  loop.focusView(inputB); // leave again
  expect(fieldA.touched()).toBe(true); // stays true across cycles
});

test('direct bind store→widget: an external set repaints Input and Switch', () => {
  // Input
  const textForm = createForm({ schema: z.object({ name: z.string() }), initial: { name: '' } });
  const nameField = textForm.field('name');
  const input = new Input({ value: nameField.value });
  const inputRoot = new Group();
  inputRoot.layout = { direction: 'col' };
  input.layout = { size: { kind: 'fixed', cells: 1 } };
  inputRoot.add(input);
  const inputLoop = createEventLoop({ width: 12, height: 2 }, { caps });
  inputLoop.mount(inputRoot);
  nameField.value.set('hi');
  inputLoop.renderRoot.flush();
  expect(row(inputLoop, 12)).toContain('hi');

  // Switch
  const boolForm = createForm({ schema: z.object({ on: z.boolean() }), initial: { on: false } });
  const onField = boolForm.field('on');
  const sw = new Switch({ value: onField.value });
  const swRoot = new Group();
  swRoot.layout = { direction: 'col' };
  sw.layout = { size: { kind: 'fixed', cells: 1 } };
  swRoot.add(sw);
  const swLoop = createEventLoop({ width: 16, height: 2 }, { caps });
  swLoop.mount(swRoot);
  onField.value.set(true);
  swLoop.renderRoot.flush();
  expect(row(swLoop, 16)).toContain('On');
});

function keyEvent(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}

test('bindField after mount is honored (onMount runs immediately once mounted)', () => {
  const { fieldA, inputA, root } = twoInputForm(); // inputB stays in the tree as the Tab target
  const loop = createEventLoop({ width: 12, height: 4 }, { caps });
  loop.mount(root);
  loop.focusView(inputA);
  bindField(fieldA, inputA); // wired after mount + focus-in
  expect(fieldA.touched()).toBe(false);
  loop.dispatch(keyEvent('tab')); // Tab moves focus off inputA → a leave
  expect(fieldA.touched()).toBe(true);
});
