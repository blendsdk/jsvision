/**
 * Filtering · N of M — every filter updates the reactive `filteredCount()` / `totalCount()` readout, so
 * the effect of a filter on the visible row count is always visible. The `.js` extension is required by
 * NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildFilterStory } from './filter-demo.js';

interface Row {
  id: number;
  region: string;
  qty: number;
}

const DATA: Row[] = [
  { id: 1, region: 'EMEA', qty: 120 },
  { id: 2, region: 'APAC', qty: 40 },
  { id: 3, region: 'AMER', qty: 200 },
  { id: 4, region: 'EMEA', qty: 75 },
  { id: 5, region: 'APAC', qty: 60 },
  { id: 6, region: 'AMER', qty: 150 },
  { id: 7, region: 'EMEA', qty: 30 },
];

export const filteringNofMStory = buildFilterStory<Row>({
  slug: 'n-of-m',
  title: 'N of M readout',
  blurb: 'filteredCount() / totalCount() drive a live "N of M" readout that updates on every filter change.',
  hint: 'Type in the quick-filter row — the "N of M" readout tracks the visible count reactively',
  quickFilter: true,
  echo: 'count',
  rows: DATA,
  columns: [
    column<Row, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
    column<Row, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, align: 'right', width: 8 }),
  ],
});
