/**
 * Implementation tests — frozen-rows + density internals beyond the ST-24/25 oracles:
 *  - frozen rows compose with frozen columns: the top-left cell (frozen row × frozen column) is pinned
 *    on BOTH axes and never moves when the body scrolls vertically or the center pans horizontally;
 *  - over-freezing rows clamps so at least one scrolling row remains, with a dev warning;
 *  - compact density keeps the header, quick-filter, and body columns aligned (the quick-filter band
 *    fills the reclaimed divider cell too).
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { EditableDataGrid } from '../src/grid.js';
import type { EditableDataGridOptions } from '../src/grid.js';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Row {
  id: number;
  name: string;
  city: string;
  dept: string;
  zone: string;
}
const mkRows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `n${i}`,
    city: String.fromCharCode(65 + i).repeat(3), // 'AAA', 'BBB', …
    dept: `d${i}`,
    zone: `z${i}`,
  }));
const COLS = () => [
  column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 3 }),
  column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 5 }),
  column<Row, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 5 }),
  column<Row, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 5 }),
  column<Row, string>({ id: 'zone', title: 'Zone', value: (r) => r.zone, width: 5 }),
];

function buildGrid(extra: Partial<EditableDataGridOptions<Row>>, rows: Row[], width = 22, height = 8) {
  const grid = new EditableDataGrid<Row>({
    columns: COLS(),
    source: fromRows(signal(rows), { rowKey: (r) => r.id }),
    ...extra,
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width, height } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  const rowText = (y: number): string => {
    loop.renderRoot.flush();
    const buf = loop.renderRoot.buffer();
    let s = '';
    for (let x = 0; x < width; x += 1) s += buf.get(x, y)?.char ?? ' ';
    return s;
  };
  const key = (k: string, ctrl = false) => loop.dispatch({ type: 'key', key: k, ctrl } as never);
  return { grid, loop, rowText, key };
}

// Frozen rows × frozen columns: the intersection (row 0, the pinned 'id' column) is doubly pinned.
test('frozen rows compose with frozen columns — the top-left cell is pinned on both axes', () => {
  const { grid, loop, rowText, key } = buildGrid({ freeze: 1, freezeRows: 1 }, mkRows(8));
  // The band is at y=1 (header y=0). The frozen 'id' column is the left panel, so row 0's id sits at x=0.
  expect(rowText(1).startsWith('0')).toBe(true); // row 0's id, pinned top-left
  expect(rowText(2)).toContain('n1'); // the scrolling body starts at row 1 (name 'n1')

  // Scroll BOTH axes: Ctrl+End jumps to the last row and last column (vertical + horizontal pan).
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  key('end', true);
  loop.renderRoot.flush();
  expect(rowText(1).startsWith('0')).toBe(true); // still pinned — neither axis moved the intersection
  expect(rowText(1)).toContain('AAA'); // row 0's city travels with the pinned band as the center pans
  const body = rowText(2) + rowText(3) + rowText(4) + rowText(5);
  expect(body).not.toContain('AAA'); // the pinned row is never duplicated into the scrolling body
});

// Over-freezing rows clamps so at least one scrolling row survives, and warns about the clamp.
test('over-freezing rows clamps to keep at least one scrolling row and warns', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const { grid, rowText } = buildGrid({ freezeRows: 100 }, mkRows(4)); // 100 ≫ 4 rows
  expect(warn).toHaveBeenCalled();
  expect(warn.mock.calls.some((c) => String(c[0]).includes('freezeRows'))).toBe(true);
  warn.mockRestore();

  // Clamped to displayLength − 1 = 3 pinned rows; the 4th row must remain scrollable in the body.
  const all = [rowText(1), rowText(2), rowText(3), rowText(4), rowText(5)].join('\n');
  expect(all).toContain('DDD'); // the last row (row 3) is still reachable — a scrolling row survived
  expect(grid.columnOrder()).toEqual(['id', 'name', 'city', 'dept', 'zone']); // grid otherwise intact
});

// Compact density keeps every band (header, quick-filter, body) aligned — including the quick-filter row,
// whose inputs fill the reclaimed divider cell.
test('compact density aligns header, quick-filter, and body columns', () => {
  const { rowText } = buildGrid({ density: 'compact', quickFilter: true }, mkRows(3));
  // No inter-column divider anywhere in compact mode.
  expect(rowText(0)).not.toContain('│'); // header
  expect(rowText(2)).not.toContain('│'); // body (row 1 is the quick-filter band at y=1)
  // The 'City' title (header, y=0) and its cell value (body, y=2) share the same start x — aligned.
  const cityX = rowText(0).indexOf('City');
  expect(cityX).toBeGreaterThan(0);
  expect(rowText(2).indexOf('AAA')).toBe(cityX); // body cell aligned under its compact header
});
