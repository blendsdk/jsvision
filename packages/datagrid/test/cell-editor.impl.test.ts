/**
 * Implementation tests — the cell-editor field round-trip (ST-17). The edit buffer is seeded from
 * `format(value)` (or `String(value)` with no formatter), a printable begin-edit replaces the content
 * with the typed character, and commit parses `field()` back through `parse` before `set`/`onCommit`.
 * The default text `Input` is two-way bound to the field and never touches the host argument. These
 * exercise the round-trip building blocks the editing controller wires together in a later phase.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, filter, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { createCellEditor } from '../src/cell-editor.js';
import type { CellEditorHost } from '../src/cell-editor.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

/** Mount an editor Input standalone, focus it, and return the loop so a test can dispatch keystrokes. */
function mountInput(editor: Input) {
  editor.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 1 } };
  const root = new Group();
  root.add(editor);
  const loop = createEventLoop({ width: 12, height: 1 }, { caps });
  loop.mount(root);
  loop.focusView(editor);
  return loop;
}

/** A synthetic key envelope for `loop.dispatch`. */
function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

interface Row {
  qty: number;
  name: string;
}

const qty = column<Row, number>({
  id: 'qty',
  title: 'Qty',
  value: (r) => r.qty,
  format: (v) => `#${v}`,
  parse: (t) => Number(t.replace(/^#/, '')),
  set: (r, v) => {
    r.qty = v;
  },
});
const name = column<Row, string>({
  id: 'name',
  title: 'Name',
  value: (r) => r.name,
  parse: (t) => t,
  set: (r, v) => {
    r.name = v;
  },
});

// ST-17 — the field is seeded from format(value) when the column has a formatter.
test('seed uses format(value) when the column has a formatter', () => {
  const row: Row = { qty: 7, name: 'Ada' };
  const seed = qty.format ? qty.format(qty.value(row), row) : String(qty.value(row));
  expect(seed).toBe('#7');
});

// ST-17 — the field falls back to String(value) when there is no formatter.
test('seed falls back to String(value) with no formatter', () => {
  const row: Row = { qty: 7, name: 'Ada' };
  const seed = name.format ? name.format(name.value(row), row) : String(name.value(row));
  expect(seed).toBe('Ada');
});

// ST-17 — commit parses field() back through parse (text → value) before the write path.
test('commit parses field() back through parse', () => {
  expect(qty.parse!('#42')).toBe(42);
  expect(name.parse!('Bo')).toBe('Bo');
});

// ST-17 — the default text Input is two-way bound: a keystroke dispatched to the focused editor
// writes back into the field signal.
test('the default Input is two-way bound to the field', () => {
  const field = signal('Ada');
  const editor = createCellEditor(name, field, { overlay: new Group() });
  expect(editor).toBeInstanceOf(Input);
  editor!.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 1 } };
  const root = new Group();
  root.add(editor!);
  const loop = createEventLoop({ width: 12, height: 1 }, { caps });
  loop.mount(root);
  loop.focusView(editor!);
  expect(loop.getFocused()).toBe(editor);
  loop.dispatch(key('x'));
  expect(field()).toContain('x');
  expect(field()).not.toBe('Ada');
});

// ST-17 — the text Input ignores the host argument: a host that throws when read is never accessed.
test('createCellEditor never touches the host for the text Input', () => {
  const field = signal('Ada');
  const trapHost: CellEditorHost = {
    get overlay(): Group {
      throw new Error('the default text Input must not read the host');
    },
  };
  expect(() => createCellEditor(name, field, trapHost)).not.toThrow();
  expect(createCellEditor(name, field, trapHost)).toBeInstanceOf(Input);
});

interface Locked {
  name: string;
  locked: boolean;
}
const perRow = column<Locked, string>({
  id: 'name',
  title: 'Name',
  value: (r) => r.name,
  parse: (t) => t,
  set: (r, v) => {
    r.name = v;
  },
  editor: (row) => (row.locked ? { kind: 'readonly' } : { kind: 'text' }),
});

// resolveSpec — a per-row editor function is resolved against the row being edited.
test('resolveSpec: a per-row editor function resolves per row', () => {
  const host = { overlay: new Group() };
  expect(createCellEditor(perRow, signal(''), host, { name: 'Ada', locked: true })).toBeNull();
  expect(createCellEditor(perRow, signal(''), host, { name: 'Ada', locked: false })).toBeInstanceOf(Input);
});

// resolveSpec — with no row (a direct factory call) a function editor falls back to a text Input.
test('resolveSpec: an undefined row falls back to a text Input', () => {
  expect(createCellEditor(perRow, signal(''), { overlay: new Group() })).toBeInstanceOf(Input);
});

// resolveSpec — a literal spec passes straight through (readonly → null).
test('resolveSpec: a literal editor spec passes through', () => {
  const ro = column<Locked, string>({
    id: 'name',
    title: 'Name',
    value: (r) => r.name,
    parse: (t) => t,
    set: (r, v) => {
      r.name = v;
    },
    editor: { kind: 'readonly' },
  });
  expect(createCellEditor(ro, signal(''), { overlay: new Group() })).toBeNull();
});

// createCellEditor dispatch — spec.validator overrides the per-kind default keystroke filter. The
// integer default ('0-9-') rejects a letter; an explicit letter filter accepts it instead.
test('createCellEditor: spec.validator overrides the default keystroke filter', () => {
  const intCol = column<Locked, string>({
    id: 'name',
    title: 'Name',
    value: (r) => r.name,
    parse: (t) => t,
    set: (r, v) => {
      r.name = v;
    },
    editor: { kind: 'integer' },
  });
  const overrideCol = column<Locked, string>({
    id: 'name',
    title: 'Name',
    value: (r) => r.name,
    parse: (t) => t,
    set: (r, v) => {
      r.name = v;
    },
    editor: { kind: 'integer', validator: filter('a-z') },
  });

  const df = signal('');
  const dloop = mountInput(createCellEditor(intCol, df, { overlay: new Group() }) as Input);
  dloop.dispatch({ type: 'key', key: 'x', ctrl: false, alt: false, shift: false }); // a letter
  expect(df()).toBe(''); // rejected by the digits-only default
  dloop.dispatch({ type: 'key', key: '5', ctrl: false, alt: false, shift: false });
  expect(df()).toBe('5'); // a digit is accepted

  const of = signal('');
  const oloop = mountInput(createCellEditor(overrideCol, of, { overlay: new Group() }) as Input);
  oloop.dispatch({ type: 'key', key: 'x', ctrl: false, alt: false, shift: false });
  expect(of()).toBe('x'); // accepted by the overriding letter filter
  oloop.dispatch({ type: 'key', key: '5', ctrl: false, alt: false, shift: false });
  expect(of()).toBe('x'); // a digit is now rejected
});
