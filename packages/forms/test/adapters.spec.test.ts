/**
 * Specification tests (immutable oracles) for the choice adapters — ST-04…ST-07.
 * Derived from the requirements only (RD-03 AC-3/AC-4/AC-5, FR-3.3/FR-3.4/FR-3.5); a failing spec
 * test means the implementation is wrong, never the test. The lens mechanics are tested directly and
 * ST-06 drives real `RadioGroup`/`CheckGroup` widgets through a real `EventLoop` end-to-end.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, RadioGroup, CheckGroup, createEventLoop, createRoot, effect } from '@jsvision/ui';
import { z } from 'zod';
import { createForm, bindRadio, bindCheck } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** A key event with no modifiers held. */
function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}

// ST-04 — bindRadio is a stateless domain-value ⇄ selected-index lens (AC-3, FR-3.3).
// A plain-string domain is used here so an out-of-options value is natural to express; ST-06 covers
// the enum-domain end-to-end fidelity.
test('ST-04: bindRadio lens maps domain value ⇄ index', () => {
  const form = createForm({ schema: z.object({ pick: z.string() }), initial: { pick: 'a' } });
  const field = form.field('pick');
  const sel = bindRadio(field, ['a', 'b', 'c']);

  expect(sel()).toBe(0);
  sel.set(1);
  expect(field.value()).toBe('b');
  field.value.set('z'); // not in options
  expect(sel()).toBe(-1);

  // .peek() reads without subscribing: an effect that only peeks does not re-run on a field change.
  let runs = 0;
  const dispose = createRoot((d) => {
    effect(() => {
      runs += 1;
      sel.peek();
    });
    return d;
  });
  expect(runs).toBe(1);
  field.value.set('a');
  expect(runs).toBe(1);
  dispose();
});

// ST-05 — bindCheck is a stateless selected-values ⇄ per-option-flags lens (AC-4, FR-3.4).
test('ST-05: bindCheck lens maps selected values ⇄ flags', () => {
  const form = createForm({
    schema: z.object({ tags: z.array(z.enum(['x', 'y', 'z'])) }),
    initial: { tags: ['x', 'z'] },
  });
  const field = form.field('tags');
  const chk = bindCheck(field, ['x', 'y', 'z']);

  expect(chk()).toEqual([true, false, true]);

  chk.set([false, true, true]);
  expect(field.value()).toEqual(['y', 'z']); // written back in option order

  // toggling one flag updates the selected-values array accordingly.
  chk.set([true, true, true]);
  expect(field.value()).toEqual(['x', 'y', 'z']);
  chk.set([false, false, false]);
  expect(field.value()).toEqual([]);
});

// ST-06 — choice widgets keep the schema in domain terms (AC-5): validation runs on the enum, never
// an index. Driven end-to-end through real widgets on a real loop.
test('ST-06: choice widgets keep the domain schema (radio + check)', () => {
  // radio half — z.enum
  const radioForm = createForm({
    schema: z.object({ align: z.enum(['left', 'center', 'right']) }),
    initial: { align: 'left' },
  });
  const alignField = radioForm.field('align');
  const radio = new RadioGroup({
    labels: ['~L~eft', '~C~enter', '~R~ight'],
    value: bindRadio(alignField, ['left', 'center', 'right']),
  });
  const radioRoot = new Group();
  radioRoot.layout = { direction: 'col' };
  radio.layout = { size: { kind: 'fixed', cells: 3 } };
  radioRoot.add(radio);
  const radioLoop = createEventLoop({ width: 20, height: 4 }, { caps });
  radioLoop.mount(radioRoot);
  radioLoop.focusView(radio);

  radioLoop.dispatch(key('down')); // left → center
  radioLoop.dispatch(key('down')); // center → right
  expect(alignField.value()).toBe('right');
  expect(radioForm.values()).toEqual({ align: 'right' });
  expect(radioForm.isValid()).toBe(true);

  // check half — z.array(z.enum)
  const checkForm = createForm({
    schema: z.object({ styles: z.array(z.enum(['bold', 'italic'])) }),
    initial: { styles: [] as Array<'bold' | 'italic'> },
  });
  const stylesField = checkForm.field('styles');
  const checks = new CheckGroup({
    labels: ['~B~old', '~I~talic'],
    value: bindCheck(stylesField, ['bold', 'italic']),
  });
  const checkRoot = new Group();
  checkRoot.layout = { direction: 'col' };
  checks.layout = { size: { kind: 'fixed', cells: 2 } };
  checkRoot.add(checks);
  const checkLoop = createEventLoop({ width: 20, height: 3 }, { caps });
  checkLoop.mount(checkRoot);
  checkLoop.focusView(checks);

  checkLoop.dispatch(key('space')); // toggle the focused item (Bold) on
  expect(stylesField.value()).toEqual(['bold']);
  expect(checkForm.values()).toEqual({ styles: ['bold'] });
  expect(checkForm.isValid()).toBe(true);
});

// ST-07 — the adapters are pure lenses: no stored state, nothing to dispose (FR-3.5).
test('ST-07: adapters are pure lenses', () => {
  const form = createForm({ schema: z.object({ pick: z.string() }), initial: { pick: 'a' } });
  const field = form.field('pick');

  // Two lenses over the same field behave equivalently.
  const s1 = bindRadio(field, ['a', 'b', 'c']);
  const s2 = bindRadio(field, ['a', 'b', 'c']);
  expect(s1()).toBe(s2());
  s1.set(2);
  expect(field.value()).toBe('c');
  expect(s2()).toBe(2);

  // Creating a lens and dropping it leaves the field untouched — no stored state, nothing to clean up.
  const before = field.value();
  bindRadio(field, ['a', 'b', 'c']);
  bindCheck(createForm({ schema: z.object({ t: z.array(z.string()) }), initial: { t: [] } }).field('t'), ['a']);
  expect(field.value()).toBe(before);
});
