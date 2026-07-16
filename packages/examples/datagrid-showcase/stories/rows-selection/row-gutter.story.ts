/**
 * Rows & selection · Row-number gutter — the opt-in `rowNumbers` gutter: 1-based, right-aligned display
 * numbers in the left-pinned region that renumber by DISPLAY position whenever the display re-derives
 * (after a sort/filter), so they track the row's position, not its `rowKey`. The `.js` extension is
 * required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildSelectionStory } from './selection-demo.js';

interface Emp {
  id: number;
  name: string;
  dept: string;
}

const ROWS: Emp[] = [
  { id: 1, name: 'Ada', dept: 'Eng' },
  { id: 2, name: 'Bo', dept: 'Ops' },
  { id: 3, name: 'Cy', dept: 'Eng' },
  { id: 4, name: 'Di', dept: 'Sales' },
  { id: 5, name: 'El', dept: 'Ops' },
];

export const selectionGutterStory = buildSelectionStory<Emp>({
  slug: 'row-gutter',
  title: 'Row-number gutter',
  blurb: '1-based, right-aligned display numbers that renumber by position after a sort — not by rowKey.',
  hint: 'Click the Name header to sort — the gutter stays 1..N by DISPLAY position (it renumbers, not follows rows)',
  rows: ROWS,
  columns: [
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
    column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4 }),
  ],
  options: { rowNumbers: true },
  echo: () => () => 'the gutter numbers rows 1..N by display position — independent of each row’s ID/rowKey',
});
