/**
 * Implementation tests — internals and edge cases of the in-memory data source: reactivity (a reactive
 * scope reading the source re-runs when the rows signal changes) and out-of-range `rowAt`.
 */
import { test, expect } from 'vitest';
import { signal, effect, createRoot } from '@jsvision/ui';
import { fromRows } from '../src/data-source.js';

interface Row {
  id: number;
}

test('should reflect rows.set updates in length and rowAt', () => {
  const rows = signal<Row[]>([{ id: 1 }]);
  const src = fromRows(rows, { rowKey: (r) => r.id });
  expect(src.length()).toBe(1);
  rows.set([{ id: 1 }, { id: 2 }, { id: 3 }]);
  expect(src.length()).toBe(3);
  expect(src.rowAt(2)).toEqual({ id: 3 });
});

test('should drive a reactive effect when the rows signal changes', () => {
  const rows = signal<Row[]>([{ id: 1 }]);
  const src = fromRows(rows, { rowKey: (r) => r.id });
  const seen: number[] = [];
  const dispose = createRoot((d) => {
    effect(() => {
      seen.push(src.length());
    });
    return d;
  });
  rows.set([{ id: 1 }, { id: 2 }]);
  expect(seen).toEqual([1, 2]); // effect ran on creation (1) and re-ran after set (2)
  dispose();
});

test('should return undefined for out-of-range indices', () => {
  const rows = signal<Row[]>([{ id: 1 }]);
  const src = fromRows(rows, { rowKey: (r) => r.id });
  expect(src.rowAt(-1)).toBeUndefined();
  expect(src.rowAt(5)).toBeUndefined();
});
