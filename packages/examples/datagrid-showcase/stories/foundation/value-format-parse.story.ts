/**
 * Foundation · value / format / parse — the three roles a typed column separates. `value(row)` is the
 * sort/filter key (here a raw number), `format(value)` is the display string (currency), and `parse`
 * round-trips an edit back to the number. The same underlying `unitPrice` is shown both raw and
 * formatted so the split is visible at a glance; edit the formatted column and `parse` converts it back.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { column, fromRows, fmt, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';
import { sales } from '../lib/data.js';
import type { Sale } from '../lib/data.js';

export const valueFormatParseStory: Story = {
  id: 'datagrid/foundation/value-format-parse',
  category: 'Foundation',
  title: 'value / format / parse',
  rd: 'RD-01',
  blurb:
    'One number, three roles: value is the sort/filter key, format(value) is the display, parse round-trips an edit.',
  build(ctx) {
    const rows = sales();
    const columns = [
      column<Sale, string>({ id: 'product', title: 'Product', value: (r) => r.product, width: 10 }),
      // The same number shown two ways: raw (String(value)) and formatted (fmt.currency + inverse parse).
      column<Sale, number>({ id: 'raw', title: 'value', value: (r) => r.unitPrice, align: 'right', width: 8 }),
      column<Sale, number>({
        id: 'price',
        title: 'format(value)',
        value: (r) => r.unitPrice,
        align: 'right',
        width: 14,
        ...fmt.currency({ locale: 'en-US', currency: 'USD' }),
        set: (r, v) => {
          r.unitPrice = v;
        },
      }),
    ];
    const grid = new EditableDataGrid<Sale>({ columns, source: fromRows(rows, { rowKey: (r) => r.id }), zebra: true });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 1);
    root.add(
      at(
        new Text('value sorts numerically · format(value) shows currency · edit it and parse converts back'),
        0,
        0,
        ctx.width,
        1,
      ),
    );
    root.add(at(grid, 0, 1, ctx.width, gridH));
    return root;
  },
};
