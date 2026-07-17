/**
 * Implementation tests — edge cases of `commitCell`: the no-`onCommit` path (apply only, no revert),
 * late-resolving async commits (both accept and veto are awaited correctly), and the `beforeSave`
 * gate's interaction with `onCommit` (short-circuit ordering, gate-only path, late-async veto).
 */
import { test, expect, vi } from 'vitest';
import { commitCell } from '../src/commit.js';

interface Rec {
  v: number;
}

const apply = (row: Rec, _columnId: string, v: number): void => {
  row.v = v;
};

test('should commit with no onCommit sink (apply only, no revert)', async () => {
  const rec: Rec = { v: 1 };
  const res = await commitCell({ row: rec, columnId: 'v', rowKey: 1, previous: 1, next: 9, apply });
  expect(res).toEqual({ committed: true, value: 9 });
  expect(rec.v).toBe(9);
});

test('should await a late-resolving async accept', async () => {
  const rec: Rec = { v: 1 };
  const res = await commitCell({
    row: rec,
    columnId: 'v',
    rowKey: 1,
    previous: 1,
    next: 9,
    apply,
    onCommit: () => new Promise((resolve) => setTimeout(() => resolve(true), 5)),
  });
  expect(res).toEqual({ committed: true, value: 9 });
  expect(rec.v).toBe(9);
});

test('should revert on a late-resolving veto', async () => {
  const rec: Rec = { v: 1 };
  const res = await commitCell({
    row: rec,
    columnId: 'v',
    rowKey: 1,
    previous: 1,
    next: 9,
    apply,
    onCommit: () => new Promise((resolve) => setTimeout(() => resolve(false), 5)),
  });
  expect(res).toEqual({ committed: false, value: 1 });
  expect(rec.v).toBe(1);
});

test('should commit through a passing beforeSave with no onCommit sink', async () => {
  const rec: Rec = { v: 1 };
  const beforeSave = vi.fn(() => true);
  const res = await commitCell({ row: rec, columnId: 'v', rowKey: 1, previous: 1, next: 9, apply, beforeSave });
  expect(res).toEqual({ committed: true, value: 9 });
  expect(rec.v).toBe(9);
  expect(beforeSave).toHaveBeenCalledTimes(1);
});

test('should run beforeSave strictly before onCommit and call each once when both pass', async () => {
  const rec: Rec = { v: 1 };
  const order: string[] = [];
  const res = await commitCell({
    row: rec,
    columnId: 'v',
    rowKey: 1,
    previous: 1,
    next: 9,
    apply,
    beforeSave: () => {
      order.push('beforeSave');
      return true;
    },
    onCommit: () => {
      order.push('onCommit');
      return true;
    },
  });
  expect(res).toEqual({ committed: true, value: 9 });
  expect(order).toEqual(['beforeSave', 'onCommit']); // gate first, sink second
});

test('should revert on a late-resolving beforeSave veto without ever awaiting onCommit', async () => {
  const rec: Rec = { v: 1 };
  const onCommit = vi.fn(() => true);
  const res = await commitCell({
    row: rec,
    columnId: 'v',
    rowKey: 1,
    previous: 1,
    next: 9,
    apply,
    beforeSave: () => new Promise((resolve) => setTimeout(() => resolve(false), 5)),
    onCommit,
  });
  expect(res).toEqual({ committed: false, value: 1 });
  expect(rec.v).toBe(1);
  expect(onCommit).not.toHaveBeenCalled();
});
