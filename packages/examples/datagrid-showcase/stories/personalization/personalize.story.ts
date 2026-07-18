/**
 * Personalization · Personalize columns — `personalizeGrid(grid, { store, host })` opens a staged modal
 * where the end user shows/hides, reorders, freezes, and resizes columns and manages saved layout
 * variants over a caller `VariantStore`; OK commits via `applyVariant`, Cancel/Esc leaves the grid
 * untouched. The launch button opens the modal through the shell's `execView` seam (a host adapter
 * routes `loop.execView` to it); under the headless smoke test `execView` is `undefined`, so the demo
 * still renders its launch control + a live layout echo and simply skips the modal open. The `.js`
 * specifier is required by NodeNext ESM resolution.
 */
import { Group, Text, Button, signal } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { column, EditableDataGrid, fromRows, personalizeGrid, createMemoryVariantStore } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Rec {
  id: number;
  name: string;
  dept: string;
  total: number;
  note: string;
}

const ROWS: Rec[] = [
  { id: 1, name: 'Ann', dept: 'Eng', total: 1200, note: 'a' },
  { id: 2, name: 'Bob', dept: 'Ops', total: 3400, note: 'b' },
  { id: 3, name: 'Cy', dept: 'Eng', total: 2100, note: 'c' },
  { id: 4, name: 'Di', dept: 'Sales', total: 900, note: 'd' },
];

export const personalizeStory: Story = {
  id: 'datagrid/personalization/personalize',
  category: 'Personalization',
  title: 'Personalize columns',
  blurb:
    'Open a staged modal to show/hide, reorder, freeze, and resize columns and manage saved layout variants over a caller VariantStore.',
  rd: 'RD-16',
  build(ctx) {
    const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    const columns = [
      column({ id: 'id', title: '#', value: (r: Rec) => r.id, width: 4, align: 'right' as const }),
      column({ id: 'name', title: 'Name', value: (r: Rec) => r.name, width: 10 }),
      column({ id: 'dept', title: 'Dept', value: (r: Rec) => r.dept, width: 8 }),
      column({
        id: 'total',
        title: 'Total',
        value: (r: Rec) => r.total,
        format: (v) => usd.format(v),
        align: 'right' as const,
        width: 12,
      }),
      column({ id: 'note', title: 'Note', value: (r: Rec) => r.note, width: 6 }),
    ];
    const grid = new EditableDataGrid<Rec>({
      columns,
      source: fromRows(signal(ROWS.slice()), { rowKey: (r) => r.id }),
      zebra: true,
    });

    // Seed the caller store with a couple of variants the dialog can apply/delete/default.
    const store = createMemoryVariantStore();
    grid.setColumnVisible('note', false);
    grid.sortBy('total', 'desc');
    store.save(grid.saveVariant('compact'));
    grid.setColumnVisible('note', true);
    grid.clearSort();
    store.save(grid.saveVariant('full'));

    const open = new Button('Personalize…', {
      onClick: () => {
        const exec = ctx.execView;
        if (exec === undefined) return; // headless smoke: no modal host — the demo still renders below
        // A host adapter: route loop.execView to the shell's seam (which owns addWindow/removeWindow).
        const host = {
          loop: {
            execView<R>(view: View): Promise<R> {
              return exec(view) as Promise<R>;
            },
          },
          desktop: {
            addWindow(): void {},
            removeWindow(): void {},
            bounds: { x: 0, y: 0, width: ctx.width, height: ctx.height },
          },
        };
        void personalizeGrid(grid, { store, host, title: 'Personalize columns' });
      },
    });

    const layoutEcho = new Text(() => {
      const f = grid.frozen();
      const vis = grid
        .columns()
        .filter((c) => c.visible)
        .map((c) => c.title)
        .join(',');
      return `visible ${vis} · frozen L[${f.left.join(',')}] R[${f.right.join(',')}] · variants ${store
        .list()
        .map((v) => v.name)
        .join(',')}`;
    });
    const hint = new Text(
      'Click Personalize… (live TTY): show/hide · Alt+↑↓ reorder · freeze cycle · width · Save/Apply/Delete/Default. OK commits; Cancel/Esc discards.',
    );

    const root = new Group();
    const gridH = Math.max(3, ctx.height - 5);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    root.add(at(open, 0, gridH, 16, 2));
    root.add(at(layoutEcho, 0, gridH + 2, ctx.width, 1));
    root.add(at(hint, 0, gridH + 3, ctx.width, Math.max(1, ctx.height - gridH - 3)));
    return root;
  },
};
