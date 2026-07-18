/**
 * Implementation/edge tests for trusted-callback isolation (hardening around ST-6/ST-7).
 *
 * The formatter guard is unit-tested at the engine accessor (`toEngineColumn`) so only the throwing
 * row degrades; the comparator guard is checked where it matters most — under a MULTI-key sort (a bad
 * primary key falls back yet the secondary key still orders the ties) and BELOW the null short-circuit
 * (a nil never reaches the custom comparator, so its ordering is unaffected). A regression check keeps
 * the pre-existing export-path formatter guard degrading too.
 */
import { test, expect } from 'vitest';
import { createRoot, signal } from '@jsvision/ui';
import { column, toEngineColumn } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { sortRowsMulti } from '../src/sort.js';
import type { SortKey } from '../src/sort.js';

// ── Formatter guard (accessor level) ────────────────────────────────────────────────────────────

test('the formatter guard degrades only the throwing cell; other rows format normally', () => {
  const eng = toEngineColumn(
    column<{ qty: number }, number>({
      id: 'qty',
      title: 'Qty',
      value: (r) => r.qty,
      format: (v) => {
        if (v === 2) throw new Error('boom');
        return `OK${v}`;
      },
    }),
  );
  expect(eng.accessor({ qty: 1 })).toBe('OK1');
  expect(eng.accessor({ qty: 2 })).toBe('2'); // degraded to String(v)
  expect(eng.accessor({ qty: 3 })).toBe('OK3');
});

// ── Comparator guard (model level) ──────────────────────────────────────────────────────────────

interface Rec {
  a: number | null;
  b: number;
}

test('a throwing primary comparator falls back to default order yet the secondary key still orders ties', () => {
  const colA = column<Rec, number | null>({
    id: 'a',
    title: 'A',
    value: (r) => r.a,
    compare: () => {
      throw new Error('boom');
    },
  });
  const colB = column<Rec, number>({ id: 'b', title: 'B', value: (r) => r.b });
  const columns = new Map([
    ['a', colA],
    ['b', colB],
  ]);
  const keys: SortKey[] = [
    { columnId: 'a', dir: 'asc' },
    { columnId: 'b', dir: 'asc' },
  ];
  const rows: Rec[] = [
    { a: 1, b: 3 },
    { a: 1, b: 1 },
    { a: 2, b: 2 },
  ];

  const out = sortRowsMulti(rows, keys, columns);
  // `a` falls back to compareValues (1,1,2); among the a=1 ties, the secondary key `b` orders 1 before 3.
  expect(out).toEqual([
    { a: 1, b: 1 },
    { a: 1, b: 3 },
    { a: 2, b: 2 },
  ]);
});

test('the comparator guard sits below the null short-circuit — nulls order without calling compare', () => {
  const colA = column<Rec, number | null>({
    id: 'a',
    title: 'A',
    value: (r) => r.a,
    nulls: 'first',
    compare: () => {
      throw new Error('boom');
    },
  });
  const columns = new Map([['a', colA]]);
  const keys: SortKey[] = [{ columnId: 'a', dir: 'asc' }];
  const rows: Rec[] = [
    { a: 5, b: 0 },
    { a: null, b: 0 },
    { a: 2, b: 0 },
  ];

  const out = sortRowsMulti(rows, keys, columns);
  // null goes first (nulls:'first', short-circuited before compare); the two non-nulls fall back to 2 < 5.
  expect(out.map((r) => r.a)).toEqual([null, 2, 5]);
});

// ── Export-path formatter regression ────────────────────────────────────────────────────────────

test('the export-path formatter guard still degrades a throwing cell', () => {
  createRoot((dispose) => {
    const grid = new EditableDataGrid<{ qty: number }>({
      columns: [
        column<{ qty: number }, number>({
          id: 'qty',
          title: 'Qty',
          value: (r) => r.qty,
          format: (v) => {
            if (v === 2) throw new Error('boom');
            return `OK${v}`;
          },
        }),
      ],
      source: fromRows(signal([{ qty: 1 }, { qty: 2 }, { qty: 3 }]), { rowKey: (r) => r.qty }),
    });
    const csv = grid.exportView('csv');
    expect(csv).toContain('OK1');
    expect(csv).toContain('OK3');
    expect(csv).not.toContain('OK2');
    expect(csv).toMatch(/(^|[\r\n,])2([\r\n,]|$)/); // the degraded raw value stands alone as a CSV field
    dispose();
  });
});
