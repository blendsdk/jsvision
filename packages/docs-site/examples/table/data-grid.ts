/**
 * A sortable, multi-column data table over typed rows. Columns mix sizing modes
 * (an auto-width Name capped at 16, fixed Age/Role, a 1fr City), the Age column
 * sorts numerically when its header is clicked (asc/desc with a ▲/▼ indicator),
 * rows zebra-stripe under a sticky header, and the whole grid scrolls horizontally
 * when the columns overflow. Arrows / PgUp / PgDn / Home / End move focus.
 */
import { Group, DataGrid, Text, signal, View } from '@jsvision/ui';
import type { Column, SortState } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
// #region example

interface Person {
  readonly name: string;
  readonly age: number;
  readonly role: string;
  readonly city: string;
}

const PEOPLE: Person[] = [
  { name: 'Alice Johnson', age: 30, role: 'Engineer', city: 'New York' },
  { name: 'Bob Smith', age: 25, role: 'Designer', city: 'Los Angeles' },
  { name: 'Carol White', age: 42, role: 'Manager', city: 'San Francisco' },
  { name: 'Dave Brown', age: 28, role: 'Engineer', city: 'Seattle' },
  { name: 'Eve Davis', age: 35, role: 'Analyst', city: 'Chicago' },
  { name: 'Frank Miller', age: 51, role: 'Director', city: 'Boston' },
  { name: 'Grace Lee', age: 23, role: 'Intern', city: 'Austin' },
  { name: 'Heidi Clark', age: 39, role: 'Engineer', city: 'Denver' },
  { name: 'Ivan Petrov', age: 46, role: 'Architect', city: 'Portland' },
  { name: 'Judy Nguyen', age: 33, role: 'Designer', city: 'Miami' },
  { name: 'Karl Weber', age: 29, role: 'Engineer', city: 'Dallas' },
  { name: 'Lena Ortiz', age: 37, role: 'Manager', city: 'Phoenix' },
];

/** Absolutely place a view within the example's box. */
function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V {
  view.layout = { position: 'absolute', rect: { x, y, width, height } };
  return view;
}

export default defineExample({
  title: 'Data grid',
  blurb: 'A sortable multi-column table: click a header to sort (▲/▼), zebra striping, sticky header, H-scroll.',
  build: (ctx) => {
    const rows = signal([...PEOPLE]);
    const focused = signal(0);
    const selected = signal(-1);
    const sort = signal<SortState>(null);

    const columns: Column<Person>[] = [
      { title: 'Name', accessor: (p) => p.name, width: 'auto', maxWidth: 16 },
      { title: 'Age', accessor: (p) => String(p.age), width: 5, align: 'right', compare: (a, b) => a.age - b.age },
      { title: 'Role', accessor: (p) => p.role, width: 11 },
      { title: 'City', accessor: (p) => p.city, width: '1fr' },
    ];
    const grid = new DataGrid<Person>({ rows, columns, focused, selected, sort, zebra: true, command: 'personChosen' });

    const group = at(new Group(), 0, 0, ctx.width, ctx.height - 2);
    group.add(at(grid, 1, 0, ctx.width - 2, ctx.height - 4));
    group.add(
      at(
        new Text(() => {
          const state = sort();
          const sortLabel = state ? `${columns[state.col]?.title ?? state.col} ${state.dir}` : 'none';
          return `Row ${focused() + 1} of ${PEOPLE.length}  ·  sort: ${sortLabel}`;
        }),
        1,
        ctx.height - 3,
        ctx.width - 2,
        1,
      ),
    );
    return group;
  },
});
// #endregion example
