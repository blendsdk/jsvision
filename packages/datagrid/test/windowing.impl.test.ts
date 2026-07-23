/**
 * Implementation tests — the internals of `windowing.ts`: the lazy-view Proxy's `length`/index/`has`
 * traps, its **fail-loud** contract (any whole-array access throws, whether the source is fully loaded
 * or partly loaded), and the `isWindowed` predicate + inert `revision` read on the eager path.
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { FooterController } from '../src/grid-footer.js';
import { GridSelection } from '../src/grid-selection.js';
import { RowMutations } from '../src/row-mutations.js';
import { isWindowed, windowedView } from '../src/windowing.js';
import { asyncWindowedSource } from './fixtures/async-windowed-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

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

// ---- Phase 2 — coalescer edges & placeholder precedence ----

/** A windowed body over `total` synthetic rows; records the ensureRange windows it requests. */
function windowBody(total: number, viewport: number) {
  const calls: Array<[number, number]> = [];
  const source: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => total,
    rowAt: (i) => (i >= 0 && i < total ? { id: i, name: `r${i}` } : undefined),
    ensureRange: () => undefined,
  };
  const focused = signal(0);
  const bodyCols: Column<Row>[] = [{ title: 'ID', accessor: (r) => String(r.id), width: 6 }];
  const body = new EditableGridRows<Row>({
    display: () => windowedView(source),
    columns: bodyCols,
    autoWidths: () => [null],
    indent: signal(0),
    focused,
    selected: signal(-1),
    zebra: false,
    focusedCol: signal(0),
    typedColumns: [{ id: 'id', title: 'ID', value: (r: Row) => r.id }],
    overlay: new Group(),
    rowKey: (r) => r.id,
    bumpVersion: () => undefined,
    ensureRange: (s, e) => void calls.push([s, e]),
    rowCount: () => total,
  });
  body.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 20, height: viewport } });
  const root = new Group();
  root.add(body);
  const loop = createEventLoop({ width: 20, height: viewport }, { caps });
  loop.mount(root);
  return { body, loop, focused, calls };
}

test('coalescer: an empty windowed source requests no window (the draw returns early)', async () => {
  const { calls } = windowBody(0, 5);
  await tick();
  expect(calls).toEqual([]);
});

test('coalescer: a single-row source requests exactly one clamped window', async () => {
  const { calls } = windowBody(1, 5);
  await tick();
  expect(calls).toEqual([[0, 1]]); // clamp(0-5,0,1)=0, clamp(0+5+5,0,1)=1
});

test('coalescer: a window at exactly length() clamps end to length()', async () => {
  const { loop, focused, calls } = windowBody(40, 20);
  focused.set(39); // keepVisible(39,0,20,40) === 20 → window [0, clamp(20+20+20,0,40)=40]
  loop.renderRoot.flush();
  await tick();
  expect(calls.at(-1)).toEqual([0, 40]); // end clamps exactly to length()
});

test('coalescer: a new settled window after a prior one fires a fresh call (de-dup releases)', async () => {
  const { loop, focused, calls } = windowBody(100000, 20);
  await tick(); // the mount window [0,40]
  focused.set(1019);
  loop.renderRoot.flush();
  await tick(); // a distinct window → a fresh call
  expect(calls).toEqual([
    [0, 40],
    [980, 1040],
  ]);
});

test('placeholder: an unloaded focused row on a zebra grid paints … and stays read-only', () => {
  const W = 22;
  const H = 6;
  const src = asyncWindowedSource<Row>({
    total: 1000,
    pageSize: 100,
    fetchPage: (p) =>
      Promise.resolve(Array.from({ length: 100 }, (_, k) => ({ id: p * 100 + k, name: `r${p * 100 + k}` }))),
    rowKey: (r) => r.id,
  });
  const cols = [column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 })];
  const grid = new EditableDataGrid<Row>({ columns: cols, source: src, zebra: true });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  const buf = loop.renderRoot.buffer();
  let text = '';
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) text += buf.get(x, y)?.char ?? ' ';
  expect(text).toContain('…'); // placeholder shows regardless of the zebra stripe
  expect(grid.focusedRow()).toBeUndefined(); // the focused unloaded row is read-only
});

// ---- Phase 3 — full-scan consumer guard edges ----

interface RowB {
  id: number;
  balance: number;
}

test('windowed footer: the devWarn fires once across repeated cell() calls (fold never invoked)', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  let scans = 0;
  const src: GridDataSource<RowB> = {
    rowKey: (r) => r.id,
    length: () => 500,
    rowAt: (i) => {
      scans += 1;
      return { id: i, balance: 1 };
    },
    ensureRange: () => undefined,
  };
  const columns = new Map([
    ['balance', column<RowB, number>({ id: 'balance', title: 'Bal', value: (r) => r.balance })],
  ]);
  const footer = new FooterController<RowB>({
    footer: { aggregates: { balance: { fn: 'sum' } } },
    columns,
    displayedRows: () => windowedView(src),
    windowed: true,
  });
  scans = 0;
  expect(footer.cell('balance')).toBe('');
  expect(footer.cell('balance')).toBe('');
  expect(footer.cell('balance')).toBe('');
  expect(scans).toBe(0); // never folds over the lazy view
  const windowedWarns = warn.mock.calls.flat().filter((m) => String(m).includes('windowed-footer'));
  expect(windowedWarns.length).toBe(1); // one-time
  warn.mockRestore();
});

test('windowed selection: tri-state reads none and toggle-all no-ops (no display map)', () => {
  const src: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => 1000,
    rowAt: (i) => ({ id: i, name: `r${i}` }),
    ensureRange: () => undefined,
  };
  const sel = new GridSelection<Row>({
    mode: 'multi',
    focused: signal(0),
    display: () => windowedView(src),
    rowKey: (r) => r.id,
    windowed: true,
  });
  expect(sel.currentTriState()).toBe('none');
  sel.toggleAll(); // inert
  expect(sel.read().size).toBe(0);
  expect(() => sel.rangeTo(5)).not.toThrow();
  expect(sel.read().size).toBe(0);
});

test('windowed mutation: a positional insert `at` is dropped to an append', () => {
  const inserts: Array<[Row, number | undefined]> = [];
  const src: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => 1000,
    rowAt: (i) => ({ id: i, name: `r${i}` }),
    ensureRange: () => undefined,
    insert: (row, at) => void inserts.push([row, at]),
  };
  const sel = new GridSelection<Row>({
    mode: 'multi',
    focused: signal(0),
    display: () => windowedView(src),
    rowKey: (r) => r.id,
    windowed: true,
  });
  const mut = new RowMutations<Row>({
    source: src,
    display: () => windowedView(src),
    selection: sel,
    warn: () => undefined,
    windowed: true,
  });
  mut.insertRow({ id: 42, name: 'x' }, 5); // an explicit positional index
  expect(inserts).toEqual([[{ id: 42, name: 'x' }, undefined]]); // dropped to append
});

test('windowed auto-width: an auto column falls back and the grid renders without a scan', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const src = asyncWindowedSource<Row>({
    total: 5000,
    pageSize: 100,
    fetchPage: (p) =>
      Promise.resolve(Array.from({ length: 100 }, (_, k) => ({ id: p * 100 + k, name: `r${p * 100 + k}` }))),
    rowKey: (r) => r.id,
  });
  const autoCols = [column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name })]; // no width ⇒ auto
  const grid = new EditableDataGrid<Row>({ columns: autoCols, source: src });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 18, height: 4 } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 18, height: 4 }, { caps });
  src.resetCounts();
  expect(() => loop.mount(root)).not.toThrow(); // fixed fallback — no all-rows measure (a scan would throw)
  expect(src.rowAtCount()).toBeLessThan(50); // the auto-width scan did not run
  const buf = loop.renderRoot.buffer();
  let frame = '';
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < 18; x += 1) frame += buf.get(x, y)?.char ?? ' ';
  expect(frame).toContain('…'); // the grid rendered (unloaded rows show the placeholder) — the fallback held
  warn.mockRestore();
});

// ---- Phase 4 — async fixture edges ----

function pagedRows(page: number, size: number): Row[] {
  return Array.from({ length: size }, (_, k) => ({ id: page * size + k, name: `r${page * size + k}` }));
}

test('async source: two reads of the same unloaded page kick exactly one fetch (in-flight de-dup)', async () => {
  let fetches = 0;
  const src = asyncWindowedSource<Row>({
    total: 10000,
    pageSize: 100,
    fetchPage: (p) => {
      fetches += 1;
      return Promise.resolve(pagedRows(p, 100));
    },
    rowKey: (r) => r.id,
  });
  src.rowAt(500); // page 5 miss
  src.rowAt(550); // same page, still in flight
  src.rowAt(599); // same page
  expect(fetches).toBe(1);
  await src.settle();
  expect(fetches).toBe(1); // still one — no duplicate fetch
});

test('async source: settle() with zero pending resolves immediately', async () => {
  const src = asyncWindowedSource<Row>({
    total: 100,
    pageSize: 100,
    fetchPage: (p) => Promise.resolve(pagedRows(p, 100)),
    rowKey: (r) => r.id,
  });
  await expect(src.settle()).resolves.toBeUndefined(); // nothing in flight → resolves
});

test('async source: a window straddling two unloaded pages loads both', async () => {
  let fetches = 0;
  const src = asyncWindowedSource<Row>({
    total: 10000,
    pageSize: 100,
    fetchPage: (p) => {
      fetches += 1;
      return Promise.resolve(pagedRows(p, 100));
    },
    rowKey: (r) => r.id,
  });
  await src.ensureRange(150, 250); // spans page 1 and page 2
  await src.settle();
  expect(fetches).toBe(2);
  expect(src.rowAt(150)).toEqual({ id: 150, name: 'r150' });
  expect(src.rowAt(249)).toEqual({ id: 249, name: 'r249' });
});
