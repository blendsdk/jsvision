/**
 * Footer widgets — free-form footer views: the reactive "N of M" filtered count and the selection count
 * as `Text` read-outs, plus a right-aligned command `Button`. The read-outs update live as the selection
 * changes. The widgets close over `grid`; they run at draw time (after construction), so the const is set.
 */
import { Group, Text, Button, spacer, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Item {
  id: number;
  name: string;
  dept: string;
}
const ROWS: Item[] = [
  { id: 1, name: 'Ada', dept: 'Eng' },
  { id: 2, name: 'Bo', dept: 'Ops' },
  { id: 3, name: 'Cy', dept: 'Eng' },
  { id: 4, name: 'Di', dept: 'Sales' },
  { id: 5, name: 'El', dept: 'Ops' },
];

export const footerWidgetsStory: Story = {
  id: 'datagrid/footer-master-detail/widgets',
  category: 'Footer & aggregation',
  title: 'Footer widgets',
  blurb: 'Free-form footer widgets — the reactive N-of-M and selection-count read-outs plus a command button.',
  rd: 'RD-09',
  build(ctx) {
    const rows = signal<Item[]>(ROWS.map((r) => ({ ...r })));
    // Explicit annotation breaks the self-referential inference (the widgets close over `grid`).
    const grid: EditableDataGrid<Item> = new EditableDataGrid<Item>({
      columns: [
        column({ id: 'id', title: 'ID', value: (r: Item) => r.id, align: 'right', width: 4 }),
        column({ id: 'name', title: 'Name', value: (r: Item) => r.name, width: 10 }),
        column({ id: 'dept', title: 'Dept', value: (r: Item) => r.dept, width: 8 }),
      ],
      source: fromRows(rows, { rowKey: (r) => r.id }),
      selectionMode: 'multi',
      zebra: true,
      footer: {
        widgets: [
          new Text(() => `${grid.filteredCount()} of ${grid.totalCount()} rows`),
          new Text(() => `${grid.selectedKeys().size} selected`),
          spacer(), // push the button to the right edge
          new Button('Add', { onClick: () => grid.insertRow({ id: rows().length + 1, name: 'New', dept: 'Eng' }) }),
        ],
      },
    });
    grid.selectRow(1);
    grid.toggleRow(3);

    const hint = new Text('↑↓ move · Space toggles selection — the footer N-of-M and selection read-outs update live.');
    const root = new Group();
    root.add(at(hint, 0, 0, ctx.width, 1));
    root.add(at(grid, 0, 1, ctx.width, Math.max(1, ctx.height - 1)));
    return root;
  },
};
