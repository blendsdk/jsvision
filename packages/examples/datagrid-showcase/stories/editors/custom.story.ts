/**
 * Cell editors · Custom — a caller-supplied editor via the `create` factory (kind: "custom"). Here the
 * factory mounts a letters-only `Input` bound to the cell field, honoring the same Enter=commit /
 * Esc=cancel lifecycle as the built-in editors. The `.js` extension is required by NodeNext ESM.
 */
import { Input, filter } from '@jsvision/ui';
import { column } from '@jsvision/datagrid';
import { buildEditorStory } from './editor-demo.js';

interface Row {
  id: number;
  tag: string;
}

export const editorCustomStory = buildEditorStory<Row>({
  slug: 'custom',
  title: 'Custom editor',
  blurb: 'A caller-supplied editor via create() — here a letters-only Input bound to the cell field.',
  hint: 'F2 / Enter opens the custom editor (letters only) · Enter commits',
  rows: [
    { id: 1, tag: 'Alpha' },
    { id: 2, tag: 'Bravo' },
  ],
  columns: [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 3 }),
    column<Row, string>({
      id: 'tag',
      title: 'Tag',
      value: (r) => r.tag,
      parse: (t) => t,
      set: (r, v) => {
        r.tag = v;
      },
      width: 14,
      editor: { kind: 'custom', create: (field) => new Input({ value: field, validator: filter('A-Za-z ') }) },
    }),
  ],
});
