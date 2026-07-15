/**
 * Filtering · Value list — the Excel-style distinct-value picker embedded in the funnel popup: a
 * checkbox per distinct value, a type-ahead search, Select All, and a truncation disclosure for a
 * bounded source. The echo shows how many values are selected. The `.js` extension is required by
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
  { id: 6, region: 'LATAM', qty: 150 },
];

export const filteringValueListStory = buildFilterStory<Row>({
  slug: 'value-list',
  title: 'Value list',
  blurb: 'A distinct-value checkbox picker with search and Select All, embedded in the funnel popup.',
  hint: 'Click the Region funnel ▽ → tick distinct values (search + Select All) to filter by set',
  echo: 'model',
  rows: DATA,
  columns: [
    column<Row, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
    column<Row, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, align: 'right', width: 8 }),
  ],
});
