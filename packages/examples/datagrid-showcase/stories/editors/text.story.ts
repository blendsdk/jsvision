/**
 * Cell editors · Text — the default editor for an editable column: a single-line text `Input`.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildEditorStory } from './editor-demo.js';

interface Row {
  id: number;
  name: string;
}

export const editorTextStory = buildEditorStory<Row>({
  slug: 'text',
  title: 'Text editor',
  blurb: 'The default editor for an editable column — a single-line text input (kind: "text").',
  rows: [
    { id: 1, name: 'Ada Lovelace' },
    { id: 2, name: 'Bo Peep' },
  ],
  columns: [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 3 }),
    column<Row, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 18,
      editor: { kind: 'text' },
    }),
  ],
});
