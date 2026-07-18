/**
 * Specification test (immutable oracle) — `@jsvision/datagrid` ships no dynamic-code-execution sink:
 * the package source contains no `eval(`, `new Function(`, or dynamic `require(` call. There is no
 * user-supplied-code path in the grid, so a static source scan is a sufficient guarantee.
 */
import { test, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import type { SortKey } from '../src/sort.js';
import type { FilterModel } from '../src/filter.js';
import type { OnCommit, BeforeSave } from '../src/commit.js';
import { PARSE_FAILED } from '../src/format.js';
import { EditableDataGrid } from '../src/grid.js';
import { asyncWindowedSource } from './fixtures/async-windowed-source.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false };
}

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// No dynamic-code-execution sink anywhere in the package source.
test('should contain no eval / new Function / dynamic require in package source', () => {
  const forbidden = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\brequire\s*\(/];
  const files = tsFiles(srcDir);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const re of forbidden) {
      expect(re.test(text), `${file} must not match ${re}`).toBe(false);
    }
  }
});

const W = 16;
const H = 5;

interface Person {
  id: number;
  name: string;
}

// ST-11 — a control-byte value committed through the editor is stored raw in memory but never reaches
// the frame as a raw ESC/BEL (it passes the engine's sanitize boundary), and the ONLY record mutation
// is through the onCommit/set path (a spy confirms no out-of-band persistence).
test('should sanitize a control-byte edit at the frame and mutate only via onCommit', async () => {
  const rows = signal<Person[]>([{ id: 1, name: 'Ada' }]);
  const spy = vi.fn<OnCommit<Person>>(() => true);
  const columns = [
    column<Person, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 10,
    }),
  ];
  const grid = new EditableDataGrid<Person>({
    columns,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    onCommit: spy,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('\x1b[31mX\x07'); // an ESC/BEL-laden value
  loop.dispatch(key('enter'));
  await tick();
  loop.renderRoot.flush();

  // The commit seam is the only mutation path (no direct write behind the model's back).
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0][0]).toMatchObject({ rowKey: 1, columnId: 'name', value: '\x1b[31mX\x07' });
  expect(rows()[0].name).toBe('\x1b[31mX\x07'); // stored raw in memory (the model is untouched by rendering)

  // …but nothing reaches the terminal unsanitized: no buffer cell holds a raw ESC/BEL glyph, and BEL —
  // which is never legitimately emitted — is absent from the serialized frame.
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
});

interface Qty {
  id: number;
  qty: number;
}

// RD-12 security — a `validate` message laced with control bytes is surfaced in the message band but
// sanitized at the draw boundary: no raw ESC/BEL reaches the frame (client validation is UX only, and
// its message is never trusted as terminal output).
test('a validate message with control bytes renders sanitized in the message band', async () => {
  const VW = 24;
  const VH = 7;
  const rows = signal<Qty[]>([{ id: 1, qty: 5 }]);
  const columns = [
    column<Qty, number>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      parse: (t) => (Number.isFinite(Number(t)) && t.trim() !== '' ? Number(t) : PARSE_FAILED),
      set: (r, v) => {
        r.qty = v;
      },
      validate: () => 'bad\x1b[31mvalue\x07', // a message carrying a raw ESC + BEL
      width: 10,
    }),
  ];
  const grid = new EditableDataGrid<Qty>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: VW, height: VH } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: VW, height: VH }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('9');
  loop.dispatch(key('enter')); // blocked by validate → the control-byte message goes to the band
  await tick();
  loop.renderRoot.flush();

  expect(grid.activeMessage()).toContain('\x1b'); // the raw message is held in memory (caller-supplied)
  const buf = loop.renderRoot.buffer(); // …but the frame is clean
  for (let y = 0; y < VH; y += 1) {
    for (let x = 0; x < VW; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
});

// RD-12 security — client gating never persists behind the source's back: a `beforeSave` veto reverts
// and never reaches `onCommit`, and an invalid (`validate`-failed) value never applies or reaches
// `onCommit`. `onCommit`/the source stay the sole persistence path.
test('a beforeSave veto and a validate-failed value never persist (onCommit is the only sink)', async () => {
  const rows = signal<Qty[]>([{ id: 1, qty: 5 }]);
  const onCommit = vi.fn<OnCommit<Qty>>(() => true);
  const beforeSave: BeforeSave<Qty> = () => false; // always veto
  const columns = [
    column<Qty, number>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      parse: (t) => (Number.isFinite(Number(t)) && t.trim() !== '' ? Number(t) : PARSE_FAILED),
      set: (r, v) => {
        r.qty = v;
      },
      validate: (v) => (v > 0 ? null : 'must be positive'),
      width: 10,
    }),
  ];
  const grid = new EditableDataGrid<Qty>({
    columns,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    beforeSave,
    onCommit,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  // A valid value that passes validate but is vetoed by beforeSave → reverted, onCommit never called.
  loop.dispatch(key('f2'));
  let editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('9');
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0].qty).toBe(5); // reverted to previous
  expect(onCommit).not.toHaveBeenCalled(); // beforeSave short-circuited the persistence sink

  // An invalid value (validate-failed) → never applied, onCommit never reached.
  editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('-3');
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0].qty).toBe(5); // still unchanged — nothing written
  expect(onCommit).not.toHaveBeenCalled();
});

interface Cust {
  id: number;
  customerId: string;
}

// ST-11(a) — a lookup provider's label carrying control bytes is sanitized at the frame: opening the
// dropdown (wired popupHost) and rendering the row never puts a raw ESC/BEL in the buffer or the frame.
test('ST-11: a lookup label with control bytes renders sanitized at the frame', async () => {
  const LW = 20;
  const LH = 10;
  const rows = signal<Cust[]>([{ id: 1, customerId: '' }]);
  const columns = [
    column<Cust, string>({
      id: 'customerId',
      title: 'Customer',
      value: (r) => r.customerId,
      parse: (t) => t,
      set: (r, v) => {
        r.customerId = v;
      },
      width: 14,
      editor: { kind: 'lookup', items: async () => [{ key: '7', label: 'A\x1b[31mB\x07' }] },
    }),
  ];
  const grid = new EditableDataGrid<Cust>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: LW, height: LH } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: LW, height: LH } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(grid);
  root.add(overlay);
  const loop = createEventLoop({ width: LW, height: LH }, { caps });
  loop.mount(root);
  loop.popupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.focusView(grid.rows);

  loop.dispatch(key('f4')); // begin edit + open the value-help dropdown
  await tick(); // the async provider resolves → the malicious label populates the list
  loop.renderRoot.flush();

  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < LH; y += 1) {
    for (let x = 0; x < LW; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
});

interface Q {
  id: number;
  qty: string;
}

// ST-11(b) — an integer editor's keystroke filter rejects a non-conforming character before commit, so
// the committed value is filter-conformant (the commit-time valid() gate is a later concern).
test('ST-11: an integer keystroke filter rejects a letter before commit', async () => {
  const rows = signal<Q[]>([{ id: 1, qty: '5' }]);
  const spy = vi.fn<OnCommit<Q>>(() => true);
  const columns = [
    column<Q, string>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      parse: (t) => t,
      set: (r, v) => {
        r.qty = v;
      },
      width: 8,
      editor: { kind: 'integer' },
    }),
  ];
  const grid = new EditableDataGrid<Q>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }), onCommit: spy });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('f2')); // begin edit (seed '5')
  loop.dispatch(key('a')); // a letter — rejected by filter('0-9-')
  loop.dispatch(key('9')); // a digit — accepted
  loop.dispatch(key('enter'));
  await tick();

  expect(spy).toHaveBeenCalledTimes(1);
  const committed = String(spy.mock.calls[0][0].value);
  expect(committed).not.toContain('a'); // the letter never entered the buffer
  expect(/^[0-9-]*$/.test(committed)).toBe(true); // filter-conformant
});

interface Ctl {
  id: number;
  v: number;
}

/** Assert no buffer cell holds a raw ESC/BEL and the serialized frame has no BEL. */
function expectNoControlBytes(loop: ReturnType<typeof createEventLoop>): void {
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
}

// ST-17 — a column `format` that emits ESC/BEL is sanitized at the frame: the control bytes flow
// through the accessor/alignCell paint path but never reach a buffer cell or the serialized output.
test('ST-17: a format result with control bytes renders sanitized at the frame', () => {
  const rows = signal<Ctl[]>([{ id: 1, v: 1 }]);
  const columns = [
    column<Ctl, number>({
      id: 'v',
      title: 'V',
      value: (r) => r.v,
      format: () => '\x1b[31mX\x07', // a formatter emitting a raw ESC + BEL
      width: 12,
    }),
  ];
  const grid = new EditableDataGrid<Ctl>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  expectNoControlBytes(loop);
});

// ST-18 — a custom `render` hook that writes ESC/BEL is sanitized at the frame: the cell-local ctx
// still funnels through the engine's buffer-write sanitize boundary, so no raw control byte lands.
test('ST-18: a render hook writing control bytes renders sanitized at the frame', () => {
  const rows = signal<Ctl[]>([{ id: 1, v: 1 }]);
  const columns = [
    column<Ctl, number>({
      id: 'v',
      title: 'V',
      value: (r) => r.v,
      width: 12,
      render: (ctx) => ctx.text(0, 0, '\x1b[31mX\x07', { fg: 'brightRed', bg: 'cyan' }),
    }),
  ];
  const grid = new EditableDataGrid<Ctl>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  expectNoControlBytes(loop);
});

interface Sale {
  region: string;
  qty: number;
}

// ST-21 — an unknown sort `columnId` is ignored by the sort API (no state change) and is never
// forwarded to a push-down source's `setSort` query. Structured `SortKey[]` only — never raw SQL.
test('ST-21: an unknown sort columnId is a no-op and never reaches a push-down setSort', () => {
  const setSort = vi.fn<(keys: SortKey[]) => void>();
  const source: GridDataSource<Sale> = {
    rowKey: (r) => r.region,
    length: () => 1,
    rowAt: () => ({ region: 'east', qty: 1 }),
    setSort,
  };
  const columns = [
    column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region }),
    column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty }),
  ];
  const grid = new EditableDataGrid<Sale>({ columns, source });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);

  grid.sortBy('nope'); // unknown via the single-key API
  grid.addSort('nope', 'desc'); // unknown via the multi-key API
  expect(grid.sort()).toEqual([]); // no state change

  // Every push-down call carries only known columns — the unknown id never reaches the query.
  for (const call of setSort.mock.calls) {
    expect(call[0].some((k) => k.columnId === 'nope')).toBe(false);
  }
});

interface Rec {
  id: number;
  v: number;
}

// ST-21 (mutation) — the grid persists ONLY through the source's `insert`/`remove` seam, so a read-only
// source (one exposing neither) can never be mutated by the CRUD API: `insertRow`/`deleteRows`/
// `duplicateRow` are safe no-ops that throw nothing. `deleteRows` still prunes the in-grid selection —
// that is grid-local state, not a mutation of the source's backing store.
test('ST-21: a read-only source without insert/remove is never mutated by the CRUD API', () => {
  const store: Rec[] = [{ id: 1, v: 10 }];
  const source: GridDataSource<Rec> = {
    rowKey: (r) => r.id,
    length: () => store.length,
    rowAt: (i) => store[i],
    // no `insert` / `remove` — a read-only source
  };
  const columns = [column<Rec, number>({ id: 'v', title: 'V', value: (r) => r.v })];
  const grid = new EditableDataGrid<Rec>({ columns, source, assignKey: (c) => ({ ...c, id: 999 }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);

  grid.selectRow(1);
  expect(() => {
    grid.insertRow({ id: 2, v: 20 }, 0); // no `insert` seam → no-op
    grid.duplicateRow(1); // no `insert` seam → no-op even with `assignKey`
    grid.deleteRows([1]); // no `remove` seam → the backing store is untouched
  }).not.toThrow();
  expect(store).toEqual([{ id: 1, v: 10 }]); // the source's array is byte-for-byte unchanged
  expect(grid.selectedKeys().size).toBe(0); // …but the in-grid selection still pruned (not a source mutation)
});

/** Mount a grid over a push-down source (spy `setFilter`); return the grid and the spy. */
function buildFilterPushGrid() {
  const setFilter = vi.fn<(model: FilterModel) => void>();
  const source: GridDataSource<Sale> = {
    rowKey: (r) => r.region,
    length: () => 1,
    rowAt: () => ({ region: 'east', qty: 1 }),
    setFilter,
  };
  const columns = [
    column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region }),
    column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty }),
  ];
  const grid = new EditableDataGrid<Sale>({ columns, source });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  return { grid, setFilter };
}

// ST-15 — an unknown filter `columnId` is ignored by the filter API (no state change) and is never
// forwarded to a push-down source's `setFilter` query.
test('ST-15: an unknown filter columnId is a no-op and never reaches a push-down setFilter', () => {
  const { grid, setFilter } = buildFilterPushGrid();
  grid.setFilter('nope', { kind: 'text', op: 'contains', value: 'x' }); // unknown column
  grid.clearFilter('nope');
  expect(grid.filterModel().size).toBe(0); // no state change

  for (const call of setFilter.mock.calls) {
    expect(call[0].has('nope')).toBe(false); // the unknown id never reaches the query
  }
});

// ST-27 — the filter model pushed down is a structured map of literal operands: no string is
// concatenated into a query by the grid (the source owns any query building).
test('ST-27: the push-down filter model is a structured map of literal operands, never a query string', () => {
  const { grid, setFilter } = buildFilterPushGrid();
  grid.setFilter('qty', { kind: 'number', op: 'between', a: 100, b: 500 });
  const model = setFilter.mock.calls.at(-1)?.[0];
  expect(model).toBeInstanceOf(Map); // a ReadonlyMap, not a string
  expect(model?.get('qty')).toEqual({ kind: 'number', op: 'between', a: 100, b: 500 }); // structured literals
});

// ST-26 — an unknown columnId in ANY column-layout call is ignored and never enters layout state.
test('ST-26: an unknown columnId in every column-layout call is a no-op, never entering state', () => {
  interface Row {
    a: string;
    b: number;
  }
  const cols = [
    column<Row, string>({ id: 'a', title: 'A', value: (r) => r.a }),
    column<Row, number>({ id: 'b', title: 'B', value: (r) => r.b }),
  ];
  const grid = new EditableDataGrid<Row>({
    columns: cols,
    source: fromRows(signal([{ a: 'x', b: 1 }]), { rowKey: (r) => r.a }),
  });
  const before = grid.columnOrder();
  grid.setColumnOrder(['a', 'zzz']); // not a permutation of the visible ids → ignored
  grid.setColumnWidth('zzz', 50); // unknown → no-op
  grid.setColumnVisible('zzz', false); // unknown → no-op
  grid.autoFitColumn('zzz'); // unknown → no-op
  expect(grid.columnOrder()).toEqual(before); // order unchanged
  expect(grid.frozen()).toEqual({ left: [], right: [] }); // no freeze introduced
});

// ST-27 (columns-layout) — layout is presentational: a header/cell text carrying control bytes stays
// sanitized at the frame after a reorder + hide (the RD-04 sanitize boundary is untouched by any layout
// change). Named distinctly from the RD-06 push-down ST-27 above (this file spans several plans).
test('ST-27: header/cell text with control bytes stays sanitized after a reorder + hide', () => {
  interface Row {
    id: number;
    name: string;
    dept: string;
  }
  const cols = [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 4 }),
    // A header title and a cell value both laced with a raw ESC + BEL.
    column<Row, string>({ id: 'name', title: 'Na\x1b[31mme\x07', value: (r) => r.name, width: 12 }),
    column<Row, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  ];
  const grid = new EditableDataGrid<Row>({
    columns: cols,
    source: fromRows(signal([{ id: 1, name: 'A\x1b[32mB\x07', dept: 'R&D' }]), { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 30, height: 5 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 30, height: 5 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();

  // Apply layout changes: reorder (name before id) and hide a column.
  grid.setColumnOrder(['name', 'id', 'dept']);
  grid.setColumnVisible('dept', false);
  loop.renderRoot.flush();

  // No raw ESC/BEL reaches any buffer cell — the frame sanitizes regardless of column order/visibility.
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 30; x += 1) {
      const ch = buf.get(x, y)?.char ?? ' ';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
});

interface Member {
  id: number;
  name: string;
  dept: string;
}

// ST-21 (sanitize) — the RD-08 row/selection mutations are presentational to the render sanitize
// boundary: header + cell text laced with control bytes stays sanitized at the frame AFTER an insert
// (a new malicious row), a duplicate (clone of a malicious row), a header select-all, and a reorder.
// None of the mutation/selection paths open a new route for a raw ESC/BEL to reach the buffer.
test('ST-21: header/cell text stays sanitized after insert / duplicate / select-all / reorder', () => {
  const SW = 34;
  const SH = 8;
  const rows = signal<Member[]>([{ id: 1, name: 'A\x1b[31mB\x07', dept: 'R&D' }]); // a cell laced with ESC + BEL
  const cols = [
    column<Member, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 4 }),
    // A header title itself carrying a raw ESC + BEL.
    column<Member, string>({ id: 'name', title: 'Na\x1b[31mme\x07', value: (r) => r.name, width: 12 }),
    column<Member, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  ];
  const grid = new EditableDataGrid<Member>({
    columns: cols,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    checkboxColumn: true,
    assignKey: (clone) => ({ ...clone, id: clone.id + 100 }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: SW, height: SH } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: SW, height: SH }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();

  // Exercise every RD-08 mutation/selection path with control-byte-laden data.
  grid.insertRow({ id: 2, name: 'C\x1b[32mD\x07', dept: 'Ops' }); // a new malicious row
  grid.duplicateRow(1); // clone the malicious row 1 with a fresh key
  grid.selectAllDisplayed(); // the header select-all path
  grid.setColumnOrder(['name', 'id', 'dept']); // reorder
  loop.renderRoot.flush();

  // No raw ESC/BEL reaches any buffer cell, and no BEL survives into the serialized frame.
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < SH; y += 1) {
    for (let x = 0; x < SW; x += 1) {
      const ch = buf.get(x, y)?.char ?? ' ';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
});

// ---- ST-20 — windowed security oracle ----

interface WRow {
  id: number;
  name: string;
}

// Every window request a hostile scroll can produce is an integer range clamped to [0, length()]; a burst
// of scroll gestures is coalesced (rate-bounded), never a per-row flood of source calls.
test('ST-20: windowed scroll never sends the source a bad range, and bursts are coalesced', async () => {
  const total = 100000;
  const calls: Array<[number, number]> = [];
  const src: GridDataSource<WRow> = {
    rowKey: (r) => r.id,
    length: () => total,
    rowAt: () => undefined, // nothing loaded → placeholders (isolates the window math)
    ensureRange: (s, e) => void calls.push([s, e]),
    setSort: () => undefined,
    setFilter: () => undefined,
  };
  const columns = [column<WRow, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 })];
  const grid = new EditableDataGrid<WRow>({ columns, source: src });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 6 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 12, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  for (const k of ['pagedown', 'pagedown', 'pagedown', 'end', 'home', 'pagedown']) {
    loop.dispatch({ type: 'key', key: k, ctrl: k === 'end' || k === 'home', alt: false, shift: false });
  }
  await tick();
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.length).toBeLessThan(10); // coalesced — not one call per gesture/row
  for (const [start, end] of calls) {
    expect(Number.isInteger(start)).toBe(true);
    expect(Number.isInteger(end)).toBe(true);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeLessThanOrEqual(total);
    expect(start).toBeLessThanOrEqual(end);
  }
});

// The `…` placeholder is a static constant — never interpolated from (would-be hostile) row data; an
// unloaded row shows only `…`, so no source string can reach the frame through a placeholder.
test('ST-20: the unloaded-row placeholder is a static constant (no row-data leak)', () => {
  const hostile: GridDataSource<WRow> = {
    rowKey: (r) => r.id,
    length: () => 500,
    rowAt: () => undefined, // unloaded — the row that WOULD carry hostile text never renders
    ensureRange: () => undefined,
    setSort: () => undefined,
    setFilter: () => undefined,
  };
  const columns = [column<WRow, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 })];
  const grid = new EditableDataGrid<WRow>({ columns, source: hostile });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 14, height: 6 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 14, height: 6 }, { caps });
  loop.mount(root);
  const buf = loop.renderRoot.buffer();
  let text = '';
  for (let y = 0; y < 6; y += 1) for (let x = 0; x < 14; x += 1) text += buf.get(x, y)?.char ?? ' ';
  expect(text).toContain('…'); // the placeholder is the constant, painted for every unloaded row
  expect(loop.renderRoot.serialize()).not.toContain('\x1b'); // no escape leaks
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
});

// A windowed edit still routes through onCommit — nothing in the windowed path writes around the sink.
test('ST-20: a windowed edit routes through onCommit (no persistence bypass)', async () => {
  const spy = vi.fn<OnCommit<WRow>>(() => true);
  const src = asyncWindowedSource<WRow>({
    total: 1000,
    pageSize: 100,
    fetchPage: (p) =>
      Promise.resolve(Array.from({ length: 100 }, (_, k) => ({ id: p * 100 + k, name: `r${p * 100 + k}` }))),
    rowKey: (r) => r.id,
  });
  await src.ensureRange(0, 100); // load the visible window
  await src.settle();
  const columns = [
    column<WRow, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 12,
    }),
  ];
  const grid = new EditableDataGrid<WRow>({ columns, source: src, onCommit: spy });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 16, height: 6 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 16, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('f2')); // the focused row 0 is loaded → editable
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('changed');
  loop.dispatch(key('enter'));
  await tick();
  expect(spy).toHaveBeenCalledTimes(1); // the commit sink is the only persistence path
  expect(spy.mock.calls[0][0]).toMatchObject({ rowKey: 0, columnId: 'name', value: 'changed' });
});

// ---- Export serializer security — formula-injection escaping, markup escaping, control-byte sanitize ----

interface FRow {
  id: number;
  f: string;
}

/** A single-column ("F") grid over the given cell strings, mounted so `exportView` reads settle. */
function buildFGrid(values: string[]): EditableDataGrid<FRow> {
  const rows = values.map((f, i) => ({ id: i + 1, f }));
  const columns = [column<FRow, string>({ id: 'f', title: 'F', value: (r) => r.f })];
  const grid = new EditableDataGrid<FRow>({ columns, source: fromRows(signal(rows), { rowKey: (r) => r.id }) });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  return grid;
}

// A formatted cell that begins with a spreadsheet formula trigger (= + - @, or a leading tab/CR) is
// prefixed with `'` in CSV so a spreadsheet never executes it; a benign leading char is untouched.
test('CSV formula injection: a formula-triggering cell is prefixed; a benign cell is not', () => {
  // Control bytes are stripped BEFORE the formula-escape, so a control-byte-masked formula cannot slip a
  // live payload through (an ESC- or CR-masked "=SUM" is still defused). A bare leading control byte with
  // no formula behind it is simply removed and needs no prefix.
  const csv = buildFGrid(['=SUM(A1)', '+1', '-1', '@x', '\tTAB', '\r=SUM', '\x1b=SUM', 'hello']).exportView('csv');
  const lines = csv.split('\r\n');
  expect(lines[0]).toBe('F'); // the title header
  expect(lines[1]).toBe("'=SUM(A1)"); // = defused
  expect(lines[2]).toBe("'+1"); // +
  expect(lines[3]).toBe("'-1"); // - (a legitimate negative formats to '-1 — the accepted tradeoff)
  expect(lines[4]).toBe("'@x"); // @
  expect(lines[5].startsWith("'")).toBe(true); // a leading tab is defused too
  expect(lines[6]).toBe("'=SUM"); // a CR-masked formula: the CR is stripped, the formula still defused
  expect(lines[7]).toBe("'=SUM"); // an ESC-masked formula: likewise defused (no control-byte bypass)
  expect(lines[8]).toBe('hello'); // a benign leading char is left untouched
});

// The same formula-injection escaping applies to TSV output (Excel tolerates quoted TSV on paste).
test('TSV formula injection: the same triggers are prefixed in TSV output', () => {
  const tsv = buildFGrid(['=SUM(A1)', '+1', '-1', '@x']).exportView('tsv');
  expect(tsv).toContain("'=SUM(A1)");
  expect(tsv).toContain("'+1");
  expect(tsv).toContain("'-1");
  expect(tsv).toContain("'@x");
});

// An HTML cell carrying markup is escaped, never emitted live — exported data can inject no markup.
test('HTML markup injection: a cell with markup is escaped, never emitted live', () => {
  const html = buildFGrid(['<script>x</script>']).exportView('html');
  expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
  expect(html).not.toContain('<script>x</script>'); // no live <script> reaches the document
});

// Control bytes are stripped before serialization, so no raw ESC/BEL reaches the output in any format
// (JSON escapes them structurally as \u sequences; the text formats sanitize them away).
test('control-byte sanitize: no raw control byte reaches the output in any format', () => {
  const grid = buildFGrid(['a\x1bX\x07']);
  for (const fmt of ['csv', 'html', 'json', 'tsv'] as const) {
    const out = grid.exportView(fmt);
    expect(out).not.toContain('\x1b'); // no raw ESC
    expect(out).not.toContain('\x07'); // no raw BEL
  }
});

// JSON is a structured format, not a spreadsheet paste target, so a formula value stays RAW there
// (never `'`-prefixed) and round-trips through JSON.parse.
test('JSON is not over-escaped: a formula value stays raw and round-trips', () => {
  const json = buildFGrid(['=SUM(A1)']).exportView('json');
  expect(JSON.parse(json)).toEqual([{ f: '=SUM(A1)' }]); // raw, not "'=SUM(A1)"
});
