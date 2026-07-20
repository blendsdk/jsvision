/**
 * Implementation tests — the lifecycle controller + helpers: string-shorthand normalization, the
 * defensive `status()`-throws-to-ready guard, the filter-aware empty message, and grid-level checks
 * (header visible across states, the Retry button omitted without `retry`, the no-config `<empty>` body).
 */
import { test, expect } from 'vitest';
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { createLifecycleController, emptyMessage } from '../src/grid-lifecycle.js';
import type { GridStatus } from '../src/grid-lifecycle.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// ─── controller + helpers ────────────────────────────────────────────────────────────────────────────

test('string shorthands normalize to their object states', () => {
  const state = (raw: GridStatus) => createLifecycleController({ status: () => raw }).state();
  expect(state('loading')).toBe('loading');
  expect(state({ kind: 'loading' })).toBe('loading');
  expect(state('ready')).toBe('ready');
  expect(state({ kind: 'ready' })).toBe('ready');
  expect(state({ kind: 'error', message: 'x' })).toBe('error');
});

test('a throwing status is treated as ready (never crashes the render)', () => {
  const c = createLifecycleController({
    status: () => {
      throw new Error('boom');
    },
  });
  expect(c.state()).toBe('ready');
  expect(c.placeholder()).toBeNull();
});

test('placeholder is null when ready, a view otherwise', () => {
  expect(createLifecycleController({ status: () => 'ready' }).placeholder()).toBeNull();
  expect(createLifecycleController({ status: () => 'loading' }).placeholder()).not.toBeNull();
  expect(createLifecycleController({ status: () => ({ kind: 'error', message: 'x' }) }).placeholder()).not.toBeNull();
});

test('a controller with no status is always ready', () => {
  expect(createLifecycleController({}).state()).toBe('ready');
  expect(createLifecycleController({}).placeholder()).toBeNull();
});

test('emptyMessage is filter-aware', () => {
  expect(emptyMessage('None', 0, 5)).toBe('No matching rows'); // a filter hid all 5
  expect(emptyMessage('None', 3, 5)).toBe('No matching rows'); // any filtered < total
  expect(emptyMessage('None', 0, 0)).toBe('None'); // truly empty source → caller text
  expect(emptyMessage(undefined, 0, 0)).toBe('No rows'); // default
});

// ─── grid-level ──────────────────────────────────────────────────────────────────────────────────────

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
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  return { grid, loop };
}

function frameText(loop: ReturnType<typeof build>['loop']): string {
  loop.renderRoot.flush();
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

test('the header stays visible in loading and error states', () => {
  const loading = build({ status: () => 'loading' });
  expect(frameText(loading.loop)).toContain('Amount');
  const error = build({ status: () => ({ kind: 'error', message: 'x' }) });
  expect(frameText(error.loop)).toContain('Amount');
});

test('the error view omits the Retry button when no retry is provided', () => {
  const { loop } = build({ status: () => ({ kind: 'error', message: 'boom' }) }); // no retry
  const text = frameText(loop);
  expect(text).toContain('boom');
  expect(text).not.toContain('Retry');
});

test('a grid with no status/emptyText keeps the plain <empty> body at zero rows', () => {
  const { loop } = build({ rows: [] });
  expect(frameText(loop)).toContain('<empty>');
});
