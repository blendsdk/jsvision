/**
 * Implementation tests — the internals of `windowing.ts`: the lazy-view Proxy's `length`/index/`has`
 * traps, its **fail-loud** contract (any whole-array access throws, whether the source is fully loaded
 * or partly loaded), and the `isWindowed` predicate + inert `revision` read on the eager path.
 */
import { test, expect } from 'vitest';
import { signal } from '@jsvision/ui';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { isWindowed, windowedView } from '../src/windowing.js';
import { asyncWindowedSource } from './fixtures/async-windowed-source.js';

interface Row {
  id: number;
  name: string;
}

/** A windowed source (declares `ensureRange`) whose every row is already present — the all-loaded case. */
function allLoaded(rows: Row[]): GridDataSource<Row> {
  return {
    rowKey: (r) => r.id,
    length: () => rows.length,
    rowAt: (i) => rows[i],
    ensureRange: () => {
      // every row present — nothing to load
    },
  };
}

const sample: Row[] = [
  { id: 0, name: 'a' },
  { id: 1, name: 'b' },
  { id: 2, name: 'c' },
];

test('the lazy view reports the source length and indexes through to rowAt', () => {
  const view = windowedView(allLoaded(sample));
  expect(view.length).toBe(3);
  expect(view[0]).toEqual({ id: 0, name: 'a' });
  expect(view[2]).toEqual({ id: 2, name: 'c' });
  expect(view[5]).toBeUndefined(); // out of range → rowAt returns undefined
});

test('the has trap covers length and integer indices, not out-of-range indices', () => {
  const view = windowedView(allLoaded(sample));
  expect('length' in view).toBe(true);
  expect('1' in view).toBe(true); // in range
  expect('3' in view).toBe(false); // === length → out of range
  expect('99' in view).toBe(false);
});

test('a non-integer string key is a whole-array access and throws', () => {
  const view = windowedView(allLoaded(sample));
  expect(() => (view as unknown as Record<string, unknown>)['1.5']).toThrow(/supports only \.length and integer/);
  expect(() => (view as unknown as Record<string, unknown>).foo).toThrow(/whole-array/);
});

test('every whole-array operation fails loud on a fully-loaded source', () => {
  const view = windowedView(allLoaded(sample));
  expect(() => view.map((r) => r.id)).toThrow(/whole-array/);
  expect(() => view.find((r) => r.id === 1)).toThrow(/whole-array/);
  expect(() => view.findIndex((r) => r.id === 1)).toThrow(/whole-array/);
  expect(() => view.filter(() => true)).toThrow(/whole-array/);
  expect(() => [...view]).toThrow(/whole-array/); // spread → Symbol.iterator
  expect(() => {
    for (const _ of view) void _; // for..of → Symbol.iterator
  }).toThrow(/whole-array/);
});

test('every whole-array operation fails loud on a partly-loaded source too (no silent full-scan)', () => {
  // Nothing loaded: an ungated whole-array op must still throw — never silently full-scan/fetch-storm.
  const src = asyncWindowedSource<Row>({
    total: 100000,
    pageSize: 50,
    fetchPage: (p) => Promise.resolve(Array.from({ length: 50 }, (_, k) => ({ id: p * 50 + k, name: 'x' }))),
    rowKey: (r) => r.id,
  });
  const view = windowedView(src);
  src.resetCounts();
  expect(() => view.map((r) => r.id)).toThrow(/whole-array/);
  expect(() => view.findIndex(() => true)).toThrow(/whole-array/);
  expect(() => [...view]).toThrow(/whole-array/);
  expect(src.rowAtCount()).toBe(0); // it threw before touching a single row — no fetch-storm
});

test('isWindowed is true only for a real ensureRange function', () => {
  expect(isWindowed(allLoaded(sample))).toBe(true);
  expect(isWindowed(fromRows(signal(sample), { rowKey: (r) => r.id }))).toBe(false);
  // A source declaring `ensureRange: undefined` is NOT windowed (typeof undefined !== 'function').
  const declaredButUndefined: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => sample.length,
    rowAt: (i) => sample[i],
    ensureRange: undefined,
  };
  expect(isWindowed(declaredButUndefined)).toBe(false);
});

test('an eager source omits revision, so the grid read source.revision?.() is inert', () => {
  const src = fromRows(signal(sample), { rowKey: (r) => r.id });
  expect(src.revision).toBeUndefined();
  expect(() => src.revision?.()).not.toThrow(); // optional-chain read yields undefined, never throws
  expect(src.revision?.()).toBeUndefined();
});
