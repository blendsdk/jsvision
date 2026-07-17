/**
 * Specification tests (immutable oracles) — the reactive footer aggregate row, its honesty labelling,
 * and its config-time validation.
 *
 * A per-column `{ fn }` aggregate renders a total aligned under its column, folded over the DISPLAYED
 * rows; it recomputes reactively as rows are edited, inserted, deleted, sorted, or filtered. A
 * not-fully-loaded source (`complete() === false`) labels the total `"(loaded)"`. Unknown columnId keys
 * and invalid `fn`s are dropped (with a dev warning); valid entries still render.
 *
 * Expectations derive from the requirements/spec docs, never the implementation. Cell text is read from
 * the painted buffer; the footer occupies the fixed band directly above the horizontal scroll bar.
 */
import { test, expect, vi } from 'vitest';
import { Group, Input, Button, Text, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import type { AggregateFn, AggregateSpec } from '../src/aggregate.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 30;
const H = 6; // header(0) · body(1,2,3) · footer(4) · hbar(5)
const FOOTER_Y = H - 2;
// Column geometry (fixed widths + one divider cell between): amount at x0..15, region at x17..24.
const AMOUNT_X0 = 0;
const AMOUNT_X1 = 16;
const REGION_X0 = 17;
const REGION_X1 = 25;

interface Sale {
  id: number;
  amount: number;
  region: string;
}
const SALES: Sale[] = [
  { id: 1, amount: 10, region: 'N' },
  { id: 2, amount: 20, region: 'S' },
  { id: 3, amount: 30, region: 'E' },
];

const amountCol = (editable: boolean) =>
  column<Sale, number>({
    id: 'amount',
    title: 'Amount',
    value: (r) => r.amount,
    align: 'right',
    width: 16,
    ...(editable
      ? {
          parse: (t: string) => Number(t),
          set: (r: Sale, v: number) => {
            r.amount = v;
          },
        }
      : {}),
  });
const regionCol = () => column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 });

function buildFooterGrid(
  opts: { aggregates?: Record<string, AggregateSpec>; complete?: () => boolean; editable?: boolean } = {},
) {
  const rows = signal<Sale[]>(SALES.map((s) => ({ ...s })));
  const base = fromRows(rows, { rowKey: (r) => r.id });
  const source: GridDataSource<Sale> = opts.complete ? { ...base, complete: opts.complete } : base;
  const grid = new EditableDataGrid<Sale>({
    columns: [amountCol(opts.editable ?? false), regionCol()],
    source,
    footer: { aggregates: opts.aggregates ?? { amount: { fn: 'sum' } } },
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop, rows };
}

const key = (k: string) => ({ type: 'key' as const, key: k, ctrl: false, alt: false, shift: false });
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Read a horizontal slice of a buffer row as a string. */
function slice(loop: ReturnType<typeof buildFooterGrid>['loop'], x0: number, x1: number, y = FOOTER_Y): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let x = x0; x < x1; x += 1) s += buf.get(x, y)?.char ?? ' ';
  return s;
}
const amountCell = (loop: ReturnType<typeof buildFooterGrid>['loop']) => slice(loop, AMOUNT_X0, AMOUNT_X1).trim();
const regionCell = (loop: ReturnType<typeof buildFooterGrid>['loop']) => slice(loop, REGION_X0, REGION_X1).trim();

// ST-1 — a `{ fn:'sum' }` aggregate renders the displayed sum aligned UNDER its column (not the others).
test('ST-1: should render the column sum aligned under that column', () => {
  const { loop } = buildFooterGrid();
  expect(amountCell(loop)).toBe('60'); // 10 + 20 + 30, under the amount column
  expect(regionCell(loop)).toBe(''); // the region column has no aggregate → blank
});

// ST-2..ST-4 — the aggregate recomputes reactively through an edit, an insert, and a delete.
test('ST-2..ST-4: should fold reactively through edit, insert, and delete', async () => {
  const { grid, loop } = buildFooterGrid({ editable: true });
  expect(amountCell(loop)).toBe('60');

  // ST-2: edit the amount-30 cell (display row 2) to 40 → 70
  loop.dispatch(key('down'));
  loop.dispatch(key('down')); // cursor on row 2 (amount 30)
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('40');
  loop.dispatch(key('enter'));
  await tick();
  loop.renderRoot.flush();
  expect(amountCell(loop)).toBe('70'); // 10 + 20 + 40

  // ST-3: insert a row with amount 5 → 75
  grid.insertRow({ id: 4, amount: 5, region: 'W' });
  loop.renderRoot.flush();
  expect(amountCell(loop)).toBe('75');

  // ST-4: delete the value-10 row (id 1) → 65
  grid.deleteRows([1]);
  loop.renderRoot.flush();
  expect(amountCell(loop)).toBe('65');
});

// ST-5 — the fold is over the DISPLAYED (filtered) set, excluding filtered-out rows.
test('ST-5: should fold over the filtered/displayed set', () => {
  const { grid, loop } = buildFooterGrid();
  expect(amountCell(loop)).toBe('60');
  // hide the value-20 row (region 'S') → displayed amounts are 10 (N) and 30 (E)
  grid.setFilter('region', { kind: 'set', selected: new Set(['N', 'E']) });
  loop.renderRoot.flush();
  expect(amountCell(loop)).toBe('40'); // 10 + 30
});

// ST-6 — the sum is order-independent: changing the sort direction leaves it unchanged and aligned.
test('ST-6: should be unchanged and aligned after a sort', () => {
  const { grid, loop } = buildFooterGrid();
  expect(amountCell(loop)).toBe('60');
  grid.sortBy('amount', 'desc');
  loop.renderRoot.flush();
  expect(amountCell(loop)).toBe('60'); // order-independent
  expect(regionCell(loop)).toBe(''); // still aligned under amount only
});

// ST-17 — a not-fully-loaded source labels the total "(loaded)".
test('ST-17: should append the "(loaded)" qualifier for a partial source', () => {
  const { loop } = buildFooterGrid({ aggregates: { amount: { fn: 'sum', label: 'Σ' } }, complete: () => false });
  expect(amountCell(loop)).toBe('Σ 60 (loaded)');
});

// ST-18 — a complete source (fromRows omits complete, ⇒ complete) renders a clean total.
test('ST-18: should render a clean total with no qualifier for a complete source', () => {
  const { loop } = buildFooterGrid({ aggregates: { amount: { fn: 'sum', label: 'Σ' } } });
  expect(amountCell(loop)).toBe('Σ 60'); // no "(loaded)"
});

// ST-27 — an unknown columnId key and an invalid `fn` are both ignored (+ devWarn); valid entries render.
test('ST-27: should ignore an unknown column and an invalid fn, and warn', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const badFn: string = 'median';
  const { loop } = buildFooterGrid({
    aggregates: {
      amount: { fn: 'sum' }, // valid → renders
      nope: { fn: 'sum' }, // unknown columnId → ignored + warn
      region: { fn: badFn as AggregateFn }, // invalid fn → ignored + warn
    },
  });
  expect(amountCell(loop)).toBe('60'); // the valid entry still renders
  expect(regionCell(loop)).toBe(''); // the invalid-fn entry did not render
  const messages = warn.mock.calls.map((c) => String(c[0])).join('\n');
  expect(messages).toContain('nope'); // warned about the unknown column
  expect(messages).toContain('median'); // warned about the invalid fn
  warn.mockRestore();
});

// ---- Widget slots (Phase 4) ---------------------------------------------------------------------

/** Mount a grid whose footer hosts the given free-form widgets (no aggregates). */
function buildWidgetGrid(widgets: import('@jsvision/ui').View[]) {
  const rows = signal<Sale[]>(SALES.map((s) => ({ ...s })));
  const grid = new EditableDataGrid<Sale>({
    columns: [amountCol(false), regionCol()],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    footer: { widgets },
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop };
}

// ST-13 — a footer Button emits its `command` through the event loop when activated.
test('ST-13: should emit a footer button command through the event loop', () => {
  const exportBtn = new Button('Export', { command: 'export' });
  const { loop } = buildWidgetGrid([exportBtn]);
  const fired = vi.fn();
  loop.onCommand('export', fired);
  loop.focusView(exportBtn);
  // A focused button activates on Space (Enter only activates a default button); activation emits the command.
  loop.dispatch({ type: 'key', key: 'space', ctrl: false, alt: false, shift: false });
  expect(fired).toHaveBeenCalledTimes(1); // the command reached an onCommand handler
});

// ST-26 — the N-of-M and selection-count read-outs update reactively as filter/selection change.
// The read-out widgets close over `grid`; they only run at draw time (after construction returns and
// the grid is mounted), so the const is assigned by then — the documented usage pattern.
test('ST-26: should update the N-of-M and selection read-outs reactively', () => {
  const rows = signal<Sale[]>(SALES.map((s) => ({ ...s })));
  // Explicit annotation breaks the self-referential inference (the widgets close over `grid`).
  const grid: EditableDataGrid<Sale> = new EditableDataGrid<Sale>({
    columns: [amountCol(false), regionCol()],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    footer: {
      widgets: [
        new Text(() => `${grid.filteredCount()} of ${grid.totalCount()}`),
        new Text(() => `${grid.selectedKeys().size} sel`),
      ],
    },
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();

  const widgetRow = () => slice(loop, 0, W, FOOTER_Y); // footer is the widget row only (no aggregates)
  expect(widgetRow()).toContain('3 of 3');
  expect(widgetRow()).toContain('0 sel');

  grid.setFilter('region', { kind: 'set', selected: new Set(['N', 'E']) }); // hide one row
  loop.renderRoot.flush();
  expect(widgetRow()).toContain('2 of 3');

  grid.selectRow(1); // select a row
  loop.renderRoot.flush();
  expect(widgetRow()).toContain('1 sel');
});
