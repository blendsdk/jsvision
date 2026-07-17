/**
 * Validation & lifecycle · Per-cell validate — a typed column `validate(value)` gate runs on the parsed
 * value at commit. A non-positive Qty is rejected: the record is left unchanged, the editor stays open,
 * the cell is marked in the `gridInvalid` role, and the message surfaces in the grid's message band. A
 * live echo mirrors the grid's active message.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Line {
  id: number;
  qty: number;
}

export const perCellValidateStory: Story = {
  id: 'datagrid/validation-lifecycle/per-cell-validate',
  category: 'Validation & lifecycle',
  title: 'Per-cell validate',
  rd: 'RD-12',
  blurb: 'A column validate gate rejects a bad value — the cell is marked and a message surfaces.',
  build(ctx) {
    const rows = signal<Line[]>([
      { id: 1, qty: 5 },
      { id: 2, qty: 12 },
      { id: 3, qty: 3 },
    ]);
    const grid = new EditableDataGrid<Line>({
      columns: [
        column<Line, number>({
          id: 'qty',
          title: 'Qty',
          value: (r) => r.qty,
          parse: (t) => Number(t),
          set: (r, v) => {
            r.qty = v;
          },
          validate: (v) => (v > 0 ? null : 'Quantity must be positive'),
          editor: { kind: 'integer' },
          width: 10,
        }),
      ],
      source: fromRows(rows, { rowKey: (r) => r.id }),
      zebra: true,
    });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 2);
    root.add(
      at(
        new Text('Edit Qty to 0 or a negative number, press Enter → rejected (editor stays open)'),
        0,
        0,
        ctx.width,
        1,
      ),
    );
    root.add(at(grid, 0, 1, ctx.width, gridH));
    root.add(
      at(new Text(() => `Active message: ${grid.activeMessage() ?? '(none)'}`), 0, ctx.height - 1, ctx.width, 1),
    );
    return root;
  },
};
