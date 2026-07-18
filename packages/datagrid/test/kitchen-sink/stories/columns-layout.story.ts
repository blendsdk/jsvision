/**
 * The columns-&-layout showcase story — the enterprise layout toolkit on one grid: a frozen 'id'
 * column pinned to the left, live column resize (drag a header grip; double-click it to auto-fit), live
 * within-panel reorder (drag a header title), and show/hide (a button toggles the 'dept' column). A live
 * bound-state echo mirrors `columnOrder()` and `frozen()` so every layout change is visible at a glance.
 */
import { Group, Text, Button, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Emp {
  id: number;
  name: string;
  city: string;
  dept: string;
  zone: string;
}

export const columnsLayoutStory: Story = {
  id: 'datagrid/columns-layout',
  category: 'DataGrid',
  title: 'Columns & layout',
  blurb:
    'Frozen columns, live resize (drag/double-click a grip), drag-to-reorder, and show/hide — with a live column-order & frozen readout.',
  rd: 'RD-07',
  build(ctx) {
    const rows = signal<Emp[]>([
      { id: 1, name: 'Ada Lovelace', city: 'London', dept: 'R&D', zone: 'EU' },
      { id: 2, name: 'Bo', city: 'LA', dept: 'Sales', zone: 'US' },
      { id: 3, name: 'Cy Young', city: 'SF', dept: 'Ops', zone: 'US' },
      { id: 4, name: 'Dita', city: 'Berlin', dept: 'R&D', zone: 'EU' },
      { id: 5, name: 'Evren', city: 'Istanbul', dept: 'Support', zone: 'EU' },
    ]);

    const columns = [
      column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4, minWidth: 3 }),
      column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
      column<Emp, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 8 }),
      column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
      column<Emp, string>({ id: 'zone', title: 'Zone', value: (r) => r.zone, width: 6 }),
    ];

    const grid = new EditableDataGrid<Emp>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      freeze: 1, // pin 'id' to a non-scrolling left panel
      zebra: true,
    });

    const hints = new Text('Drag a title to reorder · drag a grip │ to resize (dbl-click = auto-fit) · scroll ↔');
    // A show/hide toggle wired to the layout API; the live echo below mirrors the resulting visible order.
    const deptHidden = signal(false);
    const toggle = new Button('Toggle ~D~ept', {
      onClick: () => {
        deptHidden.set(!deptHidden());
        grid.setColumnVisible('dept', !deptHidden()); // hidden columns keep their sort/filter state
      },
    });
    // Live bound-state echo — repaints on every reorder / hide / freeze change (a hidden column drops
    // out of `columnOrder()`, so toggling Dept is visible here immediately).
    const echo = new Text(() => `Order: ${grid.columnOrder().join(' → ')}   frozen:[${grid.frozen().left.join(',')}]`);

    const root = new Group();
    root.add(at(hints, 0, 0, ctx.width, 1));
    root.add(at(toggle, 0, 1, 14, 2)); // a button is two rows tall (drop-shadowed face)
    root.add(at(echo, 15, 1, Math.max(1, ctx.width - 15), 1));
    const gridTop = 3;
    root.add(at(grid, 0, gridTop, ctx.width, Math.max(1, ctx.height - gridTop)));
    return root;
  },
};
