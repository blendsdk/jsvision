/**
 * Implementation tests — `EditableGridRows` internals: grid-corner clamp exactness, the focused-cell
 * overpaint math under a horizontal-scroll offset (including a partial-width edge column), and the
 * `focusedCol` bind that repaints the cursor when the column changes.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { EditableGridRows } from '../src/editable-grid-rows.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
}

interface Row {
  a: string;
  b: string;
}
const DATA: Row[] = [
  { a: 'a1', b: 'b1' },
  { a: 'a2', b: 'b2' },
  { a: 'a3', b: 'b3' },
];

const WIDE_COLS: Column<Row>[] = [
  { title: 'A', accessor: (r) => r.a, width: 8 },
  { title: 'B', accessor: (r) => r.b, width: 8 },
  { title: 'C', accessor: (r) => r.a + r.b, width: 6 },
];

function build(opts: {
  cols: Column<Row>[];
  width: number;
  height?: number;
  indentStart?: number;
  focusedColStart?: number;
}) {
  const focused = signal(0);
  const focusedCol = signal(opts.focusedColStart ?? 0);
  const selected = signal(-1);
  const indent = signal(opts.indentStart ?? 0);
  const grid = new EditableGridRows<Row>({
    display: () => DATA,
    columns: opts.cols,
    autoWidths: () => opts.cols.map(() => null),
    indent,
    focused,
    selected,
    zebra: false,
    focusedCol,
  });
  const height = opts.height ?? 5;
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: opts.width, height } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: opts.width, height }, { caps });
  loop.mount(root);
  loop.focusView(grid);
  return { grid, loop, focused, focusedCol, indent };
}

// Corner clamp exactness — Ctrl+Home/Ctrl+End land on the exact corners and are idempotent there.
test('Ctrl+Home/Ctrl+End clamp exactly at the grid corners (idempotent)', () => {
  const { loop, focused, focusedCol } = build({ cols: WIDE_COLS, width: 30 });
  loop.dispatch(key('end', { ctrl: true }));
  expect([focused(), focusedCol()]).toEqual([DATA.length - 1, WIDE_COLS.length - 1]);
  loop.dispatch(key('end', { ctrl: true })); // already at the bottom-right corner — no move
  expect([focused(), focusedCol()]).toEqual([DATA.length - 1, WIDE_COLS.length - 1]);
  loop.dispatch(key('home', { ctrl: true }));
  expect([focused(), focusedCol()]).toEqual([0, 0]);
  loop.dispatch(key('home', { ctrl: true })); // already at the top-left corner — no move
  expect([focused(), focusedCol()]).toEqual([0, 0]);
});

// Overpaint under horizontal scroll — the cursor box follows the pan and clips at the viewport edge.
test('the cursor overpaint tracks the horizontal scroll offset and clips at the edge', () => {
  // Two 10-wide columns in a 12-wide viewport: with indent 5, column 1 is a partial-width edge column.
  const cols: Column<Row>[] = [
    { title: 'A', accessor: (r) => r.a, width: 10 },
    { title: 'B', accessor: (r) => r.b, width: 10 },
  ];
  const { loop } = build({ cols, width: 12, indentStart: 5, focusedColStart: 1 });
  const buf = loop.renderRoot.buffer();
  // Column 1 starts at content x 11; panned left by 5 it renders from screen x 6 and is clipped at 11.
  expect(buf.get(6, 0)?.bg).toBe(defaultTheme.gridCursor.bg);
  expect(buf.get(11, 0)?.bg).toBe(defaultTheme.gridCursor.bg);
  // Column 0's visible tail (screen x 0..4) is not the cursor — it keeps the focused-row colour.
  expect(buf.get(2, 0)?.bg).toBe(defaultTheme.listFocused.bg);
});

// focusedCol bind — moving the column cursor repaints it to the new column.
test('a focusedCol change repaints the cursor to the new column', () => {
  const { loop, focusedCol } = build({ cols: WIDE_COLS, width: 30, focusedColStart: 0 });
  expect(loop.renderRoot.buffer().get(0, 0)?.bg).toBe(defaultTheme.gridCursor.bg); // cursor at column 0
  focusedCol.set(1); // a bare signal set outside a dispatch tick
  loop.renderRoot.flush(); // force the deferred frame the bind scheduled
  const after = loop.renderRoot.buffer();
  expect(after.get(0, 0)?.bg).not.toBe(defaultTheme.gridCursor.bg); // column 0 is no longer the cursor
  expect(after.get(9, 0)?.bg).toBe(defaultTheme.gridCursor.bg); // column 1 (starts at screen x 9) is now the cursor
});
