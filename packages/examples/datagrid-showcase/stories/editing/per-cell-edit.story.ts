/**
 * Editing · Per-cell editing — begin an edit with `F2`, `Enter`, or by typing (type-to-replace) on an
 * editable cell; `Enter` commits through the `onCommit` sink, `Esc` cancels. Name and City are editable
 * text; Age is read-only (no `parse`/`set`). A live echo shows the last committed cell.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { OnCommit } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { people } from '../lib/data.js';
import type { Person } from '../lib/data.js';

export const perCellEditStory: Story = {
  id: 'datagrid/editing/per-cell-edit',
  category: 'Editing',
  title: 'Per-cell editing',
  rd: 'RD-02',
  blurb: 'Begin an edit with F2, Enter, or by typing (type-to-replace); Enter commits, Esc cancels.',
  build(ctx) {
    const rows = people();
    const echo = signal('Move with arrows · F2 / Enter / type to edit Name or City');
    const onCommit: OnCommit<Person> = (c) => {
      echo.set(`Committed ${c.columnId} = "${String(c.value)}" on row #${c.rowKey}`);
      return true;
    };
    const columns = [
      column<Person, string>({
        id: 'name',
        title: 'Name',
        value: (r) => r.name,
        parse: (t) => t,
        set: (r, v) => {
          r.name = v;
        },
        width: 16,
      }),
      column<Person, number>({ id: 'age', title: 'Age', value: (r) => r.age, align: 'right', width: 5 }), // read-only
      column<Person, string>({
        id: 'city',
        title: 'City',
        value: (r) => r.city,
        parse: (t) => t,
        set: (r, v) => {
          r.city = v;
        },
        width: '1fr',
      }),
    ];
    const grid = new EditableDataGrid<Person>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      onCommit,
      zebra: true,
    });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 2);
    root.add(at(new Text('↑↓ ←→ move · F2 / Enter / type edits · Enter commits · Esc cancels'), 0, 0, ctx.width, 1));
    root.add(at(grid, 0, 1, ctx.width, gridH));
    root.add(at(new Text(() => echo()), 0, ctx.height - 1, ctx.width, 1));
    return root;
  },
};
