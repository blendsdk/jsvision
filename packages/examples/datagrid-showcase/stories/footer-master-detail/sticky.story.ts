/**
 * Sticky footer — a grid taller than its viewport. The footer band sits outside the body's scroll
 * window, so its running total stays pinned at the bottom while the rows scroll beneath it.
 */
import { column } from '@jsvision/datagrid';
import { buildFooterStory } from './footer-demo.js';

interface Row {
  id: number;
  label: string;
  amount: number;
}
const ROWS: Row[] = Array.from({ length: 20 }, (_x, i) => ({
  id: i + 1,
  label: `Item ${i + 1}`,
  amount: (i + 1) * 5,
}));

export const footerStickyStory = buildFooterStory<Row>({
  slug: 'sticky',
  title: 'Sticky footer',
  blurb: 'The footer stays pinned at the bottom while the body scrolls; the total is over ALL displayed rows.',
  hint: 'Scroll ↓ through the 20 rows — the Σ footer stays put and always shows the full total.',
  rows: ROWS,
  columns: [
    column({ id: 'id', title: 'ID', value: (r: Row) => r.id, align: 'right', width: 4 }),
    column({ id: 'label', title: 'Label', value: (r: Row) => r.label, width: 12 }),
    column({ id: 'amount', title: 'Amount', value: (r: Row) => r.amount, align: 'right', width: 8 }),
  ],
  footer: {
    aggregates: {
      id: { fn: 'count', label: 'rows:' },
      amount: { fn: 'sum', label: 'Σ' },
    },
  },
});
