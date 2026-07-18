/**
 * The data-at-scale showcase story — continuous virtual scroll over a **100,000-row windowed source**.
 * Only the visible window (plus a one-viewport prefetch buffer) is ever loaded; an unloaded row paints a
 * muted `…` until its page streams in, and a live "N of M loaded" read-out grows as you scroll. The grid
 * stays O(visible) — no per-row view, no full materialize — proving the windowed read path end to end.
 */
import { Group, Text } from '@jsvision/ui';
import { column, EditableDataGrid } from '../../../src/index.js';
import { asyncWindowedSource } from '../../fixtures/async-windowed-source.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Rec {
  id: number;
  name: string;
  city: string;
  balance: number;
}

export const dataAtScaleStory: Story = {
  id: 'datagrid/data-at-scale',
  category: 'DataGrid',
  title: 'Data at scale (100k windowed)',
  blurb: 'A 100,000-row windowed source: only the visible window loads, unloaded rows show …, and it stays O(visible).',
  rd: 'RD-11',
  build(ctx) {
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Boston', 'Denver'];
    const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
    // A windowed source: `fetchPage` streams one page at a time; the grid drives it as the window scrolls.
    const source = asyncWindowedSource<Rec>({
      total: 100000,
      pageSize: 100,
      fetchPage: (page) =>
        Promise.resolve(
          Array.from({ length: 100 }, (_, k) => {
            const id = page * 100 + k;
            return { id, name: `Customer ${id}`, city: cities[id % cities.length], balance: (id * 37) % 100000 };
          }),
        ),
      rowKey: (r) => r.id,
    });
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
    const grid = new EditableDataGrid<Rec>({ columns, source, zebra: true });
    // Live "N of M loaded": reading `revision()` subscribes to page-load bumps, so this repaints as pages stream in.
    const readout = new Text(() => {
      source.revision();
      return `${source.loadedRowCount().toLocaleString()} of ${source.length().toLocaleString()} rows loaded — scroll to stream more`;
    });
    const hints = new Text(
      '↑↓ / PgUp·PgDn scroll — an unloaded row shows … until its page streams in (O(visible), never O(rows))',
    );

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 2);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    root.add(at(readout, 0, gridH, ctx.width, 1));
    root.add(at(hints, 0, gridH + 1, ctx.width, 1));
    return root;
  },
};
