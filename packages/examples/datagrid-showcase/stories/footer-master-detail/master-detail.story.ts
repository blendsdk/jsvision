/**
 * Editable master-detail — an orders master linked to an editable lines detail. Moving the master cursor
 * re-derives the detail's rows (reactive); the detail is backed by a write-through source, so editing a
 * line and inserting/deleting lines persist into the owned `lines` collection. Each grid carries a footer
 * total.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, fromReactiveRows, EditableDataGrid, masterDetail } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Order {
  id: number;
  customer: string;
  total: number;
}
interface Line {
  id: number;
  orderId: number;
  sku: string;
  qty: number;
}

export const footerMasterDetailStory: Story = {
  id: 'datagrid/footer-master-detail/master-detail',
  category: 'Footer & aggregation',
  title: 'Editable master-detail',
  blurb: 'An orders master linked to an editable lines detail via a write-through source; both carry footer totals.',
  rd: 'RD-09',
  build(ctx) {
    const orders = signal<Order[]>([
      { id: 1, customer: 'Ada', total: 120 },
      { id: 2, customer: 'Bo', total: 340 },
      { id: 3, customer: 'Cy', total: 90 },
    ]);
    const lines = signal<Line[]>([
      { id: 10, orderId: 1, sku: 'A-1', qty: 2 },
      { id: 11, orderId: 1, sku: 'A-2', qty: 1 },
      { id: 12, orderId: 2, sku: 'B-1', qty: 5 },
      { id: 13, orderId: 3, sku: 'C-1', qty: 3 },
    ]);

    // Explicit annotation breaks the self-referential inference (the N-of-M widget closes over `master`).
    const master: EditableDataGrid<Order> = new EditableDataGrid<Order>({
      columns: [
        column({ id: 'id', title: 'Order', value: (r: Order) => r.id, align: 'right', width: 6 }),
        column({ id: 'customer', title: 'Customer', value: (r: Order) => r.customer, width: 12 }),
        column({ id: 'total', title: 'Total', value: (r: Order) => r.total, align: 'right', width: 8 }),
      ],
      source: fromRows(orders, { rowKey: (o) => o.id }),
      zebra: true,
      footer: {
        aggregates: { total: { fn: 'sum', label: 'Σ', format: (v) => `$${v}` } },
        widgets: [new Text(() => `${master.filteredCount()} of ${master.totalCount()} orders`)],
      },
    });

    const { detail } = masterDetail(
      master,
      (focused) =>
        new EditableDataGrid<Line>({
          columns: [
            column({
              id: 'sku',
              title: 'SKU',
              value: (r: Line) => r.sku,
              parse: (t) => t,
              set: (r, v) => {
                r.sku = v;
              },
              width: 8,
            }),
            column({
              id: 'qty',
              title: 'Qty',
              value: (r: Line) => r.qty,
              align: 'right',
              parse: (t) => Number(t),
              set: (r, v) => {
                r.qty = v;
              },
              width: 6,
            }),
          ],
          source: fromReactiveRows(() => lines().filter((l) => l.orderId === focused()?.id), {
            rowKey: (l) => l.id,
            insert: (row, index) => {
              const next = lines().slice();
              next.splice(index ?? next.length, 0, row);
              lines.set(next);
            },
            remove: (keys) => {
              const drop = new Set(keys);
              lines.set(lines().filter((l) => !drop.has(l.id)));
            },
          }),
          footer: { aggregates: { qty: { fn: 'sum', label: 'Σqty' } } },
        }),
    );

    const hint = new Text('↑↓ move the order cursor — the lines follow; F2/Enter edits a line (Σqty updates).');
    const masterLabel = new Text(() => `Orders — focused #${master.focusedKey() ?? '—'}`);
    const detailLabel = new Text('Lines of the focused order (editable, write-through)');

    const root = new Group();
    const half = Math.max(4, Math.floor((ctx.height - 3) / 2));
    root.add(at(hint, 0, 0, ctx.width, 1));
    root.add(at(masterLabel, 0, 1, ctx.width, 1));
    root.add(at(master, 0, 2, ctx.width, half));
    root.add(at(detailLabel, 0, 2 + half, ctx.width, 1));
    root.add(at(detail, 0, 3 + half, ctx.width, Math.max(3, ctx.height - 3 - half)));
    return root;
  },
};
