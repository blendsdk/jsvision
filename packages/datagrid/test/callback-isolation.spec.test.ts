/**
 * Specification tests (immutable oracles) — trusted-callback isolation (ST-6, ST-7). The on-screen
 * formatter (`column.ts` `toEngineColumn`) and the custom sort comparator (`sort.ts` `compareOneKey`)
 * are the two trusted callbacks a grid runs on every paint / sort. A throwing one must degrade its own
 * cell / fall back to the default order — never tear down the frame or the sort — matching the AC-7
 * draw-error isolation already guaranteed for the custom renderer and the export-path formatter.
 *
 *  - ST-6: a `format` that throws for one row renders that one cell as the value's `String()` form; the
 *    rest of the frame (other cells, other columns) still paints. Asserted on the painted buffer, not by
 *    catching an exception.
 *  - ST-7: a custom `compare` that throws does not crash — `sortRowsMulti` returns all rows in the
 *    type-aware default order, and a grid-level `sortBy` on the bad column renders without throwing.
 *
 * Expectations derive from the requirements, never the implementation. Spec-first: RED before the guards
 * at `column.ts` / `sort.ts` exist.
 */
import { test, expect } from 'vitest';
import { Group, createRenderRoot, createRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { sortRowsMulti } from '../src/sort.js';
import type { SortKey } from '../src/sort.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const W = 24;
const H = 6;

interface Row {
  qty: number;
  name: string;
}
const DATA: Row[] = [
  { qty: 1, name: 'Ann' },
  { qty: 2, name: 'Bea' }, // format throws on this row
  { qty: 3, name: 'Cat' },
];

/** A column whose on-screen `format` throws for `qty === 2` and otherwise renders `OK<n>`. */
function throwingFormatColumns() {
  return [
    column<Row, number>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      format: (v) => {
        if (v === 2) throw new Error('boom');
        return `OK${v}`;
      },
      width: 8,
    }),
    column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
  ];
}

/** The whole painted frame as one newline-joined string, for content assertions. */
function frameText(rr: ReturnType<typeof createRenderRoot>): string {
  return rr
    .buffer()
    .rows()
    .map((row) => row.map((c) => c.char).join(''))
    .join('\n');
}

// ST-6 — a throwing on-screen formatter degrades its one cell; the rest of the frame renders.
test('ST-6: a throwing on-screen formatter degrades its one cell to String(v), the rest still paints', () => {
  createRoot((dispose) => {
    const grid = new EditableDataGrid<Row>({
      columns: throwingFormatColumns(),
      source: fromRows(signal(DATA.map((r) => ({ ...r }))), { rowKey: (r) => r.qty }),
    });
    grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
    const root = new Group();
    root.add(grid);
    const rr = createRenderRoot({ width: W, height: H }, { caps });

    expect(() => rr.mount(root)).not.toThrow(); // a throwing formatter must not crash the paint
    const text = frameText(rr);

    expect(text).toContain('OK1'); // a good cell formats normally
    expect(text).toContain('OK3');
    expect(text).not.toContain('OK2'); // format(2) threw — it never produced 'OK2'
    expect(text).toContain('2'); // …and that cell degraded to String(2)
    expect(text).toContain('Bea'); // the bad row's other column still renders
    dispose();
  });
});

// ST-7 (model) — a throwing custom comparator degrades to the type-aware default order, never throws.
test('ST-7: a throwing custom comparator degrades sortRowsMulti to default order without throwing', () => {
  const badCol = column<Row, number>({
    id: 'qty',
    title: 'Qty',
    value: (r) => r.qty,
    compare: () => {
      throw new Error('boom');
    },
    width: 8,
  });
  const columns = new Map([['qty', badCol]]);
  const keys: SortKey[] = [{ columnId: 'qty', dir: 'asc' }];

  let out: Row[] = [];
  expect(() => {
    out = sortRowsMulti(DATA, keys, columns);
  }).not.toThrow();
  expect(out).toHaveLength(DATA.length);
  expect(out.map((r) => r.qty)).toEqual([1, 2, 3]); // default (compareValues) ascending order
});

// ST-7 (grid) — a grid-level sort on the bad column does not crash and still renders.
test('ST-7: a grid-level sort on a throwing-comparator column does not crash', () => {
  createRoot((dispose) => {
    const grid = new EditableDataGrid<Row>({
      columns: [
        column<Row, number>({
          id: 'qty',
          title: 'Qty',
          value: (r) => r.qty,
          compare: () => {
            throw new Error('boom');
          },
          width: 8,
        }),
        column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 8 }),
      ],
      source: fromRows(signal(DATA.map((r) => ({ ...r }))), { rowKey: (r) => r.qty }),
    });
    grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
    const root = new Group();
    root.add(grid);
    const rr = createRenderRoot({ width: W, height: H }, { caps });
    rr.mount(root);

    expect(() => grid.sortBy('qty')).not.toThrow();
    rr.flush();
    expect(frameText(rr)).toContain('Ann'); // still renders after the degraded sort
    dispose();
  });
});
