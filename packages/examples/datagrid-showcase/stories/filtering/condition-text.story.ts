/**
 * Filtering · Text conditions — click a text column's header funnel `▽` to open its condition popup
 * with text operators (contains / starts with / ends with / equals). The echo shows the active filter.
 * The `.js` extension is required by NodeNext ESM resolution.
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
  hint: 'Click the Product funnel ▽ → pick an operator (contains / starts with / …) and type a value',
  echo: 'model',
  rows: DATA,
  columns: [
    column<Row, string>({ id: 'product', title: 'Product', value: (r) => r.product, width: 12 }),
    column<Row, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 10 }),
  ],
});
