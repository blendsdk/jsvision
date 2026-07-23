/**
 * Rows & selection · Checkbox column — the opt-in `checkboxColumn`: a per-row `[ ]`/`[x]` box in the
 * left-pinned region plus a tri-state header box (`[ ]` none / `[-]` some / `[x]` all) that selects or
 * clears every DISPLAYED row (a filtered-out row is never swept in). The `.js` extension is required by
 * NodeNext ESM resolution.
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

export const selectionCheckboxStory = buildSelectionStory<Emp>({
  slug: 'checkbox-column',
  title: 'Checkbox column',
  blurb: 'A per-row [ ]/[x] box with a tri-state header that selects or clears every displayed row.',
  hint: 'Click a row [ ] to toggle · click the header [ ] to select/clear all displayed rows',
  rows: ROWS,
  columns: [
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4 }),
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
    column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  ],
  options: { checkboxColumn: true },
  echo: (grid) => () => {
    const n = grid.selectedKeys().size;
    return n === 0
      ? 'checked: none — the header box is [ ]'
      : n === ROWS.length
        ? `checked: all ${n} — the header box is [x]`
        : `checked: ${n} of ${ROWS.length} — the header box is [-]`;
  },
});
