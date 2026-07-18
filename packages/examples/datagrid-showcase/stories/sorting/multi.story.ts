/**
 * Sorting · Multi-column — Ctrl+click a second header to add a secondary key; each sorted header shows
 * a priority digit. Ctrl+click cycles a key asc → desc → removed in place. The `.js` extension is
 * required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildSortStory } from './sort-demo.js';

interface Row {
  id: number;
  role: string;
  name: string;
  age: number;
}

export const sortingMultiStory = buildSortStory<Row>({
  slug: 'multi',
  title: 'Multi-column sort',
  blurb: 'Ctrl+click a second header to add a secondary key; priority digits show the key order.',
  hint: 'Click Role, then Ctrl+click Age → sort by Role, then Age (priority digits shown)',
  rows: [
    { id: 1, role: 'Engineer', name: 'Alice', age: 30 },
    { id: 2, role: 'Engineer', name: 'Dave', age: 28 },
    { id: 3, role: 'Designer', name: 'Bob', age: 25 },
    { id: 4, role: 'Designer', name: 'Judy', age: 33 },
    { id: 5, role: 'Engineer', name: 'Heidi', age: 39 },
  ],
  columns: [
    column<Row, string>({ id: 'role', title: 'Role', value: (r) => r.role, width: 10 }),
    column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
    column<Row, number>({ id: 'age', title: 'Age', value: (r) => r.age, align: 'right', width: 6 }),
  ],
});
