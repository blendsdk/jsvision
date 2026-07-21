/**
 * Double-click-to-edit — a single click focuses the clicked cell (row and column); a double-click on an
 * editable cell begins the edit. It reuses the framework's synthesized `ev.clickCount` (a 500 ms window),
 * so there is no bespoke timer; a double-click on a read-only cell keeps the base row-activate.
 */
import { column } from '@jsvision/datagrid';
import { buildNavStory } from './nav-demo.js';

interface Item {
  id: number;
  sku: string;
  name: string;
  note: string;
}
const ROWS: Item[] = [
  { id: 1, sku: 'A-1', name: 'Widget', note: 'editable' },
  { id: 2, sku: 'B-2', name: 'Gadget', note: 'editable' },
  { id: 3, sku: 'C-3', name: 'Gizmo', note: 'editable' },
];
const editable = (id: 'name' | 'note', title: string, width: number) =>
  column<Item, string>({
    id,
    title,
    value: (r) => r[id],
    parse: (t) => t,
    set: (r, v) => {
      r[id] = v;
    },
    width,
  });

export const navDoubleClickStory = buildNavStory<Item>({
  slug: 'double-click',
  title: 'Double-click-to-edit',
  blurb: 'Single click focuses a cell; double-click an editable cell to edit — reuses ev.clickCount, no timer.',
  hint: 'Click a Name/Note cell to focus it, then double-click it to edit. SKU is read-only (dbl-click activates).',
  rows: ROWS,
  columns: [
    column({ id: 'sku', title: 'SKU', value: (r: Item) => r.sku, width: 6 }), // read-only
    editable('name', 'Name', 10),
    editable('note', 'Note', 12),
  ],
});
