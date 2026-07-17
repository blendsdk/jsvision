/**
 * Validation & lifecycle · Lifecycle states — a caller-driven `status` getter drives loading / ready /
 * error; the empty state is auto-derived from the row count. The buttons flip a `status` signal so you
 * can see each state: loading shows a spinner (header stays), error shows a message + a Retry button
 * (which flips back to ready), empty shows the filter-aware message, ready shows the grid.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, Button, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { GridStatus } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Row {
  id: number;
  amount: number;
}

export const lifecycleStory: Story = {
  id: 'datagrid/validation-lifecycle/lifecycle',
  category: 'Validation & lifecycle',
  title: 'Loading / empty / error',
  rd: 'RD-12',
  blurb: 'A caller status drives loading / ready / error; empty is auto-derived. Error offers a working Retry.',
  build(ctx) {
    const status = signal<GridStatus>('ready');
    const rows = signal<Row[]>([
      { id: 1, amount: 1200 },
      { id: 2, amount: 950 },
      { id: 3, amount: 430 },
    ]);

    const grid = new EditableDataGrid<Row>({
      columns: [column<Row, number>({ id: 'amount', title: 'Amount', value: (r) => r.amount, align: 'right' })],
      source: fromRows(rows, { rowKey: (r) => r.id }),
      status: () => status(),
      emptyText: 'No rows loaded',
      zebra: true,
    });

    const setBtn = (label: string, to: GridStatus, x: number) =>
      at(new Button(label, { onClick: () => status.set(to) }), x, 0, 11, 2);

    const root = new Group();
    root.add(setBtn('Loading', 'loading', 0));
    root.add(setBtn('Error', { kind: 'error', message: 'Failed to load', retry: () => status.set('ready') }, 12));
    root.add(setBtn('Ready', 'ready', 24));
    const gridH = Math.max(1, ctx.height - 3);
    root.add(at(grid, 0, 2, ctx.width, gridH));
    root.add(
      at(
        new Text('Click a button to switch state · in Error, click Retry to return to Ready'),
        0,
        ctx.height - 1,
        ctx.width,
        1,
      ),
    );
    return root;
  },
};
