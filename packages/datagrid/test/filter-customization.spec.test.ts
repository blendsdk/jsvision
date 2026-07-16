/**
 * Specification tests (immutable oracle) — the `filterPopup` customization seam (RD-06). A grid may
 * supply a factory that replaces the built-in condition popup with its own view; the factory receives
 * a context carrying the column, filter type, current filter, the apply/clear/close sinks, and a
 * `defaultPopup()` that builds the built-in popup so a factory can wrap or reuse it. The returned view
 * is mounted anchored under the column, at its own size when it sets one.
 *
 * Expectations derive from the requirements (AC #12), never the implementation. The `.js` import
 * specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { Group, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { FilterPopup } from '../src/filter-popup.js';
import type { FilterPopupContext } from '../src/filter-popup.js';

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
const REGION = column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 });
const QTY = column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: 6 });

/** A raw key event for `loop.dispatch`. */
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

/** Mount a grid (40 wide so the popup fits without clamping) with an optional custom popup factory. */
function buildGrid(filterPopup?: (ctx: FilterPopupContext<Sale>) => View) {
  const source = fromRows(signal(SALES.slice()), { rowKey: (r) => r.region });
  const grid = new EditableDataGrid<Sale>({ columns: [REGION, QTY], source, filterPopup });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 6 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 40, height: 6 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return { grid, loop };
}

test('a custom filterPopup factory replaces the built-in popup and receives the column context', () => {
  class CustomPopup extends Group {}
  let seen: FilterPopupContext<Sale> | null = null;
  const { grid, loop } = buildGrid((ctx) => {
    seen = ctx;
    return new CustomPopup();
  });
  loop.focusView(grid.rows); // cursor on region (col 0)
  loop.dispatch(rawKey('down', { alt: true })); // Alt+Down opens the (custom) popup
  loop.renderRoot.flush();

  const all = descendants(grid);
  expect(all.some((v) => v instanceof FilterPopup)).toBe(false); // the built-in popup was NOT mounted
  expect(all.some((v) => v instanceof CustomPopup)).toBe(true); // the factory's view is mounted instead
  expect(seen).not.toBeNull();
  expect(seen!.columnId).toBe('region'); // the context carries the opened column
  expect(seen!.filterType).toBe('text'); // ...and its resolved filter type
  expect(typeof seen!.defaultPopup).toBe('function'); // ...and a builder for the built-in popup
});

test('ctx.defaultPopup() reuses the built-in popup through the seam', () => {
  const { grid, loop } = buildGrid((ctx) => ctx.defaultPopup()); // factory just returns the built-in
  loop.focusView(grid.rows);
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  expect(descendants(grid).some((v) => v instanceof FilterPopup)).toBe(true); // built-in mounted via the seam
});

test('a custom popup that sets its own size is mounted anchored at that size (not forced to the default)', () => {
  class BigPopup extends Group {
    constructor() {
      super();
      this.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 30, height: 5 } };
    }
  }
  const { grid, loop } = buildGrid(() => new BigPopup());
  loop.focusView(grid.rows);
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  const big = descendants(grid).find((v): v is BigPopup => v instanceof BigPopup);
  expect(big).toBeDefined();
  expect(big!.layout.rect?.width).toBe(30); // the factory-chosen width is honored (default is 26)
  expect(big!.layout.rect?.height).toBe(5); // ...and height
});
