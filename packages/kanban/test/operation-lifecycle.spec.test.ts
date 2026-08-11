/**
 * Specification tests for board-owned operation lifecycle transitions.
 *
 * These cases observe payload-free state changes while application persistence remains authoritative.
 * Pending and accepted operations retain their semantic projection until an exact result or correlated
 * publication makes the operation terminal.
 */
import { describe, expect, it, vi } from 'vitest';

import { createKanbanOperationId } from '../src/index.js';
import { KanbanBoardAuthority } from '../src/board/board-authority.js';
import type {
  KanbanOperationId,
  KanbanOperationSnapshot,
  KanbanPublicationSubject,
  KanbanRequest,
  KanbanRequestResult,
} from '../src/index.js';

/** One exact native Promise whose settlement remains under test control. */
function deferredResult() {
  let settle: ((result: KanbanRequestResult) => void) | undefined;
  const promise = new Promise<KanbanRequestResult>((resolve) => {
    settle = resolve;
  });
  return Object.freeze({
    promise,
    resolve(result: KanbanRequestResult): void {
      if (settle === undefined) throw new Error('Deferred result already settled.');
      const current = settle;
      settle = undefined;
      current(result);
    },
  });
}

/** Valid legacy extension request used until standard producers are wired through the same coordinator. */
function request(operationId: KanbanOperationId): KanbanRequest {
  return {
    kind: 'extension',
    extensionId: 'example.lifecycle',
    operationId,
    expected: { board: 'board-r1', source: 'source-r1', query: 'query-r1' },
    payload: { cardKey: 4 },
    signal: new AbortController().signal,
  };
}

/** Exact card publication correlated with one accepted operation. */
function publication(operationId: KanbanOperationId) {
  const subjects: readonly KanbanPublicationSubject[] = Object.freeze([
    Object.freeze({
      kind: 'card',
      cardKey: 4,
      baselineRevision: 'card-r1',
      expectedRevision: 'card-r2',
    }),
  ]);
  return Object.freeze({ operationId, subjects });
}

/** Observe one operation while excluding semantic request payloads from lifecycle state. */
function observe(authority: KanbanBoardAuthority, operationId: KanbanOperationId) {
  const snapshots: KanbanOperationSnapshot[] = [];
  const unsubscribe = authority.subscribe((snapshot) => {
    if (snapshot.operationId === operationId) snapshots.push(snapshot);
  });
  return Object.freeze({ snapshots, unsubscribe });
}

describe('operation lifecycle transitions', () => {
  it('should publish proposed, pending, accepted, and committed around exact publication', async () => {
    const operationId = createKanbanOperationId('operation-accepted-1');
    const deferred = deferredResult();
    const dispatcher = vi.fn(() => deferred.promise);
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}));
    const observed = observe(authority, operationId);

    const completion = authority.request(request(operationId));
    expect(observed.snapshots.map(({ state }) => state)).toEqual(['proposed', 'pending']);
    expect(authority.snapshot().map(({ state }) => state)).toEqual(['pending']);

    const expectation = publication(operationId);
    deferred.resolve({ kind: 'accepted', operationId, publication: expectation });
    await expect(completion).resolves.toEqual({ kind: 'accepted', operationId, publication: expectation });
    expect(observed.snapshots.map(({ state }) => state)).toEqual(['proposed', 'pending', 'accepted']);

    authority.reconcilePublication({ kind: 'matching', ...expectation });
    expect(observed.snapshots.map(({ state }) => state)).toEqual(['proposed', 'pending', 'accepted', 'committed']);
    expect(authority.snapshot()).toEqual([]);
    expect(dispatcher).toHaveBeenCalledOnce();
    observed.unsubscribe();
  });

  it.each(['rejected', 'cancelled', 'superseded'] as const)(
    'should publish proposed and pending before a %s dispatcher result',
    async (kind) => {
      const operationId = createKanbanOperationId(`operation-${kind}-1`);
      const deferred = deferredResult();
      const authority = new KanbanBoardAuthority(
        () => deferred.promise,
        () => ({}),
      );
      const observed = observe(authority, operationId);

      const completion = authority.request(request(operationId));
      deferred.resolve({ kind, operationId, code: `${kind}-by-application` });
      await completion;

      expect(observed.snapshots.map(({ state }) => state)).toEqual(['proposed', 'pending', kind]);
      expect(authority.snapshot()).toEqual([]);
      observed.unsubscribe();
    },
  );

  it('should publish explicit cancellation once and ignore a late accepted settlement', async () => {
    const operationId = createKanbanOperationId('operation-cancelled-explicitly-1');
    const deferred = deferredResult();
    const authority = new KanbanBoardAuthority(
      () => deferred.promise,
      () => ({}),
    );
    const observed = observe(authority, operationId);

    const completion = authority.request(request(operationId));
    expect(authority.cancel(operationId)).toBe(true);
    deferred.resolve({ kind: 'accepted', operationId });
    await completion;

    expect(observed.snapshots.map(({ state }) => state)).toEqual(['proposed', 'pending', 'cancelled']);
    expect(authority.snapshot()).toEqual([]);
    observed.unsubscribe();
  });
});

describe('operation publication settlement', () => {
  it('should keep an accepted operation pending until exact correlated confirmation', async () => {
    const operationId = createKanbanOperationId('operation-explicit-confirmation-1');
    const unrelatedId = createKanbanOperationId('operation-unrelated-1');
    const deferred = deferredResult();
    const authority = new KanbanBoardAuthority(
      () => deferred.promise,
      () => ({}),
    );
    const observed = observe(authority, operationId);

    const completion = authority.request(request(operationId));
    deferred.resolve({ kind: 'accepted', operationId });
    await completion;
    expect(authority.snapshot().map(({ state }) => state)).toEqual(['accepted']);

    authority.reconcilePublication({ kind: 'matching', ...publication(unrelatedId) });
    expect(authority.snapshot().map(({ state }) => state)).toEqual(['accepted']);

    authority.reconcilePublication({ kind: 'confirmed', operationId });
    expect(observed.snapshots.map(({ state }) => state)).toEqual(['proposed', 'pending', 'accepted', 'committed']);
    expect(authority.snapshot()).toEqual([]);
    observed.unsubscribe();
  });

  it.each(['contradictory', 'deleted'] as const)(
    'should let an exact %s authoritative publication supersede the accepted projection',
    async (kind) => {
      const operationId = createKanbanOperationId(`operation-${kind}-publication-1`);
      const expectation = publication(operationId);
      const deferred = deferredResult();
      const authority = new KanbanBoardAuthority(
        () => deferred.promise,
        () => ({}),
      );
      const observed = observe(authority, operationId);

      const completion = authority.request(request(operationId));
      deferred.resolve({ kind: 'accepted', operationId, publication: expectation });
      await completion;
      authority.reconcilePublication({ kind, ...expectation });

      expect(observed.snapshots.map(({ state }) => state)).toEqual(['proposed', 'pending', 'accepted', 'superseded']);
      expect(authority.snapshot()).toEqual([]);
      observed.unsubscribe();
    },
  );

  it('should publish the pending snapshot before invoking an asynchronous dispatcher', async () => {
    const operationId = createKanbanOperationId('operation-atomic-handoff-1');
    const deferred = deferredResult();
    const holder: { authority?: KanbanBoardAuthority } = {};
    const dispatcher = vi.fn(() => {
      expect(holder.authority?.snapshot().map(({ state }) => state)).toEqual(['pending']);
      return deferred.promise;
    });
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}));
    holder.authority = authority;
    const observed = observe(authority, operationId);

    const completion = authority.request(request(operationId));
    expect(dispatcher).toHaveBeenCalledOnce();
    expect(observed.snapshots.map(({ state }) => state)).toEqual(['proposed', 'pending']);

    deferred.resolve({ kind: 'rejected', operationId, code: 'test-complete' });
    await completion;
    observed.unsubscribe();
  });
});
