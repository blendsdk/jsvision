/**
 * Formatting · Render & cellStyle — the two cell-painting escape hatches. A value-driven `cellStyle`
 * paints a negative balance red (composited under the fixed cursor > dirty > selected > cellStyle >
 * zebra precedence), and a custom `render` draws a traffic-light glyph into a cell-local, cell-clipped,
 * draw-error-isolated context. The `.js` extension is required by NodeNext ESM resolution.
 */
import { column, fmt } from '@jsvision/datagrid';
import { buildFormatStory } from './format-demo.js';

interface Row {
  id: number;
  name: string;
  balance: number;
}

export const fmtRenderStyleStory = buildFormatStory<Row>({
  slug: 'render-style',
  title: 'Render & cellStyle',
  blurb: 'A value-driven cellStyle (red on a negative balance) and a custom render cell (a traffic-light glyph).',
  rows: [
    { id: 1, name: 'Ada', balance: 10000.25 },
    { id: 2, name: 'Bo', balance: -250.5 },
    { id: 3, name: 'Cy', balance: 4200 },
    { id: 4, name: 'Di', balance: -12.99 },
  ],
  columns: [
    column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
    column<Row, number>({
      id: 'balance',
      title: 'Balance',
      value: (r) => r.balance,
      align: 'right',
      width: 14,
      ...fmt.currency({ locale: 'nl-NL', currency: 'EUR' }),
      cellStyle: (v) => (v < 0 ? { fg: 'brightRed', bg: 'cyan' } : 'listNormal'),
    }),
    column<Row, number>({
      id: 'flag',
      title: '',
      width: 3,
      value: (r) => r.balance,
      render: (rc, cell) =>
        rc.text(0, 0, cell.value < 0 ? '●' : '○', { fg: cell.value < 0 ? 'brightRed' : 'brightGreen', bg: 'cyan' }),
    }),
  ],
});
