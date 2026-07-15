/**
 * Columns & layout · Show / hide — a button toggles the 'dept' column's visibility through the layout
 * API (`setColumnVisible`); a hidden column drops out of `columnOrder()` but keeps its sort/filter state
 * and reappears in its slot when shown. The live echo mirrors the visible order. The `.js` extension is
 * required by NodeNext ESM resolution.
 */
import { Button } from '@jsvision/ui';
import { column } from '@jsvision/datagrid';
import { buildLayoutStory } from './layout-demo.js';

interface Emp {
  id: number;
  name: string;
  city: string;
  dept: string;
}

const ROWS: Emp[] = [
  { id: 1, name: 'Ada', city: 'London', dept: 'R&D' },
  { id: 2, name: 'Bo', city: 'LA', dept: 'Sales' },
  { id: 3, name: 'Cyrus', city: 'San Francisco', dept: 'Operations' },
  { id: 4, name: 'Dita', city: 'Berlin', dept: 'R&D' },
];

export const layoutShowHideStory = buildLayoutStory<Emp>({
  slug: 'show-hide',
  title: 'Show / hide columns',
  blurb: "Toggle a column's visibility; a hidden column keeps its sort/filter state and its slot.",
  hint: "Click 'Toggle Dept' (or press D) to hide/show the Dept column — watch the order echo",
  rows: ROWS,
  columns: [
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4 }),
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
    column<Emp, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 14 }),
    column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 12 }),
  ],
  echo: (grid) => () => `visible order: ${grid.columnOrder().join(' → ')}`,
  control: (grid) => {
    // Track visibility locally; the echo above reflects the resulting order.
    let hidden = false;
    return new Button('Toggle ~D~ept', {
      onClick: () => {
        hidden = !hidden;
        grid.setColumnVisible('dept', !hidden);
      },
    });
  },
});
