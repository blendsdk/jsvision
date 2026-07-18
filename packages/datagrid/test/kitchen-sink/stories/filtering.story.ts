/**
 * The filtering showcase story — Excel-class column filtering. The opt-in quick-filter row under the
 * header does a live contains-match per column as you type. A column's funnel `▽` appears once it has an
 * active filter; the columns here also opt into an always-visible funnel (`showFunnel: true`) so the
 * affordance is visible up front. Click a funnel, or press `Alt+Down` on any focused filterable cell
 * (which works whether or not a funnel is shown), to open a condition popup (type-appropriate operators)
 * with an embedded value-list (distinct checkboxes + search + Select All). The popup stays within the
 * viewport, and can be replaced wholesale via the grid's `filterPopup` seam. A live "N of M" readout
 * echoes `filteredCount()` / `totalCount()` so the effect of every filter is visible immediately.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Sale {
  region: string;
  qty: number;
  closed: Date | null;
}

export const filteringStory: Story = {
  id: 'datagrid/filtering',
  category: 'DataGrid',
  title: 'Column filtering',
  blurb:
    'Excel-class filtering — a live quick-filter row, header funnel condition popups, and a distinct value-list, with an N-of-M readout.',
  rd: 'RD-06',
  build(ctx) {
    const rows = signal<Sale[]>([
      { region: 'east', qty: 1000, closed: new Date(2026, 0, 15) },
      { region: 'west', qty: 9, closed: null },
      { region: 'north', qty: 50, closed: new Date(2025, 11, 1) },
      { region: 'south', qty: 9, closed: new Date(2026, 2, 3) },
      { region: 'east', qty: 300, closed: new Date(2026, 1, 20) },
    ]);

    const columns = [
      column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10, showFunnel: true }),
      column<Sale, number>({
        id: 'qty',
        title: 'Qty',
        value: (r) => r.qty,
        align: 'right',
        width: 8,
        showFunnel: true,
      }),
      column<Sale, Date | null>({
        id: 'closed',
        title: 'Closed',
        width: 12,
        value: (r) => r.closed,
        format: (v) => (v ? v.toISOString().slice(0, 10) : '—'),
        showFunnel: true,
      }),
    ];

    const grid = new EditableDataGrid<Sale>({
      columns,
      source: fromRows(rows, { rowKey: (r) => `${r.region}:${r.qty}` }),
      quickFilter: true, // the always-visible quick-filter band under the header
      zebra: true,
    });

    const hints = new Text(
      'Type in the quick-filter row · these columns show a ▽ — click it or press Alt+Down on any cell for conditions & a value-list',
    );
    // Live "N of M" — repaints whenever a filter changes the visible row count.
    const echo = new Text(() => `Showing ${grid.filteredCount()} of ${grid.totalCount()} rows`);

    const root = new Group();
    const gridHeight = Math.max(1, ctx.height - 2); // two rows for the hints + the live readout
    root.add(at(hints, 0, 0, ctx.width, 1));
    root.add(at(echo, 0, 1, ctx.width, 1));
    root.add(at(grid, 0, 2, ctx.width, gridHeight));
    return root;
  },
};
