/**
 * The validation & lifecycle showcase story — the commit-safety layer live: a per-cell `validate` gate
 * rejects a non-positive value (the cell is marked and a message surfaces, the editor staying open), and
 * a per-row `validateRow` cross-field gate traps a row-leave when `end` is not after `start`, refocusing
 * the offending field. A live read-out echoes the grid's active message. Lifecycle `status` (loading /
 * empty / error) is app-wired — a `build(ctx)` story has no loop to drive the spinner — so this story
 * focuses on the interactive validation gates.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '../../../src/index.js';
import { at } from '../story.js';
import type { Story } from '../story.js';

interface Line {
  id: number;
  qty: number;
  start: number;
  end: number;
}

export const validationLifecycleStory: Story = {
  id: 'datagrid/validation-lifecycle',
  category: 'DataGrid',
  title: 'Validation & lifecycle',
  blurb: 'A per-cell validate gate rejects bad values; a per-row validateRow gate traps a bad row-leave.',
  rd: 'RD-12',
  build(ctx) {
    const rows = signal<Line[]>([
      { id: 1, qty: 5, start: 1, end: 9 },
      { id: 2, qty: 3, start: 2, end: 8 },
      { id: 3, qty: 8, start: 4, end: 6 },
    ]);

    const num = (id: 'qty' | 'start' | 'end', title: string, validate?: (v: number) => string | null) =>
      column<Line, number>({
        id,
        title,
        value: (r) => r[id],
        parse: (t) => Number(t),
        set: (r, v) => {
          r[id] = v;
        },
        validate: validate ? (v) => validate(v) : undefined,
        editor: { kind: 'integer' },
        width: 8,
      });

    const grid = new EditableDataGrid<Line>({
      columns: [
        num('qty', 'Qty', (v) => (v > 0 ? null : 'Quantity must be positive')),
        num('start', 'Start'),
        num('end', 'End'),
      ],
      source: fromRows(rows, { rowKey: (r) => r.id }),
      // Cross-field rule: end must be after start. Trapped on a row-leave when the row was edited.
      validateRow: (r) =>
        r.end > r.start ? { ok: true } : { ok: false, message: 'End must be after Start', field: 'end' },
      zebra: true,
    });

    const hints = new Text('Edit Qty ≤ 0 → rejected · edit a row so End ≤ Start, then leave → row trapped');
    const echo = new Text(() => `Message: ${grid.activeMessage() ?? '(none — all valid)'}`);

    const root = new Group();
    const gridHeight = Math.max(1, ctx.height - 2);
    root.add(at(hints, 0, 0, ctx.width, 1));
    root.add(at(grid, 0, 1, ctx.width, gridHeight));
    root.add(at(echo, 0, ctx.height - 1, ctx.width, 1));
    return root;
  },
};
