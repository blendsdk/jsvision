/**
 * The formatting & rendering showcase story — a grid that demonstrates the three RD-04 surfaces at once:
 * a locale currency-formatted **Balance** column (nl-NL EUR, right-aligned, with a matched inverse parse
 * so an edit round-trips and a bad amount is rejected), value-driven conditional styling (a negative
 * balance paints red), and a custom **render** cell (a traffic-light glyph reflecting the balance sign).
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, fmt, EditableDataGrid } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Account {
  id: number;
  name: string;
  balance: number;
}

export const formattingStory: Story = {
  id: 'datagrid/formatting',
  category: 'DataGrid',
  title: 'Formatting & rendering',
  blurb: 'Locale currency formatting, red-on-negative conditional styling, and a traffic-light render cell.',
  rd: 'RD-04',
  build(ctx) {
    const rows = signal<Account[]>([
      { id: 1, name: 'Ada', balance: 10000.25 },
      { id: 2, name: 'Bo', balance: -250.5 },
      { id: 3, name: 'Cy', balance: 4200 },
      { id: 4, name: 'Di', balance: -12.99 },
    ]);

    const columns = [
      column<Account, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
      column<Account, number>({
        id: 'balance',
        title: 'Balance',
        align: 'right',
        width: 14,
        value: (r) => r.balance,
        ...fmt.currency({ locale: 'nl-NL', currency: 'EUR' }), // "€ 10.000,25" + a matched inverse parse
        set: (r, v) => {
          r.balance = v;
        },
        // Negative balances paint red (an explicit Style); a higher state (cursor/selected) still wins.
        cellStyle: (v) => (v < 0 ? { fg: 'brightRed', bg: 'cyan' } : 'listNormal'),
      }),
      column<Account, number>({
        id: 'flag',
        title: '',
        width: 3,
        value: (r) => r.balance,
        // A traffic-light glyph via the custom renderer — the ctx is cell-local and cell-clipped.
        render: (rc, cell) =>
          rc.text(0, 0, cell.value < 0 ? '●' : '○', {
            fg: cell.value < 0 ? 'brightRed' : 'brightGreen',
            bg: 'cyan',
          }),
      }),
    ];

    const grid = new EditableDataGrid<Account>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      zebra: true,
    });

    const hints = new Text('↑↓ ←→ move  ·  F2 / Enter edits a Balance  ·  a non-numeric amount is rejected');

    const root = new Group();
    const gridHeight = Math.max(1, ctx.height - 1); // leave a row for the hints
    root.add(at(hints, 0, 0, ctx.width, 1));
    root.add(at(grid, 0, 1, ctx.width, gridHeight));
    return root;
  },
};
