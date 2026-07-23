/**
 * Editing · In-cell overlay — begin-edit mounts the editor in an absolute overlay directly over the
 * cell, sized and positioned to it; `Enter` commits and tears the overlay down, `Esc` closes it with no
 * change. Shown *through* the live grid (the overlay is grid-internal): press `F2` on the Name cell to
 * open it.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { people } from '../lib/data.js';
import type { Person } from '../lib/data.js';

export const overlayStory: Story = {
  id: 'datagrid/editing/overlay',
  category: 'Editing',
  title: 'In-cell overlay',
  rd: 'RD-02',
  blurb: 'Begin-edit mounts the editor in an overlay over the exact cell; Enter commits and closes it, Esc cancels.',
  build(ctx) {
    const rows = people();
    const columns = [
      column<Person, string>({
        id: 'name',
        title: 'Name',
        value: (r) => r.name,
        parse: (t) => t,
        set: (r, v) => {
          r.name = v;
        },
        width: 18,
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
      zebra: true,
    });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 1);
    root.add(
      at(
        new Text('Press F2 on a cell → the editor overlay opens over it · Enter commits · Esc closes'),
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
