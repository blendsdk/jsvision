/**
 * Formatting · Parse round-trip — a `fmt.currency` column ships a matched inverse `parse`, so an edit
 * round-trips text → value; a non-numeric entry returns the `PARSE_FAILED` sentinel, which the commit
 * path rejects (the record is unchanged and the editor stays open). The `.js` extension is required by
 * NodeNext ESM resolution.
 */
import { column, fmt } from '@jsvision/datagrid';
import { buildFormatStory } from './format-demo.js';

interface Row {
  id: number;
  amount: number;
}

export const fmtParseRoundtripStory = buildFormatStory<Row>({
  slug: 'parse-roundtrip',
  title: 'Parse round-trip',
  blurb: 'A currency column round-trips edits via its inverse parse; a non-numeric entry is rejected (PARSE_FAILED).',
  hint: 'Edit Amount — a valid number round-trips; garbage is rejected and the editor stays open',
  rows: [
    { id: 1, amount: 1000 },
    { id: 2, amount: 42.5 },
  ],
  columns: [
    column<Row, number>({
      id: 'amount',
      title: 'Amount',
      value: (r) => r.amount,
      align: 'right',
      width: 16,
      ...fmt.currency({ locale: 'en-US', currency: 'USD' }),
      set: (r, v) => {
        r.amount = v;
      },
    }),
  ],
});
