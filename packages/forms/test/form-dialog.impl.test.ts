/**
 * Implementation tests (internals / edges) — `formDialog()` (`src/form-dialog.js`).
 *
 * Covers the non-spec internals the ST-D* oracles don't pin: focus landing on the first focusable body
 * view when the modal opens, the OK/Cancel button placement (absolute, centered pair on one row), and
 * the reactive OK-`disabled` seal (the OK button greys while a submit is in flight). Derived from the
 * factory body. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { z } from 'zod';
import { resolveCapabilities } from '@jsvision/core';
import { createEventLoop, Commands, Group, Input, Button, Text } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { formDialog, bindField } from '../src/index.js';
import type { Form } from '../src/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const Schema = z.object({ name: z.string().min(1, 'Required'), port: z.coerce.number().int().min(1) });
type Init = { name: string; port: string };
const initial: Init = { name: '', port: '8080' };

/** A manually-resolved deferred. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeHost(w = 60, h = 20) {
  const root = new Group();
  const loop = createEventLoop({ width: w, height: h }, { caps });
  loop.mount(root);
  const added: View[] = [];
  const host = {
    loop,
    desktop: {
      addWindow: (v: View) => {
        added.push(v);
        root.add(v);
      },
      removeWindow: (v: View) => root.remove(v),
      bounds: { x: 0, y: 0, width: w, height: h },
    },
  };
  return { loop, host, added };
}

/**
 * All descendants of a view, in tree order. The OK/Cancel pair sits inside a centred band rather than
 * directly on the dialog, so locating the buttons is a tree walk rather than a children scan.
 */
function descendants(v: View): View[] {
  const out: View[] = [];
  for (const c of (v as unknown as { children?: View[] }).children ?? []) out.push(c, ...descendants(c));
  return out;
}

/** The dialog's buttons, in tree order (OK then Cancel). */
function buttonsOf(dlg: Group): Button[] {
  return descendants(dlg).filter((c): c is Button => c instanceof Button);
}

function bodyInput(form: Form<typeof Schema, Init>): { view: View; input: Input } {
  const g = new Group();
  const input = new Input({ value: form.field('name').value });
  input.setLayout({ position: 'absolute', rect: { x: 2, y: 1, width: 24, height: 1 } });
  g.add(input);
  return { view: g, input };
}

test('impl: focus lands on the first focusable body view when the modal opens', async () => {
  const { loop, host } = makeHost();
  let input!: Input;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    body: (f) => {
      const b = bodyInput(f);
      input = b.input;
      return b.view;
    },
  });

  expect(input.state.focused).toBe(true); // execView's modal.begin → focusInto descends to the Input

  loop.emitCommand(Commands.cancel);
  await p;
});

test('impl: OK + Cancel sit as a centered pair on one row', async () => {
  const { loop, host, added } = makeHost();
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    okText: '~S~ave',
    body: (f) => bodyInput(f).view,
  });

  const dlg = added[0] as unknown as Group;
  const buttons = buttonsOf(dlg);
  expect(buttons.length).toBe(2); // OK + Cancel

  // Read the SOLVED placement rather than a static rect: the pair is laid out by a centred band, so
  // the buttons carry no rectangle of their own. What must hold is the arrangement, not the numbers.
  loop.renderRoot.flush();
  const rr = loop.renderRoot;
  const origins = buttons.map((b) => rr.originOf(b)!);
  expect(origins[0].y).toBe(origins[1].y); // one row
  expect(origins[0].x).toBeLessThan(origins[1].x); // OK left of Cancel
  const dlgOrigin = rr.originOf(dlg as unknown as View)!;
  const leftMargin = origins[0].x - dlgOrigin.x;
  const rightMargin = dlgOrigin.x + dlg.bounds.width - (origins[1].x + buttons[1].bounds.width);
  expect(leftMargin).toBe(rightMargin); // centered as a pair

  loop.emitCommand(Commands.cancel);
  await p;
});

test('impl: the caller body fills the dialog interior and renders (regression: no zero-width collapse)', async () => {
  const { loop, host } = makeHost();
  let bodyGroup!: Group;
  // A body whose only child is absolutely positioned — the common Label/Input-at-fixed-rects shape.
  // With no in-flow content the group's `auto` width would resolve to zero and clip everything inside
  // it, so the dialog showed only its frame + buttons (+ the focused caret). The fill fix must keep
  // the body spanning the interior so its bound value actually paints.
  const p = formDialog(host, {
    schema: Schema,
    initial: { name: 'ZequeXY', port: '8080' },
    width: 44,
    height: 9,
    body: (f) => {
      const g = new Group();
      const input = new Input({ value: f.field('name').value });
      input.setLayout({ position: 'absolute', rect: { x: 2, y: 1, width: 30, height: 1 } });
      g.add(input);
      bodyGroup = g;
      return g;
    },
  });

  loop.renderRoot.flush();
  expect(bodyGroup.bounds.width).toBeGreaterThan(0); // the body spans the interior, not a 0-wide collapse
  const painted = loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
  expect(painted).toContain('ZequeXY'); // the bound value is visible, not clipped away

  loop.emitCommand(Commands.cancel);
  await p;
});

test('impl: clicking Cancel discards without touching/validating the body (no error flash)', async () => {
  const { loop, host, added } = makeHost();
  let form!: Form<typeof Schema, Init>;
  let nameInput!: Input;
  const p = formDialog(host, {
    schema: Schema,
    initial, // name:'' → invalid; the error stays hidden until the field is touched
    width: 44,
    height: 9,
    body: (f) => {
      form = f;
      const g = new Group();
      const nf = f.field('name');
      nameInput = new Input({ value: nf.value });
      nameInput.setLayout({ position: 'absolute', rect: { x: 2, y: 1, width: 30, height: 1 } });
      bindField(nf, nameInput); // touched-on-first-blur reveal
      const err = new Text(() => (nf.touched() && nf.error() ? nf.error()!.message : ''), { severity: 'error' });
      err.setLayout({ position: 'absolute', rect: { x: 2, y: 3, width: 38, height: 1 } });
      g.add(nameInput);
      g.add(err);
      return g;
    },
  });
  loop.renderRoot.flush();
  loop.focusView(nameInput); // the user is editing the (invalid, empty) field

  const dlg = added[0] as unknown as Group;
  const cancel = buttonsOf(dlg)[1]; // [ok, cancel]
  const o = loop.renderRoot.originOf(cancel)!;
  // Mouse-down on Cancel must NOT blur the field (grabsFocus:false), so nothing is touched/revealed.
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: o.x + 2 + 1, y: o.y + 1 });
  loop.renderRoot.flush();
  expect(nameInput.state.focused).toBe(true); // focus stayed on the field — no blur
  expect(form.field('name').touched()).toBe(false); // never marked touched
  const painted = loop.renderRoot
    .buffer()
    .rows()
    .map((r) => r.map((c) => c.char).join(''))
    .join('\n');
  expect(painted).not.toContain('Required'); // no validation error flashed while cancelling

  loop.dispatch({ type: 'mouse', kind: 'up', button: 0, x: o.x + 2 + 1, y: o.y + 1 });
  expect(await p).toBeNull(); // the click still cancelled
});

test('impl: the OK button greys (state.disabled) while a submit is in flight, then re-enables', async () => {
  const { loop, host, added } = makeHost();
  const gate = deferred();
  let form!: Form<typeof Schema, Init>;
  const p = formDialog(host, {
    schema: Schema,
    initial,
    width: 44,
    height: 9,
    onSubmit: async () => {
      await gate.promise;
    },
    body: (f) => {
      form = f;
      return bodyInput(f).view;
    },
  });

  const dlg = added[0] as unknown as Group;
  const buttons = buttonsOf(dlg);
  expect(buttons.filter((b) => b.state.disabled).length).toBe(0); // both enabled at rest

  form.field('name').value.set('db');
  loop.emitCommand(Commands.ok); // start the gate
  await Promise.resolve();
  await Promise.resolve();
  expect(form.submitting()).toBe(true);
  expect(buttons.filter((b) => b.state.disabled).length).toBe(1); // only OK greys (disabled: () => submitting())

  gate.resolve();
  await p;
  expect(buttons.filter((b) => b.state.disabled).length).toBe(0); // re-enabled after close
});
