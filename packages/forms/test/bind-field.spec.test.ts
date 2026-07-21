/**
 * Specification tests (immutable oracles) for widget binding — ST-01…ST-03.
 * Derived from the requirements only (RD-03 AC-1/AC-2, FR-3.1/FR-3.2); a failing spec test means the
 * implementation is wrong, never the test. `Input`/`Switch` are exercised as real widgets and focus
 * is driven through a real `EventLoop`, so the specs cannot encode a mis-decode of the focus order.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, Input, Switch, createEventLoop } from '@jsvision/ui';
import { z } from 'zod';
import { createForm, bindField } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** A key event with no modifiers held. */
function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}

/** Read the rendered text of row `y` across `width` columns (pre-serialize buffer chars). */
function row(loop: ReturnType<typeof createEventLoop>, width: number, y = 0): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let x = 0; x < width; x++) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

// ST-01 — a text field bound directly to `field.value` is two-way (AC-1, FR-3.1).
test('ST-01: direct text bind is two-way', () => {
  const schema = z.object({ name: z.string().min(1, 'Required') });
  const form = createForm({ schema, initial: { name: '' } });
  const field = form.field('name');

  const input = new Input({ value: field.value });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(input);
  const loop = createEventLoop({ width: 12, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);

  // widget → store: typing writes the bound signal, and the form validates on the domain value.
  loop.dispatch(key('d'));
  loop.dispatch(key('b'));
  expect(field.value()).toBe('db');
  expect(form.values()).toEqual({ name: 'db' });
  expect(form.isValid()).toBe(true);

  // store → widget: an external set repaints the field with the new text. A set outside a dispatch
  // tick coalesces its paint onto a microtask, so flush to observe the settled frame synchronously.
  field.value.set('x');
  loop.renderRoot.flush();
  expect(row(loop, 12)).toContain('x');
});

// ST-02 — a boolean field bound directly to a `Switch` is two-way (FR-3.1).
test('ST-02: direct boolean bind is two-way', () => {
  const schema = z.object({ on: z.boolean() });
  const form = createForm({ schema, initial: { on: false } });
  const field = form.field('on');

  const sw = new Switch({ value: field.value });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  sw.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(sw);
  const loop = createEventLoop({ width: 16, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(sw);

  // widget → store: Space toggles the switch, writing the bound signal.
  loop.dispatch(key('space'));
  expect(field.value()).toBe(true);
  expect(form.values()?.on).toBe(true);
  expect(row(loop, 16)).toContain('On');

  // store → widget: an external set repaints the switch in the off state. A set outside a dispatch
  // tick coalesces its paint onto a microtask, so flush to observe the settled frame synchronously.
  field.value.set(false);
  loop.renderRoot.flush();
  expect(row(loop, 16)).toContain('Off');
});

// ST-03 — bindField marks touched on the FIRST focus-leave: never on mount, never on enter, once on
// leave, and torn down with the view (AC-2, FR-3.2).
test('ST-03: bindField sets touched on first focus-leave (not on mount/enter), cleaned up on unmount', () => {
  const schema = z.object({ a: z.string(), b: z.string() });
  const form = createForm({ schema, initial: { a: '', b: '' } });
  const fieldA = form.field('a');

  const inputA = new Input({ value: fieldA.value });
  const inputB = new Input({ value: form.field('b').value });
  const root = new Group();
  root.setLayout({ direction: 'col' });
  inputA.setLayout({ size: { kind: 'fixed', cells: 1 } });
  inputB.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(inputA);
  root.add(inputB);
  bindField(fieldA, inputA);

  const loop = createEventLoop({ width: 12, height: 4 }, { caps });
  loop.mount(root);

  expect(fieldA.touched()).toBe(false); // not on mount
  loop.focusView(inputA);
  expect(fieldA.touched()).toBe(false); // not on enter
  loop.focusView(inputB);
  expect(fieldA.touched()).toBe(true); // on first leave

  // cleaned up on unmount — a fresh field/input, focused in (still untouched), then disposed.
  const form2 = createForm({ schema, initial: { a: '', b: '' } });
  const f2 = form2.field('a');
  const in2 = new Input({ value: f2.value });
  const other = new Input({ value: form2.field('b').value });
  const root2 = new Group();
  root2.setLayout({ direction: 'col' });
  in2.setLayout({ size: { kind: 'fixed', cells: 1 } });
  other.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root2.add(in2);
  root2.add(other);
  bindField(f2, in2);
  const loop2 = createEventLoop({ width: 12, height: 4 }, { caps });
  loop2.mount(root2);
  loop2.focusView(in2);
  expect(f2.touched()).toBe(false);

  root2.remove(in2); // dispose the view's scope → the touched effect is gone
  // A detached view has no focus manager, so hand-poke a would-be leave to prove the effect is gone.
  in2.state.focused = false;
  in2.focusSignal().set(undefined);
  expect(f2.touched()).toBe(false);
});
