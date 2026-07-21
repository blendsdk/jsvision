/**
 * Columns & layout · Resize & reorder — drag a header grip │ to resize a column live (double-click it
 * to auto-fit to the widest cell), and drag a header title to reorder columns. A live echo mirrors
 * `grid.columnOrder()` and a couple of `grid.columnWidth()` readouts. The `.js` extension is required by
 * NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildLayoutStory } from './layout-demo.js';

interface Emp {
  id: number;
  name: string;
  city: string;
  dept: string;
}

const ROWS: Emp[] = [
  { id: 1, name: 'Ada Lovelace', city: 'London', dept: 'R&D' },
  { id: 2, name: 'Bo', city: 'LA', dept: 'Sales' },
  { id: 3, name: 'Cyrus', city: 'San Francisco', dept: 'Operations' },
  { id: 4, name: 'Dita', city: 'Berlin', dept: 'R&D' },
];

export const layoutResizeReorderStory = buildLayoutStory<Emp>({
  slug: 'resize-reorder',
  title: 'Resize & reorder',
  blurb: 'Drag a grip │ to resize (double-click = auto-fit); drag a title to reorder columns.',
  hint: 'Drag a grip │ to resize · double-click a grip to auto-fit · drag a title to reorder',
  rows: ROWS,
  columns: [
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4, minWidth: 3 }),
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8, minWidth: 4 }),
    column<Emp, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 8, minWidth: 4 }),
    column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8, minWidth: 4 }),
  ],
  echo: (grid) => () =>
    `order: ${grid.columnOrder().join(' → ')}   name=${grid.columnWidth('name')} city=${grid.columnWidth('city')}`,
});
