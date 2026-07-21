/**
 * Sorting · Single column — click a header to sort by it; clicking the same header again cycles
 * asc → desc → none (tri-state). The `.js` extension is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildSortStory } from './sort-demo.js';

interface Row {
  id: number;
  name: string;
  age: number;
}

export const sortingSingleStory = buildSortStory<Row>({
  slug: 'single',
  title: 'Single-column sort',
  blurb: 'Click a header to sort; click it again to cycle asc → desc → none (tri-state).',
  hint: 'Click a header to sort · click the same header again cycles asc → desc → none',
  rows: [
    { id: 1, name: 'Carol', age: 42 },
    { id: 2, name: 'Alice', age: 30 },
    { id: 3, name: 'Bob', age: 25 },
    { id: 4, name: 'Dave', age: 28 },
  ],
  columns: [
    column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 }),
    column<Row, number>({ id: 'age', title: 'Age', value: (r) => r.age, align: 'right', width: 6 }),
  ],
});
