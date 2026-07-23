/**
 * Filtering · Quick filter — the opt-in band of per-column text inputs under the header runs a live
 * `contains` filter as you type. The `.js` extension is required by NodeNext ESM resolution.
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
];

export const filteringQuickFilterStory = buildFilterStory<Row>({
  slug: 'quick-filter',
  title: 'Quick filter',
  blurb: 'The opt-in quick-filter row under the header runs a live contains-match per column as you type.',
  hint: 'Type in the quick-filter row under the header — live contains-match per column',
  quickFilter: true,
  echo: 'count',
  rows: DATA,
  columns: [
    column<Row, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
    column<Row, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, align: 'right', width: 8 }),
  ],
});
