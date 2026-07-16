/**
 * Filtering · Number & date conditions — these columns opt into an always-visible funnel `▽`
 * (`showFunnel: true`); click it (or focus any filterable cell and press `Alt+Down`, which works with or
 * without a visible funnel) to open the condition popup, whose operators adapt to the column type:
 * number columns get gt / lt / eq / between; date columns get before / after / on / between. By default
 * a funnel appears only once a column is filtered. A quick-filter row is live too. The echo shows the
 * active filter. The `.js` extension is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildFilterStory } from './filter-demo.js';

interface Row {
  id: number;
  qty: number;
  closed: Date | null;
}

const DATA: Row[] = [
  { id: 1, qty: 1000, closed: new Date(2026, 0, 15) },
  { id: 2, qty: 9, closed: null },
  { id: 3, qty: 50, closed: new Date(2025, 11, 1) },
  { id: 4, qty: 300, closed: new Date(2026, 1, 20) },
  { id: 5, qty: 120, closed: new Date(2026, 2, 3) },
];

export const filteringConditionNumDateStory = buildFilterStory<Row>({
  slug: 'condition-num-date',
  title: 'Number & date conditions',
  blurb:
    'The funnel popup adapts operators to the column type — number gt/lt/eq/between, date before/after/on/between.',
  hint: "Click a column's ▽ (or focus any cell + Alt+Down) for type-aware operators — number on Qty, date on Closed; or use the quick-filter row",
  echo: 'model',
  quickFilter: true,
  rows: DATA,
  columns: [
    column<Row, number>({ id: 'qty', title: 'Qty', value: (r) => r.qty, align: 'right', width: 8, showFunnel: true }),
    column<Row, Date | null>({
      id: 'closed',
      title: 'Closed',
      value: (r) => r.closed,
      format: (v) => (v ? v.toISOString().slice(0, 10) : '—'),
      width: 12,
      showFunnel: true,
    }),
  ],
});
