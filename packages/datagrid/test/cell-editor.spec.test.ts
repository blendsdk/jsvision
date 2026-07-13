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
import { test, expect, vi } from 'vitest';
import {
  CheckGroup,
  ComboBox,
  DatePicker,
  Group,
  Input,
  createEventLoop,
  resolveCapabilities,
  signal,
  toISO,
} from '@jsvision/ui';
import type { PopupHost } from '@jsvision/ui';
import { column, isEditable, toEngineColumn } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { createCellEditor } from '../src/cell-editor.js';
import type { OnCommit } from '../src/commit.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Drain the microtasks a deferred (await-close) commit or an async provider schedules. */
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

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
function build<T>(
  typedColumns: GridColumn<T>[],
  rows: T[],
  rowKey: (r: T) => string | number,
  opts: { onCommit?: OnCommit<T> } = {},
) {
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
    onCommit: opts.onCommit,
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

interface Flag {
  id: number;
  active: boolean;
}
const activeCol = column<Flag, boolean>({
  id: 'active',
  title: 'Active',
  value: (r) => r.active,
  format: (v) => (v ? 'true' : 'false'),
  parse: (t) => t === 'true',
  set: (r, v) => {
    r.active = v;
  },
  width: 10,
  editor: { kind: 'boolean' },
});

// ST-2 — a boolean column mounts a CheckGroup; Space toggles and Enter commits the flipped 'true'/'false'.
test('ST-2: boolean editor is a CheckGroup; Space toggles, Enter commits false→true', async () => {
  const spy = vi.fn<OnCommit<Flag>>(() => true);
  const rows: Flag[] = [{ id: 1, active: false }];
  const h = build<Flag>([activeCol], rows, (r) => r.id, { onCommit: spy });
  h.loop.dispatch(key('f2'));
  expect(h.loop.getFocused()).toBeInstanceOf(CheckGroup); // boolean → CheckGroup (a focusable leaf)
  h.loop.dispatch(key('space')); // toggle the single checkbox
  h.loop.dispatch(key('enter'));
  await tick();
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: true, previous: false }));
  expect(rows[0].active).toBe(true);
});

test('ST-2: boolean editor commits true→false when toggled off', async () => {
  const spy = vi.fn<OnCommit<Flag>>(() => true);
  const rows: Flag[] = [{ id: 1, active: true }];
  const h = build<Flag>([activeCol], rows, (r) => r.id, { onCommit: spy });
  h.loop.dispatch(key('f2'));
  h.loop.dispatch(key('space'));
  h.loop.dispatch(key('enter'));
  await tick();
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: false, previous: true }));
  expect(rows[0].active).toBe(false);
});

interface Due {
  id: number;
  due: string;
}
const dueCol = column<Due, string>({
  id: 'due',
  title: 'Due',
  value: (r) => r.due,
  parse: (t) => t,
  set: (r, v) => {
    r.due = v;
  },
  width: 12,
  editor: { kind: 'date' },
});

// ST-3 — a date column mounts a DatePicker bound to the ISO field; commit yields ISO YYYY-MM-DD.
test('ST-3: date editor is a DatePicker bound to the ISO field; commit yields ISO', async () => {
  const spy = vi.fn<OnCommit<Due>>(() => true);
  const rows: Due[] = [{ id: 1, due: '2026-07-13' }];
  const h = build<Due>([dueCol], rows, (r) => r.id, { onCommit: spy });
  h.loop.dispatch(key('f2'));
  const focused = h.loop.getFocused();
  expect(focused).toBeInstanceOf(Input); // a Group editor focuses its `.input`
  const dp = focused?.parent;
  expect(dp).toBeInstanceOf(DatePicker);
  if (dp instanceof DatePicker) {
    expect(dp.value()).not.toBeNull();
    expect(toISO(dp.value()!)).toBe('2026-07-13'); // dateBridge mapped the ISO field to the CalendarDate
  }
  h.loop.dispatch(key('enter'));
  await tick();
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: '2026-07-13' }));
  expect(rows[0].due).toBe('2026-07-13');
});

// ST-3 — an empty date field seeds the picker with no selection (null).
test('ST-3: an empty date field seeds the DatePicker value as null', () => {
  const rows: Due[] = [{ id: 1, due: '' }];
  const h = build<Due>([dueCol], rows, (r) => r.id);
  h.loop.dispatch(key('f2'));
  const dp = h.loop.getFocused()?.parent;
  expect(dp).toBeInstanceOf(DatePicker);
  if (dp instanceof DatePicker) expect(dp.value()).toBeNull();
});

interface Order {
  id: number;
  status: string;
}
const statusCol = column<Order, string>({
  id: 'status',
  title: 'Status',
  value: (r) => r.status,
  parse: (t) => t,
  set: (r, v) => {
    r.status = v;
  },
  width: 12,
  editor: { kind: 'enum', values: ['open', 'paid', 'shipped'] },
});

// ST-4 — an enum column mounts a select-only ComboBox listing exactly `values` in order; a pick commits it.
test('ST-4: enum editor is a select-only ComboBox listing values in order; pick commits the string', async () => {
  const spy = vi.fn<OnCommit<Order>>(() => true);
  const rows: Order[] = [{ id: 1, status: 'open' }];
  const h = build<Order>([statusCol], rows, (r) => r.id, { onCommit: spy });
  h.loop.dispatch(key('f2'));
  const combo = h.loop.getFocused()?.parent;
  expect(combo).toBeInstanceOf(ComboBox);
  if (!(combo instanceof ComboBox)) return;
  expect(combo.items()).toEqual(['open', 'paid', 'shipped']); // exactly the values, in order
  h.loop.dispatch(key('down', { alt: true })); // open (list focus index 0)
  h.loop.dispatch(key('down')); // paid (1)
  h.loop.dispatch(key('down')); // shipped (2)
  h.loop.dispatch(key('enter')); // pick the 3rd row
  expect(combo.value()).toBe('shipped');
  h.loop.dispatch(key('enter')); // commit the cell
  await tick();
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: 'shipped' }));
  expect(rows[0].status).toBe('shipped');
});

interface Cust {
  id: number;
  customerId: string;
}
const custCol = column<Cust, string>({
  id: 'customerId',
  title: 'Customer',
  value: (r) => r.customerId,
  parse: (t) => t,
  set: (r, v) => {
    r.customerId = v;
  },
  width: 16,
  editor: {
    kind: 'lookup',
    items: async () => [
      { key: '7', label: 'Ada' },
      { key: '9', label: 'Bo' },
    ],
  },
});

// ST-5(a) — an async lookup provider loads, shows the label, and a pick commits the KEY (not the label).
test('ST-5(a): lookup async provider loads; picking a row commits the key, not the label', async () => {
  const spy = vi.fn<OnCommit<Cust>>(() => true);
  const rows: Cust[] = [{ id: 1, customerId: '' }];
  const h = build<Cust>([custCol], rows, (r) => r.id, { onCommit: spy });
  h.loop.dispatch(key('f2'));
  const combo = h.loop.getFocused()?.parent;
  expect(combo).toBeInstanceOf(ComboBox);
  if (!(combo instanceof ComboBox)) return;
  await tick(); // the async provider resolves into the live items signal
  expect(combo.items().length).toBe(2);
  h.loop.dispatch(key('down', { alt: true })); // open (index 0 = Ada)
  h.loop.dispatch(key('enter')); // pick Ada
  expect(combo.text()).toBe('Ada'); // the label is shown
  h.loop.dispatch(key('enter')); // commit the cell
  await tick();
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: '7' })); // the KEY, not 'Ada'
  expect(rows[0].customerId).toBe('7');
});

// ST-5(b) — a seeded existing key survives mount (PF-001 regression): not clobbered to '' before the
// async rows arrive; once loaded the key re-matches its label, and commit yields the unchanged key.
test('ST-5(b): a seeded existing key is not clobbered on mount (PF-001 regression)', async () => {
  const spy = vi.fn<OnCommit<Cust>>(() => true);
  const rows: Cust[] = [{ id: 1, customerId: '7' }]; // a pre-existing FK
  const h = build<Cust>([custCol], rows, (r) => r.id, { onCommit: spy });
  h.loop.dispatch(key('f2')); // begin edit — NO user interaction
  const combo = h.loop.getFocused()?.parent;
  expect(combo).toBeInstanceOf(ComboBox);
  if (!(combo instanceof ComboBox)) return;
  await tick(); // the async rows load; the key re-matches its item
  expect(combo.text()).toBe('Ada'); // key '7' re-matched to its label
  h.loop.dispatch(key('enter')); // commit with no change
  await tick();
  expect(spy).toHaveBeenCalledWith(expect.objectContaining({ value: '7' })); // NOT clobbered to ''
  expect(rows[0].customerId).toBe('7');
});
