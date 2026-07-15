/**
 * Cell editors · Boolean — a checkbox editor (kind: "boolean"). The column formats the value to the
 * canonical `'true'`/`'false'` strings the boolean bridge expects, and parse converts back.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildEditorStory } from './editor-demo.js';

interface Row {
  id: number;
  active: boolean;
}

export const editorBooleanStory = buildEditorStory<Row>({
  slug: 'boolean',
  title: 'Boolean editor',
  blurb: 'A checkbox editor (kind: "boolean") over a canonical true/false string field.',
  hint: 'F2 / Enter opens the checkbox · Space toggles · Enter commits',
  rows: [
    { id: 1, active: true },
    { id: 2, active: false },
  ],
  columns: [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 3 }),
    column<Row, boolean>({
      id: 'active',
      title: 'Active',
      value: (r) => r.active,
      format: (v) => (v ? 'true' : 'false'),
      parse: (t) => t === 'true',
      set: (r, v) => {
        r.active = v;
      },
      width: 8,
      editor: { kind: 'boolean' },
    }),
  ],
});
