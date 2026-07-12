/**
 * Implementation tests — the read-only container's edge cases: the empty-source `<empty>` render, the
 * windowed-materialization path (a source with a not-yet-loaded hole renders only its loaded rows),
 * and the exposed `rows`/`overlay` handles.
 */
import { test, expect } from 'vitest';
import { Group, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

interface Row {
  id: number;
  name: string;
}
const W = 16;
const H = 5;

function renderGrid(source: GridDataSource<Row>): { rows: string[]; grid: EditableDataGrid<Row> } {
  const columns = [column({ id: 'name', title: 'Name', value: (r: Row) => r.name })];
  const grid = new EditableDataGrid<Row>({ columns, source });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const render = createRenderRoot({ width: W, height: H }, { caps });
  render.mount(root);
  const buf = render.buffer();
  const rows: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
    rows.push(s);
  }
  return { rows, grid };
}

test('should render <empty> for an empty source', () => {
  const { rows } = renderGrid(fromRows(signal<Row[]>([]), { rowKey: (r) => r.id }));
  expect(rows.join('\n')).toContain('<empty>');
});

test('should materialize only the loaded rows from a windowed source with a hole', () => {
  const loaded: Row[] = [
    { id: 1, name: 'Ada' },
    { id: 3, name: 'Cy' },
  ];
  // Reports length 3 but index 1 is not yet loaded (returns undefined).
  const holey: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => 3,
    rowAt: (i) => (i === 0 ? loaded[0] : i === 2 ? loaded[1] : undefined),
  };
  const { rows } = renderGrid(holey);
  const body = rows.slice(1).join('\n');
  expect(body).toContain('Ada');
  expect(body).toContain('Cy'); // the hole at index 1 is skipped — only the two loaded rows render
});

test('should expose the focusable rows renderer and the overlay host', () => {
  const { grid } = renderGrid(fromRows(signal<Row[]>([{ id: 1, name: 'Ada' }]), { rowKey: (r) => r.id }));
  expect(grid.rows.focusable).toBe(true);
  expect(grid.overlay).toBeInstanceOf(Group);
});
