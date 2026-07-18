/**
 * Data at scale · 100k windowed scroll — continuous virtual scroll over a 100,000-row **windowed**
 * source. Only the visible window (plus a one-viewport prefetch buffer) is loaded; an unloaded row
 * paints a muted `…` until its page streams in, and a live "N of M loaded" read-out grows as you scroll.
 * Clicking a header pushes the sort down to the source (it re-queries), never a client-side scan.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { column, EditableDataGrid } from '@jsvision/datagrid';
import { createWindowedSource } from '../lib/windowed-source.js';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Rec {
  id: number;
  name: string;
  city: string;
  balance: number;
}

const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Boston', 'Denver'];

export const dataAtScaleScrollStory: Story = {
  id: 'datagrid/data-at-scale/scroll-100k',
  category: 'Data at scale',
  title: '100k windowed scroll',
  blurb:
    'Virtual scroll over a 100,000-row windowed source — only the window loads; unloaded rows show …; sort pushes down.',
  rd: 'RD-11',
  build(ctx) {
    const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
    const backing: Rec[] = Array.from({ length: 100000 }, (_, id) => ({
      id,
      name: `Customer ${id}`,
      city: CITIES[id % CITIES.length],
      balance: (id * 37) % 100000,
    }));
    const columns = [
      column({ id: 'id', title: '#', value: (r: Rec) => r.id, width: 8, align: 'right' as const }),
      column({ id: 'name', title: 'Name', value: (r: Rec) => r.name, width: 16 }),
      column({ id: 'city', title: 'City', value: (r: Rec) => r.city, width: 13 }),
      column({
        id: 'balance',
        title: 'Balance',
        value: (r: Rec) => r.balance,
        format: (v) => eur.format(v),
        align: 'right' as const,
        width: 14,
      }),
    ];
    const source = createWindowedSource(backing, { rowKey: (r) => r.id, columns, pageSize: 100 });
    const grid = new EditableDataGrid<Rec>({ columns, source, zebra: true });
    const readout = new Text(
      () => `${source.loadedRowCount().toLocaleString()} of ${source.length().toLocaleString()} rows loaded`,
    );
    const hints = new Text(
      '↑↓ / PgUp·PgDn scroll — unloaded rows show … · click a header: the sort is pushed to the source',
    );

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 2);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    root.add(at(readout, 0, gridH, ctx.width, 1));
    root.add(at(hints, 0, gridH + 1, ctx.width, 1));
    return root;
  },
};
