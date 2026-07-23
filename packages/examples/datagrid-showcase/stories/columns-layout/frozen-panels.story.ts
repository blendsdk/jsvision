/**
 * Columns & layout · Frozen panels — pin columns to a non-scrolling left panel ('id') and right panel
 * ('zone'); only the center panel scrolls horizontally, with a `FreezeDivider` marking each boundary.
 * A live echo mirrors `grid.frozen()`. The `.js` extension is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildLayoutStory } from './layout-demo.js';

interface Emp {
  id: number;
  name: string;
  city: string;
  dept: string;
  zone: string;
}

const ROWS: Emp[] = [
  { id: 1, name: 'Ada Lovelace', city: 'London', dept: 'R&D', zone: 'EU' },
  { id: 2, name: 'Bo', city: 'LA', dept: 'Sales', zone: 'US' },
  { id: 3, name: 'Cy Young', city: 'San Francisco', dept: 'Ops', zone: 'US' },
  { id: 4, name: 'Dita', city: 'Berlin', dept: 'R&D', zone: 'EU' },
];

export const layoutFrozenPanelsStory = buildLayoutStory<Emp>({
  slug: 'frozen-panels',
  title: 'Frozen columns',
  blurb: "Pin columns to a left ('id') and right ('zone') panel; only the center scrolls horizontally.",
  hint: "Scroll ↔ (→/←) — 'id' stays pinned left and 'zone' pinned right while the center pans",
  rows: ROWS,
  columns: [
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4 }),
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 14 }),
    column<Emp, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 14 }),
    column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 10 }),
    column<Emp, string>({ id: 'zone', title: 'Zone', value: (r) => r.zone, width: 6 }),
  ],
  options: { freezeLeft: ['id'], freezeRight: ['zone'] },
  echo: (grid) => () => `frozen left:[${grid.frozen().left.join(',')}]  right:[${grid.frozen().right.join(',')}]`,
});
