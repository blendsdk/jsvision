/**
 * Specification tests (immutable oracle) — `grid.exportView(format)` serializes the current view
 * (visible columns in display order, formatted values, the filtered + sorted rows) to CSV / HTML /
 * JSON / TSV. CSV/TSV are RFC-4180 (delimiter-or-quote-or-newline fields double-quoted, embedded
 * quotes doubled, records CRLF-joined); HTML is a standalone document; JSON is raw values keyed by
 * column id. A windowed source is unsupported and throws a clear error. Expectations derive from the
 * requirements + the export contract, never the implementation.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const W = 40;
const H = 8;

/** Lay out + mount a grid so its reactive reads settle; return it. */
function mount<T>(grid: EditableDataGrid<T>): EditableDataGrid<T> {
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return grid;
}

interface Emp {
  id: number;
  name: string;
  dept: string;
  total: number;
}

const EMPS: Emp[] = [
  { id: 1, name: 'Ann', dept: 'Eng', total: 10 },
  { id: 2, name: 'Bob', dept: 'Ops', total: 30 },
  { id: 3, name: 'Cy', dept: 'Sales', total: 20 },
];

/** id + name columns, titles "ID"/"Name"; unformatted (String(value)). */
function idNameGrid(rows: Array<{ id: number; name: string }>): EditableDataGrid<{ id: number; name: string }> {
  const columns = [
    column<{ id: number; name: string }, number>({ id: 'id', title: 'ID', value: (r) => r.id }),
    column<{ id: number; name: string }, string>({ id: 'name', title: 'Name', value: (r) => r.name }),
  ];
  return mount(new EditableDataGrid({ columns, source: fromRows(signal(rows), { rowKey: (r) => r.id }) }));
}

// A 2-column, 2-row grid exports CSV as a title header + formatted cells, CRLF-joined, no trailing CRLF.
test('CSV: title header, formatted cells, CRLF records, no trailing separator', () => {
  const grid = idNameGrid([
    { id: 1, name: 'Ann' },
    { id: 2, name: 'Bob' },
  ]);
  expect(grid.exportView('csv')).toBe('ID,Name\r\n1,Ann\r\n2,Bob');
});

// A field containing the delimiter is double-quoted.
test('CSV: a field containing a comma is quoted', () => {
  const grid = idNameGrid([{ id: 1, name: 'Ann, Bob' }]);
  expect(grid.exportView('csv')).toBe('ID,Name\r\n1,"Ann, Bob"');
});

// A field containing a double-quote is quoted with the embedded quote doubled.
test('CSV: a field containing a quote is quoted and the quote doubled', () => {
  const grid = idNameGrid([{ id: 1, name: 'she said "hi"' }]);
  expect(grid.exportView('csv')).toBe('ID,Name\r\n1,"she said ""hi"""');
});

// A field containing a newline is quoted (the embedded newline is preserved inside the quotes).
test('CSV: a field containing a newline is quoted', () => {
  const grid = idNameGrid([{ id: 1, name: 'a\nb' }]);
  expect(grid.exportView('csv')).toBe('ID,Name\r\n1,"a\nb"');
});

// The cell text is the column's formatted string, not the raw value.
test('CSV: the cell is the formatted string, not the raw value', () => {
  const columns = [
    column<{ id: number; amount: number }, number>({
      id: 'amount',
      title: 'Amount',
      value: (r) => r.amount,
      format: (n) => '$' + n,
    }),
  ];
  const grid = mount(
    new EditableDataGrid({ columns, source: fromRows(signal([{ id: 1, amount: 1000 }]), { rowKey: (r) => r.id }) }),
  );
  expect(grid.exportView('csv')).toBe('Amount\r\n$1000');
});

// Only the visible columns in display order and only the filtered rows are exported (hide + reorder).
test('CSV: exports visible columns in display order and only the filtered rows', () => {
  const columns = [
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id }),
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name }),
    column<Emp, number>({ id: 'total', title: 'Total', value: (r) => r.total }),
  ];
  const grid = mount(
    new EditableDataGrid({ columns, source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }) }),
  );
  grid.setFilter('name', { kind: 'text', op: 'contains', value: 'nn' }); // keeps only Ann
  grid.setColumnVisible('id', false); // hide id
  grid.setColumnOrder(['total', 'name']); // reorder the remaining visible columns
  expect(grid.exportView('csv')).toBe('Total,Name\r\n10,Ann');
});

// HTML export is a standalone document: a doctype, a charset meta, and one <table> with a header +
// body row.
test('HTML: a standalone document with a charset meta and a table', () => {
  const grid = idNameGrid([{ id: 1, name: 'Ann' }]);
  const html = grid.exportView('html');
  expect(html.startsWith('<!doctype html>')).toBe(true);
  expect(html).toContain('<meta charset="utf-8">');
  expect(html).toContain('<table>');
  expect(html).toContain('<thead>');
  expect(html).toContain('<tbody>');
  expect(html).toContain('<th>ID</th>');
  expect(html).toContain('<th>Name</th>');
  expect(html).toContain('<td>Ann</td>');
});

// Every HTML title and cell is markup-escaped so exported data can never inject live markup.
test('HTML: titles and cells are markup-escaped', () => {
  const columns = [column<{ id: number; v: string }, string>({ id: 'v', title: 'X"Y', value: (r) => r.v })];
  const grid = mount(
    new EditableDataGrid({ columns, source: fromRows(signal([{ id: 1, v: 'a & b' }]), { rowKey: (r) => r.id }) }),
  );
  const html = grid.exportView('html');
  expect(html).toContain('<th>X&quot;Y</th>');
  expect(html).toContain('<td>a &amp; b</td>');
});

// The HTML body reflects the filtered + sorted rows, in sort order.
test('HTML: the body reflects the filtered + sorted rows in order', () => {
  const columns = [
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name }),
    column<Emp, number>({ id: 'total', title: 'Total', value: (r) => r.total }),
  ];
  const grid = mount(
    new EditableDataGrid({ columns, source: fromRows(signal(EMPS.slice()), { rowKey: (r) => r.id }) }),
  );
  grid.setFilter('total', { kind: 'number', op: 'between', a: 20, b: 40 }); // keeps Bob(30), Cy(20)
  grid.sortBy('total', 'desc'); // Bob then Cy
  const html = grid.exportView('html');
  expect(html).not.toContain('<td>Ann</td>'); // filtered out
  const bobAt = html.indexOf('<td>Bob</td>');
  const cyAt = html.indexOf('<td>Cy</td>');
  expect(bobAt).toBeGreaterThan(-1);
  expect(cyAt).toBeGreaterThan(-1);
  expect(bobAt).toBeLessThan(cyAt); // Bob (30) precedes Cy (20) — descending
});

// JSON export is an array of objects with RAW values keyed by column id (visible columns only).
test('JSON: raw values keyed by column id, visible columns only', () => {
  const grid = idNameGrid([{ id: 1, name: 'Ann' }]);
  const parsed = JSON.parse(grid.exportView('json'));
  expect(parsed).toEqual([{ id: 1, name: 'Ann' }]); // number 1, not the string "1"
});

// TSV export is tab-delimited with the same CRLF record framing as CSV.
test('TSV: tab delimiter, CRLF records', () => {
  const grid = idNameGrid([{ id: 1, name: 'Ann' }]);
  expect(grid.exportView('tsv')).toBe('ID\tName\r\n1\tAnn');
});

// A windowed source (one exposing ensureRange) is unsupported: exportView throws a clear error naming
// the export path, never the generic lazy-view proxy error and never a partial/garbled export.
test('a windowed source throws a clear "unsupported" error, not the proxy error', () => {
  const src: GridDataSource<{ id: number; name: string }> = {
    rowKey: (r) => r.id,
    length: () => 100000,
    rowAt: () => undefined,
    ensureRange: () => undefined,
    setSort: () => undefined,
    setFilter: () => undefined,
  };
  const columns = [column<{ id: number; name: string }, string>({ id: 'name', title: 'Name', value: (r) => r.name })];
  const grid = new EditableDataGrid({ columns, source: src });
  expect(() => grid.exportView('csv')).toThrow(/exportView/); // the error names the export path…
  expect(() => grid.exportView('csv')).toThrow(/windowed/i); // …and says it is a windowed limitation
  expect(() => grid.exportView('json')).toThrow(/windowed/i); // every format guards the same way
});
