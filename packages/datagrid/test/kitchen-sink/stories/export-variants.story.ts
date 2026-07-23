/**
 * The export & layout-variants showcase story — serialize the current view and round-trip a saved
 * column layout. `exportView(csv|html|json|tsv)` returns a string the app writes to a file or clipboard
 * (RFC-4180 CSV/TSV with formula-injection escaping, a standalone escaped HTML document, raw-values JSON);
 * `saveVariant`/`applyVariant` capture and restore the full column layout (order, widths, visibility,
 * freeze, sort, filter). This story saves a "compact" variant, resets, then re-applies it — the layout
 * returns — and echoes the live CSV of the restored view.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, EditableDataGrid, fromRows } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Rec {
  id: number;
  name: string;
  dept: string;
  total: number;
}

export const exportVariantsStory: Story = {
  id: 'datagrid/export-variants',
  category: 'DataGrid',
  title: 'Export & layout variants',
  blurb:
    'Serialize the current view to CSV/HTML/JSON/TSV, and save/restore a named column layout (order, freeze, sort, filter).',
  rd: 'RD-13',
  build(ctx) {
    const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    const rows = signal<Rec[]>([
      { id: 1, name: 'Ann', dept: 'Eng', total: 1200 },
      { id: 2, name: 'Bob', dept: 'Ops', total: 3400 },
      { id: 3, name: 'Cy', dept: 'Eng', total: 2100 },
    ]);
    const columns = [
      column({ id: 'id', title: '#', value: (r: Rec) => r.id, width: 4, align: 'right' as const }),
      column({ id: 'name', title: 'Name', value: (r: Rec) => r.name, width: 10 }),
      column({ id: 'dept', title: 'Dept', value: (r: Rec) => r.dept, width: 8 }),
      column({
        id: 'total',
        title: 'Total',
        value: (r: Rec) => r.total,
        format: (v) => usd.format(v),
        align: 'right' as const,
        width: 12,
      }),
    ];
    const grid = new EditableDataGrid<Rec>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }), zebra: true });

    // Save a "compact" layout (dept hidden, sorted by total desc), reset the grid, then re-apply the saved
    // variant — the customized layout returns, proving the round-trip.
    grid.setColumnVisible('dept', false);
    grid.sortBy('total', 'desc');
    const compact = grid.saveVariant('compact');
    grid.setColumnVisible('dept', true); // reset to the default view…
    grid.clearSort();
    grid.applyVariant(compact); // …then restore: dept hidden, total descending again

    // A live CSV echo of the current (restored) view — reading exportView subscribes to the display.
    const csvEcho = new Text(() => 'CSV  ' + grid.exportView('csv').replace(/\r\n/g, '  ¦  '));
    const hints = new Text(
      'exportView(csv/html/json/tsv) → a string the app writes to a file/clipboard · saveVariant/applyVariant round-trip the layout',
    );

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 3);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    root.add(at(csvEcho, 0, gridH, ctx.width, 1));
    root.add(at(hints, 0, gridH + 1, ctx.width, 2));
    return root;
  },
};
