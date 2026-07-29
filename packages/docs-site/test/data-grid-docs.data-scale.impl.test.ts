/** Bounded-source and large-data implementation tests for the Data Grid documentation labs. */
import { EditableDataGrid } from '@jsvision/datagrid';
import { createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import largeMemory from '../examples/data-grid/large-memory.js';
import windowed from '../examples/data-grid/windowed.js';
import {
  WINDOWED_TOTAL_ROWS,
  createGuardedWindowedRows,
  createWindowedDataGridLabSource,
} from '../src/example-fixtures/data-grid/windowed-source.js';
import {
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  viewsIn,
} from './example-lab-harness.js';

describe('guarded procedural source', () => {
  test('rejects invalid or unbounded slices', () => {
    const fixture = createGuardedWindowedRows();
    expect(() => fixture.readWindow(-1, 10)).toThrow(RangeError);
    expect(() => fixture.readWindow(0, 201)).toThrow(RangeError);
    expect(() => fixture.readWindow(0.5, 10)).toThrow(RangeError);
    expect(fixture.readCount()).toBe(0);
    expect(fixture.fullArrayRead()).toBe(false);
  });

  test('caches bounded pages and never allocates a complete collection', () => {
    const source = createWindowedDataGridLabSource(40);
    source.ensureRange?.(0, 80);
    expect(source.readCount()).toBe(2);
    expect(source.loadedRowCount()).toBe(80);
    source.ensureRange?.(10, 70);
    expect(source.readCount()).toBe(2);
    source.ensureRange?.(50_000, 50_040);
    expect(source.readCount()).toBe(3);
    expect(source.length()).toBe(WINDOWED_TOTAL_ROWS);
    expect(source.fullArrayRead()).toBe(false);
  });

  test('rejects unsafe page and range requests', () => {
    expect(() => createWindowedDataGridLabSource(0)).toThrow(RangeError);
    expect(() => createWindowedDataGridLabSource(201)).toThrow(RangeError);
    const source = createWindowedDataGridLabSource();
    expect(() => source.ensureRange?.(0, 601)).toThrow(RangeError);
    expect(() => source.ensureRange?.(Number.NaN, 20)).toThrow(RangeError);
  });
});

describe('scale laboratories', () => {
  test('windowed lab reports bounded work in a centered padded dialog', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('data-grid/windowed', windowed);
      try {
        collectTemplate1Evidence(app, dialog);
        dispatchExampleAction(app, { kind: 'key', key: 'w', modifiers: ['Alt'] });
        expect(frameText(app)).toMatch(/bounded reads/);
        const grid = viewsIn(dialog).find((view) => view instanceof EditableDataGrid);
        expect(grid?.totalCount()).toBe(WINDOWED_TOTAL_ROWS);
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('large-memory action moves between explicit bounded tiers', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('data-grid/large-memory', largeMemory);
      try {
        const grid = viewsIn(dialog).find((view) => view instanceof EditableDataGrid);
        expect(grid?.totalCount()).toBe(1_000);
        dispatchExampleAction(app, { kind: 'key', key: 'l', modifiers: ['Alt'] });
        expect(grid?.totalCount()).toBe(10_000);
        expect(frameText(app)).toContain('use windowed above this tier');
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });
});
