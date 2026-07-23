/**
 * Editing · Commit veto — `onCommit` returning `false` rejects the edit: the record reverts to its
 * previous value and the editor stays open for a fix. Here an empty Name is vetoed; a live echo shows
 * the last outcome and a running count of vetoes.
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

export const commitVetoStory: Story = {
  id: 'datagrid/editing/commit-veto',
  category: 'Editing',
  title: 'Commit veto',
  rd: 'RD-02',
  blurb: 'onCommit returning false rejects the edit — the value reverts and the editor stays open.',
  build(ctx) {
    const rows = people();
    const vetoes = signal(0);
    const echo = signal('Edit Name and clear it → the commit is vetoed and the value reverts');
    const onCommit: OnCommit<Person> = (c) => {
      if (String(c.value).trim().length === 0) {
        vetoes.set(vetoes() + 1);
        echo.set(`Vetoed: ${c.columnId} cannot be empty (${vetoes()} vetoed so far)`);
        return false;
      }
      echo.set(`Committed ${c.columnId} = "${String(c.value)}"`);
      return true;
    };
    const columns = [
      column<Person, string>({
        id: 'name',
        title: 'Name (required)',
        value: (r) => r.name,
        parse: (t) => t,
        set: (r, v) => {
          r.name = v;
        },
        width: 18,
      }),
      column<Person, string>({ id: 'role', title: 'Role', value: (r) => r.role, width: '1fr' }),
    ];
    const grid = new EditableDataGrid<Person>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      onCommit,
      zebra: true,
    });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 2);
    root.add(at(new Text('Edit Name, clear it, press Enter → veto (reverts, editor stays open)'), 0, 0, ctx.width, 1));
    root.add(at(grid, 0, 1, ctx.width, gridH));
    root.add(at(new Text(() => echo()), 0, ctx.height - 1, ctx.width, 1));
    return root;
  },
};
