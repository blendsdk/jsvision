/**
 * Specification tests (immutable oracles) for the atomic row-revert transaction and its input
 * serialization. Real grids own editing, validation, focus, dirty presentation, and mutations; only
 * the host's persistence decision is controlled by the tests.
 */
import { expect, test, vi } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { PARSE_FAILED } from '../src/format.js';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const key = (name: string, mods: { alt?: boolean; shift?: boolean } = {}) => ({
  type: 'key' as const,
  key: name,
  ctrl: false,
  alt: mods.alt ?? false,
  shift: mods.shift ?? false,
});
const W = 28;
const H = 7;

interface Row {
  id: number;
  start: number;
  end: number;
}

interface RevertCell {
  readonly columnId: string;
  readonly value: unknown;
  readonly previous: unknown;
}

interface RevertChange {
  readonly rowKey: string | number;
  readonly row: Row;
  readonly cells: readonly RevertCell[];
}

type RevertDecision = (change: RevertChange) => boolean | Promise<boolean>;
type FutureOptions = Partial<EditableDataGridOptions<Row>> & { onRevertRow?: RevertDecision };

const editable = (id: 'start' | 'end') =>
  column<Row, number>({
    id,
    title: id,
    value: (row) => row[id],
    parse: (text) => (text.trim() && Number.isFinite(Number(text)) ? Number(text) : PARSE_FAILED),
    set: (row, value) => {
      row[id] = value;
    },
    width: 8,
  });
const START = editable('start');
const END = editable('end');
const ID = column<Row, number>({ id: 'id', title: 'id', value: (row) => row.id, width: 5 });

class EscapeHost extends Group {
  escapes = 0;
  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'key' && event.event.key === 'escape') this.escapes += 1;
  }
}

function mount(options: FutureOptions = {}) {
  const rows = signal<Row[]>([
    { id: 1, start: 1, end: 9 },
    { id: 2, start: 2, end: 30 },
  ]);
  const gridOptions: EditableDataGridOptions<Row> & FutureOptions = {
    columns: [START, END, ID],
    source: fromRows(rows, { rowKey: (row) => row.id }),
    validateRow: (row) =>
      row.end > row.start ? { ok: true } : { ok: false, message: 'End must follow start', field: 'end' },
    ...options,
  };
  const grid = new EditableDataGrid<Row>(gridOptions);
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const host = new EscapeHost();
  host.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(host);
  loop.focusView(grid.rows);
  return { grid, host, loop, rows };
}

function setEditor(loop: ReturnType<typeof mount>['loop'], value: string): void {
  const editor = loop.getFocused();
  expect(editor).toBeInstanceOf(Input);
  if (editor instanceof Input) editor.getValueSignal().set(value);
}

async function editNext(context: ReturnType<typeof mount>, value: string): Promise<void> {
  context.loop.dispatch(key('f2'));
  setEditor(context.loop, value);
  await context.grid.nextCell();
  context.loop.focusView(context.grid.rows);
}

async function trapTwo(context: ReturnType<typeof mount>): Promise<void> {
  await editNext(context, '10');
  context.loop.dispatch(key('f2'));
  setEditor(context.loop, '8');
  context.loop.dispatch(key('enter'));
  await tick();
  expect(context.rows()[0]).toMatchObject({ start: 10, end: 8 });
  expect(context.grid.focusedKey()).toBe(1);
}

async function pressEscape(context: ReturnType<typeof mount>): Promise<void> {
  context.loop.focusView(context.grid.rows);
  context.loop.dispatch(key('escape'));
  await tick();
}

function dirtyMarkers(context: ReturnType<typeof mount>): number {
  context.loop.renderRoot.flush();
  return context.loop.renderRoot
    .buffer()
    .rows()
    .flat()
    .filter((cell) => cell.char === '•').length;
}

function deferred() {
  let resolve!: (accepted: boolean) => void;
  const promise = new Promise<boolean>((settle) => {
    resolve = settle;
  });
  return { callback: vi.fn<RevertDecision>(() => promise), resolve };
}

test('should deliver one frozen first-commit-ordered transaction after applying every baseline', async () => {
  let observed: RevertChange | undefined;
  const callback = vi.fn<RevertDecision>((change) => {
    observed = change;
    expect(change.row).toMatchObject({ start: 1, end: 9 });
    return true;
  });
  const context = mount({ onRevertRow: callback });
  const original = context.rows()[0];
  await trapTwo(context);
  await pressEscape(context);

  expect(callback).toHaveBeenCalledTimes(1);
  expect(observed).toMatchObject({
    rowKey: 1,
    row: original,
    cells: [
      { columnId: 'start', value: 1, previous: 10 },
      { columnId: 'end', value: 9, previous: 8 },
    ],
  });
  expect(Object.isFrozen(observed?.cells)).toBe(true);
  expect(observed?.cells.every(Object.isFrozen)).toBe(true);
});

test.each(['onCommit', 'beforeSave'] as const)(
  'should refuse local rollback without dirty writes when %s owns persistence',
  async (authority) => {
    const persistence = vi.fn(() => true);
    const context = mount(authority === 'onCommit' ? { onCommit: persistence } : { beforeSave: persistence });
    await trapTwo(context);
    const callsAfterEdits = persistence.mock.calls.length;
    await pressEscape(context);

    expect(context.rows()[0]).toMatchObject({ start: 10, end: 8 });
    expect(context.grid.activeMessage()).toBe('Row changes cannot be reverted');
    expect(context.grid.focusedKey()).toBe(1);
    expect(dirtyMarkers(context)).toBe(0);
    expect(persistence).toHaveBeenCalledTimes(callsAfterEdits);
  },
);

test('should serialize competing grid actions while a rollback decision is pending', async () => {
  const pending = deferred();
  const context = mount({ onRevertRow: pending.callback });
  await trapTwo(context);
  await pressEscape(context);
  expect(context.rows()[0]).toMatchObject({ start: 1, end: 9 });
  expect(context.grid.activeMessage()).toBe('Reverting row…');
  expect(dirtyMarkers(context)).toBeGreaterThanOrEqual(1);

  context.loop.dispatch(key('escape'));
  context.loop.dispatch(key('f2'));
  context.loop.dispatch(key('x'));
  context.loop.dispatch(key('f4'));
  context.loop.dispatch(key('down'));
  context.loop.dispatch(key('down', { shift: true }));
  context.loop.dispatch(key('down', { alt: true }));
  context.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 2, y: 3 });
  await context.grid.nextCell();
  context.grid.deleteRows([1]);
  await tick();

  expect(pending.callback).toHaveBeenCalledTimes(1);
  expect(context.rows()).toHaveLength(2);
  expect(context.rows()[0]).toMatchObject({ id: 1, start: 1, end: 9 });
  expect(context.grid.focusedKey()).toBe(1);
  expect(context.grid.selectedKeys().size).toBe(0);
  expect(context.grid.activeMessage()).toBe('Reverting row…');
  expect(context.loop.getFocused()).toBe(context.grid.rows);

  pending.resolve(true);
  await tick();
  expect(context.grid.activeMessage()).toBeNull();
  expect(dirtyMarkers(context)).toBe(0);
});

test('should compensate every cell and retain a trapped retry when the callback vetoes', async () => {
  const callback = vi.fn<RevertDecision>(() => false);
  const context = mount({ onRevertRow: callback });
  await trapTwo(context);
  await pressEscape(context);

  expect(context.rows()[0]).toMatchObject({ start: 10, end: 8 });
  expect(context.grid.focusedKey()).toBe(1);
  expect(context.grid.activeMessage()).toBe('Could not revert row changes');
  expect(dirtyMarkers(context)).toBe(0);
  context.loop.dispatch(key('down'));
  await tick();
  expect(context.grid.focusedKey()).toBe(1);
});

test.each([
  [
    'a synchronous throw',
    () => {
      throw new Error('private host failure');
    },
  ],
  ['a rejected promise', () => Promise.reject(new Error('private host rejection'))],
] as const)('should treat %s as a bounded retryable veto', async (_label, decision) => {
  const callback = vi.fn<RevertDecision>(decision);
  const context = mount({ onRevertRow: callback });
  await trapTwo(context);
  await expect(pressEscape(context)).resolves.toBeUndefined();

  expect(context.rows()[0]).toMatchObject({ start: 10, end: 8 });
  expect(context.grid.focusedKey()).toBe(1);
  expect(context.grid.activeMessage()).toBe('Could not revert row changes');
  expect(context.grid.activeMessage()).not.toContain('private host');
  expect(dirtyMarkers(context)).toBe(0);
});

test('should retry the same transaction and release the row when the second decision accepts', async () => {
  const seen: Array<Omit<RevertChange, 'row'> & { row: Row }> = [];
  const callback = vi.fn<RevertDecision>((change) => {
    seen.push({ rowKey: change.rowKey, row: change.row, cells: change.cells.map((cell) => ({ ...cell })) });
    return seen.length === 2;
  });
  const context = mount({ onRevertRow: callback });
  await trapTwo(context);
  await pressEscape(context);
  expect(context.rows()[0]).toMatchObject({ start: 10, end: 8 });
  await pressEscape(context);

  expect(callback).toHaveBeenCalledTimes(2);
  expect(seen[1]).toEqual(seen[0]);
  expect(context.rows()[0]).toMatchObject({ start: 1, end: 9 });
  expect(context.grid.activeMessage()).toBeNull();
  expect(dirtyMarkers(context)).toBe(0);
  context.loop.dispatch(key('down'));
  await tick();
  expect(context.grid.focusedKey()).toBe(2);
});

test('should bubble default Escape to the focus host when no trapped session is eligible', async () => {
  const context = mount();
  const before = { row: { ...context.rows()[0] }, focus: context.grid.focusedKey() };
  await pressEscape(context);
  expect(context.host.escapes).toBe(1);
  expect(context.rows()[0]).toEqual(before.row);
  expect(context.grid.focusedKey()).toBe(before.focus);
  expect(context.grid.activeMessage()).toBeNull();
});
