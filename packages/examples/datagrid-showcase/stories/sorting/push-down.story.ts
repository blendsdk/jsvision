/**
 * Sorting · Push-down — over a source that implements `setSort`, the grid delegates ordering to the
 * source instead of sorting client-side. This demo binds a bespoke in-memory spy source, so clicking a
 * header pushes the sort model down; the echo shows exactly what the source received.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { column, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { createSpySource } from '../lib/spy-source.js';
import { describeSort } from './sort-demo.js';

interface Row {
  id: number;
  region: string;
  qty: number;
}

const DATA: Row[] = [
  { id: 1, region: 'east', qty: 1000 },
  { id: 2, region: 'west', qty: 9 },
  { id: 3, region: 'north', qty: 50 },
  { id: 4, region: 'south', qty: 200 },
];

export const sortingPushDownStory: Story = {
  id: 'datagrid/sorting/push-down',
  category: 'Sorting',
  title: 'Push-down sort',
  rd: 'RD-05',
  blurb:
    'Over a source implementing setSort, the grid delegates ordering to the source; the echo shows what was pushed down.',
  build(ctx) {
    const columns = [
      column<Row, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
      column<Row, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, align: 'right', width: 8 }),
    ];
    const spy = createSpySource(DATA, { rowKey: (r) => r.id, columns });
    const grid = new EditableDataGrid<Row>({ columns, source: spy, zebra: true });

    const root = new Group();
    root.add(
      at(
        new Text('Click a header — the sort is pushed down to the source (not sorted client-side)'),
        0,
        0,
        ctx.width,
        1,
      ),
    );
    root.add(at(new Text(() => `Pushed down: ${describeSort(spy.lastSort())}`), 0, 1, ctx.width, 1));
    const gridH = Math.max(1, ctx.height - 2);
    root.add(at(grid, 0, 2, ctx.width, gridH));
    return root;
  },
};
