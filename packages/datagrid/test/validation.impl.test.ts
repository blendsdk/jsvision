/**
 * Implementation tests — the row-leave gate (`createRowGate`): the touched/untouched trigger, the
 * field-refocus fallback chain, throw handling, and message clearing; plus grid-level checks that a
 * within-row move never gates and a single row-leave consults the gate exactly once.
 */
import { test, expect, vi } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { PARSE_FAILED } from '../src/format.js';
import { EditableDataGrid } from '../src/grid.js';
import { createRowGate } from '../src/validation.js';
import type { RowGateDeps, RowValidation } from '../src/validation.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const key = (k: string) => ({ type: 'key' as const, key: k, ctrl: false, alt: false, shift: false });

// ─── direct createRowGate unit tests ─────────────────────────────────────────────────────────────────

interface Cfg {
  validateRow?: (row: object) => RowValidation;
  touched?: boolean;
  columnIndexOf?: (id: string) => number;
  currentColumn?: number;
}

function harness(cfg: Cfg) {
  const calls = { focusColumn: [] as number[], note: [] as (string | null)[], clearTouched: [] as unknown[] };
  const deps: RowGateDeps<object> = {
    validateRow: cfg.validateRow,
    focusedRow: () => ({ id: 1 }),
    focusedKey: () => 1,
    isRowTouched: () => cfg.touched ?? false,
    clearTouched: (k) => calls.clearTouched.push(k),
    columnIndex: (id) => cfg.columnIndexOf?.(id) ?? -1,
    currentColumn: () => cfg.currentColumn ?? 3,
    focusColumn: (i) => calls.focusColumn.push(i),
    note: (m) => calls.note.push(m),
  };
  return { gate: createRowGate(deps), calls };
}

test('no validateRow → always allows', () => {
  const { gate } = harness({});
  expect(gate.tryLeave()).toBe(true);
});

test('an untouched row leaves freely and validateRow is never called', () => {
  const validateRow = vi.fn(() => ({ ok: false }) as RowValidation);
  const { gate } = harness({ validateRow, touched: false });
  expect(gate.tryLeave()).toBe(true);
  expect(validateRow).not.toHaveBeenCalled();
});

test('a touched row that passes clears the touched mark and the message', () => {
  const { gate, calls } = harness({ validateRow: () => ({ ok: true }), touched: true });
  expect(gate.tryLeave()).toBe(true);
  expect(calls.clearTouched).toEqual([1]); // will not re-trap
  expect(calls.note).toEqual([null]); // message cleared
});

test('a touched row that fails blocks, refocuses the named field, and surfaces the message', () => {
  const { gate, calls } = harness({
    validateRow: () => ({ ok: false, message: 'bad', field: 'end' }),
    touched: true,
    columnIndexOf: (id) => (id === 'end' ? 4 : -1),
  });
  expect(gate.tryLeave()).toBe(false);
  expect(calls.focusColumn).toEqual([4]); // the `end` column
  expect(calls.note).toEqual(['bad']);
});

test('an unknown/absent field falls back to the current column (never throws)', () => {
  const unknown = harness({ validateRow: () => ({ ok: false, field: 'ghost' }), touched: true, currentColumn: 7 });
  expect(unknown.gate.tryLeave()).toBe(false);
  expect(unknown.calls.focusColumn).toEqual([7]); // ghost id → columnIndex -1 → current column

  const noField = harness({ validateRow: () => ({ ok: false }), touched: true, currentColumn: 2 });
  expect(noField.gate.tryLeave()).toBe(false);
  expect(noField.calls.focusColumn).toEqual([2]);
  expect(noField.calls.note).toEqual(['This row is invalid']); // default message
});

test('a throwing validateRow is treated as a blocking failure, not a crash', () => {
  const { gate, calls } = harness({
    validateRow: () => {
      throw new Error('boom');
    },
    touched: true,
    currentColumn: 1,
  });
  expect(() => gate.tryLeave()).not.toThrow();
  expect(gate.tryLeave()).toBe(false);
  expect(calls.focusColumn).toEqual([1, 1]); // fallback both calls
});

// ─── grid-level: within-row moves never gate; a leave consults the gate once ─────────────────────────

const W = 26;
const H = 7;

interface Row {
  id: number;
  start: number;
  end: number;
}
const intCol = (id: 'start' | 'end', title: string) =>
  column<Row, number>({
    id,
    title,
    value: (r) => r[id],
    parse: (t) => (Number.isFinite(Number(t)) && t.trim() !== '' ? Number(t) : PARSE_FAILED),
    set: (r, v) => {
      r[id] = v;
    },
    width: 8,
  });

function buildGrid(validateRow: (r: Row) => RowValidation) {
  const rows = signal<Row[]>([
    { id: 1, start: 1, end: 9 },
    { id: 2, start: 2, end: 8 },
  ]);
  const grid = new EditableDataGrid<Row>({
    columns: [intCol('start', 'Start'), intCol('end', 'End')],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    validateRow,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  return { grid, loop };
}

test('a within-row column move never consults the row gate', async () => {
  const validateRow = vi.fn(
    (r: Row) => (r.end > r.start ? { ok: true } : { ok: false, field: 'end' }) as RowValidation,
  );
  const { grid, loop } = buildGrid(validateRow);
  // Edit start → 10 (row 0 now invalid vs end=9) and commit via Tab (marks the row touched).
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('10');
  await grid.nextCell(); // Tab: within-row hop col0 → col1, must NOT gate
  loop.focusView(grid.rows);
  expect(grid.focusedRow()?.id).toBe(1); // still on row 0
  validateRow.mockClear();
  loop.dispatch(key('left')); // a column-only move on a touched invalid row
  expect(validateRow).not.toHaveBeenCalled(); // the gate never ran for a within-row move
  expect(grid.activeMessage()).toBeNull();
});

test('a single row-leave consults validateRow exactly once', async () => {
  const validateRow = vi.fn(
    (r: Row) => (r.end > r.start ? { ok: true } : { ok: false, field: 'end' }) as RowValidation,
  );
  const { grid, loop } = buildGrid(validateRow);
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('10');
  await grid.nextCell();
  loop.focusView(grid.rows);
  validateRow.mockClear();
  loop.dispatch(key('down')); // one row-leave gesture
  await tick();
  expect(validateRow).toHaveBeenCalledTimes(1); // fired once, not per panel
});
