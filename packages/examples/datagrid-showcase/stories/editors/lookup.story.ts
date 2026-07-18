/**
 * Cell editors · Lookup — a value-help `ComboBox` editor (kind: "lookup") opened with **F4**. The cell
 * stores the item **key**; the dropdown shows the human-readable **label**. The `.js` extension in
 * import specifiers is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildEditorStory } from './editor-demo.js';

interface Row {
  id: number;
  customerId: string;
}

const customers = [
  { key: '7', label: 'Ada Lovelace' },
  { key: '9', label: 'Bo Peep' },
  { key: '11', label: 'Cy Young' },
];

export const editorLookupStory = buildEditorStory<Row>({
  slug: 'lookup',
  title: 'Lookup editor (F4)',
  blurb: 'A value-help ComboBox (kind: "lookup") — stores the key, shows the label; open it with F4.',
  hint: 'F4 (or F2/Enter) opens value help · arrows pick · Enter commits the key',
  rows: [
    { id: 1, customerId: '7' },
    { id: 2, customerId: '9' },
  ],
  columns: [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 3 }),
    column<Row, string>({
      id: 'customerId',
      title: 'Customer',
      value: (r) => r.customerId,
      parse: (t) => t,
      set: (r, v) => {
        r.customerId = v;
      },
      width: 12,
      editor: { kind: 'lookup', items: customers },
    }),
  ],
});
