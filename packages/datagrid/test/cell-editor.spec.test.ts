/**
 * Specification tests (immutable oracles) — the cell-editor factory.
 *
 * ST-15 (RD-02 seam): the `column.set` write path, the `isEditable` predicate (editable ⇔ `parse`
 * **and** `set`), and `createCellEditor` returning a text `Input` for an editable column and `null` for
 * a read-only one.
 *
 * ST-1 (RD-03): the `editor` descriptor + `resolveSpec` default — an editable column with no `editor`
 * still mounts a text `Input` (backward-compat), `editor: { kind: 'readonly' }` yields `null` (begin-edit
 * rejected, record untouched), and a column without parse/set is always `null`.
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { PopupHost } from '@jsvision/ui';
import { column, isEditable, toEngineColumn } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { createCellEditor } from '../src/cell-editor.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** A synthetic key envelope for `loop.dispatch`. */
function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

const W = 30;
const H = 6;

/**
 * Mount a grid over `typedColumns`/`rows` with a wired popup host, so a test can drive F2/Enter/F4 and
 * inspect the mounted editor. The popup overlay is separate from the grid's editor-mount overlay — the
 * ComboBox opens its list into `loop.popupHost.overlay`, exactly as the app shell does.
 */
function build<T>(typedColumns: GridColumn<T>[], rows: T[], rowKey: (r: T) => string | number) {
  const engineCols = typedColumns.map(toEngineColumn);
  const focused = signal(0);
  const focusedCol = signal(0);
  const selected = signal(-1);
  const indent = signal(0);
  const version = signal(0);
  const overlay = new Group();
  overlay.layout = { position: 'fill' };
  const grid = new EditableGridRows<T>({
    display: () => {
      version();
      return rows;
    },
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent,
    focused,
    selected,
    zebra: false,
    focusedCol,
    typedColumns,
    overlay,
    rowKey,
    bumpVersion: () => version.set(version() + 1),
  });
  grid.layout = { position: 'fill' };
  const container = new Group();
  container.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  container.add(grid);
  container.add(overlay);
  // A full-viewport popup overlay wired as the loop's popup host (a ComboBox opens its list here).
  const popup = new Group();
  popup.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  popup.state.visible = false;
  const root = new Group();
  root.add(container);
  root.add(popup);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  const host: PopupHost = { overlay: popup, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  loop.focusView(grid);
  return { grid, loop, overlay, popup, rows, focused, focusedCol, version };
}

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
  width: 8,
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

// ST-15 / ST-1(a) — createCellEditor returns a text Input for an editable column (no editor), null for read-only.
test('createCellEditor returns an Input for an editable column and null for a read-only one', () => {
  const host = { overlay: new Group() };
  expect(createCellEditor(editableName, signal(''), host)).toBeInstanceOf(Input);
  expect(createCellEditor(readonlyId, signal(''), host)).toBeNull();
});

// ST-1(b) — editor: { kind: 'readonly' } on a parse/set column → createCellEditor returns null.
test('ST-1: editor kind "readonly" yields null even on a parse/set column', () => {
  const host = { overlay: new Group() };
  const explicitReadonly = column<Person, string>({
    id: 'name',
    title: 'Name',
    value: (r) => r.name,
    parse: (t) => t,
    set: (r, v) => {
      r.name = v;
    },
    editor: { kind: 'readonly' },
  });
  expect(createCellEditor(explicitReadonly, signal('Ada'), host)).toBeNull();
});

// ST-1(b) — driving F2/Enter on a readonly-kind cell mounts no editor and leaves the record untouched.
test('ST-1: F2/Enter on a readonly-kind cell mount no editor and leave the record untouched', () => {
  const explicitReadonly = column<Person, string>({
    id: 'name',
    title: 'Name',
    value: (r) => r.name,
    parse: (t) => t,
    set: (r, v) => {
      r.name = v;
    },
    editor: { kind: 'readonly' },
    width: 8,
  });
  const rows: Person[] = [{ id: 1, name: 'Ada' }];
  const { grid, loop, overlay } = build<Person>([explicitReadonly], rows, (r) => r.id);
  loop.dispatch(key('enter'));
  expect(loop.getFocused()).toBe(grid); // no editor took focus
  expect(overlay.children.length).toBe(0);
  loop.dispatch(key('f2'));
  expect(loop.getFocused()).toBe(grid);
  expect(overlay.children.length).toBe(0);
  expect(rows[0]).toEqual({ id: 1, name: 'Ada' }); // untouched
});

// ST-1(c) — a column without parse/set is always null, regardless of an editor descriptor.
test('ST-1: a column without parse/set is null regardless of editor', () => {
  const host = { overlay: new Group() };
  const labelWithEditor = column<Person, number>({
    id: 'id',
    title: 'ID',
    value: (r) => r.id,
    editor: { kind: 'text' },
  });
  expect(createCellEditor(labelWithEditor, signal(''), host)).toBeNull();
});
