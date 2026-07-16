/**
 * Implementation tests — the `Alt+Down` keyboard filter opener beyond the spec oracles: anchor parity
 * with the mouse funnel-click, a no-throw on an empty-data grid, coexistence with the in-editor
 * `Alt+Down` (ComboBox value-help), and — the load-bearing one — that the opener still anchors under
 * the correct header after a layout rebuild, proving the container refreshed its retained headers.
 *
 * The popup is mounted with no screen clamping (`mountCellOverlay` places it at `origin + anchor`), so
 * its `layout.rect.x` is exactly the anchor — a keyboard-vs-mouse comparison is precise. The `.js`
 * import specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { Group, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import type { GridColumn } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
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

const CW = 24;
const CH = 6;
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

function buildGrid(opts: { columns?: GridColumn<Sale>[]; rows?: Sale[] } = {}) {
  const source = fromRows(signal(opts.rows ?? SALES.slice()), { rowKey: (r) => r.region });
  const grid = new EditableDataGrid<Sale>({ columns: opts.columns ?? [REGION, QTY], source });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: CW, height: CH } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: CW, height: CH }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();
  return { grid, loop };
}

/** The single open filter popup (asserts exactly one is open). */
function onlyPopup(grid: EditableDataGrid<Sale>): FilterPopup<Sale> {
  const popups = descendants(grid).filter((v): v is FilterPopup<Sale> => v instanceof FilterPopup);
  expect(popups.length).toBe(1);
  return popups[0];
}

test('the keyboard-opened popup anchors at the same cell a funnel click would (parity)', () => {
  const { grid, loop } = buildGrid();
  // Open via a funnel CLICK on qty's funnel cell — content x = starts[1](9) + width(6) − 1 = 14
  // (loop.dispatch is 1-based; the header sits at screen row 0 → y = 1).
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 14 + 1, y: 1 });
  loop.renderRoot.flush();
  const clickX = onlyPopup(grid).layout.rect?.x;

  // Open the same column via Alt+Down (move the cursor to qty first). The second open replaces the first.
  loop.focusView(grid.rows);
  loop.dispatch(rawKey('right')); // cursor → qty (col 1)
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  expect(onlyPopup(grid).layout.rect?.x).toBe(clickX); // same anchor via keyboard and mouse
});

test('Alt+Down on an empty-data grid does not throw', () => {
  const { grid, loop } = buildGrid({ rows: [] });
  loop.focusView(grid.rows);
  expect(() => {
    loop.dispatch(rawKey('down', { alt: true }));
    loop.renderRoot.flush();
  }).not.toThrow();
});

test('while a lookup (ComboBox) editor is open, Alt+Down drives the editor and opens no filter popup', () => {
  const region = column<Sale, string>({
    id: 'region',
    title: 'Region',
    value: (r) => r.region,
    width: 8,
    parse: (t) => t,
    set: (r, v) => {
      r.region = v;
    },
    editor: {
      kind: 'lookup',
      items: [
        { key: 'east', label: 'East' },
        { key: 'west', label: 'West' },
        { key: 'north', label: 'North' },
      ],
    },
  });
  const { grid, loop } = buildGrid({ columns: [region, QTY] });
  loop.focusView(grid.rows);
  loop.dispatch(rawKey('f4')); // begin editing the focused (region) cell + open the ComboBox dropdown
  loop.renderRoot.flush();
  loop.dispatch(rawKey('down', { alt: true })); // the editor's own Alt+Down (ComboBox), not the filter opener
  loop.renderRoot.flush();
  const popups = descendants(grid).filter((v): v is FilterPopup<Sale> => v instanceof FilterPopup);
  expect(popups.length).toBe(0); // no filter popup — the open editor kept the key
});

test('Alt+Down still anchors under the correct header after a rebuild (retained headers refreshed)', () => {
  const { grid, loop } = buildGrid();
  // Hide region → a rebuild; qty becomes the first (and only) column at a new position.
  grid.setColumnVisible('region', false);
  loop.renderRoot.flush();

  // Ground truth: a funnel click always uses the current header (captured in a closure). qty is now the
  // sole column (width 6), so its funnel sits at content x = width − 1 = 5.
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 5 + 1, y: 1 });
  loop.renderRoot.flush();
  const mouseX = onlyPopup(grid).layout.rect?.x;

  // Keyboard open on qty. If grid.ts kept the STALE (unmounted) headers, the keyboard anchor would not
  // match the mouse path; equality proves the retained headers were refreshed in the rebuild.
  loop.focusView(grid.rows);
  loop.dispatch(rawKey('home')); // cursor → col 0 (now qty)
  loop.dispatch(rawKey('down', { alt: true }));
  loop.renderRoot.flush();
  expect(onlyPopup(grid).layout.rect?.x).toBe(mouseX);
});
