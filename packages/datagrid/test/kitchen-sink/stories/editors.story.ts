/**
 * The typed-editors showcase story — one row of the `EditableDataGrid` per built-in editor kind: a
 * boolean `CheckGroup`, a date `DatePicker`, an `enum` select-only `ComboBox`, and a `lookup` value-help
 * `ComboBox` opened with **F4**. Each editor binds to the cell's single string field through a typed
 * bridge, so the commit seam still parses the authoritative string. A live read-out echoes the bound
 * state after each commit.
 *
 * The lookup cell stores the customer **key** and shows the **label** in the dropdown (F4); the grid
 * cell itself shows the key, since mapping a stored key to a display label in the cell is a formatting
 * concern outside this editor set.
 */
import { Group, Text, signal } from '@jsvision/ui';
import type { OnCommit } from '../../../src/index.js';
import { column, fromRows, EditableDataGrid } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Order {
  id: number;
  active: boolean;
  due: string;
  status: string;
  customerId: string;
}

export const editorsStory: Story = {
  id: 'datagrid/editors',
  category: 'DataGrid',
  title: 'Cell editors (typed)',
  blurb: 'Boolean, date, enum, and lookup (F4 value help) editors, each bound to one string cell field.',
  rd: 'RD-03',
  build(ctx) {
    const rows = signal<Order[]>([
      { id: 1, active: true, due: '2026-07-13', status: 'open', customerId: '7' },
      { id: 2, active: false, due: '2026-08-01', status: 'paid', customerId: '9' },
    ]);
    const echo = signal('Edit a cell — F2/Enter/type · F4 = value help on Customer');

    // The commit seam is the only mutation path; the read-out echoes the committed cell.
    const onCommit: OnCommit<Order> = (c) => {
      echo.set(`Committed row #${c.row.id} · ${c.columnId} = ${String(c.value)}`);
      return true;
    };

    const customers = [
      { key: '7', label: 'Ada Lovelace' },
      { key: '9', label: 'Bo Peep' },
    ];

    const columns = [
      column({ id: 'id', title: 'ID', value: (r: Order) => r.id, align: 'right', width: 3 }),
      column<Order, boolean>({
        id: 'active',
        title: 'Active',
        value: (r) => r.active,
        format: (v) => (v ? 'true' : 'false'), // canonical strings the boolean bridge expects
        parse: (t) => t === 'true',
        set: (r, v) => {
          r.active = v;
        },
        width: 7,
        editor: { kind: 'boolean' },
      }),
      column<Order, string>({
        id: 'due',
        title: 'Due',
        value: (r) => r.due, // ISO YYYY-MM-DD — the date bridge parses it
        parse: (t) => t,
        set: (r, v) => {
          r.due = v;
        },
        width: 12,
        editor: { kind: 'date' },
      }),
      column<Order, string>({
        id: 'status',
        title: 'Status',
        value: (r) => r.status,
        parse: (t) => t,
        set: (r, v) => {
          r.status = v;
        },
        width: 9,
        editor: { kind: 'enum', values: ['open', 'paid', 'shipped'] },
      }),
      column<Order, string>({
        id: 'customerId',
        title: 'Customer',
        value: (r) => r.customerId, // stores the key; F4 shows the labels in the dropdown
        parse: (t) => t,
        set: (r, v) => {
          r.customerId = v;
        },
        width: 10,
        editor: { kind: 'lookup', items: customers },
      }),
    ];
    const grid = new EditableDataGrid<Order>({
      columns,
      source: fromRows(rows, { rowKey: (r) => r.id }),
      onCommit,
      zebra: true,
    });

    const hints = new Text('↑↓ ←→ move · F2/Enter/type edits · F4 = value help (Customer) · Enter commits');
    const readout = new Text(() => echo()); // repaints on each commit

    const root = new Group();
    const gridHeight = Math.max(1, ctx.height - 2); // a row each for the hints and the read-out
    root.add(at(hints, 0, 0, ctx.width, 1));
    root.add(at(grid, 0, 1, ctx.width, gridHeight));
    root.add(at(readout, 0, ctx.height - 1, ctx.width, 1));
    return root;
  },
};
