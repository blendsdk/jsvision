/**
 * Specification tests (immutable oracles) — the windowed read path. On a windowed source (one exposing
 * `ensureRange`) the grid's `display()` becomes a **length-correct lazy view** that skips `materialize`
 * and never collapses unloaded holes, and a reactive `revision` bump re-derives it to a fresh identity so
 * a landed page repaints. The eager path (no `ensureRange`) is untouched — a dense materialized array.
 *
 * Expectations derive from the requirements / plan spec, never the implementation.
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal, computed, effect, createRoot } from '@jsvision/ui';
import type { Column } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { SyntheticBodyBand } from '../src/synthetic-columns.js';
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
  body.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: opts.viewport } };
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
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
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
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
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
  band.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(band);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  const text = frame(loop, W, H);
  expect(text).toContain('…'); // the gutter reads as loading (mirrors the body placeholder)
  expect(text).not.toContain('['); // blank checkbox — no `[ ]`/`[x]` (selection is unknown)
});
