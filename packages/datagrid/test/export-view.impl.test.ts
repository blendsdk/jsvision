/**
 * Implementation tests — the exporter's edges: a throwing column `format` degrades one cell to
 * `String(value)`, zero rows yield a header-only (or `[]`) document, a cell that needs both
 * formula-escaping and RFC-4180 quoting is handled, and an empty column set is inert. The pure
 * serializer is exercised directly; the `format`-throws fallback lives in the grid method, tested there.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { serializeView } from '../src/export-view.js';
import type { ExportColumn } from '../src/export-view.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const W = 24;
const H = 6;

function mount<T>(grid: EditableDataGrid<T>): EditableDataGrid<T> {
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return grid;
}

// A throwing formatter degrades only its own cell to String(value); the export as a whole still succeeds.
test('a throwing column format falls back to String(value) for that cell', () => {
  const columns = [
    column<{ id: number; n: number }, number>({
      id: 'n',
      title: 'N',
      value: (r) => r.n,
      format: () => {
        throw new Error('boom');
      },
    }),
  ];
  const grid = mount(
    new EditableDataGrid({ columns, source: fromRows(signal([{ id: 1, n: 42 }]), { rowKey: (r) => r.id }) }),
  );
  expect(grid.exportView('csv')).toBe('N\r\n42'); // fell back to String(42), no throw
});

// Zero displayed rows: CSV/HTML/TSV are header-only; JSON is an empty array — never an exception.
test('zero rows yields a header-only document (or an empty JSON array)', () => {
  const columns = [column<{ id: number; name: string }, string>({ id: 'name', title: 'Name', value: (r) => r.name })];
  const grid = mount(
    new EditableDataGrid({
      columns,
      source: fromRows(signal<{ id: number; name: string }[]>([]), { rowKey: (r) => r.id }),
    }),
  );
  expect(grid.exportView('csv')).toBe('Name'); // just the header, no trailing CRLF
  expect(grid.exportView('tsv')).toBe('Name');
  expect(grid.exportView('json')).toBe('[]');
  const html = grid.exportView('html');
  expect(html).toContain('<th>Name</th>');
  expect(html).toContain('<tbody>\n\n</tbody>'); // an empty body
});

// A cell that both triggers a formula and contains the delimiter is formula-escaped THEN quoted.
test('a cell needing both formula-escape and quoting is escaped then quoted', () => {
  const cols: ExportColumn<{ f: string }>[] = [{ id: 'f', title: 'F', text: (r) => r.f, raw: (r) => r.f }];
  const csv = serializeView(cols, [{ f: '=1,2' }], 'csv');
  expect(csv).toBe('F\r\n"\'=1,2"'); // '=1,2 → prefixed with ', then quoted for the embedded comma
});

// An empty column set is inert: no field is emitted, and every format produces a well-formed document.
test('an empty column set produces a well-formed (empty-field) document', () => {
  const cols: ExportColumn<{ a: number }>[] = [];
  expect(serializeView(cols, [{ a: 1 }], 'json')).toBe('[\n  {}\n]'); // one empty object
  expect(serializeView(cols, [], 'json')).toBe('[]');
  expect(serializeView(cols, [{ a: 1 }], 'csv')).toBe('\r\n'); // an empty header + one empty record
});
