/**
 * Export & variants · Save & restore layout variants — `saveVariant(name)` captures the full column
 * layout (order, widths, visibility, freeze, sort, filter) as a serializable snapshot the app persists;
 * `applyVariant` restores it exactly. This demo pre-builds a "Compact" variant (dept hidden, sorted by
 * total ↓) and a "Wide" one, and adds runtime `setFrozen` toggles. The echo mirrors the live layout.
 * The `.js` extension is required by NodeNext ESM resolution.
 */
import { Group, Text, Button, signal } from '@jsvision/ui';
import { column, EditableDataGrid, fromRows } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Rec {
  id: number;
  name: string;
  dept: string;
  total: number;
}

const ROWS: Rec[] = [
  { id: 1, name: 'Ann', dept: 'Eng', total: 1200 },
  { id: 2, name: 'Bob', dept: 'Ops', total: 3400 },
  { id: 3, name: 'Cy', dept: 'Eng', total: 2100 },
  { id: 4, name: 'Di', dept: 'Sales', total: 900 },
];

export const variantsStory: Story = {
  id: 'datagrid/export-personalization/variants',
  category: 'Export & variants',
  title: 'Save & restore layout variants',
  blurb:
    'Save the column layout (order/width/visibility/freeze/sort/filter) as a variant and restore it; toggle freeze at runtime.',
  rd: 'RD-13',
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
    ];
    const grid = new EditableDataGrid<Rec>({
      columns,
      source: fromRows(signal(ROWS.slice()), { rowKey: (r) => r.id }),
      zebra: true,
    });

    // Pre-build two presets: 'compact' (dept hidden, total desc), then reset back to a plain 'wide' view.
    grid.setColumnVisible('dept', false);
    grid.sortBy('total', 'desc');
    const compact = grid.saveVariant('compact');
    grid.setColumnVisible('dept', true);
    grid.clearSort();
    const wide = grid.saveVariant('wide');

    const applyCompact = new Button('Compact', { onClick: () => grid.applyVariant(compact) });
    const applyWide = new Button('Wide', { onClick: () => grid.applyVariant(wide) });
    const freeze = new Button('Freeze #', { onClick: () => grid.setFrozen(['id'], []) });
    const unfreeze = new Button('Unfreeze', { onClick: () => grid.setFrozen([], []) });

    const echo = new Text(() => {
      const f = grid.frozen();
      const sort =
        grid
          .sort()
          .map((k) => `${k.columnId}${k.dir === 'desc' ? '↓' : '↑'}`)
          .join(',') || '—';
      return `cols ${grid.columnOrder().join(',')} · frozen L[${f.left.join(',')}] R[${f.right.join(',')}] · sort ${sort}`;
    });

    const root = new Group();
    const gridH = Math.max(3, ctx.height - 4);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    root.add(at(applyCompact, 0, gridH, 12, 2));
    root.add(at(applyWide, 13, gridH, 10, 2));
    root.add(at(freeze, 24, gridH, 12, 2));
    root.add(at(unfreeze, 37, gridH, 12, 2));
    root.add(at(echo, 0, gridH + 2, ctx.width, Math.max(1, ctx.height - gridH - 2)));
    return root;
  },
};
