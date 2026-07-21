/**
 * The sorting showcase story — value-aware single + multi-column sort (RD-05). A click on a header
 * sorts by that column's TYPED value (so `Qty` orders 9 before 1000, not lexically); Ctrl+click adds a
 * secondary key with a priority digit; clicking a sorted header again cycles asc → desc → none. A live
 * readout echoes the current `grid.sort()` model, and the nullable `Closed` column shows null ordering.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '../../../src/index.js';
import type { SortKey } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Sale {
  region: string;
  qty: number;
  closed: Date | null;
}

/** Render the sort model as a compact chip list, e.g. `qty ▲, region ▼` (or `(none)`). */
function describeSort(keys: SortKey[]): string {
  if (keys.length === 0) return '(none)';
  return keys.map((k) => `${k.columnId} ${k.dir === 'asc' ? '▲' : '▼'}`).join(', ');
}

export const sortingStory: Story = {
  id: 'datagrid/sorting',
  category: 'DataGrid',
  title: 'Column sorting',
  blurb: 'Value-aware single & multi-column sort — click a header, Ctrl+click to add a key, with a live sort readout.',
  rd: 'RD-05',
  build(ctx) {
    const rows = signal<Sale[]>([
      { region: 'east', qty: 1000, closed: new Date(2026, 0, 15) },
      { region: 'west', qty: 9, closed: null },
      { region: 'north', qty: 50, closed: new Date(2025, 11, 1) },
      { region: 'south', qty: 9, closed: new Date(2026, 2, 3) },
    ]);

    const columns = [
      column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
      // Numeric: sorts by value (9 before 1000), never by the display string.
      column<Sale, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, align: 'right', width: 8 }),
      // Nullable Date: nulls sort last (the default) regardless of direction; shown as an em dash.
      column<Sale, Date | null>({
        id: 'closed',
        title: 'Closed',
        width: 12,
        value: (r) => r.closed,
        format: (v) => (v ? v.toISOString().slice(0, 10) : '—'),
        nulls: 'last',
      }),
    ];

    const grid = new EditableDataGrid<Sale>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.region }),
      zebra: true,
    });

    const hints = new Text('Click a header to sort · Ctrl+click adds a key · click again cycles asc → desc → none');
    // Live echo of the container's sort model — repaints whenever grid.sort() changes.
    const echo = new Text(() => `Sort: ${describeSort(grid.sort())}`);

    const root = new Group();
    const gridHeight = Math.max(1, ctx.height - 2); // two rows for the hints + the live readout
    root.add(at(hints, 0, 0, ctx.width, 1));
    root.add(at(echo, 0, 1, ctx.width, 1));
    root.add(at(grid, 0, 2, ctx.width, gridHeight));
    return root;
  },
};
