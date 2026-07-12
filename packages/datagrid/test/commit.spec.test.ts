/**
 * Specification tests (immutable oracles) — the `commitCell` primitive. It applies an edit to the
 * in-memory record immediately, calls the `onCommit` veto sink, and reverts to the previous value when
 * the commit is rejected (returns `false` or a rejected promise).
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect } from 'vitest';
import { commitCell } from '../src/commit.js';
import type { CellCommit } from '../src/commit.js';

interface Rec {
  balance: number;
}

const applyBalance = (row: Rec, _columnId: string, v: number): void => {
  row.balance = v;
};

// ST-8 — onCommit receives the exact change (after the immediate apply).
test('should call onCommit with the exact change', async () => {
  const rec: Rec = { balance: 1 };
  let seen: CellCommit<Rec> | undefined;
  await commitCell({
    row: rec,
    columnId: 'balance',
    rowKey: 7,
    previous: 1,
    next: 2,
    apply: applyBalance,
    onCommit: (c) => {
      seen = c;
      return true;
    },
  });
  expect(seen).toEqual({ rowKey: 7, columnId: 'balance', value: 2, previous: 1, row: rec });
});

// ST-8 — accept keeps the new value; veto and rejection both revert to previous.
test('should keep the new value on accept and revert on veto or rejection', async () => {
  const rec: Rec = { balance: 1 };

  const accepted = await commitCell({
    row: rec,
    columnId: 'balance',
    rowKey: 1,
    previous: 1,
    next: 2,
    apply: applyBalance,
    onCommit: () => true,
  });
  expect(accepted).toEqual({ committed: true, value: 2 });
  expect(rec.balance).toBe(2);

  rec.balance = 1;
  const vetoed = await commitCell({
    row: rec,
    columnId: 'balance',
    rowKey: 1,
    previous: 1,
    next: 2,
    apply: applyBalance,
    onCommit: () => false,
  });
  expect(vetoed).toEqual({ committed: false, value: 1 });
  expect(rec.balance).toBe(1); // reverted

  rec.balance = 1;
  const rejected = await commitCell({
    row: rec,
    columnId: 'balance',
    rowKey: 1,
    previous: 1,
    next: 2,
    apply: applyBalance,
    onCommit: () => Promise.reject(new Error('nope')),
  });
  expect(rejected).toEqual({ committed: false, value: 1 });
  expect(rec.balance).toBe(1); // a rejected commit is a veto, not a crash
});
