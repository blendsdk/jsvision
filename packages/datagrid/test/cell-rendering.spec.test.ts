/**
 * Specification tests (immutable oracles) — the per-cell paint path: value-driven `cellStyle`, the
 * custom `render` hook (cell-local, cell-clipped, draw-error isolated), and the fixed precedence
 * cursor > dirty > selected-row > cellStyle > zebra > normal. The self-contained `draw()` override must
 * honor every layer and paint the no-hook path byte-identically to the base engine.
 *
 * Expectations derive from the requirements + the frozen theme roles. Explicit `Style` colours use
 * Ansi16 names (`brightRed`/`cyan`); the theme roles resolve to hex — so a cell painted in an explicit
 * style is distinguishable from one painted in a theme role, which is what the precedence tests turn on.
 */
import { test, expect } from 'vitest';
import { Group, View, GridRows, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column, toEngineColumn } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 30;
const H = 5;

/** A focusable stub used to blur the grid (a plain Group is not a focus target). */
class FocusStub extends View {
  override focusable = true;
  override draw(): void {
    // nothing to paint — it exists only to hold focus away from the grid
  }
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
  focused?: number;
  focusedCol?: number;
  /** Row keys to mark selected — RD-08's set-membership selection (the body paints from this). */
  selectedKeys?: (string | number)[];
  active?: boolean;
  zebra?: boolean;
}

/** Mount an `EditableGridRows` over `typed` columns and render one frame. */
function mountGrid(typed: GridColumn<Row>[], opts: MountOpts = {}) {
  const focused = signal(opts.focused ?? 0);
  const focusedCol = signal(opts.focusedCol ?? 0);
  const selected = signal(-1); // the base's required click sink; the datagrid paints from selectedKeys
  const selectedKeys = signal<ReadonlySet<string | number>>(new Set(opts.selectedKeys ?? []));
  const indent = signal(0);
  const engineCols = typed.map((c) => toEngineColumn(c));
  const grid = new EditableGridRows<Row>({
    display: () => DATA,
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent,
    focused,
    selected,
    selectedKeys,
    zebra: opts.zebra ?? false,
    focusedCol,
    typedColumns: typed,
    overlay: new Group(),
    rowKey: (r) => r.id,
    bumpVersion: () => undefined,
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

/** A conditional-style column (col 1, width 6): negative values paint red-on-cyan. */
function styleColumns(): GridColumn<Row>[] {
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
const QTY_X = 7; // col 1 starts at width(6)+1 divider

// A negative cell that is neither cursor nor selected paints in the explicit red-on-cyan Style.
test('cellStyle paints a negative cell red-on-cyan when no higher state owns it', () => {
  // Cursor at row 0 col 0; row 2 (qty -3) is neither focused nor selected → cellStyle applies.
  const { buf } = mountGrid(styleColumns());
  expect(buf.get(QTY_X, 2)?.fg).toBe('brightRed');
  expect(buf.get(QTY_X, 2)?.bg).toBe('cyan');
});

// The cursor wins over cellStyle: the same red cell, when it is the cursor cell, paints in gridCursor.
test('cursor beats cellStyle on the focused cell', () => {
  const { buf } = mountGrid(styleColumns(), { focused: 2, focusedCol: 1, active: true });
  expect(buf.get(QTY_X, 2)?.bg).toBe(defaultTheme.gridCursor.bg); // gridCursor, not the cellStyle cyan
  expect(buf.get(QTY_X, 2)?.bg).not.toBe('cyan');
  expect(buf.get(QTY_X, 2)?.fg).toBe(defaultTheme.gridCursor.fg);
});

// The selected row wins over cellStyle: the red cell in the selected row paints in listSelected.
// RD-08: selection is set membership by rowKey — row index 2 is id 3 (see DATA).
test('selected row beats cellStyle', () => {
  const { buf } = mountGrid(styleColumns(), { focused: 0, selectedKeys: [3], active: true });
  expect(buf.get(QTY_X, 2)?.bg).toBe(defaultTheme.listSelected.bg); // theme hex, not the cellStyle name
  expect(buf.get(QTY_X, 2)?.fg).toBe(defaultTheme.listSelected.fg);
  expect(buf.get(QTY_X, 2)?.fg).not.toBe('brightRed');
});

// The render hook paints its glyph at the cell's top-left in the explicit fg.
test('render paints a glyph at the cell origin in its explicit Style', () => {
  const typed: GridColumn<Row>[] = [
    column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 6 }),
    column<Row, number>({
      id: 'dot',
      title: 'Dot',
      value: (r) => r.qty,
      width: 6,
      render: (ctx) => ctx.text(0, 0, '●', { fg: 'brightGreen', bg: 'cyan' }),
    }),
  ];
  const { buf } = mountGrid(typed); // cursor at row 0 col 0 → inspect row 1 col 1 (not the cursor)
  expect(buf.get(QTY_X, 1)?.char).toBe('●');
  expect(buf.get(QTY_X, 1)?.fg).toBe('brightGreen');
});

// A throwing render degrades one cell (a ⚠ in gridDirty fg over the row bg); siblings + other rows render.
test('a throwing render is isolated to its own cell', () => {
  const typed: GridColumn<Row>[] = [
    column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 6 }),
    column<Row, number>({
      id: 'boom',
      title: 'Boom',
      value: (r) => r.qty,
      width: 6,
      render: () => {
        throw new Error('boom');
      },
    }),
  ];
  const { buf } = mountGrid(typed); // cursor at row 0 col 0 → inspect row 1 (a normal row)
  expect(buf.get(QTY_X, 1)?.char).toBe('⚠');
  expect(buf.get(QTY_X, 1)?.fg).toBe(defaultTheme.gridDirty.fg); // theme-adaptive red, no danger role
  expect(buf.get(QTY_X, 1)?.bg).toBe(defaultTheme.listNormal.bg); // over the row bg
  expect(buf.get(0, 1)?.char).toBe('B'); // the sibling name cell still renders ("Bo")
  expect(buf.get(0, 2)?.char).toBe('C'); // another row still renders ("Cy")
});

// A renderer cannot overflow its cell; the default path truncates a too-wide string without overflow.
test('render is cell-clipped and the default path truncates within the column', () => {
  const typed: GridColumn<Row>[] = [
    column<Row, string>({
      id: 'wide',
      title: 'Wide',
      value: (r) => r.name,
      width: 3,
      render: (ctx) => ctx.text(0, 0, 'XXXXXXXX', { fg: 'brightGreen', bg: 'cyan' }),
    }),
    column<Row, string>({ id: 'long', title: 'Long', value: () => 'Wolfeschlegel', width: 3 }),
  ];
  // col 0 width 3 → x 0..2, divider at x 3; col 1 x 4..6, divider at x 7. Inspect row 1 (not the cursor).
  const { buf } = mountGrid(typed);
  expect(buf.get(0, 1)?.char).toBe('X'); // the renderer painted inside its cell
  expect(buf.get(4, 1)?.char).not.toBe('X'); // …but did NOT overflow into the neighbour column
  expect(buf.get(4, 1)?.char).toBe('W'); // the neighbour's own (truncated) content
  expect(buf.get(7, 1)?.char).toBe('│'); // the long string clipped to 3 cells — no overflow past the divider
});

// With neither hook set, the override paints byte-identically to the base GridRows engine.
test('the no-hook path renders byte-identically to the base engine', () => {
  const typed = styleColumns().map((c) => ({ id: c.id, title: c.title, value: c.value, width: c.width }));
  const engineCols: Column<Row>[] = typed.map((c) => toEngineColumn(c));

  // Base GridRows (unfocused → no cursor overpaint to diverge on).
  const bFocused = signal(0);
  const base = new GridRows<Row>({
    display: () => DATA,
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent: signal(0),
    focused: bFocused,
    selected: signal(-1),
    zebra: false,
  });
  base.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const bStub = new FocusStub();
  bStub.layout = { position: 'absolute', rect: { x: 0, y: H - 1, width: 1, height: 1 } };
  const bRoot = new Group();
  bRoot.add(base);
  bRoot.add(bStub);
  const bLoop = createEventLoop({ width: W, height: H }, { caps });
  bLoop.mount(bRoot);
  bLoop.focusView(bStub); // blur the base grid
  const baseBuf = bLoop.renderRoot.buffer();

  const { buf } = mountGrid(typed, { active: false }); // the override, also unfocused

  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const a = baseBuf.get(x, y);
      const b = buf.get(x, y);
      expect(b?.char, `char@${x},${y}`).toBe(a?.char);
      expect(b?.fg, `fg@${x},${y}`).toBe(a?.fg);
      expect(b?.bg, `bg@${x},${y}`).toBe(a?.bg);
    }
  }
});
