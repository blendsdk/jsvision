/**
 * Specification tests (immutable oracle) — the condition section of `FilterPopup` (`filter-popup.ts`):
 * the operator choices offered per column filter type, the reveal of a second operand for `between`,
 * and the `ColumnFilter` that Apply emits. The popup is mounted bare in a render root (so `onMount`
 * wires its widgets); its operator / operand state is driven through the popup's public signals, and
 * Apply is invoked through its public method — the same way a user's selector/keystrokes would.
 *
 * Expectations derive from the requirements/spec docs (operator sets by type; the number `between`
 * shape), never the implementation. The `.js` import specifier is required by NodeNext ESM.
 */
import { test, expect, vi } from 'vitest';
import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import { column } from '../src/column.js';
import type { ColumnFilter, FilterType } from '../src/filter.js';
import { FilterPopup } from '../src/filter-popup.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Sale {
  region: string;
  qty: number;
}

/** Mount a bare `FilterPopup` for one column and return it plus a frame pump. */
function buildPopup(opts: {
  filterType: FilterType;
  columnId?: string;
  current?: ColumnFilter;
  onApply?: (columnId: string, filter: ColumnFilter) => void;
  onClear?: (columnId: string) => void;
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
    onClear: opts.onClear ?? (() => undefined),
    onClose: opts.onClose ?? (() => undefined),
  });
  popup.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 30, height: 8 } };
  const root = new Group();
  root.add(popup);
  const render = createRenderRoot({ width: 30, height: 10 }, { caps });
  render.mount(root);
  const pump = (): void => render.flush();
  pump();
  return { popup, render, pump };
}

test('ST-21: the operator choices match the column filter type', () => {
  expect(buildPopup({ filterType: 'text' }).popup.operators()).toEqual([
    'contains',
    'startsWith',
    'endsWith',
    'equals',
  ]);
  expect(buildPopup({ filterType: 'number' }).popup.operators()).toEqual(['gt', 'lt', 'between', 'eq']);
  expect(buildPopup({ filterType: 'date' }).popup.operators()).toEqual(['before', 'after', 'on', 'between']);
});

test('ST-22: a number "between" filter reveals a second operand; Apply emits {number,between,a,b}', () => {
  const onApply = vi.fn<(columnId: string, filter: ColumnFilter) => void>();
  const onClose = vi.fn<() => void>();
  const { popup, pump } = buildPopup({ filterType: 'number', columnId: 'qty', onApply, onClose });

  popup.selectOperator('gt');
  pump();
  expect(popup.currentOperator()).toBe('gt');
  expect(popup.needsSecondOperand()).toBe(false); // a single-operand operator

  popup.selectOperator('between');
  pump();
  expect(popup.needsSecondOperand()).toBe(true); // between reveals the second operand

  popup.operandA.set('100');
  popup.operandB.set('500');
  popup.apply();
  expect(onApply).toHaveBeenCalledWith('qty', { kind: 'number', op: 'between', a: 100, b: 500 });
  expect(onClose).toHaveBeenCalled(); // Apply commits and closes
});
