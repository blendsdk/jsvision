/**
 * Editing · Cursor navigation — the two-axis (row + column) cursor. Arrows move between cells,
 * `Home`/`End` jump to the row's first/last cell, `PgUp`/`PgDn` page vertically. Shown *through* the
 * live grid: focus it and watch the cursor cell highlight move (the cursor state is grid-internal, so
 * there is no separate read-out).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { people } from '../lib/data.js';
import type { Person } from '../lib/data.js';

export const cursorNavStory: Story = {
  id: 'datagrid/editing/cursor-nav',
  category: 'Editing',
  title: 'Cursor navigation',
  rd: 'RD-02',
  blurb: 'The two-axis cursor: ↑↓ ←→ move between cells, Home/End jump to the row edges, PgUp/PgDn page.',
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
    const gridH = Math.max(1, ctx.height - 1);
    root.add(
      at(
        new Text('Focus the grid · ↑↓ ←→ move the cursor cell · Home/End row edges · PgUp/PgDn page'),
        0,
        0,
        ctx.width,
        1,
      ),
    );
    root.add(at(grid, 0, 1, ctx.width, gridH));
    return root;
  },
};
