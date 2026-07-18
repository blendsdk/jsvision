/**
 * Shared builder for the client-side Sorting demos — each is a grid plus a live echo of the container's
 * `grid.sort()` model. The push-down demo is bespoke (it echoes the source instead). The `.js` extension
 * is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { GridColumn, SortKey } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

/** Render a sort model as an ordered chip list, e.g. `1. qty ▲  2. region ▼` (or `(none)`). */
export function describeSort(keys: SortKey[]): string {
  if (keys.length === 0) return '(none)';
  return keys.map((k, i) => `${i + 1}. ${k.columnId} ${k.dir === 'asc' ? '▲' : '▼'}`).join('  ');
}

/**
 * Build one client-side sorting demo.
 *
 * @param args `slug`/`title`/`blurb`/`hint`, the demo `rows` (copied per build), and the `columns`.
 * @returns A `Story` in the `Sorting` category.
 */
export function buildSortStory<T extends { id: number }>(args: {
  slug: string;
  title: string;
  blurb: string;
  hint: string;
  rows: T[];
  columns: GridColumn<T>[];
}): Story {
  return {
    id: `datagrid/sorting/${args.slug}`,
    category: 'Sorting',
    title: args.title,
    blurb: args.blurb,
    rd: 'RD-05',
    build(ctx) {
      const rows = signal<T[]>(args.rows.map((r) => ({ ...r })));
      const grid = new EditableDataGrid<T>({
        columns: args.columns,
        source: fromRows(rows, { rowKey: (r) => r.id }),
        zebra: true,
      });

      const root = new Group();
      root.add(at(new Text(args.hint), 0, 0, ctx.width, 1));
      root.add(at(new Text(() => `Sort: ${describeSort(grid.sort())}`), 0, 1, ctx.width, 1));
      const gridH = Math.max(1, ctx.height - 2);
      root.add(at(grid, 0, 2, ctx.width, gridH));
      return root;
    },
  };
}
