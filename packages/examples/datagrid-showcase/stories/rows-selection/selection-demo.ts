/**
 * Shared builder for the Rows-&-Selection demos — a grid plus a live echo of the selection/row state it
 * showcases (selectedKeys, row count). An optional control band (e.g. the CRUD buttons) slots between the
 * echo and the grid, and an optional `setup` hook seeds selection before the first paint. Each demo file
 * supplies its columns, rows, options, and echo. The `.js` extension is required by NodeNext ESM.
 */
import { Group, Text, signal } from '@jsvision/ui';
import type { View, Signal } from '@jsvision/ui';
import { fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { GridColumn, EditableDataGridOptions } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

/** The selection/CRUD slice of the grid options a demo may set (data + columns are passed separately). */
type SelectionOptions<T> = Pick<
  EditableDataGridOptions<T>,
  'selectionMode' | 'checkboxColumn' | 'rowNumbers' | 'assignKey' | 'onCommit' | 'zebra' | 'freeze'
>;

/**
 * Build one Rows-&-Selection demo.
 *
 * @param args `slug`/`title`/`blurb`/`hint`; the demo `rows` (copied per build) and `columns`; the
 *   selection `options`; an `echo` returning a reactive readout of the selection/row state; an optional
 *   two-row `control` band placed above the grid; and an optional `setup` hook run once after the grid is
 *   built (e.g. to seed the selection).
 * @returns A `Story` in the `Rows & selection` category.
 * @example
 * ```ts
 * export const demo = buildSelectionStory({
 *   slug: 'multi', title: 'Multi-select', blurb: '…', hint: 'Space toggles',
 *   rows: [{ id: 1, name: 'Ada' }], columns: [column({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 })],
 *   options: { selectionMode: 'multi' }, echo: (g) => () => `selected: ${[...g.selectedKeys()].length}`,
 * });
 * ```
 */
export function buildSelectionStory<T extends { id: number | string }>(args: {
  slug: string;
  title: string;
  blurb: string;
  hint: string;
  rows: T[];
  columns: GridColumn<T>[];
  options?: SelectionOptions<T>;
  echo: (grid: EditableDataGrid<T>, rows: Signal<T[]>) => () => string;
  control?: (grid: EditableDataGrid<T>, rows: Signal<T[]>) => View;
  setup?: (grid: EditableDataGrid<T>) => void;
}): Story {
  return {
    id: `datagrid/rows-selection/${args.slug}`,
    category: 'Rows & selection',
    title: args.title,
    blurb: args.blurb,
    rd: 'RD-08',
    build(ctx) {
      const rows = signal<T[]>(args.rows.map((r) => ({ ...r })));
      const grid = new EditableDataGrid<T>({
        columns: args.columns,
        source: fromRows(rows, { rowKey: (r) => r.id }),
        zebra: true,
        ...args.options,
      });
      args.setup?.(grid);

      const root = new Group();
      root.add(at(new Text(args.hint), 0, 0, ctx.width, 1));
      root.add(at(new Text(args.echo(grid, rows)), 0, 1, ctx.width, 1));
      let top = 2;
      if (args.control !== undefined) {
        root.add(at(args.control(grid, rows), 0, top, ctx.width, 2)); // a button is two rows tall
        top += 2;
      }
      root.add(at(grid, 0, top, ctx.width, Math.max(1, ctx.height - top)));
      return root;
    },
  };
}
