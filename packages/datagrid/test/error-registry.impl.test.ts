/**
 * Implementation tests — the error registry's active-message channel (last-writer-wins across keyed
 * `set` and the keyless `note`, with `clear`/`note(null)` falling back to the most-recent still-invalid
 * cell rather than going blank) and the cell paint precedence `cursor > gridInvalid > gridDirty`.
 */
import { test, expect } from 'vitest';
import { Group, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column, toEngineColumn } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { createErrorRegistry } from '../src/error-registry.js';
import { createDirtyRegistry, cellKey } from '../src/editing.js';

// ─── registry active-message channel ────────────────────────────────────────────────────────────────

test('set makes the message active; clearing the active cell falls back to a still-invalid cell', () => {
  const r = createErrorRegistry();
  r.set('a', 'A');
  expect(r.active()).toBe('A');
  expect(r.has('a')).toBe(true);
  r.set('b', 'B');
  expect(r.active()).toBe('B'); // last writer wins
  r.clear('b');
  expect(r.active()).toBe('A'); // falls back to the still-invalid 'a', not blank
  r.clear('a');
  expect(r.active()).toBeNull();
  expect(r.has('a')).toBe(false);
});

test('clearing a non-active cell leaves the active message untouched', () => {
  const r = createErrorRegistry();
  r.set('a', 'A');
  r.set('b', 'B'); // active = B
  r.clear('a'); // 'a' is not the active source
  expect(r.active()).toBe('B');
  expect(r.keys()).toStrictEqual(new Set(['b']));
});

test('note pushes a transient message; note(null) falls back to a still-invalid cell, not blank', () => {
  const r = createErrorRegistry();
  r.set('a', 'cellA'); // active = cellA
  r.note('rowMsg');
  expect(r.active()).toBe('rowMsg'); // the transient row message wins
  expect(r.has('a')).toBe(true); // a note is keyless — the cell stays invalid
  r.note(null);
  expect(r.active()).toBe('cellA'); // falls back to the still-invalid cell, not blank
});

test('note(null) clears the band when no cell is invalid', () => {
  const r = createErrorRegistry();
  r.note('x');
  expect(r.active()).toBe('x');
  r.note(null);
  expect(r.active()).toBeNull();
});

test('re-setting a key updates its message and makes it the most-recent fallback', () => {
  const r = createErrorRegistry();
  r.set('a', 'A');
  r.set('b', 'B'); // order: a, b
  r.set('a', 'A2'); // 'a' re-inserted to the end; active = A2
  expect(r.active()).toBe('A2');
  expect(r.message('a')).toBe('A2');
  r.clear('a'); // the active cell cleared → fall back to the last remaining ('b')
  expect(r.active()).toBe('B');
});

test('message() reads a cell; keys() is the invalid set', () => {
  const r = createErrorRegistry();
  r.set('a', 'A');
  r.set('b', 'B');
  expect(r.message('a')).toBe('A');
  expect(r.message('missing')).toBeUndefined();
  expect(r.keys()).toStrictEqual(new Set(['a', 'b']));
});

// ─── paint precedence: cursor > gridInvalid > gridDirty ──────────────────────────────────────────────

const BW = 12;
const BH = 4;

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

function mountBody(opts: {
  errors: ReturnType<typeof createErrorRegistry>;
  dirty?: ReturnType<typeof createDirtyRegistry>;
  focused?: number;
  active?: boolean;
}) {
  const typed: GridColumn<Cell>[] = [column<Cell, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: BW })];
  const engineCols = typed.map(toEngineColumn);
  const grid = new EditableGridRows<Cell>({
    display: () => CELLS,
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent: signal(0),
    focused: signal(opts.focused ?? 0),
    selected: signal(-1),
    zebra: false,
    focusedCol: signal(0),
    typedColumns: typed,
    overlay: new Group(),
    rowKey: (r) => r.id,
    bumpVersion: () => undefined,
    dirty: opts.dirty,
    errors: opts.errors,
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: BW, height: BH } });
  const stub = new FocusStub();
  stub.setLayout({ position: 'absolute', rect: { x: 0, y: BH - 1, width: 1, height: 1 } });
  const root = new Group();
  root.add(grid);
  root.add(stub);
  const loop = createEventLoop(
    { width: BW, height: BH },
    { caps: resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile },
  );
  loop.mount(root);
  loop.focusView(opts.active === false ? stub : grid);
  return loop.renderRoot.buffer();
}

test('invalid beats dirty: a cell that is both paints the gridInvalid band with no pending dot', () => {
  const dirty = createDirtyRegistry();
  const errors = createErrorRegistry();
  const k = cellKey(2, 'qty'); // row index 1
  dirty.add(k);
  errors.set(k, 'bad');
  const buf = mountBody({ errors, dirty, active: false }); // blurred → no cursor competes
  expect(buf.get(0, 1)?.bg).toBe(defaultTheme.gridInvalid.bg); // the band, not a plain row bg
  expect(buf.get(BW - 1, 1)?.char).not.toBe('•'); // the dirty dot is suppressed on an invalid cell
});

test('cursor beats invalid: the focused invalid cell keeps the gridCursor box', () => {
  const errors = createErrorRegistry();
  errors.set(cellKey(1, 'qty'), 'bad'); // row index 0 — the cursor cell
  const buf = mountBody({ errors, focused: 0, active: true });
  expect(buf.get(0, 0)?.bg).toBe(defaultTheme.gridCursor.bg); // cursor wins over the invalid band
  expect(buf.get(0, 0)?.bg).not.toBe(defaultTheme.gridInvalid.bg);
});
