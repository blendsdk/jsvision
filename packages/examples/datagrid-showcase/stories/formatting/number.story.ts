/**
 * Formatting · Number — `fmt.number` applies locale grouping and fraction-digit control; the value
 * column stays raw for contrast. The `.js` extension is required by NodeNext ESM resolution.
 */
import { column, fmt } from '@jsvision/datagrid';
import { buildFormatStory } from './format-demo.js';

interface Row {
  id: number;
  n: number;
}

export const fmtNumberStory = buildFormatStory<Row>({
  slug: 'number',
  title: 'Number',
  blurb: 'fmt.number — locale grouping and fraction digits; the value column stays raw for contrast.',
  rows: [
    { id: 1, n: 1234567.5 },
    { id: 2, n: 42 },
    { id: 3, n: -9.995 },
  ],
  columns: [
    column<Row, number>({ id: 'raw', title: 'value', value: (r) => r.n, align: 'right', width: 12 }),
    column<Row, number>({
      id: 'num',
      title: 'fmt.number',
      value: (r) => r.n,
      align: 'right',
      width: 16,
      ...fmt.number({ locale: 'en-US', maximumFractionDigits: 2 }),
    }),
  ],
});
