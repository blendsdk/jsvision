/**
 * Shared builder for the Cell-editors cluster — every editor demo is the same shape (a small editable
 * grid + a committed-value echo), differing only in the target column's `editor` descriptor. Each
 * `editors/<kind>.story.ts` supplies its rows + columns and this builds the `Story`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { GridColumn, OnCommit } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

/**
 * Build one cell-editor demo.
 *
 * @param args `slug`/`title`/`blurb`, the demo `rows` (copied per build), the `columns` (including the
 *   editor column), and an optional key `hint` line.
 * @returns A `Story` in the `Cell editors` category.
 */
export function buildEditorStory<T extends { id: number }>(args: {
  slug: string;
  title: string;
  blurb: string;
  rows: T[];
  columns: GridColumn<T>[];
  hint?: string;
}): Story {
  return {
    id: `datagrid/editors/${args.slug}`,
    category: 'Cell editors',
    title: args.title,
    blurb: args.blurb,
    rd: 'RD-03',
    build(ctx) {
      const rows = signal<T[]>(args.rows.map((r) => ({ ...r })));
      const echo = signal('Edit the highlighted column, then press Enter to commit');
      const onCommit: OnCommit<T> = (c) => {
        echo.set(`Committed ${c.columnId} = ${String(c.value)}`);
        return true;
      };
      const grid = new EditableDataGrid<T>({
        columns: args.columns,
        source: fromRows(rows, { rowKey: (r) => r.id }),
        onCommit,
        zebra: true,
      });

      const root = new Group();
      const gridH = Math.max(1, ctx.height - 2);
      root.add(
        at(new Text(args.hint ?? 'F2 / Enter / type to edit · Enter commits · Esc cancels'), 0, 0, ctx.width, 1),
      );
      root.add(at(grid, 0, 1, ctx.width, gridH));
      root.add(at(new Text(() => echo()), 0, ctx.height - 1, ctx.width, 1));
      return root;
    },
  };
}
