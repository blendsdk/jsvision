/**
 * Validation & lifecycle · Row gate — a per-row `validateRow` cross-field gate runs when the cursor
 * leaves a row that was edited. Here End must be after Start; edit a row so it is not, then try to leave
 * (arrow / Enter / click a different row) and the leave is trapped: the cursor refocuses the `end` field
 * and the message surfaces. An untouched row leaves freely.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Span {
  id: number;
  start: number;
  end: number;
}

export const rowGateStory: Story = {
  id: 'datagrid/validation-lifecycle/row-gate',
  category: 'Validation & lifecycle',
  title: 'Row gate (cross-field)',
  rd: 'RD-12',
  blurb: 'validateRow traps a row-leave when an edited row fails a cross-field rule, refocusing the field.',
  build(ctx) {
    const rows = signal<Span[]>([
      { id: 1, start: 1, end: 9 },
      { id: 2, start: 3, end: 7 },
      { id: 3, start: 2, end: 5 },
    ]);
    const num = (id: 'start' | 'end', title: string) =>
      column<Span, number>({
        id,
        title,
        value: (r) => r[id],
        parse: (t) => Number(t),
        set: (r, v) => {
          r[id] = v;
        },
        editor: { kind: 'integer' },
        width: 8,
      });
    const grid = new EditableDataGrid<Span>({
      columns: [num('start', 'Start'), num('end', 'End')],
      source: fromRows(rows, { rowKey: (r) => r.id }),
      validateRow: (r) =>
        r.end > r.start ? { ok: true } : { ok: false, message: 'End must be after Start', field: 'end' },
      zebra: true,
    });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 2);
    root.add(
      at(new Text('Edit a row so End ≤ Start, then arrow/Tab/click away → the leave is trapped'), 0, 0, ctx.width, 1),
    );
    root.add(at(grid, 0, 1, ctx.width, gridH));
    root.add(
      at(new Text(() => `Active message: ${grid.activeMessage() ?? '(none)'}`), 0, ctx.height - 1, ctx.width, 1),
    );
    return root;
  },
};
