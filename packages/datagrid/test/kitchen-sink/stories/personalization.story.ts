/**
 * The column-personalization showcase story — a staged end-user dialog (`personalizeGrid`) lets the user
 * show/hide, reorder, freeze, and resize columns and manage saved layout **variants** over a caller
 * `VariantStore`; OK commits the pending layout via `applyVariant`, Cancel/Esc leaves the grid untouched.
 * The kitchen-sink shell can't host a modal, so this story renders a live echo of the grid's column
 * metadata (`grid.columns()`) plus the seeded variant store — the read + persistence surface the dialog
 * is built on — and a hint on how to open the modal. The `.js` specifier is required by NodeNext ESM.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, EditableDataGrid, fromRows, createMemoryVariantStore } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Rec {
  id: number;
  name: string;
  dept: string;
  total: number;
  note: string;
}

export const personalizationStory: Story = {
  id: 'datagrid/personalization',
  category: 'DataGrid',
  title: 'Personalize columns',
  blurb:
    'Open a staged modal to show/hide, reorder, freeze, and resize columns and manage saved layout variants (OK commits via applyVariant).',
  rd: 'RD-16',
  build(ctx) {
    const rows = signal<Rec[]>([
      { id: 1, name: 'Ann', dept: 'Eng', total: 1200, note: 'a' },
      { id: 2, name: 'Bob', dept: 'Ops', total: 3400, note: 'b' },
      { id: 3, name: 'Cy', dept: 'Eng', total: 2100, note: 'c' },
    ]);
    const columns = [
      column({ id: 'id', title: '#', value: (r: Rec) => r.id, width: 4, align: 'right' as const }),
      column({ id: 'name', title: 'Name', value: (r: Rec) => r.name, width: 10 }),
      column({ id: 'dept', title: 'Dept', value: (r: Rec) => r.dept, width: 8 }),
      column({ id: 'total', title: 'Total', value: (r: Rec) => r.total, width: 8, align: 'right' as const }),
      column({ id: 'note', title: 'Note', value: (r: Rec) => r.note, width: 6 }),
    ];
    const grid = new EditableDataGrid<Rec>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }), zebra: true });

    // Seed a couple of saved layout variants over a memory store — the dialog reads and writes this.
    const store = createMemoryVariantStore();
    grid.setColumnVisible('note', false);
    grid.sortBy('total', 'desc');
    store.save(grid.saveVariant('compact'));
    grid.setColumnVisible('note', true);
    grid.clearSort();
    store.save(grid.saveVariant('full'));

    // A live echo of the grid's resolved column metadata — the read API the dialog is built on.
    const colsEcho = new Text(() =>
      grid
        .columns()
        .map((c) => `${c.title}${c.visible ? '·on' : '·off'}${c.frozen !== 'none' ? '·' + c.frozen : ''}`)
        .join('  '),
    );
    const variantsEcho = new Text(
      () =>
        `Saved variants: ${
          store
            .list()
            .map((v) => v.name)
            .join(', ') || '(none)'
        }`,
    );
    const hint = new Text(
      'personalizeGrid(grid, { store, host }) → a staged modal: [x] show/hide · Alt+↑↓ reorder · freeze cycle · width · Save/Apply/Delete/Default. OK commits via applyVariant; Cancel/Esc leaves the grid untouched.',
    );

    const root = new Group();
    const gridH = Math.max(3, ctx.height - 5);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    root.add(at(variantsEcho, 0, gridH, ctx.width, 1));
    root.add(at(colsEcho, 0, gridH + 1, ctx.width, 1));
    root.add(at(hint, 0, gridH + 2, ctx.width, Math.max(1, ctx.height - gridH - 2)));
    return root;
  },
};
