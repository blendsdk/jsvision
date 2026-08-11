/**
 * Specification tests for board-owned operation lifecycle transitions.
 *
 * These cases observe payload-free state changes while application persistence remains authoritative.
 * Pending and accepted operations retain their semantic projection until an exact result or correlated
 * publication makes the operation terminal.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KANBAN_LIMITS, createKanbanOperationId, createKanbanRequestEnvelope } from '../src/index.js';
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

/** Final standard request for one card subject, used to prove conflict isolation. */
function cardDeleteRequest(operationId: KanbanOperationId, cardKey: number): KanbanRequest {
  return createKanbanRequestEnvelope(
    { kind: 'card-delete', cardKey },
    {
      operationId,
      expected: { entities: [{ kind: 'card', cardKey, revision: `card-${cardKey}-r1` }] },
      signal: new AbortController().signal,
    },
  );
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

beforeEach(() => {
  const authority = new KanbanBoardAuthority(undefined, undefined);
  expect(authority.subscribe).toBeTypeOf('function');
  expect(authority.snapshot).toBeTypeOf('function');
  expect(authority.cancel).toBeTypeOf('function');
  expect(authority.undo).toBeTypeOf('function');
  authority.dispose();
});

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

describe('operation concurrency and resource lifecycle', () => {
  it('should run unrelated subjects concurrently and reject an overlapping request before dispatch', async () => {
    const firstId = createKanbanOperationId('operation-card-4-first');
    const secondId = createKanbanOperationId('operation-card-5');
    const overlappingId = createKanbanOperationId('operation-card-4-overlap');
    const deferred = new Map<KanbanOperationId, ReturnType<typeof deferredResult>>();
    const dispatcher = vi.fn((submitted: KanbanRequest) => {
      const completion = deferredResult();
      deferred.set(submitted.operationId, completion);
      return completion.promise;
    });
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}));

    const first = authority.request(cardDeleteRequest(firstId, 4));
    const second = authority.request(cardDeleteRequest(secondId, 5));
    await expect(authority.request(cardDeleteRequest(overlappingId, 4))).resolves.toMatchObject({
      kind: 'rejected',
      operationId: overlappingId,
      code: 'operation-conflict',
    });
    expect(dispatcher).toHaveBeenCalledTimes(2);
    expect(authority.snapshot().map(({ operationId }) => operationId)).toEqual([firstId, secondId]);

    deferred.get(firstId)?.resolve({ kind: 'rejected', operationId: firstId, code: 'test-complete' });
    deferred.get(secondId)?.resolve({ kind: 'rejected', operationId: secondId, code: 'test-complete' });
    await Promise.all([first, second]);
  });

  it('should reject above the pending ceiling without evicting or dispatching a live operation', async () => {
    const pending: ReturnType<typeof deferredResult>[] = [];
    const dispatcher = vi.fn(() => {
      const completion = deferredResult();
      pending.push(completion);
      return completion.promise;
    });
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}));
    const completions = Array.from({ length: KANBAN_LIMITS.pendingOperations.safe }, (_value, index) => {
      const operationId = createKanbanOperationId(`operation-pending-${index}`);
      return Object.freeze({ operationId, completion: authority.request(cardDeleteRequest(operationId, index)) });
    });
    const excessId = createKanbanOperationId('operation-pending-excess');

    await expect(authority.request(cardDeleteRequest(excessId, 10_001))).resolves.toMatchObject({
      kind: 'rejected',
      operationId: excessId,
      code: 'pending-limit-exceeded',
    });
    expect(dispatcher).toHaveBeenCalledTimes(KANBAN_LIMITS.pendingOperations.safe);
    expect(authority.snapshot()).toHaveLength(KANBAN_LIMITS.pendingOperations.safe);

    pending.forEach((completion, index) => {
      const operationId = completions[index]!.operationId;
      completion.resolve({ kind: 'rejected', operationId, code: 'test-complete' });
    });
    await Promise.all(completions.map(({ completion }) => completion));
  });

  it('should abort and clear active operations on disposal while late settlement remains inert', async () => {
    const operationId = createKanbanOperationId('operation-disposed-1');
    const deferred = deferredResult();
    let dispatchedSignal: AbortSignal | undefined;
    const authority = new KanbanBoardAuthority(
      (submitted) => {
        dispatchedSignal = submitted.signal;
        return deferred.promise;
      },
      () => ({}),
    );
    const observed = observe(authority, operationId);
    const completion = authority.request(request(operationId));

    authority.dispose();
    expect(dispatchedSignal?.aborted).toBe(true);
    expect(authority.snapshot()).toEqual([]);
    deferred.resolve({ kind: 'accepted', operationId });
    await completion;
    expect(observed.snapshots.map(({ state }) => state)).toEqual(['proposed', 'pending', 'cancelled']);
  });

  it('should turn a committed inverse descriptor into a fresh validated operation', async () => {
    const operationId = createKanbanOperationId('operation-with-undo-1');
    const expectation = publication(operationId);
    const submitted: KanbanRequest[] = [];
    const inverse = vi.fn(() => ({ kind: 'card-update', cardKey: 4, patch: { title: 'Prior title' } }) as const);
    const authority = new KanbanBoardAuthority(
      (current) => {
        submitted.push(current);
        return submitted.length === 1
          ? {
              kind: 'accepted',
              operationId,
              publication: expectation,
              undo: { kind: 'inverse-builder', build: inverse },
            }
          : { kind: 'accepted', operationId: current.operationId };
      },
      () => ({}),
    );

    await authority.request(request(operationId));
    authority.reconcilePublication({ kind: 'matching', ...expectation });
    await expect(authority.undo(operationId)).resolves.toMatchObject({ kind: 'accepted' });

    expect(inverse).toHaveBeenCalledOnce();
    expect(submitted).toHaveLength(2);
    expect(submitted[1]).toMatchObject({ kind: 'card-update', cardKey: 4, patch: { title: 'Prior title' } });
    expect(submitted[1]?.operationId).not.toBe(operationId);
  });
});
