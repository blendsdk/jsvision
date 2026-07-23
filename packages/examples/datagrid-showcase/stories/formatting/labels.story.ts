/**
 * Formatting · Labels — `fmt.enumLabel` maps a code to a display label via a record, and
 * `fmt.lookupLabel` maps a stored key to a label via a lookup-item list (an unknown key falls back to
 * the raw value). The `.js` extension is required by NodeNext ESM resolution.
 */
import { column, fmt } from '@jsvision/datagrid';
import { buildFormatStory } from './format-demo.js';

interface Row {
  id: number;
  status: string;
  custId: string;
}

export const fmtLabelsStory = buildFormatStory<Row>({
  slug: 'labels',
  title: 'Enum & lookup labels',
  blurb: 'fmt.enumLabel maps a code to a label; fmt.lookupLabel maps a stored key to a label.',
  rows: [
    { id: 1, status: 'open', custId: '7' },
    { id: 2, status: 'shipped', custId: '9' },
  ],
  columns: [
    column<Row, string>({ id: 'statusRaw', title: 'code', value: (r) => r.status, width: 9 }),
    column<Row, string>({
      id: 'status',
      title: 'enumLabel',
      value: (r) => r.status,
      width: 11,
      ...fmt.enumLabel({ open: 'Open', paid: 'Paid', shipped: 'Shipped' }),
    }),
    column<Row, string>({ id: 'custRaw', title: 'key', value: (r) => r.custId, align: 'right', width: 5 }),
    column<Row, string>({
      id: 'cust',
      title: 'lookupLabel',
      value: (r) => r.custId,
      width: 14,
      ...fmt.lookupLabel([
        { key: '7', label: 'Ada Lovelace' },
        { key: '9', label: 'Bo Peep' },
      ]),
    }),
  ],
});
