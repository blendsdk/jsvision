import { describe, expect, it, vi } from 'vitest';

import { reconcileKanbanPublication } from '../src/contract/authority.js';
import { createKanbanRequestEnvelope } from '../src/contract/request-validation.js';
import type {
  KanbanOperationId,
  KanbanOperationSubject,
  KanbanRequest,
  KanbanRequestProposal,
  KanbanRequestResult,
} from '../src/index.js';
import { KanbanBoardAuthority } from '../src/board/board-authority.js';
import { KanbanOperationCoordinator } from '../src/operation/coordinator.js';
import { KanbanOperationSnapshotRegistry } from '../src/operation/registries.js';
import { canonicalizeKanbanOperationSubject, snapshotKanbanOperationSubjects } from '../src/operation/types.js';

/** Create one exact native Promise whose settlement remains under test control. */
function deferred<T>() {
  let settle: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return Object.freeze({
    promise,
    resolve(value: T): void {
      const current = settle;
      if (current === undefined) throw new Error('Deferred value already settled.');
      settle = undefined;
      current(value);
    },
  });
}

/** Build one accepted compatibility request that optionally retains an inverse builder. */
function extensionRequest(operationId: KanbanOperationId): KanbanRequest {
  return createKanbanRequestEnvelope(
    { kind: 'extension', extensionId: 'quality.review', payload: {} },
    { operationId, expected: {}, signal: new AbortController().signal },
  );
}

describe('Phase C lifecycle quality remediation', () => {
  it.each(['blocked', 'unavailable'] as const)('rejects %s eligibility before application dispatch', async (kind) => {
    const dispatcher = vi.fn((request: KanbanRequest): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: request.operationId,
    }));
    const authority = new KanbanBoardAuthority(dispatcher, undefined, {
      eligibility: () => ({ kind, code: `policy-${kind}` }),
    });

    await expect(authority.request({ kind: 'card-update', cardKey: 4, patch: {} })).resolves.toMatchObject({
      kind: 'cancelled',
      code: `policy-${kind}`,
    });
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('fails closed when a lifecycle-free destructive proposal has no confirmer', async () => {
    const dispatcher = vi.fn();
    const authority = new KanbanBoardAuthority(dispatcher, undefined);

    await expect(authority.request({ kind: 'card-delete', cardKey: 4 })).resolves.toMatchObject({
      kind: 'cancelled',
      code: 'confirmation-declined',
    });
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('does not treat lifecycle fields as confirmation for a complete standard request', async () => {
    const dispatcher = vi.fn();
    const authority = new KanbanBoardAuthority(dispatcher, undefined);
    const request = createKanbanRequestEnvelope(
      { kind: 'card-delete', cardKey: 4 },
      { operationId: 'complete-destructive-1', expected: {}, signal: new AbortController().signal },
    );

    await expect(authority.request(request)).resolves.toMatchObject({
      kind: 'cancelled',
      code: 'confirmation-declined',
    });
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('applies current policy to a complete standard request', async () => {
    const dispatcher = vi.fn();
    const authority = new KanbanBoardAuthority(dispatcher, undefined, {
      eligibility: () => ({ kind: 'blocked', code: 'policy-blocked' }),
    });
    const request = createKanbanRequestEnvelope(
      { kind: 'card-update', cardKey: 4, patch: {} },
      { operationId: 'complete-blocked-1', expected: {}, signal: new AbortController().signal },
    );

    await expect(authority.request(request)).resolves.toMatchObject({ kind: 'cancelled', code: 'policy-blocked' });
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('does not dispatch after a pending subscriber cancels reentrantly', async () => {
    const dispatcher = vi.fn();
    const authority = new KanbanBoardAuthority(dispatcher, undefined);
    authority.subscribe((snapshot) => {
      if (snapshot.state === 'pending') authority.cancel(snapshot.operationId);
    });

    await expect(authority.request({ kind: 'card-update', cardKey: 4, patch: {} })).resolves.toMatchObject({
      kind: 'cancelled',
    });
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('cancels an approved confirmation when captured revisions changed', async () => {
    let sourceRevision = 'source-r1';
    const approval = deferred<boolean>();
    const dispatcher = vi.fn();
    const authority = new KanbanBoardAuthority(dispatcher, undefined, {
      expected: () => ({ source: sourceRevision }),
      confirm: () => approval.promise,
    });

    const completion = authority.request({ kind: 'card-delete', cardKey: 4 });
    sourceRevision = 'source-r2';
    approval.resolve(true);

    await expect(completion).resolves.toMatchObject({ kind: 'cancelled', code: 'confirmation-stale' });
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('dispatches an approved confirmation when current revisions still match', async () => {
    const dispatcher = vi.fn((request: KanbanRequest): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: request.operationId,
    }));
    const authority = new KanbanBoardAuthority(dispatcher, undefined, {
      expected: () => ({ source: 'source-r1' }),
      confirm: () => true,
    });

    await expect(authority.request({ kind: 'card-delete', cardKey: 4 })).resolves.toMatchObject({
      kind: 'accepted',
    });
    expect(dispatcher).toHaveBeenCalledOnce();
  });

  it('accepts every public publication-notice variant', () => {
    const operationId = 'publication-variant-1';
    const subjects = [{ kind: 'card' as const, cardKey: 4, baselineRevision: 'r1', expectedRevision: 'r2' }];
    const pending = [{ operationId, subjects }];

    expect(reconcileKanbanPublication(pending, { kind: 'confirmed', operationId }).pending).toEqual([]);
    expect(reconcileKanbanPublication(pending, { kind: 'deleted', operationId, subjects }).pending).toEqual([]);
  });

  it('accepts the maximum derived affected-subject expansion', () => {
    const subjects: KanbanOperationSubject[] = Array.from({ length: 10_000 }, (_value, cardKey) => ({
      kind: 'card' as const,
      cardKey,
    }));
    subjects.push(
      { kind: 'card', cardKey: 'anchor-before' },
      { kind: 'card', cardKey: 'anchor-after' },
      { kind: 'card', cardKey: 'axis-column' },
      { kind: 'card', cardKey: 'axis-swimlane' },
    );
    subjects.sort((left, right) =>
      canonicalizeKanbanOperationSubject(left).localeCompare(canonicalizeKanbanOperationSubject(right)),
    );

    expect(snapshotKanbanOperationSubjects(subjects)).toHaveLength(10_004);
  });

  it('orders observation delivery before reentrant subscriber transitions', () => {
    const registry = new KanbanOperationSnapshotRegistry(1, 1);
    const states: string[] = [];
    const proposed = { operationId: 'ordered-1', kind: 'extension', state: 'proposed', affected: [] } as const;
    const pending = {
      operationId: 'ordered-1',
      kind: 'extension',
      state: 'pending',
      affected: [],
      projection: { kind: 'extension', state: 'pending', cardKeys: [] },
    } as const;
    registry.subscribe((snapshot) => {
      states.push(`subscriber-${snapshot.state}`);
      if (snapshot.state === 'proposed') registry.publish(pending, () => states.push('observe-pending'));
    });

    registry.publish(proposed, () => states.push('observe-proposed'));

    expect(states).toEqual(['observe-proposed', 'subscriber-proposed', 'observe-pending', 'subscriber-pending']);
  });

  it('claims an inverse builder before invocation and prevents retained-ID aliasing', async () => {
    const inverse = deferred<KanbanRequestProposal>();
    const build = vi.fn(() => inverse.promise);
    const ids = ['inverse-fresh'];
    const dispatcher = vi.fn((request: KanbanRequest): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: request.operationId,
      ...(request.operationId === 'undo-origin' && dispatcher.mock.calls.length === 1
        ? { undo: { kind: 'inverse-builder' as const, build } }
        : {}),
    }));
    const authority = new KanbanBoardAuthority(dispatcher, undefined, {
      operationId: () => ids.shift() ?? 'fallback-operation',
      limits: { values: { retainedOperationIds: 1, retainedUndoDescriptors: 1 } },
    });
    await authority.request(extensionRequest('undo-origin'));
    authority.reconcilePublication({ kind: 'confirmed', operationId: 'undo-origin' });

    const firstUndo = authority.undo('undo-origin');
    await expect(authority.undo('undo-origin')).resolves.toMatchObject({ kind: 'rejected', code: 'undo-unavailable' });
    expect(build).toHaveBeenCalledOnce();
    inverse.resolve({ kind: 'card-update', cardKey: 4, patch: {} });
    await firstUndo;

    await authority.request(extensionRequest('intervening-operation'));
    authority.reconcilePublication({ kind: 'confirmed', operationId: 'intervening-operation' });
    await expect(authority.request(extensionRequest('undo-origin'))).resolves.toMatchObject({ kind: 'rejected' });
  });

  it('rejects inverse output when authority revisions changed while the builder was open', async () => {
    let sourceRevision = 'source-r1';
    const inverse = deferred<KanbanRequestProposal>();
    const dispatcher = vi.fn((request: KanbanRequest): KanbanRequestResult => ({
      kind: 'accepted',
      operationId: request.operationId,
      undo: { kind: 'inverse-builder', build: () => inverse.promise },
    }));
    const authority = new KanbanBoardAuthority(dispatcher, undefined, {
      expected: () => ({ source: sourceRevision }),
    });
    await authority.request(extensionRequest('undo-stale-origin'));
    authority.reconcilePublication({ kind: 'confirmed', operationId: 'undo-stale-origin' });

    const completion = authority.undo('undo-stale-origin');
    sourceRevision = 'source-r2';
    inverse.resolve({ kind: 'card-update', cardKey: 4, patch: {} });

    await expect(completion).resolves.toMatchObject({ kind: 'rejected', code: 'undo-stale' });
    expect(dispatcher).toHaveBeenCalledOnce();
  });

  it('emits a coarse duration band on lifecycle observations', async () => {
    let now = 0;
    const observations: unknown[] = [];
    const coordinator = new KanbanOperationCoordinator({
      dispatcher: (request) => ({ kind: 'rejected', operationId: request.operationId, code: 'done' }),
      now: () => {
        now += 60;
        return now;
      },
      observe: (observation) => observations.push(observation),
    });

    await coordinator.commitProposal({ kind: 'card-update', cardKey: 4, patch: {} }).completion;

    expect(observations).toEqual(expect.arrayContaining([expect.objectContaining({ duration: 'under-1s' })]));
  });
});
