/**
 * Implementation tests — edge cases of `commitCell`: the no-`onCommit` path (apply only, no revert)
 * and late-resolving async commits (both accept and veto are awaited correctly).
 */
import { test, expect } from 'vitest';
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
