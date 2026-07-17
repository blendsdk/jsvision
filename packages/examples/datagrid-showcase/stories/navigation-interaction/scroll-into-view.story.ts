/**
 * Scroll-into-view — activating an off-screen row or column always brings it fully into view, and the
 * cursor is never rendered off-screen. Ctrl+End jumps to the last cell, Ctrl+Home to the first, PgUp/PgDn
 * page by a viewport; a live echo shows the focused row so you can watch the window follow the cursor.
 */
import { column } from '@jsvision/datagrid';
import { buildNavStory } from './nav-demo.js';

interface Row {
  id: number;
  label: string;
  value: number;
}
const ROWS: Row[] = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  label: `row-${i + 1}`,
  value: (i + 1) * 3,
}));

export const navScrollIntoViewStory = buildNavStory<Row>({
  slug: 'scroll-into-view',
  title: 'Scroll-into-view',
  blurb: 'Ctrl+End/Home, PgUp/PgDn and arrows keep the focused cell on-screen — 40 rows in a short viewport.',
  hint: 'Ctrl+End → last row · Ctrl+Home → first · PgUp/PgDn page · ↑↓ step — the window follows the cursor.',
  rows: ROWS,
  columns: [
    column({ id: 'label', title: 'Label', value: (r: Row) => r.label, width: 12 }),
    column({ id: 'value', title: 'Value', value: (r: Row) => r.value, align: 'right', width: 8 }),
  ],
  echo: (grid) => () => {
    const row = grid.focusedRow();
    return row ? `Focused: ${row.label} (value ${row.value})` : 'No focused row';
  },
});
