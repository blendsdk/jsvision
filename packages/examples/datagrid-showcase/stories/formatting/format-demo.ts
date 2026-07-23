/**
 * Shared builder for the Formatting cluster — each demo is a small grid whose columns show a value both
 * raw and formatted (so the effect of `fmt.*` is visible side by side). Each `formatting/<x>.story.ts`
 * supplies its rows + columns. The `.js` extension is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { GridColumn } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

/**
 * Build one formatting demo.
 *
 * @param args `slug`/`title`/`blurb`, the demo `rows` (copied per build), the `columns`, and an
 *   optional key `hint` line.
 * @returns A `Story` in the `Formatting` category.
 */
export function buildFormatStory<T extends { id: number }>(args: {
  slug: string;
  title: string;
  blurb: string;
  rows: T[];
  columns: GridColumn<T>[];
  hint?: string;
}): Story {
  return {
    id: `datagrid/formatting/${args.slug}`,
    category: 'Formatting',
    title: args.title,
    blurb: args.blurb,
    rd: 'RD-04',
    build(ctx) {
      const rows = signal<T[]>(args.rows.map((r) => ({ ...r })));
      const grid = new EditableDataGrid<T>({
        columns: args.columns,
        source: fromRows(rows, { rowKey: (r) => r.id }),
        zebra: true,
      });

      const root = new Group();
      const gridY = args.hint !== undefined ? 1 : 0;
      const gridH = Math.max(1, ctx.height - gridY);
      if (args.hint !== undefined) root.add(at(new Text(args.hint), 0, 0, ctx.width, 1));
      root.add(at(grid, 0, gridY, ctx.width, gridH));
      return root;
    },
  };
}
