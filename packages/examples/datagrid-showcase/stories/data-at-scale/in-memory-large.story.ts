/**
 * Data at scale · In-memory large — a 100,000-row **eager** `Signal<T[]>` source. Virtual scroll applies
 * here too: the single-view body paints only the visible window, so the mounted cell-view count stays
 * O(visible) (no per-row `View` explosion). `materialize` runs once on a data change, never on scroll —
 * so scrolling a huge in-memory array is just as cheap as a small one.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Rec {
  id: number;
  name: string;
  balance: number;
}

export const dataAtScaleInMemoryStory: Story = {
  id: 'datagrid/data-at-scale/in-memory-large',
  category: 'Data at scale',
  title: 'In-memory large (100k eager)',
  blurb:
    'A 100,000-row in-memory Signal<T[]> — still O(visible) views; materialize runs once on change, never on scroll.',
  rd: 'RD-11',
  build(ctx) {
    const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
    const rows = signal<Rec[]>(
      Array.from({ length: 100000 }, (_, id) => ({ id, name: `Row ${id}`, balance: (id * 13) % 100000 })),
    );
    const columns = [
      column({ id: 'id', title: '#', value: (r: Rec) => r.id, width: 8, align: 'right' as const }),
      column({ id: 'name', title: 'Name', value: (r: Rec) => r.name, width: 16 }),
      column({
        id: 'balance',
        title: 'Balance',
        value: (r: Rec) => r.balance,
        format: (v) => eur.format(v),
        align: 'right' as const,
        width: 14,
      }),
    ];
    const grid = new EditableDataGrid<Rec>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }), zebra: true });
    const readout = new Text(() => `${grid.totalCount().toLocaleString()} rows — bounded cell views, no per-row View`);
    const hints = new Text(
      '↑↓ / PgUp·PgDn scroll a huge eager array — just as cheap as a small one (single-view body)',
    );

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 2);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    root.add(at(readout, 0, gridH, ctx.width, 1));
    root.add(at(hints, 0, gridH + 1, ctx.width, 1));
    return root;
  },
};
