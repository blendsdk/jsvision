/**
 * The foundation showcase story — the read-only `EditableDataGrid` over an in-memory source with a
 * typed `value`/`format`/`parse` column (a currency-formatted balance that sorts by number, not text).
 * A later release grows this into the interactive editable grid.
 */
import { Group, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Person {
  id: number;
  name: string;
  balance: number;
}

export const foundationStory: Story = {
  id: 'datagrid/foundation',
  category: 'DataGrid',
  title: 'Foundation (read-only)',
  blurb: 'value/format/parse columns rendered read-only over an in-memory source.',
  rd: 'RD-01',
  build(ctx) {
    const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
    const rows = signal<Person[]>([
      { id: 1, name: 'Ada', balance: 1000 },
      { id: 2, name: 'Bo', balance: 9 },
      { id: 3, name: 'Cy', balance: 42 },
    ]);
    const columns = [
      column({ id: 'name', title: 'Name', value: (r: Person) => r.name }),
      column({
        id: 'balance',
        title: 'Balance',
        value: (r: Person) => r.balance,
        format: (v) => eur.format(v),
        align: 'right',
      }),
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
