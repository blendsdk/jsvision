/**
 * Cell editors · Enum — a select-only `ComboBox` editor (kind: "enum") over a fixed value set; picking
 * an option commits that string. The `.js` extension in import specifiers is required by NodeNext ESM.
 */
import { column } from '@jsvision/datagrid';
import { buildEditorStory } from './editor-demo.js';

interface Row {
  id: number;
  status: string;
}

export const editorEnumStory = buildEditorStory<Row>({
  slug: 'enum',
  title: 'Enum editor',
  blurb: 'A select-only ComboBox editor (kind: "enum") over a fixed value set.',
  hint: 'F2 / Enter opens the list · arrows pick a value · Enter commits',
  rows: [
    { id: 1, status: 'open' },
    { id: 2, status: 'paid' },
  ],
  columns: [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 3 }),
    column<Row, string>({
      id: 'status',
      title: 'Status',
      value: (r) => r.status,
      parse: (t) => t,
      set: (r, v) => {
        r.status = v;
      },
      width: 10,
      editor: { kind: 'enum', values: ['open', 'paid', 'shipped'] },
    }),
  ],
});
