/**
 * Foundation · Column sizing (the Phase-1 seed demo) — a read-only `EditableDataGrid` over an in-memory
 * source showing the three `column()` sizing rules side by side: `auto` (fit content), a fixed cell
 * count, and `fr`-weighted flex, with left/right/center alignment. It proves a real grid mounts in the
 * shell before the full demo inventory lands.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { people } from '../lib/data.js';
import type { Person } from '../lib/data.js';

export const sizingStory: Story = {
  id: 'datagrid/foundation/sizing',
  category: 'Foundation',
  title: 'Column sizing',
  rd: 'RD-01',
  blurb: 'column() sizing: auto, fixed cells, and fr-weighted widths with left/right/center alignment.',
  build(ctx) {
    const rows = people();
    const columns = [
      column({ id: 'name', title: 'Name', value: (r: Person) => r.name, width: 'auto' }),
      column({ id: 'age', title: 'Age', value: (r: Person) => r.age, width: 5, align: 'right' }),
      column({ id: 'role', title: 'Role', value: (r: Person) => r.role, width: '1fr' }),
      column({ id: 'city', title: 'City', value: (r: Person) => r.city, width: '2fr', align: 'center' }),
    ];
    const grid = new EditableDataGrid<Person>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      zebra: true,
    });

    const g = new Group();
    const gridH = Math.max(6, ctx.height - 2);
    g.add(at(grid, 0, 0, ctx.width, gridH));
    g.add(
      at(
        new Text('Widths — Name: auto · Age: fixed 5 (right) · Role: 1fr · City: 2fr (center)'),
        0,
        gridH,
        ctx.width,
        1,
      ),
    );
    return g;
  },
};
