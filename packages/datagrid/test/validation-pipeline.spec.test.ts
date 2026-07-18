/**
 * Specification tests (immutable oracles) — the per-cell validation & commit pipeline. A typed column
 * `validate` gate runs on the parsed value before the write and blocks the commit (marking the cell and
 * surfacing its message) while keeping the editor open; a `null` result commits. A `beforeSave` veto
 * (above `onCommit`) reverts the optimistic write and skips `onCommit`; an `onCommit` veto reverts too.
 * An unparseable value is blocked with a generic message. Client validation is UX only — `onCommit`
 * stays the authoritative gate.
 *
 * Expectations derive from the requirements, never the implementation. Commit is await-close (async),
 * so a committing dispatch is followed by a macrotask `tick()` before asserting.
 */
import { test, expect, vi } from 'vitest';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import { PARSE_FAILED } from '../src/format.js';
import type { BeforeSave, OnCommit } from '../src/commit.js';
import { EditableDataGrid } from '../src/grid.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const key = (k: string) => ({ type: 'key' as const, key: k, ctrl: false, alt: false, shift: false });

const W = 24;
const H = 6;

interface Row {
  id: number;
  qty: number;
}

/** col 0 = editable Qty with a `validate` gate rejecting non-positive values. */
function qtyColumn() {
  return column<Row, number>({
    id: 'qty',
    title: 'Qty',
    value: (r) => r.qty,
    parse: (t) => {
      const n = Number(t);
      return Number.isFinite(n) && t.trim() !== '' ? n : PARSE_FAILED;
    },
    set: (r, v) => {
      r.qty = v;
    },
    validate: (v) => (v > 0 ? null : 'must be positive'),
    width: 10,
  });
}

function buildGrid(opts: { beforeSave?: BeforeSave<Row>; onCommit?: OnCommit<Row> } = {}) {
  const rows = signal<Row[]>([
    { id: 1, qty: 5 },
    { id: 2, qty: 8 },
  ]);
  const grid = new EditableDataGrid<Row>({
    columns: [qtyColumn()],
    source: fromRows(rows, { rowKey: (r) => r.id }),
    beforeSave: opts.beforeSave,
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

/** Open the editor on the focused cell and set its field text. */
function editTo(loop: ReturnType<typeof buildGrid>['loop'], text: string): void {
  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set(text);
}

// ST-1 — a `validate` message blocks the commit, keeps the editor open, marks the cell, surfaces the message.
test('ST-1: a validate message blocks the commit, keeps the editor open, marks the cell', async () => {
  const { grid, loop, rows } = buildGrid();
  editTo(loop, '-5');
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0].qty).toBe(5); // record unchanged — nothing written
  expect(loop.getFocused()).toBeInstanceOf(Input); // editor stays open + focused
  expect(grid.isInvalid(1, 'qty')).toBe(true); // the cell is marked invalid
  expect(grid.activeMessage()).toBe('must be positive'); // the message is active
});

// ST-2 — a `null` validate commits: the record updates, the editor closes, no marker remains.
test('ST-2: a null validate result commits and leaves no marker', async () => {
  const { grid, loop, rows } = buildGrid();
  editTo(loop, '42');
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0].qty).toBe(42); // committed
  expect(loop.getFocused()).toBe(grid.rows); // editor closed, body refocused
  expect(grid.isInvalid(1, 'qty')).toBe(false); // no marker
  expect(grid.activeMessage()).toBeNull();
});

// ST-3 — a `beforeSave` veto reverts the record, surfaces a message, and never calls `onCommit`.
test('ST-3: a beforeSave veto reverts and skips onCommit', async () => {
  const onCommit = vi.fn<OnCommit<Row>>(() => true);
  const { loop, rows } = buildGrid({ beforeSave: () => false, onCommit });
  editTo(loop, '7'); // a valid value that passes parse + validate
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0].qty).toBe(5); // reverted to previous
  expect(onCommit).not.toHaveBeenCalled(); // beforeSave short-circuits
  expect(loop.getFocused()).toBeInstanceOf(Input); // a veto keeps the editor open
});

// ST-4 — a rejecting `beforeSave` is a veto (revert), not a crash.
test('ST-4: a rejecting beforeSave is treated as a veto, not a crash', async () => {
  const onCommit = vi.fn<OnCommit<Row>>(() => true);
  const { rows, loop } = buildGrid({ beforeSave: () => Promise.reject(new Error('denied')), onCommit });
  editTo(loop, '9');
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0].qty).toBe(5); // reverted
  expect(onCommit).not.toHaveBeenCalled();
});

// ST-5 — validate ok + beforeSave true + onCommit false → applied then reverted (post-apply veto); editor open.
test('ST-5: an onCommit veto after a passing beforeSave reverts and keeps the editor open', async () => {
  const seen: number[] = [];
  const { loop, rows } = buildGrid({
    beforeSave: () => true,
    onCommit: (c) => {
      seen.push(c.row.qty); // the optimistic write is visible to onCommit
      return false;
    },
  });
  editTo(loop, '11');
  loop.dispatch(key('enter'));
  await tick();
  expect(seen).toEqual([11]); // applied before onCommit ran
  expect(rows()[0].qty).toBe(5); // reverted after the veto
  expect(loop.getFocused()).toBeInstanceOf(Input); // editor stays open
});

// ST-6 — an unparseable value is blocked with a generic message; onCommit is never reached; record unchanged.
test('ST-6: an unparseable value is marked invalid with a generic message and never persists', async () => {
  const onCommit = vi.fn<OnCommit<Row>>(() => true);
  const { grid, loop, rows } = buildGrid({ onCommit });
  editTo(loop, 'abc'); // PARSE_FAILED
  loop.dispatch(key('enter'));
  await tick();
  expect(rows()[0].qty).toBe(5); // unchanged
  expect(onCommit).not.toHaveBeenCalled();
  expect(loop.getFocused()).toBeInstanceOf(Input); // editor stays open
  expect(grid.isInvalid(1, 'qty')).toBe(true); // marked invalid
  expect(grid.activeMessage()).not.toBeNull(); // a generic message is surfaced
});
