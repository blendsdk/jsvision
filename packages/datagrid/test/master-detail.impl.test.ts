/**
 * Implementation tests (internals & edges) for the master-detail link: dispose idempotence, automatic
 * teardown when the surrounding scope disposes (no scope leak), and the empty-master edge (`read()` → []).
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal, effect, createRoot } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows, fromReactiveRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { masterDetail } from '../src/master-detail.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 24;
const H = 6;
const down = () => ({ type: 'key' as const, key: 'down', ctrl: false, alt: false, shift: false });
const up = () => ({ type: 'key' as const, key: 'up', ctrl: false, alt: false, shift: false });

interface Order {
  id: number;
}
interface Line {
  id: number;
  orderId: number;
}

function buildOrdersMaster(initialOrders: Order[] = [{ id: 1 }, { id: 2 }]) {
  const orders = signal<Order[]>(initialOrders);
  const lines = signal<Line[]>([
    { id: 10, orderId: 1 },
    { id: 11, orderId: 1 },
    { id: 12, orderId: 2 },
  ]);
  const master = new EditableDataGrid<Order>({
    columns: [column<Order, number>({ id: 'id', title: 'Order', value: (r) => r.id, width: 6 })],
    source: fromRows(orders, { rowKey: (o) => o.id }),
  });
  master.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(master);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(master.rows);
  loop.renderRoot.flush();
  return { master, loop, lines };
}

const detailFor = (focused: () => Order | undefined, lines: () => Line[]) =>
  new EditableDataGrid<Line>({
    columns: [column<Line, number>({ id: 'id', title: 'Line', value: (r) => r.id, width: 6 })],
    source: fromReactiveRows(() => lines().filter((l) => l.orderId === focused()?.id), { rowKey: (l) => l.id }),
  });

test('dispose() is idempotent', () => {
  const { master, lines } = buildOrdersMaster();
  const { dispose } = masterDetail(master, (focused) => detailFor(focused, lines));
  expect(() => {
    dispose();
    dispose(); // calling it again is a safe no-op
  }).not.toThrow();
});

test('the detail scope is freed when the surrounding scope disposes (no leak)', () => {
  const { master, loop, lines } = buildOrdersMaster();
  let recomputes = 0;
  // masterDetail runs INSIDE this outer scope, so it registers its dispose on the ambient owner.
  const outerDispose = createRoot((d) => {
    masterDetail(master, (focused) => {
      effect(() => {
        focused();
        recomputes += 1;
      });
      return detailFor(focused, lines);
    });
    return d;
  });
  expect(recomputes).toBe(1);
  loop.dispatch(down()); // master focus change → the detail's effect re-runs
  loop.renderRoot.flush();
  expect(recomputes).toBe(2);

  outerDispose(); // dispose the SURROUNDING scope → the detail is freed via the ambient onCleanup
  loop.dispatch(up());
  loop.renderRoot.flush();
  expect(recomputes).toBe(2); // no recompute — the detail scope was torn down with its surrounding scope
});

test('an empty master yields an empty detail without throwing (read() → [])', () => {
  const lines = signal<Line[]>([{ id: 10, orderId: 1 }]);
  const master = new EditableDataGrid<Order>({
    columns: [column<Order, number>({ id: 'id', title: 'Order', value: (r) => r.id, width: 6 })],
    source: fromRows(signal<Order[]>([]), { rowKey: (o) => o.id }), // empty master
  });
  const { detail, dispose } = masterDetail(master, (focused) => detailFor(focused, () => lines()));
  expect(master.focusedRow()).toBeUndefined(); // nothing focused on an empty master
  expect(detail.displayedRows()).toEqual([]); // read() folds over `focused()?.id === undefined` → []
  dispose();
});
