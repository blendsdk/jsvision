/**
 * Filtering · Text conditions — these columns opt into an always-visible funnel `▽` (`showFunnel: true`)
 * so the affordance is visible up front; click it (or focus any filterable cell and press `Alt+Down`,
 * which works whether or not a funnel is shown) to open the condition popup with text operators
 * (contains / starts with / ends with / equals). By default a column's funnel appears only once it has
 * an active filter. A quick-filter row is live too. The echo shows the active filter. The `.js`
 * extension is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildFilterStory } from './filter-demo.js';

interface Row {
  id: number;
  product: string;
  region: string;
}

const DATA: Row[] = [
  { id: 1, product: 'Widget', region: 'EMEA' },
  { id: 2, product: 'Gadget', region: 'APAC' },
  { id: 3, product: 'Sprocket', region: 'AMER' },
  { id: 4, product: 'Widget', region: 'APAC' },
  { id: 5, product: 'Gizmo', region: 'EMEA' },
];

export const filteringConditionTextStory = buildFilterStory<Row>({
  slug: 'condition-text',
  title: 'Text conditions',
  blurb: 'Open a text column funnel ▽ for condition operators: contains, starts with, ends with, equals.',
  hint: 'These columns show a ▽ (showFunnel) — click it, or focus any cell + Alt+Down, for text conditions; or type in the quick-filter row',
  echo: 'model',
  quickFilter: true,
  rows: DATA,
  columns: [
    column<Row, string>({ id: 'product', title: 'Product', value: (r) => r.product, width: 12, showFunnel: true }),
    column<Row, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10, showFunnel: true }),
  ],
});
