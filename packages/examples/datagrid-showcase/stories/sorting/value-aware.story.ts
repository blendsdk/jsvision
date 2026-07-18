/**
 * Sorting · Value-aware — the grid sorts by each column's TYPED value, not its formatted display text.
 * The Qty column is grouped (`fmt.number`), so a lexical sort would put "1,000" before "9"; value-aware
 * sorting orders 9 before 1,000. The `.js` extension is required by NodeNext ESM resolution.
 */
import { column, fmt } from '@jsvision/datagrid';
import { buildSortStory } from './sort-demo.js';

interface Row {
  id: number;
  region: string;
  qty: number;
}

export const sortingValueAwareStory = buildSortStory<Row>({
  slug: 'value-aware',
  title: 'Value-aware sort',
  blurb: 'Sorts by the typed value, not the formatted string — 9 orders before 1,000 despite the grouping.',
  hint: 'Sort Qty ascending → 9, 50, 200, 1,000 (by value), not lexically by the grouped text',
  rows: [
    { id: 1, region: 'east', qty: 1000 },
    { id: 2, region: 'west', qty: 9 },
    { id: 3, region: 'north', qty: 50 },
    { id: 4, region: 'south', qty: 200 },
  ],
  columns: [
    column<Row, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
    column<Row, number>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      align: 'right',
      width: 10,
      ...fmt.number({ locale: 'en-US' }),
    }),
  ],
});
