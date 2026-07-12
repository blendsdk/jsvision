/**
 * Specification tests (immutable oracles) — the `GridDataSource<T>` read seam. The in-memory `fromRows`
 * source and a hand-written windowed double satisfy the identical `length`/`rowAt`/`rowKey` contract,
 * so the grid body binds to one shape regardless of where the rows come from.
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { describe, test, expect } from 'vitest';
import { signal } from '@jsvision/ui';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { windowedSource } from './fixtures/windowed-source.js';

interface Row {
  id: number;
  name: string;
}

const data: Row[] = [
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
];

/** The shared source-contract assertions run against every `GridDataSource` implementation. */
function assertSourceContract(src: GridDataSource<Row>): void {
  expect(src.length()).toBe(3);
  expect(src.rowAt(0)).toEqual({ id: 1, name: 'a' });
  expect(src.rowAt(1)).toEqual({ id: 2, name: 'b' });
  expect(src.rowAt(2)).toEqual({ id: 3, name: 'c' });
  expect(src.rowAt(3)).toBeUndefined(); // out of range
  expect(src.rowKey(data[1])).toBe(2);
}

describe('GridDataSource length/rowAt/rowKey contract', () => {
  // ST-6 — the in-memory source mirrors the signal.
  test('should be satisfied by the in-memory fromRows source', () => {
    assertSourceContract(fromRows(signal(data), { rowKey: (r) => r.id }));
  });

  // ST-7 — a windowed double over the same rows produces identical results.
  test('should be satisfied identically by a windowed double over the same rows', () => {
    assertSourceContract(windowedSource(data, (r) => r.id));
  });
});
