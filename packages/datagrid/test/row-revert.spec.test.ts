/**
 * Specification tests (immutable oracles) for Escape recovery after row validation traps a committed
 * edit. These tests use real grids, sources, editors, focus, and event loops; only host persistence
 * settlement is deferred. Expectations describe public behavior and must not follow implementation
 * details.
 */
import { expect, test, vi } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromReactiveRows, fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { PARSE_FAILED } from '../src/format.js';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';
import { masterDetail } from '../src/master-detail.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const key = (name: string) => ({ type: 'key' as const, key: name, ctrl: false, alt: false, shift: false });
const W = 32;
const H = 7;

interface Row {
  id: number;
  start: number;
  end: number;
}

const numberColumn = (id: 'start' | 'end') =>
  column<Row, number>({
    id,
    title: id,
    value: (row) => row[id],
    parse: (text) => (text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : PARSE_FAILED),
    set: (row, value) => {
      row[id] = value;
    },
    width: 8,
  });
const START = numberColumn('start');
const END = numberColumn('end');
const ID = column<Row, number>({ id: 'id', title: 'id', value: (row) => row.id, width: 5 });

type FutureOptions = Partial<EditableDataGridOptions<Row>> & {
  onRevertRow?: () => boolean | Promise<boolean>;
};

function mount(
  initial: Row[] = [
    { id: 1, start: 1, end: 9 },
    { id: 2, start: 2, end: 30 },
  ],
  options: FutureOptions = {},
  source?: GridDataSource<Row>,
) {
  const rows = signal(initial);
  const gridOptions: EditableDataGridOptions<Row> & FutureOptions = {
    columns: [START, END, ID],
    source: source ?? fromRows(rows, { rowKey: (row) => row.id }),
    validateRow: (row) =>
      row.end > row.start ? { ok: true } : { ok: false, message: 'End must follow start', field: 'end' },
    ...options,
  };
  const grid = new EditableDataGrid<Row>(gridOptions);
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const outside = new Input({ value: signal('outside') });
  outside.setLayout({ position: 'absolute', rect: { x: 0, y: H - 1, width: 10, height: 1 } });
  const root = new Group();
  root.add(grid);
  root.add(outside);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  return { grid, loop, outside, rows };
}

function setEditor(loop: ReturnType<typeof mount>['loop'], value: string): void {
  const editor = loop.getFocused();
  expect(editor).toBeInstanceOf(Input);
  if (editor instanceof Input) editor.getValueSignal().set(value);
}

async function editNext(ctx: ReturnType<typeof mount>, value: string): Promise<void> {
  ctx.loop.dispatch(key('f2'));
  setEditor(ctx.loop, value);
  await ctx.grid.nextCell();
  ctx.loop.focusView(ctx.grid.rows);
}

async function trapStart(ctx: ReturnType<typeof mount>, value = '10', expectedKey: string | number = 1): Promise<void> {
  await editNext(ctx, value);
  ctx.loop.dispatch(key('down'));
  await tick();
  expect(ctx.grid.focusedKey()).toBe(expectedKey);
  expect(ctx.grid.activeMessage()).not.toBeNull();
}

async function escape(ctx: ReturnType<typeof mount>): Promise<void> {
  ctx.loop.focusView(ctx.grid.rows);
  ctx.loop.dispatch(key('escape'));
  await tick();
}

function deferred() {
  let settle!: (accepted: boolean) => void;
  let reject!: (reason?: Error) => void;
  const promise = new Promise<boolean>((resolve, rejectPromise) => {
    settle = resolve;
    reject = rejectPromise;
  });
  return { callback: vi.fn(() => promise), settle, reject };
}

test('should restore one trapped commit and permit the next leave when body Escape is pressed', async () => {
  const ctx = mount();
  await trapStart(ctx);
  await escape(ctx);
  expect(ctx.rows()[0]).toMatchObject({ start: 1, end: 9 });
  expect(ctx.grid.activeMessage()).toBeNull();
  expect(ctx.grid.focusedKey()).toBe(1);
  ctx.loop.dispatch(key('down'));
  await tick();
  expect(ctx.grid.focusedKey()).toBe(2);
});

test('should restore every committed column together when a multi-column session is trapped', async () => {
  const ctx = mount();
  await editNext(ctx, '10');
  ctx.loop.dispatch(key('f2'));
  setEditor(ctx.loop, '8');
  ctx.loop.dispatch(key('enter'));
  await tick();
  expect(ctx.rows()[0]).toMatchObject({ start: 10, end: 8 });
  await escape(ctx);
  expect(ctx.rows()[0]).toMatchObject({ start: 1, end: 9 });
});

test('should restore the earliest value when one column commits repeatedly in a session', async () => {
  const ctx = mount();
  await editNext(ctx, '10');
  ctx.loop.dispatch(key('left'));
  await editNext(ctx, '12');
  ctx.loop.dispatch(key('down'));
  await tick();
  await escape(ctx);
  expect(ctx.rows()[0].start).toBe(1);
});

test('should cancel an open editor before restoring its trapped committed session', async () => {
  const ctx = mount();
  await trapStart(ctx);
  ctx.loop.dispatch(key('f2'));
  setEditor(ctx.loop, '20');
  ctx.loop.dispatch(key('escape'));
  await tick();
  expect(ctx.rows()[0]).toMatchObject({ start: 10, end: 9 });
  expect(ctx.grid.activeMessage()).not.toBeNull();
  await escape(ctx);
  expect(ctx.rows()[0]).toMatchObject({ start: 1, end: 9 });
});

test('should leave untouched, never-trapped, and successfully-left sessions unchanged on Escape', async () => {
  const callback = vi.fn(() => true);
  const untouched = mount(undefined, { onRevertRow: callback });
  await escape(untouched);
  expect(untouched.rows()[0]).toMatchObject({ start: 1, end: 9 });

  const untrapped = mount(undefined, { onRevertRow: callback });
  await editNext(untrapped, '2');
  await escape(untrapped);
  expect(untrapped.rows()[0].start).toBe(2);

  const released = mount(undefined, { onRevertRow: callback });
  await editNext(released, '2');
  released.loop.dispatch(key('down'));
  await tick();
  const focus = released.grid.focusedKey();
  await escape(released);
  expect(released.rows()[0].start).toBe(2);
  expect(released.grid.focusedKey()).toBe(focus);
  expect(released.grid.activeMessage()).toBeNull();
  expect(callback).not.toHaveBeenCalled();
});

test('should retain a trapped session through correction but discard it after a successful leave', async () => {
  const retained = mount();
  await trapStart(retained);
  retained.loop.dispatch(key('left'));
  await editNext(retained, '5');
  await escape(retained);
  expect(retained.rows()[0]).toMatchObject({ start: 1, end: 9 });

  const released = mount();
  await trapStart(released);
  released.loop.dispatch(key('left'));
  await editNext(released, '5');
  released.loop.dispatch(key('down'));
  await tick();
  await escape(released);
  expect(released.rows()[0]).toMatchObject({ start: 5, end: 9 });
});

test('should preserve stable row and column identity through sort, hiding, and reorder', async () => {
  const ctx = mount();
  const other = ctx.rows()[1];
  await trapStart(ctx);
  ctx.grid.sortBy('end', 'desc');
  ctx.grid.setColumnVisible('start', false);
  ctx.grid.setColumnOrder(['id', 'end']);
  await escape(ctx);
  expect(ctx.rows()[0]).toMatchObject({ id: 1, start: 1, end: 9 });
  expect(ctx.rows()[1]).toBe(other);
  expect(other).toMatchObject({ start: 2, end: 30 });
});

test('should never transfer a trapped session to a same-key replacement', async () => {
  const before = mount();
  const original = before.rows()[0];
  await trapStart(before);
  const replacement: Row = { id: 1, start: 40, end: 50 };
  before.rows.set([replacement, before.rows()[1]]);
  await tick();
  await escape(before);
  expect(original.start).toBe(10);
  expect(replacement).toMatchObject({ start: 40, end: 50 });

  const pending = deferred();
  const during = mount(undefined, { onRevertRow: pending.callback });
  const captured = during.rows()[0];
  await trapStart(during);
  await escape(during);
  expect(captured.start).toBe(1);
  const replacementDuring: Row = { id: 1, start: 60, end: 70 };
  during.rows.set([replacementDuring, during.rows()[1]]);
  pending.settle(true);
  await tick();
  expect(replacementDuring).toMatchObject({ start: 60, end: 70 });
  expect(during.grid.activeMessage()).toBeNull();
});

test('should retain eligibility when a collection republishes the exact row object', async () => {
  const ctx = mount();
  const original = ctx.rows()[0];
  await trapStart(ctx);
  ctx.rows.set([original, ctx.rows()[1]]);
  await tick();
  await escape(ctx);
  expect(original.start).toBe(1);
});

test.each([true, false])(
  'should reconcile a non-reactive same-key replacement without mutating it when settlement is %s',
  async (accepted) => {
    const original: Row = { id: 1, start: 1, end: 9 };
    const other: Row = { id: 2, start: 2, end: 30 };
    let visible = [original, other];
    const source: GridDataSource<Row> = {
      length: () => visible.length,
      rowAt: (index) => visible[index],
      rowKey: (row) => row.id,
    };
    const pending = deferred();
    const ctx = mount(visible, { onRevertRow: pending.callback }, source);
    await trapStart(ctx);
    await escape(ctx);
    const replacement: Row = { id: 1, start: 80, end: 90 };
    visible = [replacement, other];
    pending.settle(accepted);
    await tick();
    ctx.loop.renderRoot.flush();
    expect(replacement).toMatchObject({ start: 80, end: 90 });
    expect(ctx.grid.displayedRows()[0]).toBe(replacement);
    expect(ctx.grid.focusedKey()).toBe(1);
    expect(original.start).toBe(accepted ? 1 : 10);
    expect(ctx.grid.activeMessage()).toBeNull();
  },
);

test.each([
  ['removed', 'accept'],
  ['removed', 'veto'],
  ['removed', 'reject'],
  ['disposed', 'accept'],
  ['disposed', 'veto'],
  ['disposed', 'reject'],
] as const)(
  'should settle only captured data after the row is %s and the host outcome is %s',
  async (mode, outcome) => {
    const pending = deferred();
    const ctx = mount(undefined, { onRevertRow: pending.callback });
    const original = ctx.rows()[0];
    await trapStart(ctx);
    await escape(ctx);
    if (mode === 'removed') ctx.rows.set(ctx.rows().slice(1));
    else ctx.loop.dispose();
    const messageAfterInvalidation = ctx.grid.activeMessage();
    if (outcome === 'reject') pending.reject(new Error('host details must remain private'));
    else pending.settle(outcome === 'accept');
    await tick();
    expect(original.start).toBe(outcome === 'accept' ? 1 : 10);
    if (mode === 'removed') {
      expect(ctx.rows()).not.toContain(original);
      expect(ctx.grid.activeMessage()).toBeNull();
    } else {
      expect(ctx.grid.activeMessage()).toBe(messageAfterInvalidation);
    }
  },
);

test('should not restore stale focus, session, or feedback when focus leaves during a veto', async () => {
  const pending = deferred();
  const ctx = mount(undefined, { onRevertRow: pending.callback });
  const original = ctx.rows()[0];
  await trapStart(ctx);
  await escape(ctx);
  ctx.loop.focusView(ctx.outside);
  pending.settle(false);
  await tick();
  ctx.loop.renderRoot.flush();
  expect(original.start).toBe(10);
  expect(ctx.loop.getFocused()).toBe(ctx.outside);
  expect(ctx.grid.activeMessage()).toBeNull();
  ctx.loop.focusView(ctx.grid.rows);
  ctx.loop.dispatch(key('escape'));
  await tick();
  expect(pending.callback).toHaveBeenCalledTimes(1);
});

test('should complete an internal rollback when no persistence callback is configured', async () => {
  const ctx = mount();
  await trapStart(ctx);
  await escape(ctx);
  expect(ctx.rows()[0]).toMatchObject({ start: 1, end: 9 });
  expect(ctx.grid.activeMessage()).toBeNull();
  ctx.loop.dispatch(key('escape'));
  await tick();
  expect(ctx.rows()[0].start).toBe(1);
});

test('should publish a detail-row rollback through its owning reactive collection', async () => {
  interface Order {
    id: number;
  }
  const orders = signal<Order[]>([{ id: 1 }, { id: 2 }]);
  const lines = signal<Row[]>([
    { id: 11, start: 1, end: 9 },
    { id: 12, start: 2, end: 30 },
    { id: 21, start: 2, end: 30 },
  ]);
  const master = new EditableDataGrid<Order>({
    columns: [column<Order, number>({ id: 'id', title: 'Order', value: (row) => row.id })],
    source: fromRows(orders, { rowKey: (row) => row.id }),
  });
  let linked: (() => Order | undefined) | undefined;
  const relation = masterDetail(master, (focused) => {
    linked = focused;
    return new EditableDataGrid<Row>({
      columns: [START, END],
      source: fromReactiveRows(() => lines().filter((line) => Math.floor(line.id / 10) === focused()?.id), {
        rowKey: (line) => line.id,
      }),
      validateRow: (row) =>
        row.end > row.start ? { ok: true } : { ok: false, message: 'End must follow start', field: 'end' },
    });
  });
  master.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 12, height: H } });
  relation.detail.setLayout({ position: 'absolute', rect: { x: 12, y: 0, width: 20, height: H } });
  const root = new Group();
  root.add(master);
  root.add(relation.detail);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(relation.detail.rows);
  const detail = { grid: relation.detail, loop, outside: new Input({ value: signal('') }), rows: lines };
  await trapStart(detail, '10', 11);
  await escape(detail);
  loop.renderRoot.flush();
  expect(lines()[0]).toMatchObject({ start: 1, end: 9 });
  expect(relation.detail.displayedRows()[0]).toBe(lines()[0]);
  expect(master.focusedKey()).toBe(1);
  expect(linked?.()?.id).toBe(1);
  relation.dispose();
});

test('should ignore Escape safely in empty and read-only grids', async () => {
  const callback = vi.fn(() => true);
  const empty = mount([], { onRevertRow: callback });
  const emptyFocus = empty.loop.getFocused();
  await expect(escape(empty)).resolves.toBeUndefined();
  expect(empty.rows()).toEqual([]);
  expect(empty.grid.activeMessage()).toBeNull();
  expect(empty.loop.getFocused()).toBe(emptyFocus);

  const readOnlyRows: Row[] = [{ id: 1, start: 1, end: 9 }];
  const readOnly = mount(readOnlyRows, { columns: [ID], onRevertRow: callback });
  const cursor = readOnly.grid.focusedKey();
  await expect(escape(readOnly)).resolves.toBeUndefined();
  expect(readOnly.rows()[0]).toEqual(readOnlyRows[0]);
  expect(readOnly.grid.focusedKey()).toBe(cursor);
  expect(readOnly.grid.activeMessage()).toBeNull();
  expect(callback).not.toHaveBeenCalled();
});
