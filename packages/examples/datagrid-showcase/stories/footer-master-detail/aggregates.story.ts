/**
 * Column aggregates — a sales grid whose footer folds a `count`, a `sum`, and an `avg` over the displayed
 * rows. Editing a cell, sorting, or filtering recomputes the totals reactively.
 */
import { column } from '@jsvision/datagrid';
import { buildFooterStory } from './footer-demo.js';

interface Sale {
  id: number;
  region: string;
  qty: number;
  price: number;
}
const ROWS: Sale[] = [
  { id: 1, region: 'North', qty: 3, price: 120 },
  { id: 2, region: 'South', qty: 5, price: 90 },
  { id: 3, region: 'East', qty: 2, price: 200 },
  { id: 4, region: 'West', qty: 8, price: 60 },
  { id: 5, region: 'North', qty: 4, price: 150 },
];

export const footerAggregatesStory = buildFooterStory<Sale>({
  slug: 'aggregates',
  title: 'Column aggregates',
  blurb: 'Per-column count/sum/avg folded over the displayed rows; they recompute as you sort, filter, or edit.',
  hint: 'Click a header to sort, or edit a Qty/Price cell (F2 / Enter) — the footer totals recompute reactively.',
  rows: ROWS,
  columns: [
    column({ id: 'region', title: 'Region', value: (r: Sale) => r.region, width: 10 }),
    column({
      id: 'qty',
      title: 'Qty',
      value: (r: Sale) => r.qty,
      align: 'right',
      parse: (t) => Number(t),
      set: (r, v) => {
        r.qty = v;
      },
      width: 6,
    }),
    column({
      id: 'price',
      title: 'Price',
      value: (r: Sale) => r.price,
      align: 'right',
      parse: (t) => Number(t),
      set: (r, v) => {
        r.price = v;
      },
      width: 8,
    }),
  ],
  footer: {
    aggregates: {
      region: { fn: 'count', label: 'rows:' },
      qty: { fn: 'sum', label: 'Σ' },
      price: { fn: 'avg', label: 'avg', format: (v) => `$${v.toFixed(0)}` },
    },
  },
});
