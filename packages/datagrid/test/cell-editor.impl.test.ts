/**
 * Implementation tests — the cell-editor field round-trip (ST-17). The edit buffer is seeded from
 * `format(value)` (or `String(value)` with no formatter), a printable begin-edit replaces the content
 * with the typed character, and commit parses `field()` back through `parse` before `set`/`onCommit`.
 * The default text `Input` is two-way bound to the field and never touches the host argument. These
 * exercise the round-trip building blocks the editing controller wires together in a later phase.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { createCellEditor } from '../src/cell-editor.js';
import type { CellEditorHost } from '../src/cell-editor.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

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
