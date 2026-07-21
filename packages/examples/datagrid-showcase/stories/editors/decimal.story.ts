/**
 * Cell editors · Decimal — a numeric input allowing a decimal point (kind: "decimal"); parse rejects a
 * non-numeric edit. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { column, PARSE_FAILED } from '@jsvision/datagrid';
import { buildEditorStory } from './editor-demo.js';

interface Row {
  id: number;
  price: number;
}

export const editorDecimalStory = buildEditorStory<Row>({
  slug: 'decimal',
  title: 'Decimal editor',
  blurb: 'A numeric input allowing a decimal point (kind: "decimal") — a non-numeric edit is rejected.',
  hint: 'F2 / type a number · non-numeric input is filtered out · Enter commits',
  rows: [
    { id: 1, price: 9.99 },
    { id: 2, price: 14.5 },
  ],
  columns: [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 3 }),
    column<Row, number>({
      id: 'price',
      title: 'Price',
      value: (r) => r.price,
      align: 'right',
      width: 8,
      parse: (t) => {
        const n = Number(t);
        return Number.isFinite(n) ? n : PARSE_FAILED;
      },
      set: (r, v) => {
        r.price = v;
      },
      editor: { kind: 'decimal' },
    }),
  ],
});
