/**
 * Specification tests (immutable oracles) — the reactive write-through data source `fromReactiveRows`,
 * the twin of `fromRows`.
 *
 * `read` supplies the current rows (evaluated reactively, so a scope reading `length`/`rowAt` re-runs
 * when the backing signal changes). `insert`/`remove` delegate to caller writers that mutate the OWNING
 * collection, so structural edits persist; omitting them yields a read-only-structural source (the
 * grid's `insertRow`/`deleteRows` then no-op gracefully).
 *
 * Expectations derive from the requirements/spec docs, never the implementation. The `.js` import
 * specifier is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { signal, effect, createRoot } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromReactiveRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';

interface Row {
  id: number;
  v?: number;
}

// ST-23 — reactive read: length()/rowAt() reflect the backing signal, and a scope re-runs on change.
test('ST-23: should read the backing signal reactively', () => {
  const backing = signal<Row[]>([{ id: 1 }, { id: 2 }]);
  const src = fromReactiveRows(() => backing(), { rowKey: (r) => r.id });
  expect(src.length()).toBe(2);
  expect(src.rowAt(0)).toEqual({ id: 1 });

  backing.set([{ id: 1 }, { id: 2 }, { id: 3 }]);
  expect(src.length()).toBe(3); // reflects the new backing
  expect(src.rowAt(2)).toEqual({ id: 3 });

  // A reactive scope reading length() re-runs when the backing changes.
  const seen: number[] = [];
  const dispose = createRoot((d) => {
    effect(() => {
      seen.push(src.length());
    });
    return d;
  });
  backing.set([{ id: 1 }]);
  expect(seen).toEqual([3, 1]); // ran on creation (3), re-ran after the set (1)
  dispose();
});

// ST-24 — write-through: insert/remove mutate the OWNED collection and persist across a re-read.
test('ST-24: should write insert/remove through to the owned collection', () => {
  const backing = signal<Row[]>([{ id: 1, v: 10 }]);
  const src = fromReactiveRows(() => backing(), {
    rowKey: (r) => r.id,
    insert: (row, at) => {
      const next = backing().slice();
      next.splice(at ?? next.length, 0, row);
      backing.set(next);
    },
    remove: (keys) => {
      const drop = new Set(keys);
      backing.set(backing().filter((r) => !drop.has(r.id)));
    },
  });

  src.insert!({ id: 2, v: 20 });
  expect(backing()).toEqual([
    { id: 1, v: 10 },
    { id: 2, v: 20 },
  ]); // persisted in the owned collection
  expect(src.length()).toBe(2); // and visible through a re-read

  src.remove!([1]);
  expect(backing()).toEqual([{ id: 2, v: 20 }]);
  expect(src.rowAt(0)).toEqual({ id: 2, v: 20 });
});

// ST-25 — omitting the writers yields a read-only-structural source: the writers are absent, and the
// grid's insertRow/deleteRows no-op without throwing (the owned collection is unchanged).
test('ST-25: should be read-only-structural when the writers are omitted', () => {
  const backing = signal<Row[]>([{ id: 1 }]);
  const src = fromReactiveRows(() => backing(), { rowKey: (r) => r.id });
  expect(src.insert).toBeUndefined(); // no insert writer
  expect(src.remove).toBeUndefined(); // no remove writer

  const grid = new EditableDataGrid<Row>({
    columns: [column<Row, number>({ id: 'id', title: 'Id', value: (r) => r.id, width: 5 })],
    source: src,
  });
  expect(() => grid.insertRow({ id: 99 })).not.toThrow();
  expect(() => grid.deleteRows([1])).not.toThrow();
  expect(backing()).toEqual([{ id: 1 }]); // both no-oped — the owned collection is untouched
});
