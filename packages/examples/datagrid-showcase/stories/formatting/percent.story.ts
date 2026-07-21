/**
 * Formatting · Percent — `fmt.percent` displays a 0..1 ratio as a locale percentage (0.25 → "25%").
 * The `.js` extension is required by NodeNext ESM resolution.
 */
import { column, fmt } from '@jsvision/datagrid';
import { buildFormatStory } from './format-demo.js';

interface Row {
  id: number;
  ratio: number;
}

export const fmtPercentStory = buildFormatStory<Row>({
  slug: 'percent',
  title: 'Percent',
  blurb: 'fmt.percent — a 0..1 ratio shown as a locale percentage (0.25 → "25%").',
  rows: [
    { id: 1, ratio: 0.32 },
    { id: 2, ratio: 0.185 },
    { id: 3, ratio: 1.2 },
  ],
  columns: [
    column<Row, number>({ id: 'raw', title: 'value', value: (r) => r.ratio, align: 'right', width: 10 }),
    column<Row, number>({
      id: 'pct',
      title: 'fmt.percent',
      value: (r) => r.ratio,
      align: 'right',
      width: 14,
      ...fmt.percent({ locale: 'en-US', maximumFractionDigits: 1 }),
    }),
  ],
});
