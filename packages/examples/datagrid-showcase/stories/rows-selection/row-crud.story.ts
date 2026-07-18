/**
 * Rows & selection · Row CRUD — insert / duplicate / delete routed through the data-source mutation seam.
 * Insert appends a fresh-key row; Duplicate clones the first selected row with a fresh key from
 * `assignKey`; Delete removes the selected rows and de-selects them (the seam is the only persistence
 * path). The `.js` extension is required by NodeNext ESM resolution.
 */
import { Button, Group } from '@jsvision/ui';
import { column } from '@jsvision/datagrid';
import { at } from '../../story.js';
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
];

// A monotonic key minter — the caller owns key generation (the grid never mints keys). Module-level so
// re-showing the demo keeps minting unique ids across rebuilds.
let nextId = 100;

export const selectionCrudStory = buildSelectionStory<Emp>({
  slug: 'row-crud',
  title: 'Row CRUD',
  blurb: 'Insert, duplicate, and delete rows through the mutation seam; a delete de-selects the removed rows.',
  hint: 'Insert appends · Duplicate clones the first selected row · Delete removes the selected rows',
  rows: ROWS,
  columns: [
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4 }),
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
    column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  ],
  options: { checkboxColumn: true, assignKey: (clone) => ({ ...clone, id: nextId++ }) },
  control: (grid) => {
    const band = new Group();
    band.add(
      at(
        new Button('~I~nsert', { onClick: () => grid.insertRow({ id: nextId++, name: 'New', dept: 'Eng' }) }),
        0,
        0,
        11,
        2,
      ),
    );
    band.add(
      at(
        new Button('~D~uplicate', {
          onClick: () => {
            const first = [...grid.selectedKeys()][0];
            if (first !== undefined) grid.duplicateRow(first);
          },
        }),
        12,
        0,
        14,
        2,
      ),
    );
    band.add(at(new Button('De~l~ete', { onClick: () => grid.deleteRows([...grid.selectedKeys()]) }), 27, 0, 11, 2));
    return band;
  },
  echo: (grid, rows) => () =>
    `rows: ${rows().length} · selected: ${grid.selectedKeys().size} (check rows, then Duplicate/Delete)`,
});
