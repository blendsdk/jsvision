/**
 * Columns & layout · Density — `density: 'compact'` drops the inter-column │ divider, reclaiming its
 * cell per column so more content fits in the same width (header, body, and quick-filter reflow together
 * and stay aligned). The `.js` extension is required by NodeNext ESM resolution.
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
  { id: 1, name: 'Ada', city: 'London', dept: 'R&D', zone: 'EU' },
  { id: 2, name: 'Bo', city: 'LA', dept: 'Sales', zone: 'US' },
  { id: 3, name: 'Cyrus', city: 'Berlin', dept: 'Ops', zone: 'EU' },
  { id: 4, name: 'Dita', city: 'Tokyo', dept: 'R&D', zone: 'APAC' },
];

export const layoutDensityStory = buildLayoutStory<Emp>({
  slug: 'density',
  title: 'Compact density',
  blurb: "density: 'compact' drops the │ divider, reclaiming a cell per column for denser content.",
  hint: 'Compact mode — no inter-column divider; columns pack tighter than the default normal density',
  rows: ROWS,
  columns: [
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4 }),
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
    column<Emp, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 8 }),
    column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
    column<Emp, string>({ id: 'zone', title: 'Zone', value: (r) => r.zone, width: 6 }),
  ],
  options: { density: 'compact' },
  echo: () => () => "density: 'compact' — the inter-column │ divider is dropped (horizontal only)",
});
