/**
 * Specification tests (immutable oracles) — the editor seam (ST-15): the `column.set` write path, the
 * `isEditable` predicate (editable ⇔ `parse` **and** `set`), and `createCellEditor` returning a text
 * `Input` for an editable column and `null` for a read-only one.
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import { Group, Input, signal } from '@jsvision/ui';
import { column, isEditable } from '../src/column.js';
import { createCellEditor } from '../src/cell-editor.js';

interface Person {
  id: number;
  name: string;
}

const editableName = column<Person, string>({
  id: 'name',
  title: 'Name',
  value: (r) => r.name,
  parse: (t) => t,
  set: (r, v) => {
    r.name = v;
  },
});
const readonlyId = column<Person, number>({ id: 'id', title: 'ID', value: (r) => r.id });
const parseOnly = column<Person, string>({ id: 'p', title: 'P', value: (r) => r.name, parse: (t) => t });
const setOnly = column<Person, string>({
  id: 's',
  title: 'S',
  value: (r) => r.name,
  set: (r, v) => {
    r.name = v;
  },
});

// ST-15 — column.set writes the parsed value straight into the record.
test('column.set writes the value into the record', () => {
  const row: Person = { id: 1, name: 'Ada' };
  editableName.set!(row, 'Bo');
  expect(row.name).toBe('Bo');
});

// ST-15 — a column is editable only when BOTH parse and set are present (a complete text↔record round-trip).
test('isEditable is true only when both parse and set are present', () => {
  expect(isEditable(editableName)).toBe(true);
  expect(isEditable(readonlyId)).toBe(false);
  expect(isEditable(parseOnly)).toBe(false);
  expect(isEditable(setOnly)).toBe(false);
});

// ST-15 — createCellEditor returns a text Input for an editable column, null for a read-only one.
test('createCellEditor returns an Input for an editable column and null for a read-only one', () => {
  const host = { overlay: new Group() };
  expect(createCellEditor(editableName, signal(''), host)).toBeInstanceOf(Input);
  expect(createCellEditor(readonlyId, signal(''), host)).toBeNull();
});
