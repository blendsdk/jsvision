/**
 * Cell editors · Read-only — an otherwise-editable column (it has `parse`/`set`) made read-only with an
 * explicit `{ kind: 'readonly' }` editor: begin-edit is rejected even though the column can round-trip.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildEditorStory } from './editor-demo.js';

interface Row {
  id: number;
  code: string;
}

export const editorReadonlyStory = buildEditorStory<Row>({
  slug: 'readonly',
  title: 'Read-only editor',
  blurb: 'An otherwise-editable column made read-only with { kind: "readonly" } — begin-edit is rejected.',
  hint: 'The Code column has parse/set but { kind: "readonly" } → F2 / Enter do nothing',
  rows: [
    { id: 1, code: 'ABC-123' },
    { id: 2, code: 'XYZ-789' },
  ],
  columns: [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 3 }),
    column<Row, string>({
      id: 'code',
      title: 'Code',
      value: (r) => r.code,
      parse: (t) => t,
      set: (r, v) => {
        r.code = v;
      },
      width: 12,
      editor: { kind: 'readonly' },
    }),
  ],
});
