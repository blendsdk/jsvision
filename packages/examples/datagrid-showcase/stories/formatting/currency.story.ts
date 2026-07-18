/**
 * Formatting · Currency — `fmt.currency` renders the same amount in two locales/currencies (nl-NL EUR
 * and en-US USD), each with its own group/decimal symbols. The `.js` extension is required by NodeNext ESM.
 */
import { column, fmt } from '@jsvision/datagrid';
import { buildFormatStory } from './format-demo.js';

interface Row {
  id: number;
  n: number;
}

export const fmtCurrencyStory = buildFormatStory<Row>({
  slug: 'currency',
  title: 'Currency',
  blurb: 'fmt.currency — the same amount as nl-NL EUR and en-US USD, each with its own locale symbols.',
  rows: [
    { id: 1, n: 10000.25 },
    { id: 2, n: -250.5 },
    { id: 3, n: 9.99 },
  ],
  columns: [
    column<Row, number>({ id: 'raw', title: 'value', value: (r) => r.n, align: 'right', width: 10 }),
    column<Row, number>({
      id: 'eur',
      title: 'EUR (nl-NL)',
      value: (r) => r.n,
      align: 'right',
      width: 14,
      ...fmt.currency({ locale: 'nl-NL', currency: 'EUR' }),
    }),
    column<Row, number>({
      id: 'usd',
      title: 'USD (en-US)',
      value: (r) => r.n,
      align: 'right',
      width: 14,
      ...fmt.currency({ locale: 'en-US', currency: 'USD' }),
    }),
  ],
});
