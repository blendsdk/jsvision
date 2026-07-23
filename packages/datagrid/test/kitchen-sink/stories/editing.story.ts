/**
 * The editing showcase story — the interactive `EditableDataGrid`: an editable **Name** cell beside a
 * read-only **ID**. It demonstrates the two-axis cursor, in-cell editing, and the `onCommit` veto —
 * a non-empty name commits (echoing the edited row), an empty one is rejected (the editor stays open).
 * A live read-out echoes the bound state after each commit; the commit seam is the only mutation path.
 */
import { Group, Text, signal } from '@jsvision/ui';
import type { OnCommit } from '../../../src/index.js';
import { column, fromRows, EditableDataGrid } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Person {
  id: number;
  name: string;
}

export const editingStory: Story = {
  id: 'datagrid/editing',
  category: 'DataGrid',
  title: 'Editing (in-cell)',
  blurb: 'Edit a Name cell in place beside a read-only ID; Enter commits through an onCommit veto.',
  rd: 'RD-02',
  build(ctx) {
    const rows = signal<Person[]>([
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Bo' },
      { id: 3, name: 'Cy' },
    ]);
    const echo = signal('Focused row #1 · Ada — edit a Name and press Enter to commit');

    // The commit seam is the only mutation path: a non-empty name commits (echoing the edited row's
    // data), an empty one is vetoed so the editor stays open for a fix.
    const onCommit: OnCommit<Person> = (c) => {
      if (String(c.value).trim().length === 0) {
        echo.set(`Rejected: ${c.columnId} cannot be empty`);
        return false;
      }
      echo.set(`Committed row #${c.row.id} · ${c.row.name}`);
      return true;
    };

    const columns = [
      // Read-only: no parse/set, so F2/Enter/typing falls through with no editor.
      column({ id: 'id', title: 'ID', value: (r: Person) => r.id, align: 'right', width: 4 }),
      // Editable: parse + set present.
      column<Person, string>({
        id: 'name',
        title: 'Name',
        value: (r) => r.name,
        parse: (t) => t,
        set: (r, v) => {
          r.name = v;
        },
        width: 12,
      }),
    ];
    const grid = new EditableDataGrid<Person>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      onCommit,
      zebra: true,
    });

    const hints = new Text('↑↓ ←→ move  ·  F2 / Enter / type to edit  ·  Enter commits  ·  Esc cancels');
    const readout = new Text(() => echo()); // repaints on each commit

    const root = new Group();
    const gridHeight = Math.max(1, ctx.height - 2); // leave a row each for the hints and the read-out
    root.add(at(hints, 0, 0, ctx.width, 1));
    root.add(at(grid, 0, 1, ctx.width, gridHeight));
    root.add(at(readout, 0, ctx.height - 1, ctx.width, 1));
    return root;
  },
};
