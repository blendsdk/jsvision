/**
 * Implementation tests (internals & guards) for the RD-09 footer surface. This file grows across the
 * footer phases; the Phase-2 slice covers the headroom extractions, the grid.ts thin-delegator
 * line-count guard, the reactivity of the new displayed/focused readouts, and the optional source
 * completeness seam.
 */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Group, createEventLoop, resolveCapabilities, signal, effect, createRoot } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const src = (name: string) => readFileSync(fileURLToPath(new URL(`../src/${name}`, import.meta.url)), 'utf8');

interface Row {
  id: number;
  n: number;
}
function buildGrid() {
  const rows = signal<Row[]>([
    { id: 1, n: 10 },
    { id: 2, n: 20 },
    { id: 3, n: 30 },
  ]);
  const grid = new EditableDataGrid<Row>({
    columns: [column<Row, number>({ id: 'n', title: 'N', value: (r) => r.n, width: 8 })],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 6 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 20, height: 6 }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return { grid, loop, rows };
}

test('the headroom extractions landed: EditorOverlay/PopupCatcher live in overlay.ts, devWarn in dev.ts', () => {
  const overlay = src('overlay.ts');
  const dev = src('dev.ts');
  const grid = src('grid.ts');
  expect(overlay).toContain('export class EditorOverlay');
  expect(overlay).toContain('export class PopupCatcher');
  expect(dev).toContain('export function devWarn');
  // grid.ts imports them back rather than re-declaring — no inlined copies remain.
  expect(grid).toContain("from './overlay.js'");
  expect(grid).toContain("import { devWarn } from './dev.js'");
  expect(grid).not.toContain('class EditorOverlay');
  expect(grid).not.toContain('class PopupCatcher');
  expect(grid).not.toContain('function devWarn');
});

test('grid.ts stays a thin delegator under the line-count guard', () => {
  // The footer/aggregate logic lands in new modules (aggregate.ts, footer-band.ts, grid-footer.ts,
  // master-detail.ts), so grid.ts keeps only thin accessors + the footer option pass-through. This
  // ceiling is a runaway-growth guard, not the 700-line target; it is re-based only with rationale and
  // never met by re-inlining logic elsewhere.
  const lineCount = src('grid.ts').split('\n').length;
  expect(lineCount).toBeLessThan(1200);
});

test('displayedRows is reactive: an effect re-runs when the source rows change', () => {
  const { grid, rows } = buildGrid();
  const seen: number[] = [];
  const dispose = createRoot((d) => {
    effect(() => {
      seen.push(grid.displayedRows().length);
    });
    return d;
  });
  expect(seen).toEqual([3]); // ran on creation
  rows.set([...rows(), { id: 4, n: 40 }]);
  expect(seen[seen.length - 1]).toBe(4); // re-ran after the mutation
  dispose();
});

test('focusedRow / focusedKey are reactive to cursor movement', () => {
  const { grid, loop } = buildGrid();
  const keys: (number | undefined)[] = [];
  const dispose = createRoot((d) => {
    effect(() => {
      keys.push(grid.focusedKey() as number | undefined);
    });
    return d;
  });
  expect(keys).toEqual([1]);
  loop.dispatch({ type: 'key', key: 'down', ctrl: false, alt: false, shift: false });
  expect(keys[keys.length - 1]).toBe(2);
  dispose();
});

test('focusedRow / focusedKey return undefined on an empty grid', () => {
  const rows = signal<Row[]>([]);
  const grid = new EditableDataGrid<Row>({
    columns: [column<Row, number>({ id: 'n', title: 'N', value: (r) => r.n, width: 8 })],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  expect(grid.focusedRow()).toBeUndefined();
  expect(grid.focusedKey()).toBeUndefined();
  expect(grid.displayedRows()).toEqual([]);
});

test('complete?() is optional: fromRows omits it (absent ⇒ complete); a source may provide it', () => {
  const rows = signal<Row[]>([{ id: 1, n: 10 }]);
  const eager = fromRows(rows, { rowKey: (r) => r.id });
  expect(eager.complete).toBeUndefined(); // absent ⇒ treated as complete downstream

  // A windowed source can declare partial completeness through the same optional seam.
  const windowed: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => rows().length,
    rowAt: (i) => rows()[i],
    complete: () => false,
  };
  expect(windowed.complete?.()).toBe(false);
});
