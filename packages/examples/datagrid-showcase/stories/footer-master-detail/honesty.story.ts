/**
 * Aggregate honesty — a windowed source that has loaded only part of its dataset (`complete()` returns
 * `false`). The footer labels its total `"(loaded)"`, so a partial total is never passed off as a
 * whole-dataset grand total.
 */
import { column } from '@jsvision/datagrid';
import type { GridDataSource } from '@jsvision/datagrid';
import { buildFooterStory } from './footer-demo.js';

interface Sale {
  id: number;
  region: string;
  amount: number;
}
const LOADED_PAGE: Sale[] = [
  { id: 1, region: 'North', amount: 120 },
  { id: 2, region: 'South', amount: 340 },
  { id: 3, region: 'East', amount: 90 },
];

export const footerHonestyStory = buildFooterStory<Sale>({
  slug: 'honesty',
  title: 'Aggregate honesty',
  blurb: 'A not-fully-loaded (windowed) source labels its footer total "(loaded)" — never a false grand total.',
  hint: 'This source reports complete() === false, so the Σ carries a "(loaded)" qualifier.',
  rows: LOADED_PAGE,
  columns: [
    column({ id: 'region', title: 'Region', value: (r: Sale) => r.region, width: 10 }),
    column({ id: 'amount', title: 'Amount', value: (r: Sale) => r.amount, align: 'right', width: 16 }),
  ],
  // A windowed source: reactive read over the loaded page, but honestly incomplete.
  source: (rows): GridDataSource<Sale> => ({
    rowKey: (r) => r.id,
    length: () => rows().length,
    rowAt: (i) => rows()[i],
    complete: () => false,
  }),
  footer: {
    aggregates: { amount: { fn: 'sum', label: 'Σ', format: (v) => `$${v}` } },
  },
});
