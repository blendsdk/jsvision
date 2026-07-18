/**
 * Foundation · Theming & zebra — the grid paints entirely through theme roles. Zebra striping alternates
 * `listNormal`/the zebra role, the focused cell uses the cursor role, and a selected row uses the
 * selected role — all resolved from the active theme, so a theme swap re-colours the whole grid with no
 * per-cell code. Focus the grid and move the cursor to see the roles light up.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { people } from '../lib/data.js';
import type { Person } from '../lib/data.js';

export const themingStory: Story = {
  id: 'datagrid/foundation/theming',
  category: 'Foundation',
  title: 'Theming & zebra',
  rd: 'RD-01',
  blurb:
    'The grid paints through theme roles — zebra stripes, the cursor cell, and the selected row all come from the active theme.',
  build(ctx) {
    const rows = people();
    const columns = [
      column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 16 }),
      column<Person, string>({ id: 'role', title: 'Role', value: (r) => r.role, width: 12 }),
      column<Person, string>({ id: 'city', title: 'City', value: (r) => r.city, width: '1fr' }),
    ];
    const grid = new EditableDataGrid<Person>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      zebra: true,
    });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 1);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    root.add(
      at(
        new Text('Roles — listNormal · listCursor (focus + arrows) · listSelected · zebra stripes'),
        0,
        gridH,
        ctx.width,
        1,
      ),
    );
    return root;
  },
};
