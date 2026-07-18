/**
 * Specification tests (immutable oracles) — the `commitCell` primitive. It applies an edit to the
 * in-memory record immediately, calls the `onCommit` veto sink, and reverts to the previous value when
 * the commit is rejected (returns `false` or a rejected promise).
 *
 * Expectations derive from the requirements, never the implementation.
 */
import { test, expect, vi } from 'vitest';
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

// A `beforeSave` veto (returns `false`) reverts the record and never reaches `onCommit` — beforeSave
// decides *whether* to persist, above the onCommit sink.
test('should revert on a beforeSave veto and never call onCommit', async () => {
  const rec: Rec = { balance: 1 };
  const onCommit = vi.fn(() => true);
  const vetoed = await commitCell({
    row: rec,
    columnId: 'balance',
    rowKey: 1,
    previous: 1,
    next: 2,
    apply: applyBalance,
    beforeSave: () => false,
    onCommit,
  });
  expect(vetoed).toEqual({ committed: false, value: 1 });
  expect(rec.balance).toBe(1); // reverted to previous
  expect(onCommit).not.toHaveBeenCalled(); // beforeSave short-circuits before onCommit
});

// A rejecting/throwing `beforeSave` is treated as a veto (revert), not a crash — mirrors onCommit.
test('should treat a rejecting beforeSave as a veto, not a crash', async () => {
  const rec: Rec = { balance: 1 };
  const onCommit = vi.fn(() => true);
  const rejected = await commitCell({
    row: rec,
    columnId: 'balance',
    rowKey: 1,
    previous: 1,
    next: 2,
    apply: applyBalance,
    beforeSave: () => Promise.reject(new Error('denied')),
    onCommit,
  });
  expect(rejected).toEqual({ committed: false, value: 1 });
  expect(rec.balance).toBe(1);
  expect(onCommit).not.toHaveBeenCalled();
});

// beforeSave accepts, then onCommit vetoes: the value is applied, then reverted (post-apply veto). This
// pins the ordering apply → beforeSave → onCommit, both gates sharing the one revert path.
test('should apply then revert when beforeSave accepts but onCommit vetoes', async () => {
  const rec: Rec = { balance: 1 };
  const beforeSave = vi.fn(() => true);
  const seenDuringOnCommit: number[] = [];
  const result = await commitCell({
    row: rec,
    columnId: 'balance',
    rowKey: 1,
    previous: 1,
    next: 2,
    apply: applyBalance,
    beforeSave,
    onCommit: () => {
      seenDuringOnCommit.push(rec.balance); // the optimistic write is visible to onCommit
      return false;
    },
  });
  expect(beforeSave).toHaveBeenCalledTimes(1);
  expect(seenDuringOnCommit).toEqual([2]); // applied before onCommit ran
  expect(result).toEqual({ committed: false, value: 1 });
  expect(rec.balance).toBe(1); // reverted after the onCommit veto
});
