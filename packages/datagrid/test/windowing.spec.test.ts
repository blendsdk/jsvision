/**
 * Specification tests (immutable oracles) — the windowed read path. On a windowed source (one exposing
 * `ensureRange`) the grid's `display()` becomes a **length-correct lazy view** that skips `materialize`
 * and never collapses unloaded holes, and a reactive `revision` bump re-derives it to a fresh identity so
 * a landed page repaints. The eager path (no `ensureRange`) is untouched — a dense materialized array.
 *
 * Expectations derive from the requirements / plan spec, never the implementation.
 */
import { test, expect } from 'vitest';
import { signal, computed, effect, createRoot } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { isWindowed, windowedView } from '../src/windowing.js';
import { asyncWindowedSource } from './fixtures/async-windowed-source.js';

interface Row {
  id: number;
  name: string;
}

/** Fixed-width columns (an `auto` column would force an all-rows width measure — never on the windowed path). */
const cols = [
  column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 6 }),
  column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 }),
];

/** An async windowed source over a synthetic dataset; the last page is trimmed to `total`. */
function makeSource(total: number, pageSize: number) {
  return asyncWindowedSource<Row>({
    total,
    pageSize,
    fetchPage: (page) =>
      Promise.resolve(
        Array.from({ length: pageSize }, (_, k) => {
          const id = page * pageSize + k;
          return { id, name: `row-${id}` };
        }).filter((r) => r.id < total),
      ),
    rowKey: (r) => r.id,
  });
}

// ST-1 — the windowed display reports the source total and never runs `materialize` (which would scan
// every row). With only the first page loaded, `display().length` is the grand total and no full-scan ran.
test('ST-1: windowed display is length-correct and does not materialize', async () => {
  const src = makeSource(100000, 50);
  await src.ensureRange(0, 50); // load only rows [0,50)
  await src.settle();
  const grid = new EditableDataGrid<Row>({ columns: cols, source: src });

  src.resetCounts();
  const display = grid.displayedRows();
  expect(display.length).toBe(100000); // length-correct even with 99950 rows unloaded
  expect(src.rowAtCount()).toBe(0); // materialize (a 100000× rowAt scan) did NOT run
});

// ST-2 — an integer index returns the loaded row, and an unloaded index returns `undefined` — the hole
// is preserved, never collapsed away (which would misalign every index past it).
test('ST-2: windowed display preserves unloaded holes', async () => {
  const src = makeSource(100000, 50);
  await src.ensureRange(0, 50);
  await src.settle();
  const grid = new EditableDataGrid<Row>({ columns: cols, source: src });

  const display = grid.displayedRows();
  expect(display[10]).toEqual({ id: 10, name: 'row-10' }); // loaded
  expect(display[500]).toBeUndefined(); // unloaded → a preserved hole (not collapsed)
});

// ST-3 — a landed page bumps the reactive `revision`, and an effect bound to the windowed display
// derivation (the exact shape the grid uses: read `revision`, return a fresh lazy view) re-runs with a
// fresh identity → the repaint fires.
test('ST-3: a revision bump re-derives the windowed display to a fresh identity', async () => {
  const src = makeSource(100, 10);
  const seen: unknown[] = [];
  const dispose = createRoot((d) => {
    // Mirrors grid.ts's windowed display branch: `derived(() => { source.revision?.(); return windowedView(source); })`.
    const display = computed(() => {
      src.revision();
      return windowedView(src);
    });
    effect(() => {
      seen.push(display());
    });
    return d;
  });

  expect(seen.length).toBe(1); // ran once on creation
  src.rowAt(0); // miss → kicks the page fetch
  await src.settle(); // page lands → revision bumps → effect re-runs (synchronous propagation)
  expect(seen.length).toBe(2); // re-derived → repaint
  // Compare identity by reference (`===` triggers no Proxy trap); the loud view throws on any
  // introspecting matcher access, so `.not.toBe` is not usable here — by design.
  expect(seen[0] === seen[1]).toBe(false); // a fresh identity (a new lazy view)
  dispose();
});

// ST-4 — the eager path is byte-identical to before: a `fromRows` source is not windowed, and its
// display is a dense materialized array supporting whole-array ops (which throw on the windowed view).
test('ST-4: an eager source stays a dense materialized array (regression guard)', () => {
  const rows = signal<Row[]>([
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
  ]);
  const src = fromRows(rows, { rowKey: (r) => r.id });
  expect(isWindowed(src)).toBe(false); // no ensureRange → eager

  const grid = new EditableDataGrid<Row>({ columns: cols, source: src });
  const display = grid.displayedRows();
  expect(display.length).toBe(2);
  expect(display.map((r) => r.id)).toEqual([1, 2]); // whole-array ops work on the dense eager array
  expect([...display]).toHaveLength(2); // iterable (spread) — eager only
});
