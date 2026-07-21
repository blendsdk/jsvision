/**
 * Specification tests (immutable oracles) — the windowed read path. On a windowed source (one exposing
 * `ensureRange`) the grid's `display()` becomes a **length-correct lazy view** that skips `materialize`
 * and never collapses unloaded holes, and a reactive `revision` bump re-derives it to a fresh identity so
 * a landed page repaints. The eager path (no `ensureRange`) is untouched — a dense materialized array.
 *
 * Expectations derive from the requirements / plan spec, never the implementation.
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal, computed, effect, createRoot } from '@jsvision/ui';
import type { Column } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { SyntheticBodyBand } from '../src/synthetic-columns.js';
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

/** Fixed-width columns (an `auto` column would force an all-rows width measure — never on the windowed path). */
const cols = [
  column<Row, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 6 }),
  column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 }),
];

/** An async windowed source over a synthetic dataset; the last page is trimmed to `total`. */
function makeSource(total: number, pageSize: number) {
  return asyncWindowedSource<Row>({
    total,
    pageSize,
    fetchPage: (page) =>
      Promise.resolve(
        Array.from({ length: pageSize }, (_, k) => {
          const id = page * pageSize + k;
          return { id, name: `row-${id}` };
        }).filter((r) => r.id < total),
      ),
    rowKey: (r) => r.id,
  });
}

// ST-1 — the windowed display reports the source total and never runs `materialize` (which would scan
// every row). With only the first page loaded, `display().length` is the grand total and no full-scan ran.
test('ST-1: windowed display is length-correct and does not materialize', async () => {
  const src = makeSource(100000, 50);
  await src.ensureRange(0, 50); // load only rows [0,50)
  await src.settle();
  const grid = new EditableDataGrid<Row>({ columns: cols, source: src });

  src.resetCounts();
  const display = grid.displayedRows();
  expect(display.length).toBe(100000); // length-correct even with 99950 rows unloaded
  expect(src.rowAtCount()).toBe(0); // materialize (a 100000× rowAt scan) did NOT run
});

// ST-2 — an integer index returns the loaded row, and an unloaded index returns `undefined` — the hole
// is preserved, never collapsed away (which would misalign every index past it).
test('ST-2: windowed display preserves unloaded holes', async () => {
  const src = makeSource(100000, 50);
  await src.ensureRange(0, 50);
  await src.settle();
  const grid = new EditableDataGrid<Row>({ columns: cols, source: src });

  const display = grid.displayedRows();
  expect(display[10]).toEqual({ id: 10, name: 'row-10' }); // loaded
  expect(display[500]).toBeUndefined(); // unloaded → a preserved hole (not collapsed)
});

// ST-3 — a landed page bumps the reactive `revision`, and an effect bound to the windowed display
// derivation (the exact shape the grid uses: read `revision`, return a fresh lazy view) re-runs with a
// fresh identity → the repaint fires.
test('ST-3: a revision bump re-derives the windowed display to a fresh identity', async () => {
  const src = makeSource(100, 10);
  const seen: unknown[] = [];
  const dispose = createRoot((d) => {
    // Mirrors grid.ts's windowed display branch: `derived(() => { source.revision?.(); return windowedView(source); })`.
    const display = computed(() => {
      src.revision();
      return windowedView(src);
    });
    effect(() => {
      seen.push(display());
    });
    return d;
  });

  expect(seen.length).toBe(1); // ran once on creation
  src.rowAt(0); // miss → kicks the page fetch
  await src.settle(); // page lands → revision bumps → effect re-runs (synchronous propagation)
  expect(seen.length).toBe(2); // re-derived → repaint
  // Compare identity by reference (`===` triggers no Proxy trap); the loud view throws on any
  // introspecting matcher access, so `.not.toBe` is not usable here — by design.
  expect(seen[0] === seen[1]).toBe(false); // a fresh identity (a new lazy view)
  dispose();
});

// ST-4 — the eager path is byte-identical to before: a `fromRows` source is not windowed, and its
// display is a dense materialized array supporting whole-array ops (which throw on the windowed view).
test('ST-4: an eager source stays a dense materialized array (regression guard)', () => {
  const rows = signal<Row[]>([
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
  ]);
  const src = fromRows(rows, { rowKey: (r) => r.id });
  expect(isWindowed(src)).toBe(false); // no ensureRange → eager

  const grid = new EditableDataGrid<Row>({ columns: cols, source: src });
  const display = grid.displayedRows();
  expect(display.length).toBe(2);
  expect(display.map((r) => r.id)).toEqual([1, 2]); // whole-array ops work on the dense eager array
  expect([...display]).toHaveLength(2); // iterable (spread) — eager only
});

// ---- Phase 2 — windowed rendering, prefetch & coalescing (ST-5…ST-10) ----

const bodyCols: Column<Row>[] = [
  { title: 'ID', accessor: (r) => String(r.id), width: 6 },
  { title: 'Name', accessor: (r) => r.name, width: 12 },
];

/** A windowed body whose every row resolves (isolating the window/coalesce math from placeholders). */
function buildWindowBody(opts: { total: number; viewport: number; prefetch?: number }) {
  const source: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => opts.total,
    rowAt: (i) => ({ id: i, name: `row-${i}` }),
    ensureRange: () => undefined,
  };
  const calls: Array<[number, number]> = [];
  const focused = signal(0);
  const body = new EditableGridRows<Row>({
    display: () => windowedView(source),
    columns: bodyCols,
    autoWidths: () => bodyCols.map(() => null),
    indent: signal(0),
    focused,
    selected: signal(-1),
    zebra: false,
    focusedCol: signal(0),
    typedColumns: bodyCols.map((c, i) => ({
      id: `c${i}`,
      title: c.title,
      value: (r: Row) => (i === 0 ? r.id : r.name),
    })),
    overlay: new Group(),
    rowKey: (r) => r.id,
    bumpVersion: () => undefined,
    ensureRange: (s, e) => void calls.push([s, e]),
    rowCount: () => opts.total,
    prefetch: opts.prefetch,
  });
  const W = 24;
  body.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: opts.viewport } });
  const root = new Group();
  root.add(body);
  const loop = createEventLoop({ width: W, height: opts.viewport }, { caps });
  loop.mount(root);
  return { body, loop, focused, calls };
}

// ST-5 — the visible window [top, top+visible) drives a single ensureRange covering visible + a
// one-viewport buffer each side, clamped. Viewport 20, focused 1019 → top 1000 → ensureRange(980, 1040).
test('ST-5: the window drives one clamped ensureRange over visible + a one-viewport buffer', async () => {
  const { loop, focused, calls } = buildWindowBody({ total: 100000, viewport: 20 });
  focused.set(1019); // keepVisible(1019, 0, 20, 100000) === 1000
  loop.renderRoot.flush();
  await tick();
  expect(calls).toEqual([[980, 1040]]); // clamp(1000-20), clamp(1000+20+20)
});

// ST-7 — rapid intra-frame scroll coalesces to ≤1 ensureRange for the settled window; a repeat draw
// at the unchanged window issues none.
test('ST-7: rapid scroll coalesces to one ensureRange; an unchanged window issues none', async () => {
  const { loop, focused, calls } = buildWindowBody({ total: 100000, viewport: 20 });
  for (const f of [100, 200, 500, 800, 1019]) {
    focused.set(f); // five deltas within one frame (no await between → one coalesced request)
    loop.renderRoot.flush();
  }
  await tick();
  expect(calls).toEqual([[980, 1040]]); // exactly one call, for the settled window
  // A repeat draw at the same settled window issues no new call.
  loop.renderRoot.flush();
  await tick();
  expect(calls).toEqual([[980, 1040]]);
});

// ST-8 — window bounds are always integers in [0, length()], even near the end and under hostile
// (negative / huge / fractional) scroll positions (security: a source never gets a bad range).
test('ST-8: ensureRange bounds are clamped, integer, and never out of range', async () => {
  const total = 100000;
  const { loop, focused, calls } = buildWindowBody({ total, viewport: 20 });
  for (const f of [99999, -100, 1e9, 50.7, 12345.9]) {
    focused.set(f);
    loop.renderRoot.flush();
    await tick();
  }
  expect(calls.length).toBeGreaterThan(0);
  for (const [start, end] of calls) {
    expect(Number.isInteger(start)).toBe(true);
    expect(Number.isInteger(end)).toBe(true);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeLessThanOrEqual(total); // never exceeds length()
    expect(start).toBeLessThanOrEqual(end);
  }
  // Near the end (focused 99999 → top 99980), the end clamps exactly to length().
  expect(calls.some(([, end]) => end === total)).toBe(true);
});

/** An async source over `total` rows, page size `pageSize`; nothing loaded until requested. */
function pagedSource(total: number, pageSize: number) {
  return asyncWindowedSource<Row>({
    total,
    pageSize,
    fetchPage: (page) =>
      Promise.resolve(
        Array.from({ length: pageSize }, (_, k) => ({
          id: page * pageSize + k,
          name: `row-${page * pageSize + k}`,
        })).filter((r) => r.id < total),
      ),
    rowKey: (r) => r.id,
  });
}

/** Read the rendered frame of a mounted event loop as one string per screen row. */
function frame(loop: ReturnType<typeof createEventLoop>, w: number, h: number): string {
  const buf = loop.renderRoot.buffer();
  const out: string[] = [];
  for (let y = 0; y < h; y += 1) {
    let s = '';
    for (let x = 0; x < w; x += 1) s += buf.get(x, y)?.char ?? ' ';
    out.push(s);
  }
  return out.join('\n');
}

// ST-6 — an unloaded row paints the muted `…`; when its page lands (and the source bumps revision) it
// repaints to the real values. The grid auto-requests the visible window on mount.
test('ST-6: an unloaded row paints … then repaints to real values on a landed page', async () => {
  const W = 26;
  const H = 6;
  const src = pagedSource(1000, 100);
  const cols = [column({ id: 'name', title: 'Name', value: (r: Row) => r.name, width: 14 })];
  const grid = new EditableDataGrid<Row>({ columns: cols, source: src });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);

  const before = frame(loop, W, H);
  expect(before).toContain('…'); // unloaded rows show the muted placeholder
  expect(before).not.toContain('row-0');

  await tick(); // the auto-requested window fetch lands → revision bumps
  loop.renderRoot.flush();
  const after = frame(loop, W, H);
  expect(after).toContain('row-0'); // repainted to real values
  expect(after).not.toContain('…');
});

// ST-9 — a cursor on an unloaded focused row is read-only: focusedRow()/focusedKey() are undefined
// (no rowKey(undefined) crash), and F2 opens no editor. focusedKey() is the strong probe — it routes
// through focusAnchorKey → rowKey(before[i]), which throws on an unloaded row without the guard.
test('ST-9: an unloaded focused cell is read-only (no rowKey(undefined) crash)', () => {
  const W = 26;
  const H = 6;
  const src = pagedSource(1000, 100); // nothing loaded yet
  const cols = [
    column<Row, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 14,
    }),
  ];
  const grid = new EditableDataGrid<Row>({ columns: cols, source: src });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  expect(grid.focusedRow()).toBeUndefined(); // unloaded focused row → undefined
  expect(() => grid.focusedKey()).not.toThrow(); // focusAnchorKey guards the undefined row
  expect(grid.focusedKey()).toBeUndefined();
  loop.dispatch({ type: 'key', key: 'f2', ctrl: false, alt: false, shift: false });
  expect(grid.rows.isEditing()).toBe(false); // no editor opened on the placeholder row
});

// ST-10 — the synthetic prefix band mirrors the body: an unloaded row renders a `…` gutter placeholder
// and a blank checkbox (no `[ ]`/`[x]`), never crashing on rowKey(undefined).
test('ST-10: the synthetic prefix band renders a placeholder for an unloaded row', () => {
  const W = 12;
  const H = 4;
  const src = pagedSource(1000, 100); // nothing loaded → every visible row is a hole
  const band = new SyntheticBodyBand<Row>({
    display: () => windowedView(src),
    columns: [],
    autoWidths: () => [],
    indent: signal(0),
    focused: signal(0),
    selected: signal(-1),
    zebra: false,
    prefix: { checkbox: true, rowNumbers: true, rowCount: 1000 },
    selectedKeys: signal<ReadonlySet<string | number>>(new Set()),
    rowKey: (r) => r.id,
    onToggleRow: () => undefined,
    active: () => false,
  });
  band.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(band);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  const text = frame(loop, W, H);
  expect(text).toContain('…'); // the gutter reads as loading (mirrors the body placeholder)
  expect(text).not.toContain('['); // blank checkbox — no `[ ]`/`[x]` (selection is unknown)
});

// ---- Phase 3 — full-scan consumer guards (ST-11…ST-17) ----

/** Mount a grid over `source` at W×H, focus the body, and return the loop. */
function mountGrid(source: GridDataSource<Row>, gridCols = cols, W = 26, H = 6) {
  const grid = new EditableDataGrid<Row>({ columns: gridCols, source });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  return { grid, loop };
}

// ST-11 — a windowed source with an auto-width column skips the all-rows measure (the loud view would
// throw on a scan), falls back to a fixed width + a devWarn, and autoFitColumn is a no-op.
test('ST-11: windowed auto-width skips the measure (fallback + devWarn); autoFitColumn no-ops', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const src = pagedSource(1000, 100);
  const autoCols = [column<Row, string>({ id: 'name', title: 'Name', value: (r) => r.name })]; // no width ⇒ auto
  const grid = new EditableDataGrid<Row>({ columns: autoCols, source: src });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 5 } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 20, height: 5 }, { caps });
  expect(() => loop.mount(root)).not.toThrow(); // measureAutoWidths skipped — a scan would throw on the loud view
  expect(warn.mock.calls.flat().join(' ')).toMatch(/auto-width/i); // fallback devWarn
  src.resetCounts();
  grid.autoFitColumn('name'); // no-op for windowed (cannot measure unloaded rows)
  expect(src.rowAtCount()).toBeLessThan(50); // no full-scan measure
  warn.mockRestore();
});

// ST-12 — (a) a windowed source lacking push-down throws at construction; (b) a configured one pushes
// sort/filter down to the source and never client-scans.
test('ST-12: windowed push-down is required (throws) and runs server-side with no client scan', () => {
  const minimal: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => 10,
    rowAt: () => undefined,
    ensureRange: () => undefined,
  };
  expect(() => new EditableDataGrid<Row>({ columns: cols, source: minimal })).toThrow(/setSort|setFilter/);

  const src = pagedSource(1000, 100);
  const { grid } = mountGrid(src);
  src.resetCounts();
  grid.sortBy('name');
  expect(src.spies.setSort.length).toBeGreaterThan(0); // sort pushed down
  grid.setFilter('name', { kind: 'text', op: 'contains', value: 'x' });
  expect(src.spies.setFilter.length).toBeGreaterThan(0); // filter pushed down
  expect(src.rowAtCount()).toBeLessThan(100); // no materialize / client scan
});

interface RowB {
  id: number;
  balance: number;
}

// ST-13 — a windowed footer aggregate cell renders blank + a one-time devWarn; the fold is never invoked
// (no displayedRows().map over the lazy view).
test('ST-13: a windowed footer aggregate is blank + a one-time devWarn (fold not invoked)', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  let scans = 0;
  const src: GridDataSource<RowB> = {
    rowKey: (r) => r.id,
    length: () => 1000,
    rowAt: (i) => {
      scans += 1;
      return { id: i, balance: 10 };
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
  expect(footer.cell('balance')).toBe(''); // blank — NOT a misleading '0'/'Σ 0'
  expect(scans).toBe(0); // the fold did not run (no map over the lazy view)
  expect(warn.mock.calls.flat().join(' ')).toMatch(/windowed/i);
  warn.mockRestore();
});

// ST-14 — windowed selection disables select-all / tri-state / Ctrl+Shift range (they map over the whole
// display); a single-row keyed toggle works on a loaded row and no-ops on an unloaded (placeholder) row.
test('ST-14: windowed selection disables select-all/range; keyed toggle guards unloaded rows', async () => {
  const src = pagedSource(1000, 100);
  await src.ensureRange(0, 100); // load rows [0,100); rows >= 100 stay unloaded
  await src.settle();
  const sel = new GridSelection<Row>({
    mode: 'multi',
    focused: signal(0),
    display: () => windowedView(src),
    rowKey: (r) => r.id,
    windowed: true,
  });
  sel.selectAllDisplayed();
  expect(sel.read().size).toBe(0); // disabled (a map over length() would throw)
  expect(() => sel.currentTriState()).not.toThrow();
  expect(sel.currentTriState()).toBe('none');
  expect(() => sel.rangeToRow(50)).not.toThrow(); // range disabled
  expect(sel.read().size).toBe(0);

  sel.toggleAtRow(0); // loaded → toggles its key
  expect(sel.read().has(0)).toBe(true);
  sel.toggleAtRow(500); // unloaded → no-op (no rowKey(undefined))
  expect(sel.read().size).toBe(1);
});

// ST-15 — windowed counts read source.length(); a pushed-down filter re-reports a smaller total, and
// filtered ≡ grand total (the v1 single-length limitation).
test('ST-15: windowed counts read source.length() (filtered ≡ grand total, v1)', () => {
  const src = pagedSource(100000, 100);
  const { grid } = mountGrid(src);
  expect(grid.totalCount()).toBe(100000);
  expect(grid.filteredCount()).toBe(100000);
  grid.setFilter('name', { kind: 'text', op: 'contains', value: 'x' });
  src.setTotal(4000); // the server re-reports the filtered total
  expect(grid.filteredCount()).toBe(4000);
  expect(grid.totalCount()).toBe(4000); // filtered ≡ grand total (a distinct grand total is Phase B)
});

// ST-16 — windowed mutation appends via insert (no `at`) and deletes via remove (key-based); duplicate /
// positional insert is a no-op + devWarn; no source linear scan runs.
test('ST-16: windowed mutation is append/delete via the seam; duplicate no-ops without scanning', () => {
  const warn = vi.fn();
  const inserts: Array<[Row, number | undefined]> = [];
  const removes: Array<readonly (string | number)[]> = [];
  let scans = 0;
  const src: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => 1000,
    rowAt: (i) => {
      scans += 1;
      return { id: i, name: `r${i}` };
    },
    ensureRange: () => undefined,
    insert: (row, at) => void inserts.push([row, at]),
    remove: (keys) => void removes.push(keys),
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
    assignKey: (clone) => clone,
    warn,
    windowed: true,
  });
  mut.insertRow({ id: 9999, name: 'new' });
  expect(inserts).toEqual([[{ id: 9999, name: 'new' }, undefined]]); // append, no positional `at`
  mut.deleteRows([1]);
  expect(removes).toEqual([[1]]); // key-based remove
  scans = 0;
  mut.duplicateRow(5); // windowed → no-op + devWarn, no linear scan
  expect(warn).toHaveBeenCalled();
  expect(scans).toBe(0);
});

// ST-17 — opening a value-list filter on a windowed grid delegates to source.distinct (never a client
// materialize/computeDistinct), and the popup sample reads source.rowAt(0) — so no full-scan runs.
test('ST-17: a windowed value-list filter delegates to source.distinct with no client scan', async () => {
  const distinctCalls: string[] = [];
  const src = asyncWindowedSource<Row>({
    total: 100000,
    pageSize: 100,
    fetchPage: (p) =>
      Promise.resolve(Array.from({ length: 100 }, (_, k) => ({ id: p * 100 + k, name: `r${p * 100 + k}` }))),
    rowKey: (r) => r.id,
    distinct: (columnId) => {
      distinctCalls.push(columnId);
      return Promise.resolve({ values: ['r0', 'r1'], truncated: true });
    },
  });
  await src.ensureRange(0, 100);
  await src.settle();
  const { loop } = mountGrid(src);
  src.resetCounts();
  loop.dispatch({ type: 'key', key: 'down', ctrl: false, alt: true, shift: false }); // Alt+Down → open the popup on the focused column ('id')
  await tick();
  expect(src.spies.distinct.length).toBeGreaterThan(0); // delegated to source.distinct
  expect(distinctCalls).toContain('id'); // the focused column's value-list delegated, never a client scan
  expect(src.rowAtCount()).toBeLessThan(100); // no computeDistinct(materialize) / sample full-scan
});

// ---- Phase 4 — helper source contract (ST-18) ----

// ST-18 — the async paged source: a miss returns undefined + kicks the page fetch (idempotent); a landed
// page bumps revision; loaded pages are retained (a re-read issues no re-fetch); rows are stable mutable
// refs (an in-place edit persists); ensureRange returns a settle-able Promise.
test('ST-18: the async paged source loads on miss, settles, bumps revision, retains pages, stable refs', async () => {
  let fetches = 0;
  const src = asyncWindowedSource<Row>({
    total: 100000,
    pageSize: 100,
    fetchPage: (p) => {
      fetches += 1;
      return Promise.resolve(Array.from({ length: 100 }, (_, k) => ({ id: p * 100 + k, name: `r${p * 100 + k}` })));
    },
    rowKey: (r) => r.id,
  });
  const rev0 = src.revision();
  expect(src.rowAt(250)).toBeUndefined(); // page 2 not loaded → hole + fetch kicked
  expect(src.rowAt(251)).toBeUndefined(); // same page in flight → no second fetch (idempotent)
  expect(fetches).toBe(1);
  await src.settle();
  expect(src.revision()).toBeGreaterThan(rev0); // a landed page bumped the revision
  expect(src.rowAt(250)).toEqual({ id: 250, name: 'r250' }); // now loaded

  const before = fetches;
  src.rowAt(299); // still page 2 — retained, no re-fetch
  await src.settle();
  expect(fetches).toBe(before);

  const row = src.rowAt(250)!;
  row.name = 'edited';
  expect(src.rowAt(250)!.name).toBe('edited'); // stable, mutable ref — an in-place edit persists

  const p = src.ensureRange(300, 500);
  expect(p).toBeInstanceOf(Promise); // settle-able Promise
  await p;
  expect(src.rowAt(400)).toEqual({ id: 400, name: 'r400' });
});
