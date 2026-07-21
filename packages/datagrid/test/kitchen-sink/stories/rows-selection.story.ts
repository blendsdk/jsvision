/**
 * The rows & selection showcase story — multi-row selection with the opt-in **checkbox column** and
 * **row-number gutter**. `Space` / `Ctrl`+click toggle a row, `Shift`+↑↓ / `Shift`+click extend a range,
 * and the tri-state header box selects or clears every displayed row. Selection is keyed by `rowKey`, so
 * it survives a re-sort/re-filter. A live read-out echoes `selectedKeys()` and repaints on every change.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Person {
  id: number;
  name: string;
  dept: string;
}

export const rowsSelectionStory: Story = {
  id: 'datagrid/rows-selection',
  category: 'DataGrid',
  title: 'Rows & selection',
  blurb:
    'Multi-select rows via a checkbox column + row-number gutter; Space/Ctrl-click toggle, Shift extends, header box = all.',
  rd: 'RD-08',
  build(ctx) {
    const rows = signal<Person[]>([
      { id: 1, name: 'Ada', dept: 'Eng' },
      { id: 2, name: 'Bo', dept: 'Ops' },
      { id: 3, name: 'Cy', dept: 'Eng' },
      { id: 4, name: 'Di', dept: 'Sales' },
      { id: 5, name: 'El', dept: 'Ops' },
      { id: 6, name: 'Fe', dept: 'Sales' },
    ]);

    const columns = [
      column({ id: 'id', title: 'ID', value: (r: Person) => r.id, align: 'right', width: 4 }),
      column({ id: 'name', title: 'Name', value: (r: Person) => r.name, width: 10 }),
      column({ id: 'dept', title: 'Dept', value: (r: Person) => r.dept, width: 8 }),
    ];

    const grid = new EditableDataGrid<Person>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      selectionMode: 'multi',
      checkboxColumn: true,
      rowNumbers: true,
      zebra: true,
    });
    // Seed a couple of rows so the checkbox column + tri-state header + echo read as live on first paint.
    grid.selectRow(2);
    grid.toggleRow(4);

    // Live echo of selectedKeys() — reads the reactive selection signal, so it repaints on every toggle.
    const echo = new Text(() => {
      const keys = [...grid.selectedKeys()].map(Number).sort((a, b) => a - b);
      return keys.length > 0
        ? `Selected: ${keys.join(', ')}  (${keys.length} of ${rows().length})`
        : 'Selected: (none) — Space / Ctrl+click to toggle, Shift to extend';
    });
    const hints = new Text('↑↓ move  ·  Space toggle  ·  Shift+↑↓ range  ·  click [ ] header = select all');

    const root = new Group();
    const gridHeight = Math.max(1, ctx.height - 2); // a row each for the hints and the read-out
    root.add(at(hints, 0, 0, ctx.width, 1));
    root.add(at(grid, 0, 1, ctx.width, gridHeight));
    root.add(at(echo, 0, ctx.height - 1, ctx.width, 1));
    return root;
  },
};
