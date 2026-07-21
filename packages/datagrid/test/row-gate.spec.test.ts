/**
 * Specification tests (immutable oracles) — the per-row cross-field gate and its row-leave trap. An
 * optional `validateRow` runs when the cursor leaves a row that was **edited** (a cell in it committed);
 * a failing row cannot leave, the cursor refocuses the reported field, and the message surfaces. An
 * untouched row — even a pre-existing invalid one — leaves freely. A corrected row leaves and the
 * message clears. The trap covers keyboard row-nav, the Enter-advance, and a click on a different row.
 *
 * Expectations derive from the requirements, never the implementation. Commit is await-close (async),
 * so a committing dispatch is followed by a macrotask `tick()` before asserting.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { PARSE_FAILED } from '../src/format.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const key = (k: string) => ({ type: 'key' as const, key: k, ctrl: false, alt: false, shift: false });

const W = 26;
const H = 7;

interface Row {
  id: number;
  start: number;
  end: number;
}

const startCol = column<Row, number>({
  id: 'start',
  title: 'Start',
  value: (r) => r.start,
  parse: (t) => (Number.isFinite(Number(t)) && t.trim() !== '' ? Number(t) : PARSE_FAILED),
  set: (r, v) => {
    r.start = v;
  },
  width: 8,
});
const endCol = column<Row, number>({
  id: 'end',
  title: 'End',
  value: (r) => r.end,
  parse: (t) => (Number.isFinite(Number(t)) && t.trim() !== '' ? Number(t) : PARSE_FAILED),
  set: (r, v) => {
    r.end = v;
  },
  width: 8,
});

/** end must be strictly after start; on failure refocus the `end` field. */
function buildGrid() {
  const rows = signal<Row[]>([
    { id: 1, start: 1, end: 9 }, // valid seed
    { id: 2, start: 5, end: 3 }, // INVALID seed (3 !> 5), but untouched
  ]);
  const grid = new EditableDataGrid<Row>({
    columns: [startCol, endCol],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    validateRow: (r) =>
      r.end > r.start ? { ok: true } : { ok: false, message: 'End must be after start', field: 'end' },
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  return { grid, loop, rows };
}

function setField(loop: ReturnType<typeof buildGrid>['loop'], text: string): void {
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set(text);
}

/** F2 on the focused cell and read the value it seeds — proves which cell the cursor is on. */
function seededValueOnEdit(loop: ReturnType<typeof buildGrid>['loop']): string {
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  const v = editor instanceof Input ? editor.getValueSignal()() : '';
  loop.dispatch(key('escape')); // abandon — leave state untouched
  return v;
}

/** A body mouse-down at (x, display row r). Header offset mirrors the other datagrid click tests. */
function clickRow(loop: ReturnType<typeof buildGrid>['loop'], r: number): void {
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 2, y: r + 2 } as never);
}

// ST-12 — an edited row that fails validateRow is trapped on Down; the cursor lands on `field`.
test('ST-12: an edited invalid row is trapped on arrow-down; the cursor lands on the field', async () => {
  const { grid, loop, rows } = buildGrid();
  loop.dispatch(key('f2')); // edit start (row 0)
  setField(loop, '10'); // start 10 makes end(9) <= start → invalid
  await grid.nextCell(); // Tab: commits start=10 (marks row 1 touched), moves within the row to `end`
  loop.focusView(grid.rows);
  expect(rows()[0].start).toBe(10);

  loop.dispatch(key('down')); // attempt to leave row 0
  await tick();
  expect(grid.focusedRow()?.id).toBe(1); // did NOT leave the row
  expect(grid.activeMessage()).toBe('End must be after start');
  expect(seededValueOnEdit(loop)).toBe('9'); // cursor refocused the `end` cell (value 9), not `start`
});

// ST-13 — correcting the row so validateRow passes lets the next Down leave, clearing the message.
test('ST-13: a corrected row leaves on the next commit and the message clears', async () => {
  const { grid, loop, rows } = buildGrid();
  // Make row 0 invalid + touched, and land the cursor on `end` (ST-15 setup).
  loop.dispatch(key('f2'));
  setField(loop, '10');
  loop.dispatch(key('enter')); // commit start=10; advanceRow is blocked (invalid), cursor refocuses `end`
  await tick();
  expect(grid.focusedRow()?.id).toBe(1);

  // Correct `end` to 20 and commit with Enter → the row is now valid, so the advance leaves the row.
  loop.dispatch(key('f2'));
  setField(loop, '20');
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0]).toMatchObject({ start: 10, end: 20 });
  expect(grid.focusedRow()?.id).toBe(2); // advanced to the next row
  expect(grid.activeMessage()).toBeNull(); // message cleared
});

// ST-14 — an untouched invalid row (seed data) leaves freely; no trap, no message.
test('ST-14: an untouched invalid row leaves freely', async () => {
  const { grid, loop } = buildGrid();
  loop.dispatch(key('down')); // move onto row 1 (id 2), the invalid seed row — untouched
  expect(grid.focusedRow()?.id).toBe(2);
  loop.dispatch(key('up')); // leave the untouched invalid row
  await tick();
  expect(grid.focusedRow()?.id).toBe(1); // left freely
  expect(grid.activeMessage()).toBeNull();
});

// ST-15 — Enter on an edited invalid row does not advance; the cursor refocuses the field.
test('ST-15: Enter on an edited invalid row does not advance and refocuses the field', async () => {
  const { grid, loop } = buildGrid();
  loop.dispatch(key('f2')); // edit start (row 0)
  setField(loop, '10'); // invalid vs end=9
  loop.dispatch(key('enter')); // commit + attempt advance
  await tick();
  expect(grid.focusedRow()?.id).toBe(1); // did NOT advance
  expect(grid.activeMessage()).toBe('End must be after start');
  expect(seededValueOnEdit(loop)).toBe('9'); // refocused `end`
});

// ST-16 — clicking a cell in a different row is blocked when the current row is edited + invalid.
test('ST-16: a click on a different row is blocked; focus returns to the offending field', async () => {
  const { grid, loop } = buildGrid();
  loop.dispatch(key('f2'));
  setField(loop, '10');
  await grid.nextCell(); // Tab commits start=10 (touched), cursor on `end`, row 0 still current
  loop.focusView(grid.rows);

  clickRow(loop, 1); // click a cell in row 1
  await tick();
  expect(grid.focusedRow()?.id).toBe(1); // the click was blocked — still on row 0
  expect(grid.activeMessage()).toBe('End must be after start');
  expect(seededValueOnEdit(loop)).toBe('9'); // focus returned to `end`
});
