/**
 * Implementation tests — the read-only container's edge cases: the empty-source `<empty>` render, the
 * windowed-materialization path (a source with a not-yet-loaded hole renders only its loaded rows),
 * and the exposed `rows`/`overlay` handles.
 */
import { test, expect, vi } from 'vitest';
import { Group, Input, View, createEventLoop, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { GridDataSource } from '../src/data-source.js';
import type { OnCommit } from '../src/commit.js';
import { EditableDataGrid } from '../src/grid.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';
import { asyncWindowedSource } from './fixtures/async-windowed-source.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

interface Row {
  id: number;
  name: string;
}
const W = 16;
const H = 5;

function renderGrid(source: GridDataSource<Row>): { rows: string[]; grid: EditableDataGrid<Row> } {
  const columns = [column({ id: 'name', title: 'Name', value: (r: Row) => r.name })];
  const grid = new EditableDataGrid<Row>({ columns, source });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const render = createRenderRoot({ width: W, height: H }, { caps });
  render.mount(root);
  const buf = render.buffer();
  const rows: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
    rows.push(s);
  }
  return { rows, grid };
}

test('should render <empty> for an empty source', () => {
  const { rows } = renderGrid(fromRows(signal<Row[]>([]), { rowKey: (r) => r.id }));
  expect(rows.join('\n')).toContain('<empty>');
});

test('should materialize only the loaded rows from a windowed source with a hole', () => {
  const loaded: Row[] = [
    { id: 1, name: 'Ada' },
    { id: 3, name: 'Cy' },
  ];
  // Reports length 3 but index 1 is not yet loaded (returns undefined).
  const holey: GridDataSource<Row> = {
    rowKey: (r) => r.id,
    length: () => 3,
    rowAt: (i) => (i === 0 ? loaded[0] : i === 2 ? loaded[1] : undefined),
  };
  const { rows } = renderGrid(holey);
  const body = rows.slice(1).join('\n');
  expect(body).toContain('Ada');
  expect(body).toContain('Cy'); // the hole at index 1 is skipped — only the two loaded rows render
});

test('should expose the focusable rows renderer and the overlay host', () => {
  const { grid } = renderGrid(fromRows(signal<Row[]>([{ id: 1, name: 'Ada' }]), { rowKey: (r) => r.id }));
  expect(grid.rows.focusable).toBe(true);
  expect(grid.overlay).toBeInstanceOf(Group);
});

// ---- Editable container internals (Phase 5): shared-signal injection, version repaint, onCommit threading ----

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false };
}

interface Emp {
  id: number;
  name: string;
  city: string;
}

/** Build a two-column editable container, focus its body, and return the handles. */
function buildInteractive(opts: { onCommit?: OnCommit<Emp> } = {}) {
  const rows = signal<Emp[]>([
    { id: 1, name: 'Ada', city: 'NYC' },
    { id: 2, name: 'Bo', city: 'LA' },
  ]);
  const columns = [
    column<Emp, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 6,
    }),
    column<Emp, string>({
      id: 'city',
      title: 'City',
      value: (r) => r.city,
      parse: (t) => t,
      set: (r, v) => {
        r.city = v;
      },
      width: 6,
    }),
  ];
  const grid = new EditableDataGrid<Emp>({
    columns,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    onCommit: opts.onCommit,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  return { grid, loop, rows };
}

/** The characters painted on each screen row of the loop's frame. */
function frameRows(loop: ReturnType<typeof buildInteractive>['loop']): string[] {
  const buf = loop.renderRoot.buffer();
  const out: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
    out.push(s);
  }
  return out;
}

// The container mounts an EditableGridRows body and injects the shared column cursor, so a `→` before
// begin-edit targets the second column through the container.
test('mounts an EditableGridRows body sharing the injected column cursor', async () => {
  const { grid, loop, rows } = buildInteractive();
  expect(grid.rows).toBeInstanceOf(EditableGridRows);
  loop.dispatch(key('right')); // move the shared column cursor to 'city'
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  expect(editor).toBeInstanceOf(Input);
  if (editor instanceof Input) {
    expect(editor.getValueSignal()()).toBe('NYC'); // seeded from column 1 (city) — the cursor moved
    editor.getValueSignal().set('SF');
  }
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0].city).toBe('SF'); // committed into the second column
  expect(rows()[0].name).toBe('Ada'); // the first column untouched
});

// An in-place cell write mutates the row object without changing the rows-array reference; the repaint
// comes from the container's version bump folded into the display computed (AR #5 mechanism).
test('repaints an in-place cell write via the version bump (stable rows reference)', async () => {
  const { loop, rows } = buildInteractive();
  const before = rows(); // capture the array reference
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('Zed');
  loop.dispatch(key('enter'));
  await tick();
  loop.renderRoot.flush();
  expect(rows()).toBe(before); // same array reference — the row object was mutated in place
  expect(frameRows(loop).slice(1).join('\n')).toContain('Zed'); // repaint came from the version bump
});

// A vetoing onCommit threaded through the container keeps the editor open with the field preserved.
test('threads a vetoing onCommit through the container — the editor stays open', async () => {
  const spy = vi.fn<OnCommit<Emp>>(() => false);
  const { loop } = buildInteractive({ onCommit: spy });
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('bad');
  loop.dispatch(key('enter'));
  await tick();
  expect(spy).toHaveBeenCalledTimes(1);
  const still = loop.getFocused();
  expect(still).toBeInstanceOf(Input); // vetoed → the editor remains open through the container
  if (still instanceof Input) expect(still.getValueSignal()()).toBe('bad'); // field preserved
});

// ---- AC-1: bounded cell views at scale (ST-19) ----

interface Big {
  id: number;
  name: string;
}
const bigCols = [column<Big, string>({ id: 'name', title: 'Name', value: (r) => r.name, width: 12 })];

/** Count the mounted views in a tree (Group children are the only structural nesting). */
function countViews(v: View): number {
  let n = 1;
  if (v instanceof Group) for (const c of v.children) n += countViews(c);
  return n;
}

function mountBig(source: GridDataSource<Big>) {
  const grid = new EditableDataGrid<Big>({ columns: bigCols, source });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 32 } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: 20, height: 32 }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  return { grid, loop, root };
}

const pgdn = { type: 'key' as const, key: 'pagedown', ctrl: false, alt: false, shift: false };

// ST-19 — a 100k windowed grid AND a 100k in-memory grid each mount a bounded number of views (the
// single-view body paints only the window — no per-row View), and a page-scroll does not grow the count.
test('ST-19: 100k windowed and 100k in-memory grids keep a bounded, scroll-stable view count', () => {
  // Windowed: nothing materialized; the lazy view paints only the visible window.
  const windowed = asyncWindowedSource<Big>({
    total: 100000,
    pageSize: 100,
    fetchPage: (p) =>
      Promise.resolve(Array.from({ length: 100 }, (_, k) => ({ id: p * 100 + k, name: `r${p * 100 + k}` }))),
    rowKey: (r) => r.id,
  });
  const w = mountBig(windowed);
  const wBefore = countViews(w.root);
  for (let i = 0; i < 5; i += 1) w.loop.dispatch(pgdn);
  const wAfter = countViews(w.root);
  expect(wBefore).toBeLessThan(60); // bounded — NOT ~100000 (no per-row view)
  expect(wAfter).toBe(wBefore); // a page-scroll does not grow the mounted-view count

  // In-memory large: `materialize` copies once on data-change, but the body is still a single view.
  const rows = signal<Big[]>(Array.from({ length: 100000 }, (_, i) => ({ id: i, name: `r${i}` })));
  const e = mountBig(fromRows(rows, { rowKey: (r) => r.id }));
  const eBefore = countViews(e.root);
  for (let i = 0; i < 5; i += 1) e.loop.dispatch(pgdn);
  const eAfter = countViews(e.root);
  expect(eBefore).toBeLessThan(60);
  expect(eAfter).toBe(eBefore);
});
