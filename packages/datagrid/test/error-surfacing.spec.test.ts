/**
 * Specification tests (immutable oracles) — error surfacing. An invalid cell is painted in the
 * `gridInvalid` role (a solid band, above any pending-commit marker); the active validation message is
 * shown in a reactive one-line band in the footer region, present even when no footer is configured.
 * Correcting the value (a successful re-commit) or abandoning the edit (Escape) clears both the marker
 * and the message, so a cell that once again holds a valid value never keeps a stale invalid band.
 *
 * Expectations derive from the requirements, never the implementation. The `gridInvalid` bytes are the
 * frozen theme role; commit is await-close (async), so a committing dispatch is followed by `tick()`.
 */
import { test, expect } from 'vitest';
import { Group, Input, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column, toEngineColumn } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { PARSE_FAILED } from '../src/format.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { EditableDataGrid } from '../src/grid.js';
import { createErrorRegistry } from '../src/error-registry.js';
import { cellKey } from '../src/editing.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const key = (k: string) => ({ type: 'key' as const, key: k, ctrl: false, alt: false, shift: false });

// ─── §1 body-level paint (ST-7, ST-9): the gridInvalid band over an invalid cell ────────────────────

const BW = 12;
const BH = 4;

/** A focusable stub used to blur the grid so no cursor overpaint competes with the invalid band. */
class FocusStub extends View {
  override focusable = true;
  override draw(): void {}
}

interface Cell {
  id: number;
  qty: number;
}
const CELLS: Cell[] = [
  { id: 1, qty: 1 },
  { id: 2, qty: 2 },
  { id: 3, qty: 3 },
];

/** Mount an `EditableGridRows` over one column with an injected error registry; blurred (no cursor). */
function paintGrid(errors: ReturnType<typeof createErrorRegistry>) {
  const typed: GridColumn<Cell>[] = [column<Cell, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: BW })];
  const engineCols = typed.map(toEngineColumn);
  const grid = new EditableGridRows<Cell>({
    display: () => CELLS,
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent: signal(0),
    focused: signal(0),
    selected: signal(-1),
    zebra: false,
    focusedCol: signal(0),
    typedColumns: typed,
    overlay: new Group(),
    rowKey: (r) => r.id,
    bumpVersion: () => undefined,
    errors,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: BW, height: BH } };
  const stub = new FocusStub();
  stub.layout = { position: 'absolute', rect: { x: 0, y: BH - 1, width: 1, height: 1 } };
  const root = new Group();
  root.add(grid);
  root.add(stub);
  const loop = createEventLoop({ width: BW, height: BH }, { caps });
  loop.mount(root);
  loop.focusView(stub); // blur the grid — no cursor cell
  return loop.renderRoot.buffer();
}

// ST-7 — an invalid cell's rect is painted in the gridInvalid role.
test('ST-7: an invalid cell is painted in the gridInvalid band', () => {
  const errors = createErrorRegistry();
  errors.set(cellKey(2, 'qty'), 'bad'); // row index 1
  const buf = paintGrid(errors);
  expect(buf.get(0, 1)?.bg).toBe(defaultTheme.gridInvalid.bg); // the invalid cell's band
  expect(buf.get(0, 1)?.fg).toBe(defaultTheme.gridInvalid.fg);
  expect(buf.get(0, 0)?.bg).not.toBe(defaultTheme.gridInvalid.bg); // a valid cell is untouched
});

// ST-9 — two invalid cells are both painted; the registry exposes the most-recent message as active.
test('ST-9: two invalid cells both paint the band; active() is the most-recent message', () => {
  const errors = createErrorRegistry();
  errors.set(cellKey(1, 'qty'), 'first'); // row index 0
  errors.set(cellKey(3, 'qty'), 'second'); // row index 2
  const buf = paintGrid(errors);
  expect(buf.get(0, 0)?.bg).toBe(defaultTheme.gridInvalid.bg);
  expect(buf.get(0, 2)?.bg).toBe(defaultTheme.gridInvalid.bg);
  expect(errors.active()).toBe('second'); // last writer wins
});

// ─── §2 container-level surfacing (ST-8, ST-10, ST-24): the message band + clearing ─────────────────

const W = 24;
const H = 6;

interface Row {
  id: number;
  qty: number;
}

function buildGrid() {
  const rows = signal<Row[]>([
    { id: 1, qty: 5 },
    { id: 2, qty: 8 },
  ]);
  const grid = new EditableDataGrid<Row>({
    columns: [
      column<Row, number>({
        id: 'qty',
        title: 'Qty',
        value: (r) => r.qty,
        parse: (t) => {
          const n = Number(t);
          return Number.isFinite(n) && t.trim() !== '' ? n : PARSE_FAILED;
        },
        set: (r, v) => {
          r.qty = v;
        },
        validate: (v) => (v > 0 ? null : 'must be positive'),
        width: 10,
      }),
    ],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  return { grid, loop, rows };
}

/** Every character painted on the frame, one string, so a message-band scan is position-agnostic. */
function frameText(loop: ReturnType<typeof buildGrid>['loop']): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

function editTo(loop: ReturnType<typeof buildGrid>['loop'], text: string): void {
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set(text);
}

// ST-10 — an invalid commit surfaces its message in the band even with no footer configured.
test('ST-10: the message band renders the active message with no footer configured', async () => {
  const { grid, loop } = buildGrid(); // no footer option
  editTo(loop, '-1');
  loop.dispatch(key('enter'));
  await tick();
  loop.renderRoot.flush();
  expect(grid.activeMessage()).toBe('must be positive');
  expect(frameText(loop)).toContain('must be positive'); // the band rendered it
});

// ST-8 — correcting the value and re-committing clears both the marker and the message.
test('ST-8: correcting the value clears the marker and the message', async () => {
  const { grid, loop, rows } = buildGrid();
  editTo(loop, '-1');
  loop.dispatch(key('enter'));
  await tick();
  expect(grid.isInvalid(1, 'qty')).toBe(true);

  // Correct the still-open editor to a valid value and re-commit.
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('3');
  loop.dispatch(key('enter'));
  await tick();
  loop.renderRoot.flush();
  expect(rows()[0].qty).toBe(3); // committed
  expect(grid.isInvalid(1, 'qty')).toBe(false); // marker cleared
  expect(grid.activeMessage()).toBeNull(); // message cleared
  expect(frameText(loop)).not.toContain('must be positive');
});

// ST-24 — abandoning the edit with Escape clears the marker and message; the cell keeps its valid value.
test('ST-24: Escape after a blocked commit clears the marker and message (no stale band)', async () => {
  const { grid, loop, rows } = buildGrid();
  editTo(loop, '-1');
  loop.dispatch(key('enter'));
  await tick();
  expect(grid.isInvalid(1, 'qty')).toBe(true);

  loop.dispatch(key('escape')); // abandon the bad edit
  await tick();
  loop.renderRoot.flush();
  expect(rows()[0].qty).toBe(5); // the untouched, valid prior value
  expect(grid.isInvalid(1, 'qty')).toBe(false); // no stale marker on a valid-valued cell
  expect(grid.activeMessage()).toBeNull();
  expect(frameText(loop)).not.toContain('must be positive');
});
