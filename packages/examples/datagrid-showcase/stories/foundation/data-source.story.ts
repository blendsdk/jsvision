/**
 * Foundation · Data source (reactive) — `fromRows` binds the grid to a `Signal<T[]>` with a required
 * `rowKey`. Because the source reads the signal, mutating it re-renders the grid: click **Add row** and
 * a new record appears; the live "rows" echo reads `grid.totalCount()`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, Button } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { people } from '../lib/data.js';
import type { Person } from '../lib/data.js';

export const dataSourceStory: Story = {
  id: 'datagrid/foundation/data-source',
  category: 'Foundation',
  title: 'Data source (reactive)',
  rd: 'RD-01',
  blurb: 'fromRows binds a Signal<T[]> with a required rowKey — mutate the signal and the grid re-renders.',
  build(ctx) {
    const rows = people();
    let nextId = 100;
    const columns = [
      column<Person, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 16 }),
      column<Person, string>({ id: 'city', title: 'City', value: (r) => r.city, width: '1fr' }),
    ];
    const grid = new EditableDataGrid<Person>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      zebra: true,
    });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 3);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    const add = new Button('~A~dd row', {
      onClick: () => {
        nextId += 1;
        rows.set([
          ...rows(),
          { id: nextId, name: `New #${nextId}`, age: 20, role: 'New', city: 'Nowhere', active: true },
        ]);
      },
    });
    root.add(at(add, 0, gridH + 1, 14, 2));
    root.add(at(new Text(() => `rows: ${grid.totalCount()}`), 16, gridH + 1, ctx.width - 16, 1));
    return root;
  },
};
