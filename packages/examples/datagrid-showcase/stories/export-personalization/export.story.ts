/**
 * Export & variants · Export the current view — `exportView(format)` serializes the visible columns (in
 * display order) and the filtered + sorted rows to CSV / HTML / JSON / TSV and returns a string the app
 * writes wherever it likes. Click 'Next format' to cycle the format and watch the live output; 'Copy TSV'
 * pipes the TSV to the browser clipboard via `@jsvision/web`'s `setClipboard` (the datagrid itself never
 * depends on web — it just returns the string). The `.js` extension is required by NodeNext ESM.
 */
import { Group, Text, Button, signal } from '@jsvision/ui';
import { column, EditableDataGrid, fromRows } from '@jsvision/datagrid';
import type { ExportFormat } from '@jsvision/datagrid';
import { setClipboard } from '@jsvision/web';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Rec {
  id: number;
  name: string;
  dept: string;
  total: number;
}

const FORMATS: readonly ExportFormat[] = ['csv', 'html', 'json', 'tsv'];

const ROWS: Rec[] = [
  { id: 1, name: 'Ann', dept: 'Eng', total: 1200 },
  { id: 2, name: 'Bob', dept: 'Ops', total: 3400 },
  { id: 3, name: 'Cy', dept: 'Eng', total: 2100 },
  { id: 4, name: 'Di', dept: 'Sales', total: 900 },
];

export const exportFormatsStory: Story = {
  id: 'datagrid/export-personalization/export',
  category: 'Export & variants',
  title: 'Export the current view',
  blurb: 'Serialize the visible columns + filtered/sorted rows to CSV/HTML/JSON/TSV; copy TSV to the clipboard.',
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
    grid.sortBy('total', 'desc'); // a non-trivial view so the export reflects the sort

    const fmtIdx = signal(0);
    const fmt = (): ExportFormat => FORMATS[fmtIdx()];
    const label = new Text(() => `Format ▸ ${fmt().toUpperCase()}   (click 'Next format' to cycle)`);
    const next = new Button('Next format', { onClick: () => fmtIdx.set((fmtIdx() + 1) % FORMATS.length) });
    // setClipboard is a no-op without a browser clipboard (e.g. headless), so this is safe everywhere.
    const copy = new Button('Copy TSV', { onClick: () => void setClipboard(grid.exportView('tsv'), ctx.caps) });
    const output = new Text(() => grid.exportView(fmt()).replace(/\r\n/g, ' ⏎ '));

    const root = new Group();
    const gridH = Math.max(3, ctx.height - 6);
    root.add(at(grid, 0, 0, ctx.width, gridH));
    root.add(at(label, 0, gridH, ctx.width, 1));
    root.add(at(next, 0, gridH + 1, 16, 2));
    root.add(at(copy, 18, gridH + 1, 14, 2));
    root.add(at(output, 0, gridH + 3, ctx.width, Math.max(1, ctx.height - gridH - 3)));
    return root;
  },
};
