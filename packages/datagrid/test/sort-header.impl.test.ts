/**
 * Implementation tests — `SortHeader` geometry/click-machine edges beyond the spec oracles:
 * narrow-column indicator clamp, a priority digit for key ≥ 3, an H-scrolled (indented) hit-test,
 * a click on the divider / past the last column (no-op), a Ctrl+click that toggles an existing key's
 * direction through the container, and header repaint on a `sortKeys` change.
 */
import { test, expect, vi } from 'vitest';
import { Group, createRenderRoot, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column, DispatchEvent, Signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { SortKey } from '../src/sort.js';
import type { FilterModel } from '../src/filter.js';
import { EditableDataGrid } from '../src/grid.js';
import { SortHeader } from '../src/sort-header.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Sale {
  region: string;
  qty: number;
}

const UNIT_COLS: Column<Sale>[] = [
  { title: 'Region', accessor: (r) => r.region, width: 8 },
  { title: 'Qty', accessor: (r) => String(r.qty), width: 6 },
];
const UNIT_IDS = ['region', 'qty'] as const;

/** Mount a bare SortHeader (optionally H-scrolled) and return it + a line reader. */
function buildHeader(
  sort: Signal<SortKey[]>,
  onHeaderClick: (columnId: string, additive: boolean) => void,
  opts: {
    width?: number;
    indent?: Signal<number>;
    autoWidths?: () => (number | null)[];
    columns?: Column<Sale>[];
    filterable?: boolean[];
    filterModel?: Signal<FilterModel>;
  } = {},
) {
  const width = opts.width ?? 22;
  const header = new SortHeader<Sale>({
    columns: opts.columns ?? UNIT_COLS,
    columnIds: [...UNIT_IDS],
    autoWidths: opts.autoWidths ?? (() => [null, null]),
    indent: opts.indent ?? signal(0),
    sort,
    onHeaderClick,
    filterModel: opts.filterModel ?? signal<FilterModel>(new Map()),
    onFunnelClick: () => undefined,
    filterable: opts.filterable,
  });
  header.layout = { position: 'absolute', rect: { x: 0, y: 0, width, height: 1 } };
  const root = new Group();
  root.add(header);
  const render = createRenderRoot({ width, height: 1 }, { caps });
  render.mount(root);
  const line = (): string => {
    render.flush(); // reactive repaints are scheduled on a microtask — force the frame for the test
    let s = '';
    const buf = render.buffer();
    for (let x = 0; x < width; x += 1) s += buf.get(x, 0)?.char ?? ' ';
    return s;
  };
  return { header, line, render };
}

function mouseDown(x: number, ctrl = false): DispatchEvent {
  return {
    event: { type: 'mouse', kind: 'down', button: 0, x, y: 0, ctrl },
    local: { x, y: 0 },
    handled: false,
  } as unknown as DispatchEvent;
}

test('a multi-key sort paints a priority digit and an arrow per participating column', () => {
  const { line } = buildHeader(
    signal<SortKey[]>([
      { columnId: 'qty', dir: 'asc' },
      { columnId: 'region', dir: 'desc' },
    ]),
    () => undefined,
  );
  const row = line();
  expect(row).toContain('1'); // qty is key 1
  expect(row).toContain('2'); // region is key 2
  expect(row).toContain('▲'); // qty ascending
  expect(row).toContain('▼'); // region descending
});

test('a priority digit renders the 1-based position for a key at index ≥ 2', () => {
  // Three fixed columns; sort them c, b, a so column "a" is priority 3.
  const cols: Column<Sale & { extra: number }>[] = [
    { title: 'A', accessor: () => 'a', width: 6 },
    { title: 'B', accessor: () => 'b', width: 6 },
    { title: 'C', accessor: () => 'c', width: 6 },
  ];
  const header = new SortHeader<Sale & { extra: number }>({
    columns: cols,
    columnIds: ['a', 'b', 'c'],
    autoWidths: () => [null, null, null],
    indent: signal(0),
    sort: signal<SortKey[]>([
      { columnId: 'c', dir: 'asc' },
      { columnId: 'b', dir: 'asc' },
      { columnId: 'a', dir: 'asc' },
    ]),
    onHeaderClick: () => undefined,
    filterModel: signal<FilterModel>(new Map()),
    onFunnelClick: () => undefined,
  });
  header.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 1 } };
  const root = new Group();
  root.add(header);
  const render = createRenderRoot({ width: 24, height: 1 }, { caps });
  render.mount(root);
  let row = '';
  for (let x = 0; x < 24; x += 1) row += render.buffer().get(x, 0)?.char ?? ' ';
  expect(row).toContain('3'); // column "a" shows priority digit 3
});

test('a narrow (1-cell) sorted column clamps to the arrow and never truncates it', () => {
  // A 1-cell column that is multi-sorted: reserve clamps to 1 → only the arrow fits, no digit.
  const narrow: Column<Sale>[] = [
    { title: 'X', accessor: () => 'x', width: 1 },
    { title: 'Qty', accessor: (r) => String(r.qty), width: 6 },
  ];
  const { line } = buildHeader(
    signal<SortKey[]>([
      { columnId: 'region', dir: 'asc' }, // maps to columnIds[0] = 'region' (the 1-cell column)
      { columnId: 'qty', dir: 'asc' },
    ]),
    () => undefined,
    { columns: narrow, autoWidths: () => [null, null] },
  );
  const row = line();
  expect(row[0]).toBe('▲'); // the 1-cell column shows just the arrow
});

test('onEvent hit-tests against the H-scroll indent (a scrolled header still maps x correctly)', () => {
  const onClick = vi.fn<(columnId: string, additive: boolean) => void>();
  const indent = signal(4); // scrolled right by 4 cells
  // Viewport (10) narrower than the content (16 = 8+1+6+1), so indent 4 is not clamped to 0.
  const { header } = buildHeader(signal<SortKey[]>([]), onClick, { indent, width: 10 });
  // With indent 4, screen x=2 maps to content x=6 → still region [0,8).
  header.onEvent(mouseDown(2));
  expect(onClick).toHaveBeenLastCalledWith('region', false);
  // Screen x=6 maps to content x=10 → qty [9,15).
  header.onEvent(mouseDown(6));
  expect(onClick).toHaveBeenLastCalledWith('qty', false);
});

test('onEvent ignores a click past the last column', () => {
  const onClick = vi.fn<(columnId: string, additive: boolean) => void>();
  const { header } = buildHeader(signal<SortKey[]>([]), onClick);
  const ev = mouseDown(20); // past qty's right edge (content ends at 15)
  header.onEvent(ev);
  expect(onClick).not.toHaveBeenCalled();
  expect(ev.handled).toBe(false);
});

test('Ctrl+click on an existing key toggles that key’s direction in place', () => {
  const grid = new EditableDataGrid<Sale>({
    columns: [
      column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 }),
      column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: 6 }),
    ],
    source: fromRows(signal([{ region: 'east', qty: 1 }]), { rowKey: (r) => r.region }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 22, height: 6 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 22, height: 6 }, { caps });
  loop.mount(root);
  grid.addSort('qty'); // qty asc
  grid.addSort('qty'); // Ctrl+click semantics: existing key cycles asc → desc
  expect(grid.sort()).toEqual([{ columnId: 'qty', dir: 'desc' }]);
});

test('the header repaints when the sort model changes', () => {
  const sort = signal<SortKey[]>([]);
  const { line } = buildHeader(sort, () => undefined);
  expect(line()).not.toContain('▲');
  sort.set([{ columnId: 'qty', dir: 'asc' }]);
  expect(line()).toContain('▲'); // the bound repaint reflected the new model
});

test('a filterable column clips its title one cell earlier for the funnel; a non-filterable one does not', () => {
  // One 8-wide column whose 8-char title exactly fills it. Filterable → the funnel takes the last cell
  // (the title clips to 7); non-filterable → the title keeps all 8 cells and shows no funnel.
  const cols: Column<Sale>[] = [{ title: 'ABCDEFGH', accessor: () => '', width: 8 }];
  const filterable = buildHeader(signal<SortKey[]>([]), () => undefined, {
    columns: cols,
    width: 10,
    autoWidths: () => [null],
    filterable: [true],
  }).line();
  expect(filterable[7]).toBe('▽'); // funnel occupies the last cell
  expect(filterable.slice(0, 7)).toBe('ABCDEFG'); // title clipped one char early
  expect(filterable).not.toContain('H'); // the 8th title char is dropped for the funnel

  const plain = buildHeader(signal<SortKey[]>([]), () => undefined, {
    columns: cols,
    width: 10,
    autoWidths: () => [null],
    filterable: [false],
  }).line();
  expect(plain.slice(0, 8)).toBe('ABCDEFGH'); // full title — no funnel cell reserved
  expect(plain).not.toContain('▽');
});

test("setFilter/clearFilter on the grid repaints only that column's funnel emphasized↔muted", () => {
  const grid = new EditableDataGrid<Sale>({
    columns: [
      column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 }),
      column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: 6 }),
    ],
    source: fromRows(signal([{ region: 'east', qty: 5 }]), { rowKey: (r) => r.region }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 22, height: 6 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 22, height: 6 }, { caps });
  loop.mount(root);
  // Funnel cells on the header row (y=0): region at 7, qty at 14 (each column's rightmost content cell,
  // unsorted). Inspect the resolved fg to tell muted (listDivider) from emphasized (tableHeader).
  const fgAt = (x: number): unknown => {
    loop.renderRoot.flush();
    return loop.renderRoot.buffer().get(x, 0)?.fg;
  };
  expect(fgAt(14)).toBe(defaultTheme.listDivider.fg); // qty starts muted
  grid.setFilter('qty', { kind: 'number', op: 'gt', a: 0 });
  expect(fgAt(14)).toBe(defaultTheme.tableHeader.fg); // qty emphasized
  expect(fgAt(7)).toBe(defaultTheme.listDivider.fg); // region stays muted (only the filtered column emphasizes)
  grid.clearFilter('qty');
  expect(fgAt(14)).toBe(defaultTheme.listDivider.fg); // qty muted again — never removed
});
