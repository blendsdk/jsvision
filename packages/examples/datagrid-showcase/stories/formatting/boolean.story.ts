/**
 * Formatting · Boolean — `fmt.boolean` maps a boolean to a label pair (default Yes/No, or custom).
 * The `.js` extension is required by NodeNext ESM resolution.
 */
import { column, fmt } from '@jsvision/datagrid';
import { buildFormatStory } from './format-demo.js';

interface Row {
  id: number;
  flag: boolean;
}

export const fmtBooleanStory = buildFormatStory<Row>({
  slug: 'boolean',
  title: 'Boolean',
  blurb: 'fmt.boolean — a boolean shown as a label pair (default Yes/No, or a custom pair like ✓/✗).',
  rows: [
    { id: 1, flag: true },
    { id: 2, flag: false },
  ],
  columns: [
    column<Row, boolean>({ id: 'raw', title: 'value', value: (r) => r.flag, width: 7 }),
    column<Row, boolean>({ id: 'yesno', title: 'Yes/No', value: (r) => r.flag, width: 8, ...fmt.boolean() }),
    column<Row, boolean>({
      id: 'ticks',
      title: 'Ticks',
      value: (r) => r.flag,
      width: 7,
      ...fmt.boolean({ true: '✓', false: '✗' }),
    }),
  ],
});
