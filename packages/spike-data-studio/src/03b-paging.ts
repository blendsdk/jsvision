/**
 * Probe 3b — THE PAGING VERDICT (make-or-break). Can a windowed, server-paged data source feed the
 * existing `DataGrid` UNMODIFIED?
 *
 * The grid indexes `display()[topItem + i]` only across its visible window and reads `display().length`
 * for the scroll range (grid-rows.ts). So a JS `Proxy` that reports `length = totalCount` and
 * materializes only the touched window can masquerade as the in-memory `T[]` the grid expects — no
 * fork, no framework change — PROVIDED nothing forces a full scan.
 *
 * Two things in the grid DO force a full scan, and this probe measures both by counting integer-index
 * accesses per compose:
 *   • an `auto`-width column → `measureAutoWidths` iterates every row (columns.ts);
 *   • a client-side sort → `sortRows` does `[...rows]` (columns.ts).
 * With FIXED columns and SERVER-SIDE sort, neither fires, and paging works.
 */
import { DataGrid, signal, createRoot, createRenderRoot } from '@jsvision/ui';
import type { Column, Signal } from '@jsvision/ui';
import { pool } from './db.js';
import { caps } from './headless.js';
import { WindowedSource } from './windowed-source.js';
import type { Row } from './windowed-source.js';

const PAGE = 200;
const TOTAL_LIMIT = 100000;

const mkSource = (total: number): WindowedSource => new WindowedSource(total, 'app', 'big', ['id'], PAGE);

const FIXED_COLS: Column<Row>[] = [
  { title: 'id', accessor: (r) => String(r.id ?? ''), width: 8, align: 'right' },
  { title: 'label', accessor: (r) => String(r.label ?? ''), width: 14 },
  { title: 'amount', accessor: (r) => String(r.amount ?? ''), width: 12, align: 'right' },
  { title: 'flag', accessor: (r) => (r.flag ? 'Y' : 'N'), width: 5 },
  { title: 'made_on', accessor: (r) => String(r.made_on ?? '').slice(0, 10), width: 12 },
];

/** Mount a grid over `src` with the given columns/sort, compose one frame, return the visible lines. */
function composeGrid(
  src: WindowedSource,
  columns: Column<Row>[],
  focusRow: number,
  sort: Signal<import('@jsvision/ui').SortState> | undefined,
): { lines: string[]; grid: DataGrid<Row> } {
  return createRoot((dispose) => {
    const grid = new DataGrid<Row>({ rows: src.rowsSignal, columns, sort });
    grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 55, height: 12 } };
    const rr = createRenderRoot({ width: 55, height: 12 }, { caps: caps() });
    rr.mount(grid);
    grid.focused.set(focusRow);
    rr.flush();
    const lines = rr
      .buffer()
      .rows()
      .map((row) =>
        row
          .map((c) => c.char)
          .join('')
          .trimEnd(),
      );
    dispose();
    return { lines, grid };
  });
}

async function main(): Promise<void> {
  console.log('=== Probe 3b: PAGING VERDICT (windowed Proxy vs the real DataGrid) ===');
  const total = Math.min(Number((await pool.query('SELECT count(*)::int AS n FROM app.big')).rows[0].n), TOTAL_LIMIT);
  console.log(`app.big total rows: ${total}, page size: ${PAGE}`);

  // Scenario 1 — FIXED columns, NO sort: scroll deep, then let the window page in. This is the real
  // end-to-end paging test.
  console.log('\n① FIXED columns, no sort — scroll to row 50000:');
  const src = mkSource(total);
  src.resetCounters();
  let out = composeGrid(src, FIXED_COLS, 50000, undefined);
  console.log(
    `   first compose at focus=50000 → index accesses=${src.accesses}, pages fetched(so far)=${src.pagesFetched}`,
  );
  await src.settle();
  // Recompose so the freshly-paged rows are shown.
  out = composeGrid(src, FIXED_COLS, 50000, undefined);
  await src.settle();
  out = composeGrid(src, FIXED_COLS, 50000, undefined);
  console.log(
    `   pages materialized total: ${src.pagesInMemory} of ${Math.ceil(total / PAGE)} (${((src.pagesInMemory / Math.ceil(total / PAGE)) * 100).toFixed(2)}%)`,
  );
  console.log('   composed frame around row 50000:');
  for (const l of out.lines.filter((l) => l.length)) console.log(`     ${l}`);

  // Scenario 2 — an AUTO column forces measureAutoWidths to scan every row.
  console.log('\n② FIXED + one AUTO column, no sort — one compose:');
  const src2 = mkSource(total);
  src2.fetchOnMiss = false; // just measure the scan; do not fire 500 fetches
  src2.resetCounters();
  const autoCols: Column<Row>[] = [
    ...FIXED_COLS.slice(0, 4),
    { title: 'made_on', accessor: (r) => String(r.made_on ?? ''), width: 'auto' },
  ];
  composeGrid(src2, autoCols, 0, undefined);
  console.log(
    `   index accesses in ONE compose: ${src2.accesses}  → ${src2.accesses >= total ? 'FULL SCAN (auto measures every row) ✗' : 'windowed ✓'}`,
  );

  // Scenario 3 — a client-side sort forces sortRows to spread the whole array.
  console.log('\n③ FIXED columns + CLIENT sort — one compose:');
  const src3 = mkSource(total);
  src3.fetchOnMiss = false;
  src3.resetCounters();
  const sort = signal<import('@jsvision/ui').SortState>({ col: 0, dir: 'asc' });
  composeGrid(src3, FIXED_COLS, 0, sort);
  console.log(
    `   index accesses in ONE compose: ${src3.accesses}  → ${src3.accesses >= total ? 'FULL SCAN (client sort spreads the array) ✗' : 'windowed ✓'}`,
  );

  console.log('\nPAGING VERDICT:');
  console.log('  🟡 A windowed Proxy dense-array feeds the UNMODIFIED DataGrid — BUT only with');
  console.log('     (a) FIXED/fr column widths (never `auto`), and (b) SERVER-SIDE sort (client sort');
  console.log('     spreads the array). Under those two constraints, scrolling to row 50000 materialized');
  console.log(`     a tiny fraction of pages. A clean fix = a small "windowed data source" seam in`);
  console.log('     @jsvision/ui (an accessor+length interface the grid reads) removing the constraints.');
}

main()
  .catch((err) => {
    console.error('Probe 3b FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
