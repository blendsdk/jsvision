/**
 * Specification tests (immutable oracle) — the keyboard entry point into the condition filter popup:
 * `Alt+Down` on the non-editing grid body opens the focused column's popup (filter-entry-point, GH #92).
 *
 * The body reports the global focused column up to the container via `onOpenFilter`; the container
 * resolves the owning header + filterability and opens the popup. A `filterable: false` column is a
 * no-op; an unfiltered column opens a blank popup (no current filter); a plain `Down` (no Alt) still
 * row-navigates through the base — `Alt+Down` *repurposes* a binding the base owns, so the new handler
 * must run before `super.onEvent`.
 *
 * Expectations derive from the requirements (FR-3, FR-4) + register decisions (AR-5, AR-9, AR-10,
 * AR-11), never the implementation. The `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect, vi } from 'vitest';
import { Group, View, createEventLoop, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column, DispatchEvent } from '@jsvision/ui';
import { column } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { FilterPopup } from '../src/filter-popup.js';

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

/** A synthetic dispatch envelope for a direct `body.onEvent` call (key events carry no `local`). */
function keyEv(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}): DispatchEvent {
  return {
    event: { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods },
    handled: false,
  } as unknown as DispatchEvent;
}

/** A raw key event for `loop.dispatch` (the loop wraps it in an envelope and routes it to the focused view). */
function rawKey(k: string, mods: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false, ...mods };
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

// ---------------------------------------------------------------------------
// Body key routing — EditableGridRows reports Alt+Down up via onOpenFilter (unit)
// ---------------------------------------------------------------------------

const BODY_COLS: Column<Sale>[] = [
  { title: 'Region', accessor: (r) => r.region, width: 8 },
  { title: 'Qty', accessor: (r) => String(r.qty), width: 6 },
];
const BW = 20;
const BH = 5;

/** Mount a bare `EditableGridRows` with an `onOpenFilter` spy; returns it + the shared cursors. */
function buildBody(opts: { onOpenFilter?: (globalCol: number, ev: DispatchEvent) => void } = {}) {
  const focused = signal(0); // row cursor
  const focusedCol = signal(0); // global column cursor
  const body = new EditableGridRows<Sale>({
    display: () => SALES,
    columns: BODY_COLS,
    autoWidths: () => BODY_COLS.map(() => null),
    indent: signal(0),
    focused,
    selected: signal(-1),
    zebra: false,
    focusedCol,
    typedColumns: [
      { id: 'region', title: 'Region', value: (r) => r.region },
      { id: 'qty', title: 'Qty', value: (r) => r.qty },
    ],
    overlay: new Group(),
    rowKey: (r) => r.region,
    bumpVersion: () => undefined,
    onOpenFilter: opts.onOpenFilter,
  });
  body.layout = { position: 'absolute', rect: { x: 0, y: 0, width: BW, height: BH } };
  const root = new Group();
  root.add(body);
  const render = createRenderRoot({ width: BW, height: BH }, { caps });
  render.mount(root);
  return { body, focused, focusedCol };
}

test('ST-8: Alt+Down on the non-editing body reports the focused column via onOpenFilter without row-navigating', () => {
  const onOpenFilter = vi.fn<(globalCol: number, ev: DispatchEvent) => void>();
  const { body, focused, focusedCol } = buildBody({ onOpenFilter });
  focusedCol.set(1); // focus the Qty column
  const ev = keyEv('down', { alt: true });
  body.onEvent(ev);
  expect(onOpenFilter).toHaveBeenCalledTimes(1);
  expect(onOpenFilter.mock.calls[0][0]).toBe(1); // reports the global focused column
  expect(ev.handled).toBe(true);
  expect(focused()).toBe(0); // the row cursor did NOT move — the handler consumed it before the base row-down (PF-001)
});

test('PF-001 guard: a plain Down (no Alt) does not open the filter and still moves the row cursor', () => {
  const onOpenFilter = vi.fn<(globalCol: number, ev: DispatchEvent) => void>();
  const { body, focused } = buildBody({ onOpenFilter });
  body.onEvent(keyEv('down')); // plain Down
  expect(onOpenFilter).not.toHaveBeenCalled();
  expect(focused()).toBe(1); // the base moved the row cursor down — ordinary navigation preserved
});

test('ST-8 (modifiers): Alt+Down combined with Ctrl or Shift does not open the filter', () => {
  const onOpenFilter = vi.fn<(globalCol: number, ev: DispatchEvent) => void>();
  const { body } = buildBody({ onOpenFilter });
  body.onEvent(keyEv('down', { alt: true, ctrl: true }));
  body.onEvent(keyEv('down', { alt: true, shift: true }));
  expect(onOpenFilter).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// Container wiring — the keyboard opener drives EditableDataGrid.openFilterPopup
// ---------------------------------------------------------------------------

const CW = 24;
const CH = 6;
const REGION = column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 });
const QTY = column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: 6 });

/** Mount an `EditableDataGrid` in an event loop; returns the grid + loop. */
function buildGrid(opts: { columns?: GridColumn<Sale>[]; freezeRight?: string[] } = {}) {
  const source = fromRows(signal(SALES.slice()), { rowKey: (r) => r.region });
  const grid = new EditableDataGrid<Sale>({
    columns: opts.columns ?? [REGION, QTY],
    source,
    freezeRight: opts.freezeRight,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: CW, height: CH } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: CW, height: CH }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return { grid, loop };
}

/** The open filter popups in the grid subtree (at most one). */
function openPopups(grid: EditableDataGrid<Sale>): FilterPopup<Sale>[] {
  return descendants(grid).filter((v): v is FilterPopup<Sale> => v instanceof FilterPopup);
}

test('ST-8 (container): Alt+Down on the focused body opens the condition popup from the keyboard (no mouse)', () => {
  const { grid, loop } = buildGrid();
  expect(openPopups(grid).length).toBe(0); // nothing open before
  loop.focusView(grid.rows); // body active; the cursor starts on region (col 0)
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  expect(openPopups(grid).length).toBe(1); // a popup opened via the keyboard route
});

test('ST-9: while a cell editor is open, Alt+Down does not open the filter popup', () => {
  const region = column<Sale, string>({
    id: 'region',
    title: 'Region',
    value: (r) => r.region,
    width: 8,
    parse: (t) => t,
    set: (r, v) => {
      r.region = v;
    },
  });
  const { grid, loop } = buildGrid({ columns: [region, QTY] });
  loop.focusView(grid.rows);
  loop.dispatch(rawKey('f2')); // begin editing the focused (region) cell
  loop.renderRoot.flush();
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  expect(openPopups(grid).length).toBe(0); // the editor owns the key — no filter popup
});

test('ST-10: Alt+Down with a filterable:false column focused is a no-op; a filterable column still opens', () => {
  const actions = column<Sale, string>({
    id: 'actions',
    title: '',
    value: () => '',
    width: 4,
    filterable: false,
  });
  const { grid, loop } = buildGrid({ columns: [REGION, QTY, actions] });
  loop.focusView(grid.rows);
  loop.dispatch(rawKey('end')); // jump to the last column (actions, non-filterable)
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  expect(openPopups(grid).length).toBe(0); // non-filterable → no popup

  loop.dispatch(rawKey('home')); // back to region (filterable)
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  expect(openPopups(grid).length).toBe(1); // filterable → popup opens (proving the setup + keyboard path work)
});

test('ST-11: Alt+Down on an unfiltered column opens a popup and creates no filter (blank)', () => {
  const { grid, loop } = buildGrid();
  expect(grid.filterModel().has('region')).toBe(false); // region starts unfiltered
  loop.focusView(grid.rows);
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  expect(openPopups(grid).length).toBe(1); // popup opened
  expect(grid.filterModel().has('region')).toBe(false); // opening did not itself set a filter — a blank popup
});

test('ST-12: Alt+Down opens the popup for a column in a frozen right panel', () => {
  const { grid, loop } = buildGrid({ freezeRight: ['qty'] });
  loop.focusView(grid.rows); // the center body holds focus; the cursor starts at global col 0 (region)
  loop.dispatch(rawKey('end')); // jump to the last column (qty, pinned in the right panel) — focus hops there
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  expect(openPopups(grid).length).toBe(1); // resolved the right-panel header + opened the popup (AR-11)
});
