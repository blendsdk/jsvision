/**
 * Specification tests (immutable oracles) — the grid's lifecycle states. A caller-driven `status`
 * getter drives loading / ready / error; the grid derives `empty` from the filtered row count when
 * ready. Loading shows a spinner (rows hidden, header still visible); error shows the message plus a
 * working Retry; empty shows `emptyText` (or the filter-aware `'No matching rows'`); ready shows the
 * grid. A grid with no `status`/`emptyText` keeps its plain zero-row `<empty>` body (no regression).
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect, vi } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import type { GridStatus } from '../src/grid-lifecycle.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const W = 30;
const H = 8;

interface Row {
  id: number;
  amount: number;
}

function build(opts: { rows?: Row[]; status?: () => GridStatus; emptyText?: string }) {
  const rows = signal<Row[]>(opts.rows ?? [{ id: 1, amount: 4242 }]);
  const grid = new EditableDataGrid<Row>({
    columns: [column<Row, number>({ id: 'amount', title: 'Amount', value: (r) => r.amount })],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    status: opts.status,
    emptyText: opts.emptyText,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  return { grid, loop };
}

function frameText(loop: ReturnType<typeof build>['loop']): string {
  loop.renderRoot.flush(); // apply any pending swap / re-derive before reading the frame
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

/** The (x, y) of the first cell whose row starts `needle`, or null. */
function findText(loop: ReturnType<typeof build>['loop'], needle: string): { x: number; y: number } | null {
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < H; y += 1) {
    let s = '';
    for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
    const i = s.indexOf(needle);
    if (i >= 0) return { x: i, y };
  }
  return null;
}

const mouse = (kind: 'down' | 'up', x: number, y: number) => ({ type: 'mouse' as const, kind, button: 0, x, y });

// ST-17 — loading shows a spinner (rows hidden); the header stays visible.
test('ST-17: loading shows a spinner region with the header still visible and rows hidden', () => {
  const { loop } = build({ status: () => 'loading' });
  const text = frameText(loop);
  expect(text).toContain('Amount'); // the header column title stays visible
  expect(text).toContain('Loading'); // the loading label
  expect(text).not.toContain('4242'); // the row data is hidden while loading
});

// ST-18 — error shows the message + a Retry button; clicking Retry calls the retry callback.
test('ST-18: error shows the message and a working Retry button', () => {
  const retry = vi.fn();
  const { loop } = build({ status: () => ({ kind: 'error', message: 'boom', retry }) });
  expect(frameText(loop)).toContain('boom'); // the error message
  const at = findText(loop, 'Retry');
  expect(at, 'a Retry button is shown').not.toBeNull();
  // Click the Retry face (down + up inside).
  loop.dispatch(mouse('down', at!.x + 1, at!.y + 1)); // 1-based screen coords
  loop.dispatch(mouse('up', at!.x + 1, at!.y + 1));
  expect(retry).toHaveBeenCalledTimes(1);
});

// ST-19 — ready + 0 rows shows emptyText (no filter) or the filter-aware built-in (active filter).
test('ST-19: empty shows emptyText with no filter and the filter-aware message under a filter', () => {
  // (a) truly empty source, no filter → emptyText.
  const empty = build({ rows: [], status: () => 'ready', emptyText: 'Nothing here' });
  expect(frameText(empty.loop)).toContain('Nothing here');
  expect(frameText(empty.loop)).not.toContain('No matching rows');

  // (b) a non-empty source filtered down to zero → the built-in filter-aware message.
  const filtered = build({ rows: [{ id: 1, amount: 5 }], status: () => 'ready', emptyText: 'Nothing here' });
  filtered.grid.setFilter('amount', { kind: 'number', op: 'eq', a: 999 }); // matches nothing
  expect(frameText(filtered.loop)).toContain('No matching rows');
});

// ST-20 — ready + rows shows the grid; a no-config grid with 0 rows keeps the plain <empty> body.
test('ST-20: ready shows the grid; a no-config zero-row grid still shows <empty>', () => {
  const withRows = build({ status: () => 'ready', rows: [{ id: 1, amount: 4242 }] });
  expect(frameText(withRows.loop)).toContain('4242'); // the grid renders its rows

  const noConfig = build({ rows: [] }); // no status, no emptyText
  expect(frameText(noConfig.loop)).toContain('<empty>'); // unchanged plain body
});
