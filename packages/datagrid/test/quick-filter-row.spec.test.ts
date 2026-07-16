/**
 * Specification tests (immutable oracle) — the opt-in quick-filter band (`quick-filter-row.ts`) and its
 * container wiring on `EditableDataGrid`. The band exists only when the grid is built with
 * `quickFilter: true`; it holds one live `Input` per column, and typing into a column's Input drives a
 * `text`/`contains` filter for that column (clearing the Input removes it).
 *
 * The grid is mounted in an event loop and painted (mount fires `onMount`, which wires the Inputs);
 * a column's Input is driven by writing its value signal, which fires the same bind a keystroke would.
 * Expectations derive from the requirements/spec docs, never the implementation. The `.js` import
 * specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { column } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { QuickFilterRow } from '../src/quick-filter-row.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Sale {
  region: string;
  qty: number;
}
const SALES: Sale[] = [
  { region: 'east', qty: 1000 },
  { region: 'west', qty: 9 },
  { region: 'north', qty: 50 },
];

const W = 24;
const H = 6;
const COLUMNS = [
  column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
  column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: 8 }),
];

/** Mount an `EditableDataGrid` (optionally with the quick-filter band) and return it + a frame pump. */
function buildGrid(opts: { quickFilter?: boolean; columns?: GridColumn<Sale>[] } = {}) {
  const source = fromRows(signal(SALES.slice()), { rowKey: (r) => r.region });
  const grid = new EditableDataGrid<Sale>({ columns: opts.columns ?? COLUMNS, source, quickFilter: opts.quickFilter });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  // Flush a frame so the tree reflows, fires onMount, and wires the band's Inputs.
  const pump = (): void => loop.renderRoot.flush();
  pump();
  return { grid, loop, pump };
}

/** Every view in the subtree rooted at `view` (self included), depth-first. */
function descendants(view: View): View[] {
  const out: View[] = [];
  const stack: View[] = [view];
  while (stack.length > 0) {
    const v = stack.pop();
    if (v === undefined) continue;
    out.push(v);
    if (v instanceof Group) for (const child of v.children) stack.push(child);
  }
  return out;
}

test('ST-17: the quick-filter band exists only with quickFilter:true, one Input per column', () => {
  const off = buildGrid({ quickFilter: false });
  expect(descendants(off.grid).some((v) => v instanceof QuickFilterRow)).toBe(false); // no band when off

  const on = buildGrid({ quickFilter: true });
  const bands = descendants(on.grid).filter((v): v is QuickFilterRow<Sale> => v instanceof QuickFilterRow);
  expect(bands.length).toBe(1); // exactly one band when on
  const inputs = bands[0].children.filter((v): v is Input => v instanceof Input);
  expect(inputs.length).toBe(COLUMNS.length); // one Input per column
});

/** The quick-filter Inputs of a mounted grid, in column order (non-filterable columns contribute none). */
function bandInputs(grid: EditableDataGrid<Sale>): Input[] {
  const band = descendants(grid).find((v): v is QuickFilterRow<Sale> => v instanceof QuickFilterRow);
  expect(band).toBeDefined();
  return band!.children.filter((v): v is Input => v instanceof Input);
}

test('ST-EP-13: a filterable:false column omits its quick-filter Input; other columns keep their geometry', () => {
  // Three fixed-width columns; the middle one opts out of filtering. A baseline (all filterable) and a
  // variant (middle non-filterable) share identical widths, so any geometry shift on the survivors shows.
  const make = (qtyFilterable: boolean): GridColumn<Sale>[] => [
    column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 }),
    column<Sale, number>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      width: 6,
      filterable: qtyFilterable ? undefined : false,
    }),
    column<Sale, string>({ id: 'city', title: 'City', value: (r) => r.region, width: 8 }),
  ];

  const baseline = bandInputs(buildGrid({ quickFilter: true, columns: make(true) }).grid);
  const variant = bandInputs(buildGrid({ quickFilter: true, columns: make(false) }).grid);

  expect(baseline.length).toBe(3); // every column filterable → three inputs
  expect(variant.length).toBe(2); // qty opts out → its input is omitted

  const qtyX = baseline[1].layout.rect?.x; // qty's slot in the all-filterable baseline
  expect(variant.some((i) => i.layout.rect?.x === qtyX)).toBe(false); // nothing rendered under the non-filterable column

  // The trailing city column keeps its position + width — the omitted input leaves a nullable slot, so
  // downstream columns stay index-parallel and their geometry is unchanged.
  expect(variant[1].layout.rect?.x).toBe(baseline[2].layout.rect?.x);
  expect(variant[1].layout.rect?.width).toBe(baseline[2].layout.rect?.width);
});

test('ST-18: typing into a column Input sets a text/contains filter; clearing the Input removes it', () => {
  const { grid, pump } = buildGrid({ quickFilter: true });
  const band = descendants(grid).find((v): v is QuickFilterRow<Sale> => v instanceof QuickFilterRow);
  expect(band).toBeDefined();
  const inputs = band!.children.filter((v): v is Input => v instanceof Input);

  // Type into the region (column 0) Input — drives a contains filter over the formatted display.
  inputs[0].getValueSignal().set('east');
  pump();
  expect(grid.filterModel().get('region')).toEqual({ kind: 'text', op: 'contains', value: 'east' });
  expect(grid.filteredCount()).toBe(1); // only 'east' matches
  expect(grid.totalCount()).toBe(3);

  // Clearing the Input removes the column's filter (never an empty-needle contains that keeps all).
  inputs[0].getValueSignal().set('');
  pump();
  expect(grid.filterModel().has('region')).toBe(false);
  expect(grid.filteredCount()).toBe(3);
});
