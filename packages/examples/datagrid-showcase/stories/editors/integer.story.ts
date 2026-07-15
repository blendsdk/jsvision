/**
 * Cell editors · Integer — a digits-only input (kind: "integer"); parse rejects a non-integer edit.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { column, PARSE_FAILED } from '@jsvision/datagrid';
import { buildEditorStory } from './editor-demo.js';

interface Row {
  id: number;
  qty: number;
}

export const editorIntegerStory = buildEditorStory<Row>({
  slug: 'integer',
  title: 'Integer editor',
  blurb: 'A digits-only input (kind: "integer") — a non-integer edit is rejected by parse.',
  hint: 'F2 / type digits · non-digits are filtered out · Enter commits',
  rows: [
    { id: 1, qty: 12 },
    { id: 2, qty: 340 },
  ],
  columns: [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 3 }),
    column<Row, number>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      align: 'right',
      width: 8,
      parse: (t) => {
        const n = Number(t);
        return Number.isInteger(n) ? n : PARSE_FAILED;
      },
      set: (r, v) => {
        r.qty = v;
      },
      editor: { kind: 'integer' },
    }),
  ],
});
