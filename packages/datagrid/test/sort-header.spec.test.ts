/**
 * Specification tests (immutable oracles) — the `SortHeader` render + click machine and the container
 * sort wiring (RD-05; plan docs plans/sorting/03-02, 07-testing-strategy ST-13 … ST-20).
 *
 * Two seams (mouse events are new to the datagrid suite — see 07 §Test-seam note):
 *   • Unit: construct the barrel-exported `SortHeader` directly and drive `draw`/`onEvent`.
 *   • Container: mount an `EditableDataGrid`, click the header at `y=0` (mouse routing is hit-test
 *     based, independent of focus), and read the painted frame / the public `grid.sort()` readout.
 *
 * Expectations derive from the requirements/spec docs + the frozen theme roles, never the
 * implementation. The `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column, DispatchEvent, Signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import type { SortKey } from '../src/sort.js';
import type { FilterModel, ColumnFilter } from '../src/filter.js';
import { EditableDataGrid } from '../src/grid.js';
import { SortHeader } from '../src/sort-header.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Sale {
  region: string;
  qty: number;
}
// region distinct (east < north < west); qty asc = 9, 50, 1000. '9'/'50'/'1000' each uniquely
// identify one row in the painted frame.
const SALES: Sale[] = [
  { region: 'east', qty: 1000 },
  { region: 'west', qty: 9 },
  { region: 'north', qty: 50 },
];

const W = 22;
const H = 6;

// ---------------------------------------------------------------------------
// Unit-level SortHeader (render + hit-test) — validates the barrel export too
// ---------------------------------------------------------------------------

const UNIT_COLS: Column<Sale>[] = [
  { title: 'Region', accessor: (r) => r.region, width: 8 },
  { title: 'Qty', accessor: (r) => String(r.qty), width: 6 },
];
const UNIT_IDS = ['region', 'qty'] as const;

/** Mount a bare `SortHeader` in a render root and return it plus a frame reader. */
function buildHeader(
  sort: Signal<SortKey[]>,
  onHeaderClick: (columnId: string, additive: boolean) => void,
  opts: {
    filterModel?: Signal<FilterModel>;
    onFunnelClick?: (columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void;
    filterable?: boolean[];
    showFunnel?: boolean[];
  } = {},
) {
  const header = new SortHeader<Sale>({
    columns: UNIT_COLS,
    columnIds: [...UNIT_IDS],
    autoWidths: () => [null, null],
    indent: signal(0),
    sort,
    onHeaderClick,
    filterModel: opts.filterModel ?? signal<FilterModel>(new Map()),
    onFunnelClick: opts.onFunnelClick ?? (() => undefined),
    filterable: opts.filterable,
    showFunnel: opts.showFunnel,
  });
  header.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: 1 } });
  const root = new Group();
  root.add(header);
  const render = createRenderRoot({ width: W, height: 1 }, { caps });
  render.mount(root);
  const line = (): string => {
    let s = '';
    const buf = render.buffer();
    for (let x = 0; x < W; x += 1) s += buf.get(x, 0)?.char ?? ' ';
    return s;
  };
  /** The painted buffer cell at header-local `x` (char + resolved fg/bg), for tone assertions. */
  const cell = (x: number) => render.buffer().get(x, 0);
  /** Re-paint after a reactive change (filter set/cleared) so the buffer reflects it. */
  const flush = (): void => render.flush();
  return { header, line, cell, flush };
}

/** A synthetic mouse-down envelope at header-local x. */
function mouseDown(x: number, ctrl = false): DispatchEvent {
  return {
    event: { type: 'mouse', kind: 'down', button: 0, x, y: 0, ctrl },
    local: { x, y: 0 },
    handled: false,
  } as unknown as DispatchEvent;
}

test('ST-13 (unit): a single-key SortHeader paints one arrow and no priority digit', () => {
  const { line } = buildHeader(signal<SortKey[]>([{ columnId: 'qty', dir: 'asc' }]), () => undefined);
  const row = line();
  expect(row).toContain('Qty');
  expect(row).toContain('▲'); // ascending arrow
  expect(row).not.toContain('▼');
  expect(row).not.toMatch(/[12]/); // single sort → no priority digit
});

test('ST-20 (unit): an unsorted SortHeader paints titles and no indicator', () => {
  const { line } = buildHeader(signal<SortKey[]>([]), () => undefined);
  const row = line();
  expect(row).toContain('Region');
  expect(row).toContain('Qty');
  expect(row).not.toContain('▲');
  expect(row).not.toContain('▼');
});

test('onEvent hit-tests the clicked column and reports the Ctrl (additive) flag', () => {
  const onClick = vi.fn<(columnId: string, additive: boolean) => void>();
  const { header } = buildHeader(signal<SortKey[]>([]), onClick);
  header.onEvent(mouseDown(2)); // within region [0,8)
  expect(onClick).toHaveBeenLastCalledWith('region', false);
  header.onEvent(mouseDown(11, true)); // within qty [9,15), Ctrl held
  expect(onClick).toHaveBeenLastCalledWith('qty', true);
});

test('onEvent ignores a click on a divider (no-op, not marked handled)', () => {
  const onClick = vi.fn<(columnId: string, additive: boolean) => void>();
  const { header } = buildHeader(signal<SortKey[]>([]), onClick);
  const ev = mouseDown(8); // the region|qty divider cell (starts[0]+widths[0] = 8)
  header.onEvent(ev);
  expect(onClick).not.toHaveBeenCalled();
  expect(ev.handled).toBe(false);
});

// ---------------------------------------------------------------------------
// Container-level wiring (mount, click, read the frame / grid.sort())
// ---------------------------------------------------------------------------

const COLUMNS = [
  column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 }),
  column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: 6 }),
];

/** Mount an `EditableDataGrid` over `source` in an event loop; return the grid, loop, and a frame reader. */
function buildGrid(source: GridDataSource<Sale> = fromRows(signal(SALES.slice()), { rowKey: (r) => r.region })) {
  const grid = new EditableDataGrid<Sale>({ columns: COLUMNS, source });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  const frame = (): string[] => {
    loop.renderRoot.flush();
    const buf = loop.renderRoot.buffer();
    const out: string[] = [];
    for (let y = 0; y < H; y += 1) {
      let s = '';
      for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
      out.push(s);
    }
    return out;
  };
  return { grid, loop, frame };
}

/** The body row (screen y in 1..H-1) whose text contains `needle`, or -1. */
function bodyRowOf(rows: string[], needle: string): number {
  for (let y = 1; y < H; y += 1) if (rows[y].includes(needle)) return y;
  return -1;
}

/**
 * Dispatch a header-column click through the loop. `x0` is a 0-based content column; the header sits at
 * 0-based screen row 0. `loop.dispatch` takes 1-based terminal coordinates (it converts to 0-based
 * internally), so we send `x0 + 1` and `y = 1`.
 */
function clickHeader(loop: ReturnType<typeof buildGrid>['loop'], x0: number, ctrl = false): void {
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: x0 + 1, y: 1, ctrl });
}

const REGION_X = 2; // 0-based, within region content [0,8)
const QTY_X = 11; // 0-based, within qty content [9,15)

test('ST-13: clicking a numeric header sorts ascending, shows the arrow, and reorders the body', () => {
  const { loop, frame } = buildGrid();
  clickHeader(loop, QTY_X);
  const rows = frame();
  expect(rows[0]).toContain('▲'); // header indicator
  expect(bodyRowOf(rows, '9')).toBeLessThan(bodyRowOf(rows, '1000')); // 9 paints above 1000
});

test('ST-14: Ctrl+click adds a second key — priority digits 1 & 2, ordered by the first key then the second', () => {
  const { grid, loop, frame } = buildGrid();
  clickHeader(loop, REGION_X); // primary: region asc
  clickHeader(loop, QTY_X, true); // Ctrl+click: qty asc as key 2
  expect(grid.sort()).toEqual([
    { columnId: 'region', dir: 'asc' },
    { columnId: 'qty', dir: 'asc' },
  ]);
  const rows = frame();
  expect(rows[0]).toContain('1'); // priority digit for key 1
  expect(rows[0]).toContain('2'); // priority digit for key 2
  // region asc: east < north < west
  expect(bodyRowOf(rows, 'east')).toBeLessThan(bodyRowOf(rows, 'north'));
  expect(bodyRowOf(rows, 'north')).toBeLessThan(bodyRowOf(rows, 'west'));
});

test('ST-15: a plain click on a participating header resets to a single ascending key', () => {
  const { grid, loop } = buildGrid();
  clickHeader(loop, REGION_X);
  clickHeader(loop, QTY_X, true); // now multi: [region, qty]
  clickHeader(loop, REGION_X); // plain click resets
  expect(grid.sort()).toEqual([{ columnId: 'region', dir: 'asc' }]);
});

test('ST-16: a source with setSort gets the keys pushed down; the client does NOT re-sort', () => {
  const setSort = vi.fn<(keys: SortKey[]) => void>();
  const pushSource: GridDataSource<Sale> = {
    rowKey: (r) => r.region,
    length: () => SALES.length,
    rowAt: (i) => SALES[i],
    setSort,
  };
  const { grid, frame } = buildGrid(pushSource);
  grid.sortBy('qty');
  expect(setSort).toHaveBeenCalledWith([{ columnId: 'qty', dir: 'asc' }]);
  // Push-down source owns ordering (its rowAt is unchanged here), so the body stays in source order.
  const rows = frame();
  expect(bodyRowOf(rows, '1000')).toBeLessThan(bodyRowOf(rows, '9')); // still source order (1000 before 9)
});

test('ST-16: an in-memory source sorts client-side (no setSort)', () => {
  const { grid, frame } = buildGrid();
  grid.sortBy('qty');
  const rows = frame();
  expect(bodyRowOf(rows, '9')).toBeLessThan(bodyRowOf(rows, '1000')); // client-sorted ascending
});

test('ST-17: tri-state — clicking the sole sorted header cycles asc → desc → none (source order)', () => {
  const { grid, loop, frame } = buildGrid();
  clickHeader(loop, QTY_X);
  expect(grid.sort()).toEqual([{ columnId: 'qty', dir: 'asc' }]);
  clickHeader(loop, QTY_X);
  expect(grid.sort()).toEqual([{ columnId: 'qty', dir: 'desc' }]);
  clickHeader(loop, QTY_X);
  expect(grid.sort()).toEqual([]); // none
  const rows = frame();
  expect(bodyRowOf(rows, '1000')).toBeLessThan(bodyRowOf(rows, '9')); // source order restored
});

test('ST-18: the cursor re-anchors by row-key across a re-sort', () => {
  const { grid, loop, frame } = buildGrid();
  loop.focusView(grid.rows); // body active → the focused cell paints gridCursor
  // Cursor starts on source row 0 (east/1000). Sorting qty asc moves east/1000 to the last index.
  grid.sortBy('qty');
  const rows = frame();
  const buf = loop.renderRoot.buffer();
  // Find the body row carrying the gridCursor overpaint (the focused cell at column 0, x=0).
  let cursorY = -1;
  for (let y = 1; y < H; y += 1) if (buf.get(0, y)?.bg === defaultTheme.gridCursor.bg) cursorY = y;
  expect(cursorY).toBeGreaterThan(0);
  expect(rows[cursorY]).toContain('1000'); // the cursor followed east/1000 to its new position
});

test('ST-19: sortBy / addSort / clearSort drive the reactive grid.sort() readout', () => {
  const { grid } = buildGrid();
  grid.sortBy('qty');
  expect(grid.sort()).toEqual([{ columnId: 'qty', dir: 'asc' }]);
  grid.addSort('region', 'desc');
  expect(grid.sort()).toEqual([
    { columnId: 'qty', dir: 'asc' },
    { columnId: 'region', dir: 'desc' },
  ]);
  grid.clearSort();
  expect(grid.sort()).toEqual([]);
});

test('ST-20: a fresh grid paints no indicator and renders in source order', () => {
  const { grid, frame } = buildGrid();
  expect(grid.sort()).toEqual([]);
  const rows = frame();
  expect(rows[0]).not.toContain('▲');
  expect(rows[0]).not.toContain('▼');
  expect(bodyRowOf(rows, '1000')).toBeLessThan(bodyRowOf(rows, '9')); // source order
});

// ---------------------------------------------------------------------------
// Funnel visibility (default = only when filtered; opt-in always-visible via `showFunnel`) + the
// muted/emphasized tone + funnel-vs-title click routing (the filter surface merged into the header).
// These cases use an `ST-EP-*` scheme (distinct from the sorting `ST-13…ST-20` above in this file).
// The funnel is NOT permanent: by default an unfiltered column shows none; a filtered column shows an
// emphasized one; a `showFunnel: true` column shows an always-visible muted→emphasized one. `ST-20
// (filter)` (funnel-cell click on a *filtered* column) is retained below.
// ---------------------------------------------------------------------------

test('ST-EP-1 (filter): an unfiltered column WITHOUT showFunnel paints no ▽ (clean header)', () => {
  const { cell } = buildHeader(signal<SortKey[]>([]), () => undefined); // nothing filtered, no opt-in
  expect(cell(14)?.char).not.toBe('▽'); // qty's would-be funnel cell (starts[1]=9 + width 6 − 1 = 14) is clean
  expect(cell(7)?.char).not.toBe('▽'); // region's too — no funnel until filtered or opted-in
});

test('ST-EP-2 (filter): a column with an active filter paints ▽ in the emphasized tableHeader tone', () => {
  const filterModel = signal<FilterModel>(
    new Map<string, ColumnFilter>([['qty', { kind: 'text', op: 'contains', value: '5' }]]),
  );
  const { cell } = buildHeader(signal<SortKey[]>([]), () => undefined, { filterModel });
  expect(cell(14)?.char).toBe('▽'); // the filtered column shows one even without showFunnel
  expect(cell(14)?.fg).toBe(defaultTheme.tableHeader.fg); // emphasized (normal header tone)
  expect(cell(14)?.fg).not.toBe(defaultTheme.listDivider.fg); // and distinct from the muted tone
  expect(cell(7)?.char).not.toBe('▽'); // the unfiltered, non-opted-in column stays clean
});

test('ST-EP-3 (filter): a showFunnel column paints a muted ▽ unfiltered, emphasized when filtered, muted again when cleared', () => {
  const filterModel = signal<FilterModel>(new Map());
  // qty opts into an always-visible funnel; region does not.
  const { cell, flush } = buildHeader(signal<SortKey[]>([]), () => undefined, {
    filterModel,
    showFunnel: [false, true],
  });
  expect(cell(14)?.char).toBe('▽'); // present because opted-in, even though unfiltered
  expect(cell(14)?.fg).toBe(defaultTheme.listDivider.fg); // muted tone
  expect(cell(7)?.char).not.toBe('▽'); // region did not opt in and is unfiltered → clean

  filterModel.set(new Map<string, ColumnFilter>([['qty', { kind: 'text', op: 'contains', value: '5' }]]));
  flush();
  expect(cell(14)?.fg).toBe(defaultTheme.tableHeader.fg); // emphasized while filtered

  filterModel.set(new Map()); // clear
  flush();
  expect(cell(14)?.char).toBe('▽'); // still present (opted-in)
  expect(cell(14)?.fg).toBe(defaultTheme.listDivider.fg); // back to muted, not gone
});

test('ST-EP-4 (filter): a filterable:false column paints no ▽ (even with showFunnel) and its funnel cell is not hit-testable', () => {
  const onFunnel = vi.fn<(columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void>();
  const { cell, header } = buildHeader(signal<SortKey[]>([]), () => undefined, {
    filterable: [true, false], // region filterable, qty opted out entirely
    showFunnel: [true, true], // opting-in cannot override filterable:false
    onFunnelClick: onFunnel,
  });
  expect(cell(7)?.char).toBe('▽'); // region (filterable + opted-in) shows the funnel
  expect(cell(14)?.char).not.toBe('▽'); // qty (non-filterable) shows none despite showFunnel
  header.onEvent(mouseDown(14)); // a click on qty's would-be funnel cell
  expect(onFunnel).not.toHaveBeenCalled(); // never routes to the popup
});

test('ST-20 (filter): a funnel-cell click fires onFunnelClick (no sort); a title click sorts', () => {
  const onFunnel = vi.fn<(columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void>();
  const onSort = vi.fn<(columnId: string, additive: boolean) => void>();
  // qty is filtered → its funnel is drawn and hittable. Unsorted qty reserves no sort cell, so the
  // funnel is the column's rightmost content cell: starts[1](=9) + width(6) - 1 = 14.
  const filterModel = signal<FilterModel>(
    new Map<string, ColumnFilter>([['qty', { kind: 'text', op: 'contains', value: '5' }]]),
  );
  const { header } = buildHeader(signal<SortKey[]>([]), onSort, { filterModel, onFunnelClick: onFunnel });

  const funnelEv = mouseDown(14);
  header.onEvent(funnelEv);
  expect(onFunnel).toHaveBeenCalledTimes(1);
  expect(onFunnel.mock.calls[0][0]).toBe('qty'); // reports the filtered column
  expect(onFunnel.mock.calls[0][2]).toBe(funnelEv); // forwards the LIVE dispatch envelope (focus/popup seam)
  expect(funnelEv.handled).toBe(true);
  expect(onSort).not.toHaveBeenCalled(); // a funnel click never also sorts

  header.onEvent(mouseDown(10)); // within qty content [9,15) but left of the funnel cell → title (sort)
  expect(onSort).toHaveBeenLastCalledWith('qty', false);
});

test("ST-EP-5 (filter): a click on a showFunnel column's funnel cell fires onFunnelClick, not a sort", () => {
  const onFunnel = vi.fn<(columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void>();
  const onSort = vi.fn<(columnId: string, additive: boolean) => void>();
  // Nothing filtered, but qty opts into an always-visible funnel → the cell must route to the popup.
  const { header } = buildHeader(signal<SortKey[]>([]), onSort, {
    onFunnelClick: onFunnel,
    showFunnel: [false, true],
  });
  const ev = mouseDown(14); // qty funnel cell (unsorted → starts[1]+width−1 = 14)
  header.onEvent(ev);
  expect(onFunnel).toHaveBeenCalledTimes(1);
  expect(onFunnel.mock.calls[0][0]).toBe('qty'); // reports the column even with no active filter
  expect(ev.handled).toBe(true);
  expect(onSort).not.toHaveBeenCalled(); // a funnel click never also sorts
});

test('ST-EP-6 (filter): the funnel cell routes to the funnel; the cell to its left routes to the title (sort)', () => {
  const onFunnel = vi.fn<(columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void>();
  const onSort = vi.fn<(columnId: string, additive: boolean) => void>();
  // qty opts in so its funnel is drawn; region does not.
  const { header } = buildHeader(signal<SortKey[]>([]), onSort, { onFunnelClick: onFunnel, showFunnel: [false, true] });
  header.onEvent(mouseDown(14)); // exactly the funnel cell → funnel
  expect(onFunnel).toHaveBeenCalledTimes(1);
  expect(onSort).not.toHaveBeenCalled();
  header.onEvent(mouseDown(13)); // one cell left of the funnel → title zone (sort)
  expect(onSort).toHaveBeenLastCalledWith('qty', false);
});

test("ST-EP-8 (filter): an unfiltered non-showFunnel column's rightmost cell routes to the title (sort), not a funnel", () => {
  const onFunnel = vi.fn<(columnId: string, anchor: { x: number; y: number }, ev: DispatchEvent) => void>();
  const onSort = vi.fn<(columnId: string, additive: boolean) => void>();
  // Default columns: filterable but unfiltered and not opted-in → no funnel is drawn, so the rightmost
  // content cell is part of the title zone and a click there sorts.
  const { header } = buildHeader(signal<SortKey[]>([]), onSort, { onFunnelClick: onFunnel });
  header.onEvent(mouseDown(14)); // qty's rightmost content cell — no funnel here anymore
  expect(onFunnel).not.toHaveBeenCalled(); // nothing routes to the popup
  expect(onSort).toHaveBeenLastCalledWith('qty', false); // it sorts instead
});

test('ST-EP-7 (filter): a too-narrow sorted filterable column drops the funnel and keeps the sort arrow', () => {
  // A width-1 column that is both sorted and filtered has room for exactly one indicator: drop-first
  // precedence keeps the sort arrow and drops the funnel.
  const narrowCols: Column<Sale>[] = [{ title: 'Q', accessor: (r) => String(r.qty), width: 1 }];
  const header = new SortHeader<Sale>({
    columns: narrowCols,
    columnIds: ['qty'],
    autoWidths: () => [null],
    indent: signal(0),
    sort: signal<SortKey[]>([{ columnId: 'qty', dir: 'asc' }]), // reserves the arrow cell
    onHeaderClick: () => undefined,
    filterModel: signal<FilterModel>(
      new Map<string, ColumnFilter>([['qty', { kind: 'text', op: 'contains', value: '5' }]]),
    ),
    onFunnelClick: () => undefined,
    filterable: [true],
  });
  header.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 8, height: 1 } });
  const root = new Group();
  root.add(header);
  const render = createRenderRoot({ width: 8, height: 1 }, { caps });
  render.mount(root);
  const buf = render.buffer();
  const chars = Array.from({ length: 8 }, (_, x) => buf.get(x, 0)?.char ?? ' ').join('');
  expect(chars).toContain('▲'); // the sort arrow survives
  expect(chars).not.toContain('▽'); // the funnel is dropped (drop-first, too narrow)
});
