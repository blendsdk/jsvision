/**
 * Editing · Dirty tracking — while a commit is in flight the cell is *pending*: the grid paints a `•`
 * marker on it, and `isGridDirty()` reads `true`, until the commit resolves. This demo delays each
 * commit ~1.5s (an async `onCommit`) so the pending state is easy to see; a live echo mirrors it.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { OnCommit } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { people } from '../lib/data.js';
import type { Person } from '../lib/data.js';

export const dirtyTrackingStory: Story = {
  id: 'datagrid/editing/dirty-tracking',
  category: 'Editing',
  title: 'Dirty tracking',
  rd: 'RD-02',
  blurb: 'A pending commit paints a • marker on the cell until it resolves (this demo delays each commit ~1.5s).',
  build(ctx) {
    const rows = people();
    // A deliberately slow commit so the pending (dirty) state — the `•` marker — is visible.
    const onCommit: OnCommit<Person> = () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1500));
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
    root.add(
      at(new Text('Edit a cell and press Enter → a • marks it while the (slow) commit is pending'), 0, 0, ctx.width, 1),
    );
    root.add(at(grid, 0, 1, ctx.width, gridH));
    root.add(
      at(
        new Text(() => (grid.isGridDirty() ? '● commit pending…' : '○ no pending commits')),
        0,
        ctx.height - 1,
        ctx.width,
        1,
      ),
    );
    return root;
  },
};
