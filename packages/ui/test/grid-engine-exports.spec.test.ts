/**
 * Specification tests (immutable oracles) — the grid engine promoted from source-internal to the
 * public `@jsvision/ui` barrel, so another package can build on `GridRows`/`GridHeader` and the pure
 * column math BY NAME instead of reaching into built output.
 *
 * Imports the promoted surface by name from `@jsvision/ui` (the published barrel). The values must
 * resolve as functions; the construction types must be importable (the type-only usage below compiles
 * only if the barrel forwards them). The existing `DataGrid` export must stay intact — the promotion
 * is purely additive.
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import {
  GridRows,
  GridHeader,
  apportionColumns,
  alignCell,
  sortRows,
  measureAutoWidths,
  stringWidth,
  DataGrid,
  signal,
} from '@jsvision/ui';
import type {
  GridRowsConfig,
  GridHeaderConfig,
  Column,
  ColumnWidth,
  ColumnAlign,
  SortState,
  ColumnGeometry,
} from '@jsvision/ui';

interface Row {
  readonly v: string;
  readonly n: number;
}

// ST-1 — every promoted value resolves as a function from the published barrel.
test('should promote the grid engine renderers and column math to the @jsvision/ui barrel', () => {
  expect(GridRows).toBeTypeOf('function');
  expect(GridHeader).toBeTypeOf('function');
  expect(apportionColumns).toBeTypeOf('function');
  expect(alignCell).toBeTypeOf('function');
  expect(sortRows).toBeTypeOf('function');
  expect(measureAutoWidths).toBeTypeOf('function');
  expect(stringWidth).toBeTypeOf('function');
});

// ST-1 — the promoted values are the real engine helpers (a pure round-trip, not placeholder stubs):
// stringWidth measures columns, alignCell pads to width, sortRows orders by the typed comparator, and
// the auto-measure + apportion pass produces integer geometry.
test('should expose working engine helpers, not placeholder bindings', () => {
  expect(stringWidth('ab')).toBe(2);
  expect(alignCell('x', 3, 'left', stringWidth)).toBe('x  ');

  const cols: Column<Row>[] = [{ title: 'N', accessor: (r) => String(r.n), width: 'auto', compare: (a, b) => a.n - b.n }];
  const sorted = sortRows([{ v: 'b', n: 9 }, { v: 'a', n: 1 }], cols, { col: 0, dir: 'asc' });
  expect(sorted.map((r) => r.n)).toEqual([1, 9]);

  const autos = measureAutoWidths(cols, [{ v: 'a', n: 1000 }], stringWidth);
  const geom: ColumnGeometry = apportionColumns(cols, autos, 10);
  expect(geom.widths).toHaveLength(1);
  expect(geom.widths[0]).toBeGreaterThan(0);
});

// ST-1 — the construction types forward through the barrel (this file compiles only if the newly
// public `GridRowsConfig`/`GridHeaderConfig` — and the already-public column types — are re-exported).
test('should re-export the GridRowsConfig / GridHeaderConfig construction types', () => {
  const width: ColumnWidth = '1fr';
  const align: ColumnAlign = 'left';
  const columns: Column<Row>[] = [{ title: 'V', accessor: (r) => r.v, width, align }];
  const sort = signal<SortState>(null);

  const rowsCfg: GridRowsConfig<Row> = {
    display: () => [{ v: 'a', n: 1 }],
    columns,
    autoWidths: () => [null],
    indent: signal(0),
    focused: signal(0),
    selected: signal(-1),
    zebra: false,
  };
  const headerCfg: GridHeaderConfig<Row> = { columns, autoWidths: () => [null], indent: signal(0), sort };

  const rows = new GridRows(rowsCfg);
  const header = new GridHeader(headerCfg);
  expect(rows.focusable).toBe(true);
  expect(header.focusable).toBe(false);
});

// ST-2 — the promotion is additive: the existing DataGrid export is unchanged and still constructs.
test('should keep DataGrid exported and constructable (additive promotion, no regression)', () => {
  expect(DataGrid).toBeTypeOf('function');
  const grid = new DataGrid<Row>({
    rows: signal<Row[]>([{ v: 'a', n: 1 }]),
    columns: [{ title: 'V', accessor: (r) => r.v, width: '1fr' }],
  });
  expect(grid.rows.focusable).toBe(true);
});
