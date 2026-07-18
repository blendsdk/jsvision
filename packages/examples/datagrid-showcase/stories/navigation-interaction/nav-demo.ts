/**
 * Shared builder for the Navigation-&-interaction demos — a grid (optionally remapped via the `keymap`
 * option), a one-line hint, an optional multi-line note panel (used to show the app-side Tab wiring), and
 * an optional live echo. Each demo file supplies its rows, columns, and copy. The `.js` extension in
 * import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { GridColumn, GridKeymap } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

/**
 * Build one Navigation-&-interaction demo.
 *
 * @param args `slug`/`title`/`blurb`/`hint`; the demo `rows` (copied per build) and `columns`; an
 *   optional `keymap` remap; an optional `note` (one Text per line, e.g. a wiring snippet); and an
 *   optional `echo` reactive readout.
 * @returns A `Story` in the `Navigation & interaction` category.
 * @example
 * ```ts
 * export const demo = buildNavStory({
 *   slug: 'remap', title: 'Remap a chord', blurb: '…', hint: 'Ctrl+E edits',
 *   rows: [{ id: 1, name: 'Ada' }], columns: [], keymap: { 'ctrl+e': 'beginEdit' },
 * });
 * ```
 */
export function buildNavStory<T extends { id: number | string }>(args: {
  slug: string;
  title: string;
  blurb: string;
  hint: string;
  rows: T[];
  columns: GridColumn<T>[];
  keymap?: GridKeymap;
  note?: readonly string[];
  echo?: (grid: EditableDataGrid<T>) => () => string;
}): Story {
  return {
    id: `datagrid/navigation-interaction/${args.slug}`,
    category: 'Navigation & interaction',
    title: args.title,
    blurb: args.blurb,
    rd: 'RD-10',
    build(ctx) {
      const rows = signal<T[]>(args.rows.map((r) => ({ ...r })));
      const grid = new EditableDataGrid<T>({
        columns: args.columns,
        source: fromRows(rows, { rowKey: (r) => r.id }),
        keymap: args.keymap,
        zebra: true,
      });

      const root = new Group();
      root.add(at(new Text(args.hint), 0, 0, ctx.width, 1));
      let top = 1;
      if (args.note !== undefined) {
        args.note.forEach((line, i) => root.add(at(new Text(line), 0, top + i, ctx.width, 1)));
        top += args.note.length;
      }
      let bottom = ctx.height;
      if (args.echo !== undefined) {
        bottom = ctx.height - 1;
        root.add(at(new Text(args.echo(grid)), 0, ctx.height - 1, ctx.width, 1));
      }
      root.add(at(grid, 0, top, ctx.width, Math.max(1, bottom - top)));
      return root;
    },
  };
}
