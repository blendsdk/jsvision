/**
 * Filtering · Push-down — over a source that implements `setFilter`, the grid delegates filtering to the
 * source instead of filtering client-side. This demo binds the bespoke spy source with the quick-filter
 * band, so typing pushes the filter model down; the echo shows exactly what the source received (and
 * clearing the box pushes an empty model). The `.js` extension is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { column, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { createSpySource } from '../lib/spy-source.js';
import { describeFilter } from './filter-demo.js';

interface Row {
  id: number;
  region: string;
  qty: number;
}

const DATA: Row[] = [
  { id: 1, region: 'EMEA', qty: 120 },
  { id: 2, region: 'APAC', qty: 40 },
  { id: 3, region: 'AMER', qty: 200 },
  { id: 4, region: 'EMEA', qty: 75 },
  { id: 5, region: 'APAC', qty: 60 },
];

export const filteringPushDownStory: Story = {
  id: 'datagrid/filtering/push-down',
  category: 'Filtering',
  title: 'Push-down filter',
  rd: 'RD-06',
  blurb:
    'Over a source implementing setFilter, the grid delegates filtering to the source; the echo shows what was pushed down.',
  build(ctx) {
    const columns = [
      column<Row, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
      column<Row, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, align: 'right', width: 8 }),
    ];
    const spy = createSpySource(DATA, { rowKey: (r) => r.id, columns });
    const grid = new EditableDataGrid<Row>({ columns, source: spy, quickFilter: true, zebra: true });

    const root = new Group();
    root.add(
      at(
        new Text('Type in the quick-filter row — the filter is pushed down to the source (clear it to reset)'),
        0,
        0,
        ctx.width,
        1,
      ),
    );
    root.add(at(new Text(() => `Pushed down: ${describeFilter(spy.lastFilter())}`), 0, 1, ctx.width, 1));
    const gridH = Math.max(1, ctx.height - 2);
    root.add(at(grid, 0, 2, ctx.width, gridH));
    return root;
  },
};
