/** Implementation tests for failure containment, repaint stages, and late transaction settlement. */
import { expect, test, vi } from 'vitest';
import { createRowRevertController, createRowRevertTransactionController } from '../src/row-revert.js';
import type { OnRevertRow } from '../src/commit.js';

interface Row {
  id: number;
  first: number;
  second: number;
}

interface Harness {
  readonly row: Row;
  readonly sessions: ReturnType<typeof createRowRevertController<Row>>;
  readonly transaction: ReturnType<typeof createRowRevertTransactionController<Row>>;
  readonly callback: ReturnType<typeof vi.fn<OnRevertRow<Row>>>;
  readonly dirty: Set<string>;
  readonly bump: ReturnType<typeof vi.fn>;
  readonly active: () => string | null;
  replace(row: Row): void;
}

function harness(
  options: {
    readonly decision?: boolean | Promise<boolean>;
    readonly firstApply?: (row: Row, value: unknown) => void;
    readonly secondApply?: (row: Row, value: unknown) => void;
  } = {},
): Harness {
  const target: Row = { id: 1, first: 10, second: 20 };
  const sessions = createRowRevertController<Row>(true);
  sessions.recordCommit({
    rowKey: 1,
    row: target,
    columnId: 'first',
    previous: 1,
    value: 10,
    apply:
      options.firstApply ??
      ((row, value) => {
        if (typeof value === 'number') row.first = value;
      }),
  });
  sessions.recordCommit({
    rowKey: 1,
    row: target,
    columnId: 'second',
    previous: 2,
    value: 20,
    apply:
      options.secondApply ??
      ((row, value) => {
        if (typeof value === 'number') row.second = value;
      }),
  });
  sessions.markTrapped(1, target);

  let source = target;
  let displayed = target;
  let focused = target;
  let message: string | null = null;
  const dirty = new Set<string>();
  const bump = vi.fn();
  const callback = vi.fn<OnRevertRow<Row>>(() => options.decision ?? true);
  const transaction = createRowRevertTransactionController({
    sessions,
    onRevertRow: callback,
    internalAllowed: false,
    sourceRow: () => source,
    displayedRow: () => displayed,
    focusedRow: () => focused,
    focusedKey: () => focused.id,
    bodyFocused: () => true,
    addDirty: (key) => dirty.add(key),
    deleteDirty: (key) => dirty.delete(key),
    clearError: vi.fn(),
    activeMessage: () => message,
    note: (next) => {
      message = next;
    },
    publishMutation: bump,
    cellKey: (key, columnId) => `${key}:${columnId}`,
    messages: { pending: 'pending', failed: 'failed', unavailable: 'unavailable' },
  });

  return {
    row: target,
    sessions,
    transaction,
    callback,
    dirty,
    bump,
    active: () => message,
    replace(next): void {
      source = next;
      focused = next;
      // Deliberately retain the cached displayed identity. Settlement must discover and repaint it.
      displayed = target;
    },
  };
}

test('recovers an attempted prefix when a setter mutates and then throws', () => {
  const callback = vi.fn<OnRevertRow<Row>>(() => true);
  const context = harness({
    secondApply: (row, value) => {
      if (typeof value !== 'number') return;
      row.second = value;
      if (value === 2) throw new Error('setter contract violation');
    },
  });
  // Replace the default callback assertion target with the actual controller-owned callback.
  expect(callback).not.toHaveBeenCalled();

  expect(context.transaction.start(1, context.row)).toBe(true);
  expect(context.row).toEqual({ id: 1, first: 10, second: 20 });
  expect(context.callback).not.toHaveBeenCalled();
  expect(context.dirty.size).toBe(0);
  expect(context.active()).toBe('failed');
  expect(context.bump).toHaveBeenCalledTimes(1);
  expect(context.sessions.isTouched(1, context.row)).toBe(false);
});

test('continues compensation after a recovery setter fails and invalidates retry', async () => {
  const context = harness({
    decision: false,
    secondApply: (row, value) => {
      if (typeof value !== 'number') return;
      if (value === 20) throw new Error('recovery failed');
      row.second = value;
    },
  });

  context.transaction.start(1, context.row);
  await Promise.resolve();
  expect(context.row.first).toBe(10);
  expect(context.row.second).toBe(2);
  expect(context.active()).toBe('failed');
  expect(context.bump).toHaveBeenCalledTimes(2);
  expect(context.transaction.start(1, context.row)).toBe(false);
});

test('serializes duplicate starts and repaints once per accepted or rejected mutation stage', async () => {
  let settle!: (accepted: boolean) => void;
  const decision = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const accepted = harness({ decision });
  expect(accepted.transaction.start(1, accepted.row)).toBe(true);
  expect(accepted.transaction.start(1, accepted.row)).toBe(true);
  expect(accepted.callback).toHaveBeenCalledTimes(1);
  settle(true);
  await decision;
  await Promise.resolve();
  expect(accepted.bump).toHaveBeenCalledTimes(1);

  const rejected = harness({ decision: false });
  rejected.transaction.start(1, rejected.row);
  await Promise.resolve();
  expect(rejected.bump).toHaveBeenCalledTimes(2);
  expect(rejected.sessions.isTrapped(1, rejected.row)).toBe(true);
});

test('reconciles a non-reactive replacement once without transferring registry ownership', async () => {
  let settle!: (accepted: boolean) => void;
  const decision = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const context = harness({ decision });
  context.transaction.start(1, context.row);
  const replacement: Row = { id: 1, first: 80, second: 90 };
  context.replace(replacement);
  settle(false);
  await decision;
  await Promise.resolve();

  expect(context.row).toEqual({ id: 1, first: 10, second: 20 });
  expect(replacement).toEqual({ id: 1, first: 80, second: 90 });
  expect(context.bump).toHaveBeenCalledTimes(2);
  expect(context.dirty.size).toBe(0);
  expect(context.active()).toBeNull();
  expect(context.sessions.isTouched(1, replacement)).toBe(false);
});

test('settles captured data after disposal without touching grid-owned state', async () => {
  let settle!: (accepted: boolean) => void;
  const decision = new Promise<boolean>((resolve) => {
    settle = resolve;
  });
  const context = harness({ decision });
  context.transaction.start(1, context.row);
  const messageBefore = context.active();
  const dirtyBefore = new Set(context.dirty);
  context.transaction.dispose();
  context.sessions.dispose();
  settle(false);
  await decision;
  await Promise.resolve();

  expect(context.row).toEqual({ id: 1, first: 10, second: 20 });
  expect(context.bump).toHaveBeenCalledTimes(1);
  expect(context.active()).toBe(messageBefore);
  expect(context.dirty).toEqual(dirtyBefore);
});
