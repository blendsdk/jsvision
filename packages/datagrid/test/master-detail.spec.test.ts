/**
 * Specification tests (immutable oracles) — the master grid's focused-record readouts and the
 * `masterDetail` link helper.
 *
 * `focusedRow()` / `focusedKey()` expose the record under the row cursor (reactive), re-anchored by
 * `rowKey` so the cursor follows the same record across a re-sort. `masterDetail(master, buildDetail)`
 * links a detail grid to that focused record and disposes its reactive scope on `dispose()`.
 *
 * Expectations derive from the requirements/spec docs, never from the implementation. `loop.dispatch`
 * moves the row cursor via arrow keys; the `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal, effect } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows, fromReactiveRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { masterDetail } from '../src/master-detail.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 24;
const H = 6;

interface Row {
  id: number;
  n: number;
}
const ROWS: Row[] = [
  { id: 1, n: 10 },
  { id: 2, n: 20 },
  { id: 3, n: 30 },
];

/** Mount a master grid over a fresh copy of ROWS; focus its body so arrow keys move the cursor. */
function buildMaster() {
  const rows = signal<Row[]>(ROWS.map((r) => ({ ...r })));
  const grid = new EditableDataGrid<Row>({
    columns: [
      column<Row, number>({ id: 'id', title: 'Id', value: (r) => r.id, width: 6 }),
      column<Row, number>({ id: 'n', title: 'N', value: (r) => r.n, width: 6 }),
    ],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop, rows };
}

const down = () => ({ type: 'key' as const, key: 'down', ctrl: false, alt: false, shift: false });

// ST-19 — the cursor readouts track the row cursor (reactive).
test('ST-19: should return the focused record and its key as the cursor moves', () => {
  const { grid, loop } = buildMaster();
  // cursor starts on the first display row
  expect(grid.focusedRow()).toEqual({ id: 1, n: 10 });
  expect(grid.focusedKey()).toBe(1);
  // move down one row → the second record
  loop.dispatch(down());
  loop.renderRoot.flush();
  expect(grid.focusedRow()).toEqual({ id: 2, n: 20 });
  expect(grid.focusedKey()).toBe(2);
});

// ST-20 — a sort that moves the focused record keeps the SAME record under the cursor (re-anchored by key).
test('ST-20: should keep the same focused record after a sort moves it', () => {
  const { grid } = buildMaster();
  // cursor on record id 1 (top). Sorting by n descending sends it to the bottom.
  expect(grid.focusedKey()).toBe(1);
  grid.sortBy('n', 'desc'); // display order becomes id 3, 2, 1
  // the cursor followed record id 1 to its new position — same record, still focused
  expect(grid.focusedRow()).toEqual({ id: 1, n: 10 });
  expect(grid.focusedKey()).toBe(1);
});

// ---- masterDetail link (ST-21, ST-22) -----------------------------------------------------------

const up = () => ({ type: 'key' as const, key: 'up', ctrl: false, alt: false, shift: false });

interface Order {
  id: number;
}
interface Line {
  id: number;
  orderId: number;
}

/** Mount an orders master; the lines signal is the owned collection a detail reads/writes through. */
function buildOrdersMaster() {
  const orders = signal<Order[]>([{ id: 1 }, { id: 2 }]);
  const lines = signal<Line[]>([
    { id: 10, orderId: 1 },
    { id: 11, orderId: 1 },
    { id: 12, orderId: 2 },
  ]);
  const master = new EditableDataGrid<Order>({
    columns: [column<Order, number>({ id: 'id', title: 'Order', value: (r) => r.id, width: 6 })],
    source: fromRows(orders, { rowKey: (o) => o.id }),
  });
  master.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(master);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(master.rows);
  loop.renderRoot.flush();
  return { master, loop, lines };
}

/** A detail grid over the lines of the master's focused order. */
const detailFor = (focused: () => Order | undefined, lines: () => Line[]) =>
  new EditableDataGrid<Line>({
    columns: [column<Line, number>({ id: 'id', title: 'Line', value: (r) => r.id, width: 6 })],
    source: fromReactiveRows(() => lines().filter((l) => l.orderId === focused()?.id), { rowKey: (l) => l.id }),
  });

// ST-21 — moving the master focus updates the detail's rows to the new record's related rows.
test('ST-21: should update the detail rows when the master focus changes', () => {
  const { master, loop, lines } = buildOrdersMaster();
  const { detail, dispose } = masterDetail(master, (focused) => detailFor(focused, lines));
  expect(detail.displayedRows().map((l) => l.id)).toEqual([10, 11]); // order 1's lines
  loop.dispatch(down()); // master cursor → order 2
  loop.renderRoot.flush();
  expect(detail.displayedRows().map((l) => l.id)).toEqual([12]); // order 2's lines
  dispose();
});

// ST-22 — after dispose(), the detail's reactive wiring no longer recomputes on a master focus change.
test('ST-22: should stop recomputing after dispose()', () => {
  const { master, loop, lines } = buildOrdersMaster();
  let recomputes = 0;
  const { dispose } = masterDetail(master, (focused) => {
    effect(() => {
      focused(); // track the master's focused record
      recomputes += 1;
    });
    return detailFor(focused, lines);
  });
  expect(recomputes).toBe(1); // the effect ran on creation
  loop.dispatch(down()); // master focus → order 2 → the effect re-runs
  loop.renderRoot.flush();
  expect(recomputes).toBe(2);

  dispose(); // tear down the detail's reactive scope
  loop.dispatch(up()); // master focus → order 1 again
  loop.renderRoot.flush();
  expect(recomputes).toBe(2); // no recompute after dispose (scope torn down)
});
