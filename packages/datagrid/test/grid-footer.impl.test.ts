/**
 * Implementation tests (internals & guards) for the RD-09 footer surface. This file grows across the
 * footer phases; the Phase-2 slice covers the headroom extractions, the grid.ts thin-delegator
 * line-count guard, the reactivity of the new displayed/focused readouts, and the optional source
 * completeness seam.
 */
import { test, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Group, Text, Button, createEventLoop, resolveCapabilities, signal, effect, createRoot } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
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
  // master-detail.ts), so grid.ts keeps only thin accessors + the footer option pass-through + the
  // controller wiring. This ceiling is a runaway-growth guard, not the 700-line target. The headroom
  // extractions (EditorOverlay/PopupCatcher -> overlay.ts, devWarn -> dev.ts) reclaimed ~53 lines first;
  // the remaining IRREDUCIBLE public surface — the footer option, the three reactive readout accessors,
  // and the footer-controller wiring — still crosses the original 1200, so the ceiling is re-based with
  // this rationale, and is NEVER met by re-inlining logic that belongs in the new modules. It is re-based
  // again 1250 -> 1300 for the navigation surface: the keymap option pass-through plus the thin
  // nextCell/prevCell/isBodyFocused delegators (the pure cursor math lives in navigation.ts).
  const lineCount = src('grid.ts').split('\n').length;
  expect(lineCount).toBeLessThan(1300);
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

// ---- Phase 3: footer controller + band ----------------------------------------------------------

interface Sale {
  id: number;
  amount: number;
  region: string;
}
function buildFooterGrid(withFooter: boolean, width = 30, height = 6) {
  const rows = signal<Sale[]>([
    { id: 1, amount: 10, region: 'N' },
    { id: 2, amount: 20, region: 'S' },
    { id: 3, amount: 30, region: 'E' },
  ]);
  const grid = new EditableDataGrid<Sale>({
    columns: [
      column<Sale, number>({ id: 'amount', title: 'Amount', value: (r) => r.amount, align: 'right', width: 16 }),
      column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 }),
    ],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    ...(withFooter ? { footer: { aggregates: { amount: { fn: 'sum' } } } } : {}),
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width, height } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  const amountAt = (y: number): string => {
    const buf = loop.renderRoot.buffer();
    let s = '';
    for (let x = 0; x < 16; x += 1) s += buf.get(x, y)?.char ?? ' ';
    return s.trim();
  };
  return { grid, loop, amountAt };
}

test('the footer controller is instantiated (not inlined) — the fold lives in grid-footer.ts', () => {
  const gridFooter = src('grid-footer.ts');
  const grid = src('grid.ts');
  expect(gridFooter).toContain('export class FooterController'); // the controller + validation live here
  expect(grid).toContain('new FooterController'); // grid.ts instantiates it
  expect(grid).toContain('import { FooterController }');
  expect(grid).not.toContain('foldAggregate'); // grid.ts never inlines the fold itself
});

test('the footer band is present only when a footer with aggregates is declared', () => {
  const footerY = 6 - 2; // header(0) · body(1,2,3) · footer(4) · hbar(5)
  const withFooter = buildFooterGrid(true);
  expect(withFooter.amountAt(footerY)).toBe('60'); // the aggregate band occupies the fixed bottom band

  const noFooter = buildFooterGrid(false);
  expect(noFooter.amountAt(footerY)).not.toBe('60'); // no footer band → that row is not an aggregate
});

test('a rebuild (partition change) recreates the footer band', () => {
  const footerY = 6 - 2;
  const { grid, loop, amountAt } = buildFooterGrid(true);
  expect(amountAt(footerY)).toBe('60');
  // Hiding a column changes the partition shape → rebuildBody re-runs buildGridBody (which recreates the
  // footer). The aggregate must survive the rebuild.
  grid.setColumnVisible('region', false);
  loop.renderRoot.flush();
  expect(amountAt(footerY)).toBe('60'); // footer recreated with the aggregate intact
});

// ---- Phase 4: widget row ------------------------------------------------------------------------

function buildWidgetImplGrid(widgets: View[], width = 30, height = 6) {
  const rows = signal<Sale[]>([
    { id: 1, amount: 10, region: 'N' },
    { id: 2, amount: 20, region: 'S' },
  ]);
  const grid = new EditableDataGrid<Sale>({
    columns: [
      column<Sale, number>({ id: 'amount', title: 'Amount', value: (r) => r.amount, width: 16 }),
      column<Sale, string>({ id: 'region', title: 'Region', value: (r) => r.region, width: 8 }),
    ],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    footer: { widgets },
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width, height } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  const rowAt = (y: number): string => {
    const buf = loop.renderRoot.buffer();
    let s = '';
    for (let x = 0; x < width; x += 1) s += buf.get(x, y)?.char ?? ' ';
    return s;
  };
  return { grid, loop, rowAt };
}

test('the widget row is built only when footer.widgets is non-empty', () => {
  const footerY = 6 - 2;
  const withWidgets = buildWidgetImplGrid([new Text('HELLO')]);
  expect(withWidgets.rowAt(footerY)).toContain('HELLO'); // the widget row occupies the bottom band

  const noWidgets = buildWidgetImplGrid([]);
  expect(noWidgets.rowAt(footerY)).not.toContain('HELLO'); // empty widgets ⇒ no widget band
});

test('a footer button is mounted in the dispatch tree so its command routes to onCommand', () => {
  const go = new Button('Go', { command: 'go' });
  const { loop } = buildWidgetImplGrid([go]);
  const fired = vi.fn();
  loop.onCommand('go', fired);
  loop.focusView(go); // reachable ⇒ the widget is live in the mounted tree
  loop.dispatch({ type: 'key', key: 'space', ctrl: false, alt: false, shift: false });
  expect(fired).toHaveBeenCalledTimes(1);
});

test('a rebuild (partition change) keeps a footer widget working', () => {
  const footerY = 6 - 2;
  const { grid, loop, rowAt } = buildWidgetImplGrid([new Text('HELLO')]);
  expect(rowAt(footerY)).toContain('HELLO');
  grid.setColumnVisible('region', false); // triggers rebuildBody
  loop.renderRoot.flush();
  expect(rowAt(footerY)).toContain('HELLO'); // the reused widget survives the rebuild
});
