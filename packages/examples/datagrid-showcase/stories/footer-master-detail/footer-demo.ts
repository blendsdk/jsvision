/**
 * Shared builder for the single-grid Footer-&-aggregation demos — a grid with a footer band (aggregates
 * and/or widgets) plus a one-line hint and an optional live echo. Each demo file supplies its rows,
 * columns, footer config, and (optionally) a windowed source or a selection option. The master-detail
 * demo is built separately (it composes two grids). The `.js` extension is required by NodeNext ESM.
 */
import { Group, Text, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import { fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { GridColumn, GridDataSource, GridFooter, EditableDataGridOptions } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

/** The slice of grid options a footer demo may set (data/columns/footer are passed separately). */
type FooterDemoOptions<T> = Pick<EditableDataGridOptions<T>, 'selectionMode' | 'checkboxColumn' | 'zebra'>;

/**
 * Build one single-grid Footer-&-aggregation demo.
 *
 * @param args `slug`/`title`/`blurb`/`hint`; the demo `rows` (copied per build) and `columns`; the
 *   `footer` config; an optional `source` factory (defaults to `fromRows`, overridden for the windowed
 *   honesty demo); optional grid `options`; an optional `echo` reactive readout; and an optional `setup`.
 * @returns A `Story` in the `Footer & aggregation` category.
 * @example
 * ```ts
 * export const demo = buildFooterStory({
 *   slug: 'aggregates', title: 'Column aggregates', blurb: '…', hint: 'sort/filter to see totals move',
 *   rows: [{ id: 1, qty: 3 }], columns: [column({ id: 'qty', title: 'Qty', value: (r) => r.qty, width: 6 })],
 *   footer: { aggregates: { qty: { fn: 'sum', label: 'Σ' } } },
 * });
 * ```
 */
export function buildFooterStory<T extends { id: number | string }>(args: {
  slug: string;
  title: string;
  blurb: string;
  hint: string;
  rows: T[];
  columns: GridColumn<T>[];
  footer: GridFooter;
  source?: (rows: Signal<T[]>) => GridDataSource<T>;
  options?: FooterDemoOptions<T>;
  echo?: (grid: EditableDataGrid<T>, rows: Signal<T[]>) => () => string;
  setup?: (grid: EditableDataGrid<T>) => void;
}): Story {
  return {
    id: `datagrid/footer-master-detail/${args.slug}`,
    category: 'Footer & aggregation',
    title: args.title,
    blurb: args.blurb,
    rd: 'RD-09',
    build(ctx) {
      const rows = signal<T[]>(args.rows.map((r) => ({ ...r })));
      const grid = new EditableDataGrid<T>({
        columns: args.columns,
        source: args.source ? args.source(rows) : fromRows(rows, { rowKey: (r) => r.id }),
        zebra: true,
        footer: args.footer,
        ...args.options,
      });
      args.setup?.(grid);

      const root = new Group();
      root.add(at(new Text(args.hint), 0, 0, ctx.width, 1));
      let top = 1;
      if (args.echo !== undefined) {
        root.add(at(new Text(args.echo(grid, rows)), 0, 1, ctx.width, 1));
        top = 2;
      }
      root.add(at(grid, 0, top, ctx.width, Math.max(1, ctx.height - top)));
      return root;
    },
  };
}
