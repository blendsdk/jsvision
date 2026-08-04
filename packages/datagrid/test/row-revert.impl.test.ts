/** Implementation tests for the bounded row-session journal and attempt ownership invariants. */
import { describe, expect, test, vi } from 'vitest';
import { createRowRevertController, createRowRevertTransactionController } from '../src/row-revert.js';
import type { AcceptedCellCommit, RowRevertController } from '../src/row-revert.js';

interface Row {
  id: number;
  first: number;
  second: number;
}

const row = (id: number): Row => ({ id, first: 1, second: 2 });

function record(
  controller: RowRevertController<Row>,
  target: Row,
  columnId: 'first' | 'second',
  previous: number,
  value: number,
): void {
  const change: AcceptedCellCommit<Row> = {
    rowKey: target.id,
    row: target,
    columnId,
    previous,
    value,
    apply: (record, next) => {
      if (typeof next === 'number') record[columnId] = next;
    },
  };
  controller.recordCommit(change);
}

describe('row revert session journal', () => {
  test('retains first-commit order, earliest baselines, and latest accepted values', () => {
    const controller = createRowRevertController<Row>(true);
    const target = row(1);
    record(controller, target, 'second', 2, 20);
    record(controller, target, 'first', 1, 10);
    record(controller, target, 'second', 20, 30);
    controller.markTrapped(1, target);

    const attempt = controller.prepare(1, target);
    expect(attempt?.cells.map(({ columnId, value, previous }) => ({ columnId, value, previous }))).toEqual([
      { columnId: 'second', value: 2, previous: 30 },
      { columnId: 'first', value: 1, previous: 10 },
    ]);
  });

  test('never transfers a same-key session to a replacement object', () => {
    const controller = createRowRevertController<Row>(true);
    const original = row(1);
    const replacement = row(1);
    record(controller, original, 'first', 1, 10);
    controller.markTrapped(1, original);

    expect(controller.isTouched(1, replacement)).toBe(false);
    expect(controller.isTouched(1, original)).toBe(false);
    expect(controller.prepare(1, replacement)).toBeUndefined();
  });

  test('retains only the current row visit and honors targeted invalidation', () => {
    const controller = createRowRevertController<Row>(true);
    const first = row(1);
    const second = row(2);
    record(controller, first, 'first', 1, 10);
    record(controller, second, 'second', 2, 20);

    expect(controller.isTouched(1, first)).toBe(false);
    expect(controller.isTouched(2, second)).toBe(true);
    controller.invalidate(new Set([1]));
    expect(controller.isTouched(2, second)).toBe(true);
    controller.invalidate(new Set([2]));
    expect(controller.isTouched(2, second)).toBe(false);
  });

  test('issues a fresh attempt token for retry and releases an accepted session', () => {
    const controller = createRowRevertController<Row>(true);
    const target = row(1);
    record(controller, target, 'first', 1, 10);
    controller.markTrapped(1, target);
    const first = controller.prepare(1, target);
    expect(first).toBeDefined();
    if (first === undefined) return;

    expect(controller.finish(first, 'rejected')).toEqual({ owned: true, retryable: true });
    const retry = controller.prepare(1, target);
    expect(retry?.token).not.toBe(first.token);
    expect(retry?.cells).toEqual(first.cells);
    if (retry !== undefined) expect(controller.finish(retry, 'accepted')).toEqual({ owned: true, retryable: false });
    expect(controller.isTouched(1, target)).toBe(false);
  });

  test('disabled and disposed controllers reject retained state', () => {
    const disabled = createRowRevertController<Row>(false);
    const target = row(1);
    record(disabled, target, 'first', 1, 10);
    expect(disabled.isTouched(1, target)).toBe(false);

    const enabled = createRowRevertController<Row>(true);
    record(enabled, target, 'first', 1, 10);
    enabled.dispose();
    record(enabled, target, 'second', 2, 20);
    expect(enabled.isTouched(1, target)).toBe(false);
  });
});

test('a stale attempt detaches only its presentation and compensates only its captured row', async () => {
  const sessions = createRowRevertController<Row>(true);
  const original = row(1);
  original.first = 10;
  const replacement = row(1);
  record(sessions, original, 'first', 1, 10);
  sessions.markTrapped(1, original);

  let resolve!: (accepted: boolean) => void;
  const decision = new Promise<boolean>((settle) => {
    resolve = settle;
  });
  const dirty = new Set<string>();
  let active: string | null = null;
  let current = original;
  const transaction = createRowRevertTransactionController({
    sessions,
    onRevertRow: vi.fn(() => decision),
    internalAllowed: false,
    sourceRow: () => current,
    displayedRow: () => current,
    focusedRow: () => current,
    focusedKey: () => 1,
    bodyFocused: () => true,
    addDirty: (key) => dirty.add(key),
    deleteDirty: (key) => dirty.delete(key),
    clearError: vi.fn(),
    activeMessage: () => active,
    note: (message) => {
      active = message;
    },
    bumpVersion: vi.fn(),
    cellKey: (key, columnId) => `${key}:${columnId}`,
    messages: { pending: 'pending', failed: 'failed', unavailable: 'unavailable' },
  });

  expect(transaction.start(1, original)).toBe(true);
  expect(original.first).toBe(1);
  expect(dirty).toEqual(new Set(['1:first']));
  current = replacement;
  transaction.reconcile(1, replacement);
  expect(dirty.size).toBe(0);
  expect(active).toBeNull();

  resolve(false);
  await decision;
  await Promise.resolve();
  expect(original.first).toBe(10);
  expect(replacement.first).toBe(1);
  expect(active).toBeNull();
  expect(sessions.isTouched(1, original)).toBe(false);
});
