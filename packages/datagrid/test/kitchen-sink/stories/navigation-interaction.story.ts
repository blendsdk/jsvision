/**
 * The navigation & interaction showcase story — the grid's consolidated input surface: a remappable
 * keymap (here `Ctrl+E` also begins editing, beside the default `F2`), full keyboard navigation, and
 * mouse interaction (a single click focuses the clicked cell; a double-click on an editable cell edits
 * it). A live read-out echoes the focused cell as the cursor moves. `Tab`/`Shift+Tab` cell-traversal is
 * wired at the application level (via `installGridNavigation`), demonstrated in the showcase app.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Person {
  id: number;
  name: string;
  city: string;
}

export const navigationInteractionStory: Story = {
  id: 'datagrid/navigation-interaction',
  category: 'DataGrid',
  title: 'Navigation & interaction',
  blurb: 'Remappable keymap (Ctrl+E edits), full keyboard nav, click-to-focus, and double-click-to-edit.',
  rd: 'RD-10',
  build(ctx) {
    const rows = signal<Person[]>([
      { id: 1, name: 'Ada', city: 'NYC' },
      { id: 2, name: 'Bo', city: 'LA' },
      { id: 3, name: 'Cy', city: 'SF' },
    ]);

    const editable = (id: 'name' | 'city', title: string, width: number) =>
      column<Person, string>({
        id,
        title,
        value: (r) => r[id],
        parse: (t) => t,
        set: (r, v) => {
          r[id] = v;
        },
        width,
      });

    const grid = new EditableDataGrid<Person>({
      columns: [
        editable('name', 'Name', 12),
        editable('city', 'City', 10),
        column({ id: 'id', title: 'ID', value: (r: Person) => r.id, align: 'right', width: 4 }),
      ],
      source: fromRows(rows, { rowKey: (r) => r.id }),
      keymap: { 'ctrl+e': 'beginEdit' }, // remap: Ctrl+E also begins editing (F2 still works)
      zebra: true,
    });

    const hints = new Text(
      '↑↓ ←→ Home/End PgUp/PgDn move · click focuses a cell · dbl-click / F2 / Ctrl+E edits · Tab: app-wired',
    );
    // A live echo of the focused record — repaints as the cursor moves across rows.
    const readout = new Text(() => {
      const row = grid.focusedRow();
      return row ? `Focused row #${row.id} · ${row.name} — ${row.city}` : 'No focused row';
    });

    const root = new Group();
    const gridHeight = Math.max(1, ctx.height - 2);
    root.add(at(hints, 0, 0, ctx.width, 1));
    root.add(at(grid, 0, 1, ctx.width, gridHeight));
    root.add(at(readout, 0, ctx.height - 1, ctx.width, 1));
    return root;
  },
};
