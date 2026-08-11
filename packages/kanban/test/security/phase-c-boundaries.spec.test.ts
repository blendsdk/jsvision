/**
 * Security specifications for the modern Kanban request and placement boundary.
 *
 * These cases keep application records and executable object behavior outside package-owned state,
 * enforce atomic bounds, and ensure opaque placement evidence never becomes diagnostic text.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  KANBAN_LIMITS,
  createKanbanOperationIdRegistry,
  createKanbanRequestEnvelope,
  createPlacementToken,
  dispatchKanbanRequest,
  evaluateKanbanMoveEligibility,
  snapshotKanbanRequestProposal,
} from '../../src/index.js';

beforeEach(() => {
  expect(snapshotKanbanRequestProposal).toBeTypeOf('function');
  expect(createKanbanRequestEnvelope).toBeTypeOf('function');
  expect(evaluateKanbanMoveEligibility).toBeTypeOf('function');
  expect(createKanbanOperationIdRegistry).toBeTypeOf('function');
});

/** One valid semantic move proposal used as a safe baseline for hostile variations. */
function moveProposal() {
  return {
    kind: 'card-move',
    moved: [
      {
        cardKey: 4,
        source: { columnId: 'ready' },
        sourcePlacement: { kind: 'between', beforeCardKey: 3, afterCardKey: 5, cursorRevision: 'ready-r7' },
        sourceRevision: 'ready-r7',
        entityRevision: 'card-4-r3',
      },
    ],
    target: { columnId: 'doing' },
    position: { kind: 'between', beforeCardKey: 8, afterCardKey: 9, cursorRevision: 'doing-r8' },
  };
}

/** Package-owned lifecycle metadata used to form a dispatchable request. */
function lifecycle() {
  return {
    operationId: 'operation-17',
    expected: { source: 'source-r8', query: 'query-r12' },
    signal: new AbortController().signal,
  };
}

describe('atomic request boundaries', () => {
  // A repeated card identity would make selection order ambiguous and must reject the whole proposal.
  it('should reject duplicate moved identities without publishing a partial snapshot', () => {
    const proposal = moveProposal();
    const duplicate = { ...proposal, moved: [proposal.moved[0]!, proposal.moved[0]!] };

    expect(() => snapshotKanbanRequestProposal(duplicate)).toThrow();
  });

  // Bulk success is one operation result; accepted-subset shapes are never interpreted as partial success.
  it('should reject a partial atomic result without accepting any moved identity', async () => {
    const request = createKanbanRequestEnvelope(moveProposal(), lifecycle());
    const dispatcher = vi.fn(() => ({
      kind: 'accepted',
      operationId: request.operationId,
      acceptedCardKeys: [4],
    }));

    await expect(dispatchKanbanRequest(request, dispatcher, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: request.operationId,
      code: 'invalid-dispatch-result',
    });
    expect(dispatcher).toHaveBeenCalledOnce();
  });

  // Active and recently retained operation identities cannot alias a different operation.
  it('should reject duplicate active and retained operation IDs without changing the incumbent', () => {
    const registry = createKanbanOperationIdRegistry({ factory: () => 'same-operation' });
    const active = registry.acquire();

    expect(() => registry.acquire()).toThrow();
    expect(active.active()).toBe(true);

    active.retain();
    expect(active.active()).toBe(false);
    expect(() => registry.acquire()).toThrow();
  });
});

describe('hostile application values', () => {
  // Descriptor inspection must reject getters without evaluating application code.
  it('should reject an accessor-bearing proposal without invoking the getter', () => {
    const getter = vi.fn(() => 'card-delete');
    const hostile = Object.defineProperty({ cardKey: 4 }, 'kind', { enumerable: true, get: getter });

    expect(() => snapshotKanbanRequestProposal(hostile)).toThrow();
    expect(getter).not.toHaveBeenCalled();
  });

  // Proxy traps are application code and must not escape or expose their private error payload.
  it('should contain a throwing proxy trap before retaining request data', () => {
    const hostile = new Proxy(moveProposal(), {
      ownKeys() {
        throw new Error('private proxy payload');
      },
    });

    expect(() => snapshotKanbanRequestProposal(hostile)).toThrow();
    try {
      snapshotKanbanRequestProposal(hostile);
    } catch (error) {
      expect(String(error)).not.toContain('private proxy payload');
    }
  });

  // A then-shaped semantic value is data from an untrusted object and must never be assimilated.
  it('should reject a thenable draft without invoking its then member', () => {
    const then = vi.fn(() => {
      throw new Error('must not run');
    });
    const proposal = { kind: 'card-create', target: { columnId: 'ready' }, draft: { then } };

    expect(() => snapshotKanbanRequestProposal(proposal)).toThrow();
    expect(then).not.toHaveBeenCalled();
  });
});

describe('bounded and redacted semantic data', () => {
  // The selection ceiling applies before any partial ordered collection becomes package state.
  it('should reject a moved collection above the configured safe atomic limit', () => {
    const proposal = moveProposal();
    const moved = Array.from({ length: KANBAN_LIMITS.selectedKeys.safe + 1 }, (_value, cardKey) => ({
      ...proposal.moved[0]!,
      cardKey,
      entityRevision: `card-${cardKey}-r1`,
    }));

    expect(() => snapshotKanbanRequestProposal({ ...proposal, moved })).toThrow();
  });

  // Generic semantic content remains bounded even though the application owns its schema.
  it('should reject excessive semantic draft text without echoing it in the error', () => {
    const excessive = 'private-value-'.repeat(2_000);
    const proposal = { kind: 'card-create', target: { columnId: 'ready' }, draft: { title: excessive } };

    expect(() => snapshotKanbanRequestProposal(proposal)).toThrow();
    try {
      snapshotKanbanRequestProposal(proposal);
    } catch (error) {
      expect(String(error)).not.toContain(excessive);
      expect(String(error)).not.toContain('private-value');
    }
  });

  // Control-bearing structural identities cannot cross into application dispatch.
  it('should reject terminal controls in target identities before envelope creation', () => {
    const proposal = { kind: 'card-create', target: { columnId: 'ready\u001b[31m' }, draft: { title: 'safe' } };

    expect(() => snapshotKanbanRequestProposal(proposal)).toThrow();
  });

  // Placement tokens may reach the dispatcher but never a public eligibility result or error string.
  it('should redact an obsolete placement token from unavailable feedback', () => {
    const tokenText = 'private-placement-token-42';
    const token = createPlacementToken(tokenText);
    const proposal = {
      ...moveProposal(),
      position: {
        kind: 'window-edge',
        edge: 'after',
        neighborCardKey: 9,
        token,
        cursorRevision: 'doing-r8',
      },
    };
    const result = evaluateKanbanMoveEligibility({
      proposal,
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
        targetEdges: { start: 'unknown', end: 'unknown' },
        targetCardKeys: [9],
        placementTokens: [],
      },
      expected: lifecycle().expected,
      capability: { state: 'allowed' },
      selection: { kind: 'loaded', orderedCardKeys: [4], maximum: KANBAN_LIMITS.selectedKeys.safe },
      ordering: { sorted: false, filtered: false, filteredPlacement: 'not-required' },
      transition: { kind: 'allowed' },
      definitionOfDone: { kind: 'allowed' },
      wip: { kind: 'allowed' },
      unchanged: false,
    });

    expect(result).toEqual({ kind: 'unavailable', code: 'placement-token-stale' });
    expect(JSON.stringify(result)).not.toContain(tokenText);
  });
});
