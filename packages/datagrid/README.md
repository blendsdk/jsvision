# @jsvision/datagrid

An editable, enterprise-class data grid for
[jsvision](https://github.com/blendsdk/jsvision) terminal apps, built on
[`@jsvision/ui`](../ui) — typed columns, per-cell display formatting, immediate
in-cell editing, row selection, virtual scrolling, and a sort/filter/footer surface.
Think SAP ALV / MS-Access in a text-mode terminal.

ESM only. Node 22+.

See the [documentation site](https://blendsdk.github.io/jsvision/) for the full
reference and [API docs](https://blendsdk.github.io/jsvision/api/).

## Recover a trapped row

`validateRow` runs after an accepted cell commit when navigation tries to leave that edited row.
When the cross-field rule rejects the leave, the grid keeps focus on the row and shows a localized
Escape hint. With the body focused, Escape restores the earliest value committed to each changed
cell during that trapped row session. This is scoped row recovery, not a general undo stack.

An open cell editor owns the first Escape and cancels only its uncommitted text. Commit or cancel the
editor before using body-level Escape to restore an already trapped row.

Applications that persist accepted cell commits must provide one atomic `onRevertRow` transaction:

```ts
import { EditableDataGrid, column, fromRows } from '@jsvision/datagrid';
import { signal } from '@jsvision/ui';

interface Line {
  id: number;
  start: number;
  end: number;
}

const rows = signal<Line[]>([{ id: 1, start: 1, end: 9 }]);
const numberColumn = (id: 'start' | 'end', title: string) =>
  column<Line, number>({
    id,
    title,
    value: (row) => row[id],
    parse: Number,
    set: (row, value) => {
      row[id] = value;
    },
  });

const grid = new EditableDataGrid<Line>({
  columns: [numberColumn('start', 'Start'), numberColumn('end', 'End')],
  source: fromRows(rows, { rowKey: (row) => row.id }),
  validateRow: (row) =>
    row.end > row.start ? { ok: true } : { ok: false, message: 'End must be after Start', field: 'end' },
  onRevertRow: async ({ rowKey, row, cells }) => persistRestoredRow(rowKey, row, cells),
});
```

The callback receives the original row after every session baseline has been applied and an
immutable changed-cell list in first-commit order. Return `false`, throw, or reject to compensate
the row to its pre-revert committed values and keep the trap available for retry. While it settles,
the grid blocks competing edits, navigation, filtering, selection, and row mutations.

Without `onRevertRow`, local recovery is available only when neither `beforeSave` nor `onCommit` is
configured. If either persistence/policy hook exists, Escape keeps the row trapped and reports that
row changes cannot be reverted, preventing the UI from silently diverging from host persistence.
Client-side validation and recovery are UX boundaries; the source remains authoritative.
