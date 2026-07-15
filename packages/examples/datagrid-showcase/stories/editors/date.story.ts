/**
 * Cell editors · Date — a `DatePicker` editor (kind: "date") over an ISO `YYYY-MM-DD` string field; the
 * date bridge parses and formats it. The `.js` extension in import specifiers is required by NodeNext ESM.
 */
import { column } from '@jsvision/datagrid';
import { buildEditorStory } from './editor-demo.js';

interface Row {
  id: number;
  due: string;
}

export const editorDateStory = buildEditorStory<Row>({
  slug: 'date',
  title: 'Date editor',
  blurb: 'A DatePicker editor (kind: "date") over an ISO YYYY-MM-DD string field.',
  hint: 'F2 / Enter opens the picker · arrows change the date · Enter commits',
  rows: [
    { id: 1, due: '2026-07-13' },
    { id: 2, due: '2026-08-01' },
  ],
  columns: [
    column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 3 }),
    column<Row, string>({
      id: 'due',
      title: 'Due',
      value: (r) => r.due,
      parse: (t) => t,
      set: (r, v) => {
        r.due = v;
      },
      width: 12,
      editor: { kind: 'date' },
    }),
  ],
});
