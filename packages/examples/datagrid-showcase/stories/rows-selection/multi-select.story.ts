/**
 * Rows & selection · Multi-select — `Space` / `Ctrl`+click toggle a row, `Shift`+↑↓ / `Shift`+click
 * extend a range. Selection is a `ReadonlySet` keyed by `rowKey`, so it survives a re-sort/re-filter with
 * no reconcile — the live echo mirrors `selectedKeys()`. The `.js` extension is required by NodeNext ESM.
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
  { id: 6, name: 'Fe', dept: 'Sales' },
];

export const selectionMultiStory = buildSelectionStory<Emp>({
  slug: 'multi-select',
  title: 'Multi-row selection',
  blurb: 'Space / Ctrl+click toggle a row, Shift extends a range; selection is keyed by row, so it survives a sort.',
  hint: '↑↓ move · Space toggle · Shift+↑↓ range · click Name header to sort — selection follows the rows',
  rows: ROWS,
  columns: [
    column<Emp, number>({ id: 'id', title: 'ID', value: (r) => r.id, align: 'right', width: 4 }),
    column<Emp, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 10 }),
    column<Emp, string>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 8 }),
  ],
  options: { selectionMode: 'multi' },
  echo: (grid) => () => {
    const keys = [...grid.selectedKeys()].map(Number).sort((a, b) => a - b);
    return keys.length > 0
      ? `selectedKeys(): { ${keys.join(', ')} }  (${keys.length} of ${ROWS.length})`
      : 'selectedKeys(): { } — Space / Ctrl+click to toggle, Shift to extend';
  },
  // Seed a couple of rows so the highlight + echo read as live on first paint.
  setup: (grid) => {
    grid.selectRow(2);
    grid.toggleRow(4);
  },
});
