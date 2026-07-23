/**
 * Rows & selection · Null policy — a `nullable` column with a `nullDisplay`. A null value renders the
 * placeholder (here `—`), distinct from an empty string (which renders blank) and from a real value; and
 * an editor that commits an empty value stores `null` (not `''`). The `.js` extension is required by
 * NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildSelectionStory } from './selection-demo.js';

interface Emp {
  id: number;
  name: string;
  dept: string | null;
}

const ROWS: Emp[] = [
  { id: 1, name: 'Ada', dept: 'Eng' }, // a real value → renders "Eng"
  { id: 2, name: 'Bo', dept: null }, // null → renders the nullDisplay "—"
  { id: 3, name: 'Cy', dept: '' }, // empty string → renders blank (distinct from null)
  { id: 4, name: 'Di', dept: 'Sales' },
];

export const selectionNullStory = buildSelectionStory<Emp>({
  slug: 'null-policy',
  title: 'Null policy',
  blurb: 'A nullable column renders nullDisplay for null (distinct from ""); an empty edit commits null.',
  hint: 'Edit a Dept cell (F2) and clear it → commits null → renders “—”; a non-empty edit round-trips the text',
  rows: ROWS,
  columns: [
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4 }),
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
    column<Emp, string | null>({
      id: 'dept',
      title: 'Dept',
      value: (r) => r.dept,
      parse: (t) => t,
      set: (r, v) => {
        r.dept = v;
      },
      nullable: true,
      nullDisplay: '—',
      width: 10,
    }),
  ],
  echo: () => () => 'Dept: null → “—” · "" → blank · a real value renders as-is — all three are visible in the column',
});
