/**
 * Validation & lifecycle · beforeSave vs onCommit — `beforeSave` is a per-cell gate that layers ABOVE
 * `onCommit`: it decides *whether* to persist. Here it vetoes any edit to a locked row; on a veto the
 * value reverts and `onCommit` is never called (a live echo shows which sink ran). `onCommit` performs
 * the persistence for the rows beforeSave allows.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { BeforeSave, OnCommit } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Item {
  id: number;
  price: number;
  locked: boolean;
}

export const beforeSaveStory: Story = {
  id: 'datagrid/validation-lifecycle/before-save',
  category: 'Validation & lifecycle',
  title: 'beforeSave vs onCommit',
  rd: 'RD-12',
  blurb: 'beforeSave gates whether to persist (above onCommit): a locked row is vetoed before onCommit runs.',
  build(ctx) {
    const rows = signal<Item[]>([
      { id: 1, price: 10, locked: false },
      { id: 2, price: 20, locked: true },
      { id: 3, price: 30, locked: false },
    ]);
    const echo = signal('Edit Price on an unlocked row → onCommit runs; on the locked row #2 → vetoed');

    const beforeSave: BeforeSave<Item> = (c) => {
      if (c.row.locked) {
        echo.set(`beforeSave vetoed row #${c.rowKey} (locked) — onCommit was NOT called`);
        return false;
      }
      return true;
    };
    const onCommit: OnCommit<Item> = (c) => {
      echo.set(`onCommit persisted row #${c.rowKey}: price = ${String(c.value)}`);
      return true;
    };

    const grid = new EditableDataGrid<Item>({
      columns: [
        column<Item, number>({
          id: 'price',
          title: 'Price',
          value: (r) => r.price,
          parse: (t) => Number(t),
          set: (r, v) => {
            r.price = v;
          },
          editor: { kind: 'integer' },
          width: 8,
        }),
        column<Item, string>({ id: 'lock', title: 'Locked', value: (r) => (r.locked ? '🔒' : ''), width: 8 }),
      ],
      source: fromRows(rows, { rowKey: (r) => r.id }),
      beforeSave,
      onCommit,
      zebra: true,
    });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 2);
    root.add(
      at(new Text('Row #2 is locked: editing its Price is vetoed by beforeSave before onCommit'), 0, 0, ctx.width, 1),
    );
    root.add(at(grid, 0, 1, ctx.width, gridH));
    root.add(at(new Text(() => echo()), 0, ctx.height - 1, ctx.width, 1));
    return root;
  },
};
