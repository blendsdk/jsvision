/**
 * Sorting · Collation — string columns sort with a case-insensitive collator, so `apple` and `Banana`
 * order together rather than ASCII-ordered (which would place every capital before every lowercase).
 * The `.js` extension is required by NodeNext ESM resolution.
 */
import { column } from '@jsvision/datagrid';
import { buildSortStory } from './sort-demo.js';

interface Row {
  id: number;
  fruit: string;
}

export const sortingCollatorStory = buildSortStory<Row>({
  slug: 'collator',
  title: 'Case-insensitive collation',
  blurb: 'String sort uses a case-insensitive collator — apple, Banana, cherry, Date sort naturally.',
  hint: 'Sort Fruit ascending → apple, Banana, cherry, Date (not ASCII: capitals first)',
  rows: [
    { id: 1, fruit: 'cherry' },
    { id: 2, fruit: 'Banana' },
    { id: 3, fruit: 'Date' },
    { id: 4, fruit: 'apple' },
  ],
  columns: [column<Row, string>({ id: 'fruit', title: 'Fruit', value: (r) => r.fruit, width: 14 })],
});
