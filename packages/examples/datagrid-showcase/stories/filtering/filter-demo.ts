/**
 * Shared builder + helpers for the Filtering cluster. Each demo is a grid with either an N-of-M count
 * echo or an active-filter-model echo; the push-down demo is bespoke (it echoes the source). The `.js`
 * extension is required by NodeNext ESM resolution.
 */
import { Group, Text, signal } from '@jsvision/ui';
import { fromRows, EditableDataGrid } from '@jsvision/datagrid';
import type { GridColumn, FilterModel } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

/** Render a filter model as a compact chip list, e.g. `region contains "ea"  qty between 100..500`. */
export function describeFilter(model: FilterModel): string {
  if (model.size === 0) return '(none)';
  const parts: string[] = [];
  for (const [id, f] of model) {
    if (f.kind === 'text') parts.push(`${id} ${f.op} "${f.value}"`);
    else if (f.kind === 'number') parts.push(`${id} ${f.op} ${f.a}${f.b !== undefined ? `..${f.b}` : ''}`);
    else if (f.kind === 'date') parts.push(`${id} ${f.op} (date)`);
    else if (f.kind === 'set') parts.push(`${id} in {${f.selected.size} selected}`);
    else parts.push(`${id} custom`);
  }
  return parts.join('  ');
}

/**
 * Build one filtering demo.
 *
 * @param args `slug`/`title`/`blurb`/`hint`, the demo `rows` + `columns`, whether to show the opt-in
 *   `quickFilter` band, and which `echo` to render (`'count'` = N of M, `'model'` = the active filter).
 * @returns A `Story` in the `Filtering` category.
 */
export function buildFilterStory<T extends { id: number }>(args: {
  slug: string;
  title: string;
  blurb: string;
  hint: string;
  rows: T[];
  columns: GridColumn<T>[];
  quickFilter?: boolean;
  echo: 'count' | 'model';
}): Story {
  return {
    id: `datagrid/filtering/${args.slug}`,
    category: 'Filtering',
    title: args.title,
    blurb: args.blurb,
    rd: 'RD-06',
    build(ctx) {
      const rows = signal<T[]>(args.rows.map((r) => ({ ...r })));
      const grid = new EditableDataGrid<T>({
        columns: args.columns,
        source: fromRows(rows, { rowKey: (r) => r.id }),
        quickFilter: args.quickFilter,
        zebra: true,
      });

      const root = new Group();
      root.add(at(new Text(args.hint), 0, 0, ctx.width, 1));
      const echo =
        args.echo === 'count'
          ? new Text(() => `Showing ${grid.filteredCount()} of ${grid.totalCount()} rows`)
          : new Text(() => `Filter: ${describeFilter(grid.filterModel())}`);
      root.add(at(echo, 0, 1, ctx.width, 1));
      const gridH = Math.max(1, ctx.height - 2);
      root.add(at(grid, 0, 2, ctx.width, gridH));
      return root;
    },
  };
}
