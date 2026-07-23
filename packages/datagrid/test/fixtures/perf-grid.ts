/**
 * Shared fixture for the perf-bench (ST-4) and bytes-∝-damage (ST-5) specs: a 60×22 representative
 * editable grid over an EAGER in-memory `fromRows` source (no async paging — measurement reflects
 * render cost, not loading). ~5 columns and enough rows to fill the 21 visible body rows.
 *
 * `fromRows` takes a `Signal<T[]>` plus a required `{ rowKey }`; the returned `rows` signal is exposed
 * so ST-5 can apply a single-cell change and re-serialize the damage diff. The render root is a bare
 * `createRenderRoot` (no event loop — the bench drives compose/serialize directly).
 */
import { Group, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import type { Signal } from '@jsvision/ui';
import { defaultTheme } from '@jsvision/core';
import { column } from '../../src/column.js';
import { fromRows } from '../../src/data-source.js';
import { EditableDataGrid } from '../../src/grid.js';

/** A row record for the perf/bytes fixture. */
export interface PerfRec {
  id: number;
  name: string;
  city: string;
  balance: number;
  status: string;
}

/** The built perf scene: the render root, the backing rows signal, and the viewport size. */
export interface PerfGrid {
  readonly rr: ReturnType<typeof createRenderRoot>;
  readonly rows: Signal<PerfRec[]>;
  readonly width: number;
  readonly height: number;
}

const W = 60;
const H = 22;

/** Deterministically generate `n` rows (no RNG, so the bench/diff is stable across runs). */
function makeRows(n: number): PerfRec[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `Customer ${i + 1}`,
    city: `City ${i % 7}`,
    balance: 1000 + i * 37,
    status: i % 2 === 0 ? 'active' : 'idle',
  }));
}

/** Build the 60×22 perf grid fresh (each call is independent). */
export function buildPerfGrid(): PerfGrid {
  const rows = signal<PerfRec[]>(makeRows(30)); // > 21 visible → the viewport is full
  const columns = [
    column<PerfRec, number>({ id: 'id', title: 'ID', value: (r) => r.id, width: 6, align: 'right' }),
    column<PerfRec, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 16,
    }),
    column<PerfRec, string>({ id: 'city', title: 'City', value: (r) => r.city, width: 12 }),
    column<PerfRec, number>({ id: 'balance', title: 'Balance', value: (r) => r.balance, width: 12, align: 'right' }),
    column<PerfRec, string>({ id: 'status', title: 'Status', value: (r) => r.status, width: 10 }),
  ];

  const grid = new EditableDataGrid<PerfRec>({
    columns,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    zebra: true,
  });
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });

  const root = new Group();
  root.add(grid);

  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
  const rr = createRenderRoot({ width: W, height: H }, { caps, theme: defaultTheme });
  rr.mount(root);

  return { rr, rows, width: W, height: H };
}
