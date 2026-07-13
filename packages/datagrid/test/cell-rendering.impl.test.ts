/**
 * Implementation tests — the per-cell paint edges: the full precedence matrix (including cellStyle over
 * a zebra stripe and a dirty marker surviving over a cellStyle cell), the empty grid, a wide-glyph
 * clip, `cellStyle` returning a bare `Style` vs a theme role name, and a scrolled (indented) cell clip.
 */
import { test, expect } from 'vitest';
import { Group, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column, toEngineColumn } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { createDirtyRegistry, cellKey } from '../src/editing.js';
import type { DirtyRegistry } from '../src/editing.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 30;
const H = 5;

class FocusStub extends View {
  override focusable = true;
  override draw(): void {}
}

interface Row {
  id: number;
  name: string;
  qty: number;
}
const DATA: Row[] = [
  { id: 1, name: 'Ada', qty: -5 },
  { id: 2, name: 'Bo', qty: 10 },
  { id: 3, name: 'Cy', qty: -3 },
];

interface MountOpts {
  data?: Row[];
  focused?: number;
  focusedCol?: number;
  selected?: number;
  active?: boolean;
  zebra?: boolean;
  indent?: number;
  dirty?: DirtyRegistry;
}

function mount(typed: GridColumn<Row>[], opts: MountOpts = {}) {
  const data = opts.data ?? DATA;
  const focused = signal(opts.focused ?? 0);
  const focusedCol = signal(opts.focusedCol ?? 0);
  const selected = signal(opts.selected ?? -1);
  const indent = signal(opts.indent ?? 0);
  const engineCols = typed.map((c) => toEngineColumn(c));
  const grid = new EditableGridRows<Row>({
    display: () => data,
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent,
    focused,
    selected,
    zebra: opts.zebra ?? false,
    focusedCol,
    typedColumns: typed,
    overlay: new Group(),
    rowKey: (r) => r.id,
    bumpVersion: () => undefined,
    dirty: opts.dirty,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const stub = new FocusStub();
  stub.layout = { position: 'absolute', rect: { x: 0, y: H - 1, width: 1, height: 1 } };
  const root = new Group();
  root.add(grid);
  root.add(stub);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(opts.active === false ? stub : grid);
  return { loop, buf: loop.renderRoot.buffer() };
}

/** A cellStyle column (col 1, width 6) painting negatives red-on-cyan. */
function redOnNegative(): GridColumn<Row>[] {
  return [
    column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 6 }),
    column<Row, number>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      width: 6,
      cellStyle: (v) => (v < 0 ? { fg: 'brightRed', bg: 'cyan' } : 'listNormal'),
    }),
  ];
}
const QTY_X = 7;

// cellStyle beats a zebra stripe: an odd, non-focused, non-selected negative row paints red, not the stripe.
test('cellStyle beats a zebra stripe', () => {
  // Cursor at row 0; row 2 is odd (zebra candidate), negative, and neither focused nor selected.
  const { buf } = mount(redOnNegative(), { zebra: true });
  expect(buf.get(QTY_X, 2)?.bg).toBe('cyan'); // the explicit cellStyle bg, not the staticText stripe
  expect(buf.get(QTY_X, 2)?.bg).not.toBe(defaultTheme.staticText.bg);
});

// A positive cell keeps the row colour (its cellStyle returns the normal role, no override).
test('a non-matching cellStyle leaves the row colour intact', () => {
  const { buf } = mount(redOnNegative()); // row 1 (qty 10, positive) is normal, not focused/selected
  expect(buf.get(QTY_X, 1)?.bg).toBe(defaultTheme.listNormal.bg);
  expect(buf.get(QTY_X, 1)?.fg).not.toBe('brightRed');
});

// cellStyle may return a theme ROLE name, resolved against the active theme.
test('cellStyle resolves a returned role name', () => {
  const typed: GridColumn<Row>[] = [
    column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 6 }),
    column<Row, number>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      width: 6,
      cellStyle: (v) => (v < 0 ? 'tableHeader' : 'listNormal'),
    }),
  ];
  const { buf } = mount(typed); // row 2 negative, not focused/selected
  expect(buf.get(QTY_X, 2)?.bg).toBe(defaultTheme.tableHeader.bg);
  expect(buf.get(QTY_X, 2)?.fg).toBe(defaultTheme.tableHeader.fg);
});

// A dirty marker survives (over-paints) a cellStyle cell — dirty beats cellStyle.
test('a dirty marker survives over a cellStyle cell', () => {
  const dirty = createDirtyRegistry();
  dirty.add(cellKey(3, 'qty')); // row id 3 is display row 2 (qty -3, cellStyle red)
  const { buf } = mount(redOnNegative(), { dirty });
  // The marker sits at the cell's right edge: start(7) + width(6) - 1 = 12.
  expect(buf.get(12, 2)?.char).toBe('•');
  expect(buf.get(12, 2)?.fg).toBe(defaultTheme.gridDirty.fg);
});

// An empty grid shows the <empty> placeholder at (1,0).
test('an empty grid shows the placeholder', () => {
  const { buf } = mount(redOnNegative(), { data: [] });
  const row0 = Array.from({ length: 7 }, (_, x) => buf.get(x, 0)?.char).join('');
  expect(row0).toBe(' <empty'); // one cell in, then "<empty>" (clipped view start)
});

// A renderer with a wide glyph is clipped whole — a width-2 glyph that would straddle the edge is dropped.
test('a wide-glyph renderer is clipped without splitting', () => {
  const typed: GridColumn<Row>[] = [
    column<Row, string>({
      id: 'warn',
      title: 'Warn',
      value: (r) => r.name,
      width: 3,
      render: (ctx) => ctx.text(0, 0, '⚠⚠', { fg: 'brightRed', bg: 'cyan' }), // 2×2 = 4 cols in a 3-wide cell
    }),
    column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 6 }),
  ];
  const { buf } = mount(typed); // col0 x0..2, divider x3, col1 x4..; inspect row 1
  expect(buf.get(0, 1)?.char).toBe('⚠'); // first ⚠ fits (cols 0-1)
  expect(buf.get(3, 1)?.char).toBe('│'); // the second ⚠ (cols 2-3) is dropped whole — divider intact
  expect(buf.get(2, 1)?.char).not.toBe('⚠'); // nothing straddles the cell edge
});

// With horizontal scroll (indent), a renderer still cannot overflow into the neighbour column.
test('an indented renderer stays cell-clipped', () => {
  const typed: GridColumn<Row>[] = [
    column<Row, string>({
      id: 'x',
      title: 'X',
      value: (r) => r.name,
      width: 4,
      render: (ctx) => ctx.text(0, 0, 'XXXXXX', { fg: 'brightGreen', bg: 'cyan' }),
    }),
    column<Row, string>({ id: 'y', title: 'Y', value: () => 'YYYY', width: 4 }),
    column<Row, string>({ id: 'z', title: 'Z', value: () => 'ZZZZ', width: 30 }), // forces overflow → indent works
  ];
  // col0 start 0, col1 start 5, col2 start 10. indent 2 → col0 x=-2, col1 x=3, col2 x=8.
  const { buf } = mount(typed, { indent: 2 });
  // The col0 renderer (offset x=-2, clipped to its 4-wide cell) must not paint at col1's start (x=3).
  expect(buf.get(3, 1)?.char).not.toBe('X');
  expect(buf.get(3, 1)?.char).toBe('Y'); // col1's own content begins here
});
