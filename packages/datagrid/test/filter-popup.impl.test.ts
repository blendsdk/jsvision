/**
 * Implementation tests — `FilterPopup` edges beyond the spec oracles: reopening a filtered column
 * pre-fills the operator + operands from the existing filter; Escape closes without applying while
 * Enter applies; and, at the container level, a funnel click mounts the popup anchored below the funnel
 * and an outside click (the click-away catcher) closes it.
 *
 * The unit cases drive the popup's public signals/methods; the container case dispatches real mouse
 * events through the event loop (the funnel→popup seam forwards the live envelope). The `.js` import
 * specifier is required by NodeNext ESM.
 */
import { test, expect, vi } from 'vitest';
import { Group, createRenderRoot, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { DispatchEvent, View } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { ColumnFilter, FilterType } from '../src/filter.js';
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

/** Mount a bare `FilterPopup` and return it plus a frame pump. */
function buildPopup(opts: {
  filterType: FilterType;
  columnId?: string;
  current?: ColumnFilter;
  onApply?: (columnId: string, filter: ColumnFilter) => void;
  onClose?: () => void;
}) {
  const columnId = opts.columnId ?? 'qty';
  const col = column<Sale, number>({ id: columnId, title: 'Qty', value: (r) => r.qty, width: 8 });
  const popup = new FilterPopup<Sale>({
    column: col,
    columnId,
    filterType: opts.filterType,
    current: opts.current,
    onApply: opts.onApply ?? (() => undefined),
    onClear: () => undefined,
    onClose: opts.onClose ?? (() => undefined),
  });
  popup.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 30, height: 8 } };
  const root = new Group();
  root.add(popup);
  const render = createRenderRoot({ width: 30, height: 10 }, { caps });
  render.mount(root);
  render.flush();
  return { popup, render };
}

/** A synthetic key envelope. */
function keyEvent(key: string): DispatchEvent {
  return {
    event: { type: 'key', key, ctrl: false, alt: false, shift: false },
    handled: false,
  } as unknown as DispatchEvent;
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

test('reopening a filtered column pre-fills the operator and operands from the current filter', () => {
  const num = buildPopup({ filterType: 'number', current: { kind: 'number', op: 'between', a: 100, b: 500 } }).popup;
  expect(num.currentOperator()).toBe('between');
  expect(num.needsSecondOperand()).toBe(true);
  expect(num.operandA()).toBe('100');
  expect(num.operandB()).toBe('500');

  const txt = buildPopup({
    filterType: 'text',
    columnId: 'region',
    current: { kind: 'text', op: 'endsWith', value: 'st' },
  }).popup;
  expect(txt.currentOperator()).toBe('endsWith');
  expect(txt.operandA()).toBe('st');
});

test('Escape closes the popup without applying; Enter applies then closes', () => {
  const onApply = vi.fn<(columnId: string, filter: ColumnFilter) => void>();
  const onClose = vi.fn<() => void>();
  const { popup } = buildPopup({ filterType: 'number', onApply, onClose });
  popup.selectOperator('gt');
  popup.operandA.set('42');

  const esc = keyEvent('escape');
  popup.onEvent(esc);
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onApply).not.toHaveBeenCalled(); // Escape discards
  expect(esc.handled).toBe(true);

  const enter = keyEvent('enter');
  popup.onEvent(enter);
  expect(onApply).toHaveBeenCalledWith('qty', { kind: 'number', op: 'gt', a: 42 });
  expect(onClose).toHaveBeenCalledTimes(2);
  expect(enter.handled).toBe(true);
});

test('a funnel click opens the popup anchored below the funnel; an outside click closes it', () => {
  const W = 60; // wide enough that the 34-cell popup fits at the funnel anchor without clamping
  const H = 8;
  const COLUMNS = [
    column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 }),
    column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: 6 }),
  ];
  const grid = new EditableDataGrid<Sale>({
    columns: COLUMNS,
    source: fromRows(signal(SALES.slice()), { rowKey: (r) => r.region }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  const pump = (): void => loop.renderRoot.flush();
  pump();

  grid.setFilter('qty', { kind: 'number', op: 'gt', a: 0 }); // funnel appears on qty
  pump();
  // qty funnel content-x = starts[1](9) + width[1](6) − 1 = 14; header is screen row 0. Dispatch is 1-based.
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 15, y: 1 });
  pump();

  const popup = descendants(grid.popupOverlay).find((v): v is FilterPopup<Sale> => v instanceof FilterPopup);
  expect(popup).toBeDefined();
  expect(popup!.bounds.x).toBe(14); // anchored at the funnel column
  expect(popup!.bounds.y).toBe(1); // one row below the header

  // An outside mouse-down (x=2 is left of the popup at x≥14) hits the click-away catcher and closes it.
  loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x: 3, y: 4 });
  pump();
  expect(descendants(grid.popupOverlay).some((v) => v instanceof FilterPopup)).toBe(false);
});
