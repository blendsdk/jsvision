/**
 * Foundation · Read-only grid — every column omits `parse`/`set`, so the whole grid is read-only. The
 * two-axis cursor still moves (arrows / Home / End / PgUp / PgDn), but `F2`/`Enter`/typing is a no-op:
 * editability is decided per column by the presence of `parse` + `set`, nothing global.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { people } from '../lib/data.js';
import type { Person } from '../lib/data.js';

export const readOnlyStory: Story = {
  id: 'datagrid/foundation/read-only',
  category: 'Foundation',
  title: 'Read-only grid',
  rd: 'RD-01',
  blurb: 'Columns with no parse/set are read-only — the cursor still moves, but begin-edit is a no-op.',
  build(ctx) {
    const rows = people();
    const columns = [
      column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 16 }),
      column<Person, number>({ id: 'age', title: 'Age', value: (r) => r.age, align: 'right', width: 5 }),
      column<Person, string>({ id: 'role', title: 'Role', value: (r) => r.role, width: 11 }),
      column<Person, string>({ id: 'city', title: 'City', value: (r) => r.city, width: '1fr' }),
    ];
    const grid = new EditableDataGrid<Person>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      zebra: true,
    });

    const root = new Group();
    root.add(at(grid, 0, 0, ctx.width, ctx.height));
    return root;
  },
};
