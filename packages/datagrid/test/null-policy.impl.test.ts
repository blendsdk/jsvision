/**
 * Implementation tests (edges/internals) — the per-column null policy (RD-08 Phase 5).
 *
 * The spec oracles (`null-policy.spec.test.ts`, ST-19 … ST-20) pin the requirement behaviour; these
 * cover the edges: a null value renders `''` when `nullDisplay` is omitted (never the literal `"null"`),
 * a non-null value still renders through `format` (the null branch does not intercept it), and a
 * NON-nullable numeric column still rejects an empty commit (`parse('')` → `PARSE_FAILED`, editor stays
 * open) — the null policy is opt-in and does not relax numeric validation.
 */
import { test, expect, vi } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { EditableDataGrid } from '../src/grid.js';
import { PARSE_FAILED } from '../src/format.js';
import type { OnCommit } from '../src/commit.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const W = 20;
const H = 6;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false };
}

/** Mount a grid full-viewport, focus its body, and flush a first frame. */
function mount<T>(grid: EditableDataGrid<T>) {
  grid.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);
  loop.renderRoot.flush();
  return loop;
}

function text(loop: ReturnType<typeof mount>, x: number, y: number, len: number): string {
  const buf = loop.renderRoot.buffer();
  let s = '';
  for (let i = 0; i < len; i += 1) s += buf.get(x + i, y)?.char ?? ' ';
  return s;
}

interface Emp {
  id: number;
  dept: string | null;
}

test('a null value renders "" when nullDisplay is omitted (never the literal "null")', () => {
  const rows = signal<Emp[]>([{ id: 1, dept: null }]);
  const grid = new EditableDataGrid<Emp>({
    columns: [column<Emp, string | null>({ id: 'dept', title: 'Dept', value: (r) => r.dept, width: 12 })],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  const loop = mount(grid);
  expect(text(loop, 0, 1, 4)).toBe('    '); // blank — the default nullDisplay is '', not "null"
});

test('a non-null value still renders through format (the null branch does not intercept it)', () => {
  const rows = signal<Emp[]>([{ id: 1, dept: 'ops' }]);
  const grid = new EditableDataGrid<Emp>({
    columns: [
      column<Emp, string | null>({
        id: 'dept',
        title: 'Dept',
        value: (r) => r.dept,
        format: (v) => (v ?? '').toUpperCase(),
        nullDisplay: '-',
        width: 12,
      }),
    ],
    source: fromRows(rows, { rowKey: (r) => r.id }),
  });
  const loop = mount(grid);
  expect(text(loop, 0, 1, 3)).toBe('OPS'); // format ran; nullDisplay applies only to a nullish value
});

interface Q {
  id: number;
  qty: number;
}

test('a numeric non-nullable column rejects an empty commit (parse → PARSE_FAILED, editor stays open)', async () => {
  const rows = signal<Q[]>([{ id: 1, qty: 5 }]);
  const spy = vi.fn<OnCommit<Q>>(() => true);
  const grid = new EditableDataGrid<Q>({
    columns: [
      column<Q, number>({
        id: 'qty',
        title: 'Qty',
        value: (r) => r.qty,
        format: (v) => String(v),
        parse: (t) => {
          const n = Number(t);
          return t.trim() === '' || Number.isNaN(n) ? PARSE_FAILED : n;
        },
        set: (r, v) => {
          r.qty = v;
        },
        width: 8,
        // NOT nullable — an empty commit must parse, not clear to null
      }),
    ],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    onCommit: spy,
  });
  const loop = mount(grid);

  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set(''); // clear to empty
  loop.dispatch(key('enter'));
  await tick();

  expect(rows()[0].qty).toBe(5); // unchanged — the empty parse was rejected, no null written
  expect(spy).not.toHaveBeenCalled(); // the commit sink is never reached on a parse failure
  expect(loop.getFocused()).toBeInstanceOf(Input); // the editor stays open for correction
});
