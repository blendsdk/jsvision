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
import { asyncWindowedSource } from './fixtures/async-windowed-source.js';

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

  // ST-7 — an eager double over the same rows produces identical results.
  test('should be satisfied identically by an eager double over the same rows', () => {
    assertSourceContract(windowedSource(data, (r) => r.id));
  });
});

describe('GridDataSource revision contract (windowed repaint seam)', () => {
  // A windowed/async source exposes an optional reactive `revision` read; a landed page bumps it, so a
  // scope reading it inside the grid's display derivation re-runs and repaints the newly-loaded rows.
  test('a windowed source exposes a reactive revision that bumps when a page lands', async () => {
    const src = asyncWindowedSource<Row>({
      total: 50,
      pageSize: 10,
      fetchPage: (page) => Promise.resolve(Array.from({ length: 10 }, (_, k) => ({ id: page * 10 + k, name: 'x' }))),
      rowKey: (r) => r.id,
    });
    expect(typeof src.revision).toBe('function');
    const before = src.revision!();
    src.rowAt(0); // miss → kicks the page fetch
    await src.settle(); // page lands → revision bumps
    expect(src.revision!()).toBeGreaterThan(before);
  });

  // An eager in-memory source omits `revision` — its rows signal already drives repaint, so the member
  // is absent (and the grid's `revision?.()` read is inert on the eager path).
  test('an eager fromRows source omits revision', () => {
    const src = fromRows(signal<Row[]>([]), { rowKey: (r) => r.id });
    expect(src.revision).toBeUndefined();
  });
});
