import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanOperationIdRegistry,
  evaluateKanbanMoveEligibility,
  reconcileKanbanPublication,
  snapshotKanbanRequestProposal,
} from '../src/index.js';

/** One complete allowed move fact set for internal pipeline ordering tests. */
function allowedMoveFacts() {
  return {
    proposal: {
      kind: 'card-move',
      moved: [
        {
          cardKey: 4,
          source: { columnId: 'ready' },
          sourcePlacement: { kind: 'start', cursorRevision: 'ready-r7' },
          sourceRevision: 'ready-r7',
          entityRevision: 'card-4-r3',
        },
      ],
      target: { columnId: 'doing' },
      position: { kind: 'end', cursorRevision: 'doing-r8' },
    },
    current: {
      sourceRevision: 'source-r8',
      queryRevision: 'query-r12',
      columns: [
        { columnId: 'ready', revision: 'ready-r7' },
        { columnId: 'doing', revision: 'doing-r8' },
      ],
      swimlanes: [],
      cards: [{ cardKey: 4, revision: 'card-4-r3' }],
      targetCursorRevision: 'doing-r8',
      targetEdges: { start: 'complete', end: 'complete' },
      targetCardKeys: [],
      placementTokens: [],
    },
    expected: { source: 'source-r8', query: 'query-r12' },
    capability: { state: 'allowed' },
    selection: { kind: 'loaded', orderedCardKeys: [4], maximum: 10_000 },
    ordering: { sorted: false, filtered: false, filteredPlacement: 'not-required' },
    transition: { kind: 'allowed' },
    definitionOfDone: { kind: 'allowed' },
    wip: { kind: 'allowed' },
    unchanged: false,
  };
}

describe('request discriminator implementation', () => {
  it.each([
    [{ kind: 'card-create', target: { columnId: 'ready' }, draft: null, cardKey: 1 }],
    [{ kind: 'column-update', columnId: 'ready', patch: null, position: { kind: 'end' } }],
    [{ kind: 'swimlane-delete', swimlaneId: 'team-a', payload: null }],
    [{ kind: 'saved-view-delete', viewId: 'daily', label: 'not valid here' }],
    [{ kind: 'extension', extensionId: 'example.review', payload: null, target: { columnId: 'ready' } }],
  ])('rejects a member owned by another proposal discriminator', (proposal) => {
    expect(() => snapshotKanbanRequestProposal(proposal)).toThrow();
  });

  it('keeps numeric and textual card subjects collision-free during reconciliation', () => {
    const subjects = [
      { kind: 'card' as const, cardKey: 1, baselineRevision: 'n1', expectedRevision: 'n2' },
      { kind: 'card' as const, cardKey: '1', baselineRevision: 's1', expectedRevision: 's2' },
    ];
    const pending = [{ operationId: 'operation-1', subjects }];

    expect(
      reconcileKanbanPublication(pending, {
        kind: 'matching',
        operationId: 'operation-1',
        subjects,
      }),
    ).toMatchObject({ pending: [], cleared: { subjects } });
  });
});

describe('operation ID implementation', () => {
  it('fails closed when an injected factory throws or returns an invalid identity', () => {
    const throwing = createKanbanOperationIdRegistry({
      factory: () => {
        throw new RangeError('counter exhausted');
      },
    });
    const invalid = createKanbanOperationIdRegistry({ factory: () => 'control\u001b[31m' });

    expect(() => throwing.acquire()).toThrow();
    expect(() => invalid.acquire()).toThrow();
  });

  it('evicts retained IDs in FIFO order without disturbing an active lease', () => {
    const candidates = ['operation-1', 'operation-2', 'operation-3', 'operation-1'];
    const registry = createKanbanOperationIdRegistry({
      factory: () => candidates.shift() ?? 'operation-fallback',
      retainedLimit: 2,
    });
    registry.acquire().retain();
    registry.acquire().retain();
    const active = registry.acquire();
    active.retain();

    const reusedEvicted = registry.acquire();

    expect(reusedEvicted.operationId).toBe('operation-1');
    expect(reusedEvicted.active()).toBe(true);
  });
});

describe('eligibility stage implementation', () => {
  it('does not inspect capability after structural failure', () => {
    const getter = vi.fn(() => 'allowed');
    const capability = Object.defineProperty({}, 'state', { enumerable: true, get: getter });
    const facts = allowedMoveFacts();

    const result = evaluateKanbanMoveEligibility({
      ...facts,
      current: { ...facts.current, columns: [{ columnId: 'ready', revision: 'ready-r7' }] },
      capability,
    });

    expect(result).toEqual({ kind: 'unavailable', code: 'column-not-found' });
    expect(getter).not.toHaveBeenCalled();
  });

  it('does not inspect workflow advice after stale revision wins', () => {
    const getter = vi.fn(() => 'blocked');
    const transition = Object.defineProperty({}, 'kind', { enumerable: true, get: getter });
    const facts = allowedMoveFacts();

    const result = evaluateKanbanMoveEligibility({
      ...facts,
      expected: { ...facts.expected, source: 'stale-source' },
      transition,
    });

    expect(result).toEqual({ kind: 'unavailable', code: 'stale-source-revision' });
    expect(getter).not.toHaveBeenCalled();
  });
});
