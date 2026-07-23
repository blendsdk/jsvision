/**
 * Shared builder for the Columns-&-Layout demos — a grid plus a live echo of the layout state it
 * showcases (column order, frozen panels, widths). An optional control band (e.g. a show/hide toggle)
 * slots between the echo and the grid. Each demo file supplies its columns, rows, options, and echo.
 * The `.js` extension is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { GridColumn, EditableDataGridOptions } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

/** The layout-only slice of the grid options a demo may set (data + columns are passed separately). */
type LayoutOptions<T> = Pick<
  EditableDataGridOptions<T>,
  'freeze' | 'freezeLeft' | 'freezeRight' | 'freezeRows' | 'density' | 'zebra'
>;

/**
 * Build one Columns-&-Layout demo.
 *
 * @param args `slug`/`title`/`blurb`/`hint`; the demo `rows` (copied per build) and `columns`; the
 *   layout `options`; an `echo` returning a reactive readout of the layout state; and an optional
 *   `control` band (two rows tall) placed above the grid.
 * @returns A `Story` in the `Columns & layout` category.
 * @example
 * ```ts
 * export const demo = buildLayoutStory({
 *   slug: 'frozen', title: 'Frozen columns', blurb: '…', hint: 'Scroll ↔ — id stays pinned',
 *   rows: [{ id: 1, name: 'Ada' }], columns: [column({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 })],
 *   options: { freeze: 1 }, echo: (g) => () => `frozen: ${g.frozen().left.join(',')}`,
 * });
 * ```
 */
export function buildLayoutStory<T extends { id: number | string }>(args: {
  slug: string;
  title: string;
  blurb: string;
  hint: string;
  rows: T[];
  columns: GridColumn<T>[];
  options?: LayoutOptions<T>;
  echo: (grid: EditableDataGrid<T>) => () => string;
  control?: (grid: EditableDataGrid<T>) => View;
}): Story {
  return {
    id: `datagrid/columns-layout/${args.slug}`,
    category: 'Columns & layout',
    title: args.title,
    blurb: args.blurb,
    rd: 'RD-07',
    build(ctx) {
      const rows = signal<T[]>(args.rows.map((r) => ({ ...r })));
      const grid = new EditableDataGrid<T>({
        columns: args.columns,
        source: fromRows(rows, { rowKey: (r) => r.id }),
        zebra: true,
        ...args.options,
      });

      const root = new Group();
      root.add(at(new Text(args.hint), 0, 0, ctx.width, 1));
      root.add(at(new Text(args.echo(grid)), 0, 1, ctx.width, 1));
      let top = 2;
      if (args.control !== undefined) {
        root.add(at(args.control(grid), 0, top, ctx.width, 2)); // a button is two rows tall
        top += 2;
      }
      root.add(at(grid, 0, top, ctx.width, Math.max(1, ctx.height - top)));
      return root;
    },
  };
}
