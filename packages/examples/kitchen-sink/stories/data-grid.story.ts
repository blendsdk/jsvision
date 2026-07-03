/**
 * Story: `DataGrid` (RD-16) — a multi-column table over typed `Person` rows.
 *
 * Mixed column sizing (`auto` Name capped at 16, fixed Age/Role, `1fr` City), a sortable numeric Age
 * column (click the header → asc/desc with a ▲/▼ indicator), zebra striping, and a sticky header. A
 * live echo shows the focused + selected rows and the active sort. ↑↓/PgUp/PgDn/Home/End move focus,
 * Enter/Space selects (emits `personChosen`), ←/→ horizontally scrolls when the columns overflow.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, DataGrid, Text, signal } from '@jsvision/ui';
import type { Column, SortState } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

interface Person {
  readonly name: string;
  readonly age: number;
  readonly role: string;
  readonly city: string;
}

/** ~18 people — enough to overflow a short viewport so virtualization + the scroll bar show. */
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
  { name: 'Mona Farah', age: 26, role: 'Analyst', city: 'Atlanta' },
  { name: 'Nate Cole', age: 44, role: 'Engineer', city: 'Houston' },
  { name: 'Olga Ivanova', age: 31, role: 'Designer', city: 'San Diego' },
  { name: 'Paul Adams', age: 55, role: 'Director', city: 'Detroit' },
  { name: 'Quinn Ray', age: 24, role: 'Intern', city: 'Nashville' },
  { name: 'Rosa Marin', age: 40, role: 'Architect', city: 'Orlando' },
];

export const dataGridStory: Story = {
  id: 'data-grid',
  category: 'Containers',
  title: 'DataGrid',
  rd: 'RD-16',
  blurb: 'Multi-column table: sticky header · click a header to sort (▲/▼) · fixed/fr/auto widths · H-scroll · zebra.',
  build(ctx: StoryContext) {
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

    const g = new Group();
    const gridW = Math.max(30, Math.floor(ctx.width * 0.62));
    const gridH = Math.max(8, ctx.height - 3);
    g.add(at(grid, 1, 1, gridW, gridH));

    const echoX = gridW + 3;
    const echoW = Math.max(12, ctx.width - echoX - 1);
    g.add(
      at(
        new Text(() => {
          const f = focused();
          return `focused: #${f} = ${PEOPLE[f]?.name ?? '—'}`;
        }),
        echoX,
        1,
        echoW,
        1,
      ),
    );
    g.add(
      at(
        new Text(() => {
          const s = selected();
          return `selected: ${s < 0 ? '(none)' : `#${s} = ${PEOPLE[s]?.name ?? '—'}`}`;
        }),
        echoX,
        3,
        echoW,
        1,
      ),
    );
    g.add(
      at(
        new Text(() => {
          const s = sort();
          return `sort: ${s === null ? '(none)' : `col ${s.col} ${s.dir}`}`;
        }),
        echoX,
        5,
        echoW,
        1,
      ),
    );
    g.add(at(new Text('Click the Age header to sort.'), echoX, 7, echoW, 2));
    return g;
  },
};
