/**
 * Security specifications for the modern Kanban request and placement boundary.
 *
 * These cases keep application records and executable object behavior outside package-owned state,
 * enforce atomic bounds, and ensure opaque placement evidence never becomes diagnostic text.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';

import {
  KANBAN_LIMITS,
  createKanbanOperationId,
  createKanbanOperationIdRegistry,
  createKanbanRequestEnvelope,
  createPlacementToken,
  dispatchKanbanRequest,
  evaluateKanbanMoveEligibility,
  evaluateKanbanMovePositionCurrency,
  snapshotKanbanRequestProposal,
} from '../../src/index.js';
import { KanbanBoardAuthority } from '../../src/board/board-authority.js';
import { composeKanbanViewportOverlay } from '../../src/board/overlay-projector.js';
import type { KanbanViewportProjection } from '../../src/board/viewport-projector.js';
import type { KanbanOperationId, KanbanRequest } from '../../src/index.js';

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

/** Complete safe eligibility input used for hostile current-authority variations. */
function eligibilityInput() {
  return {
    proposal: moveProposal(),
    current: {
      sourceRevision: 'source-r8',
      queryRevision: 'query-r12',
      columns: [
        { columnId: 'ready', revision: 'ready-r7' },
        { columnId: 'doing', revision: 'doing-r8' },
      ],
      swimlanes: [],
      cards: [{ cardKey: 4, revision: 'card-4-r3' }],
      sourceCells: [
        {
          address: { columnId: 'ready' },
          cursorRevision: 'ready-r7',
          edges: { start: 'complete', end: 'complete' },
          cardKeys: [3, 5],
          placementTokens: [],
        },
      ],
      targetCursorRevision: 'doing-r8',
      targetEdges: { start: 'unknown', end: 'unknown' },
      targetCardKeys: [8, 9],
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

  it('should reject hostile operation registry options without invoking accessors', () => {
    const getter = vi.fn(() => 1);
    const options = Object.defineProperty({}, 'activeLimit', { enumerable: true, get: getter });
    expect(() => createKanbanOperationIdRegistry(options)).toThrow();
    expect(getter).not.toHaveBeenCalled();

    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('private options payload');
        },
      },
    );
    expect(() => createKanbanOperationIdRegistry(proxy)).toThrow('Invalid Kanban semantic value.');
    expect(() => createKanbanOperationIdRegistry({ unexpected: true } as never)).toThrow();
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
  it('should contain hostile overlay reason codes without retaining terminal controls or application text', () => {
    const authoritative: KanbanViewportProjection = Object.freeze({
      columns: Object.freeze([]),
      cards: Object.freeze([]),
      regions: Object.freeze([]),
      actionTargets: Object.freeze([]),
      states: Object.freeze([]),
    });
    const result = composeKanbanViewportOverlay({
      authoritative,
      bounds: { x: 0, y: 0, width: 18, height: 5 },
      density: 'compact',
      drag: {
        generation: 1,
        geometryGeneration: 1,
        ghost: { cardKey: 17, point: { x: 2, y: 2 }, count: 1 },
        placeholders: [{ address: { columnId: 'ready' }, cardKeys: [17] }],
        gap: {
          slotId: 'ready:end',
          address: { columnId: 'ready' },
          rect: { x: 1, y: 4, width: 16, height: 1 },
          eligibility: { kind: 'warning', code: 'private\u001b[2J\nrecord-body' },
        },
      },
    });

    expect(JSON.stringify(result.overlay)).not.toMatch(/private|record-body|\u001b|2J/u);
  });

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
    const baseline = eligibilityInput();
    const result = evaluateKanbanMoveEligibility({
      ...baseline,
      proposal,
      current: { ...baseline.current, targetCardKeys: [9] },
    });

    expect(result).toEqual({ kind: 'unavailable', code: 'placement-token-stale' });
    expect(JSON.stringify(result)).not.toContain(tokenText);
  });

  it('should enforce structural authority limits before policy evaluation', () => {
    const baseline = eligibilityInput();
    const columns = Array.from({ length: KANBAN_LIMITS.columns.safe + 1 }, (_value, index) => ({
      columnId: `column-${index}`,
      revision: `revision-${index}`,
    }));
    expect(() => evaluateKanbanMoveEligibility({ ...baseline, current: { ...baseline.current, columns } })).toThrow();
  });

  it('should enforce one aggregate budget across bounded source-cell evidence', () => {
    const baseline = eligibilityInput();
    const sourceCells = Array.from({ length: 40 }, (_value, cellIndex) => ({
      address: { columnId: `source-${cellIndex}` },
      cursorRevision: `source-${cellIndex}-r1`,
      edges: { start: 'complete', end: 'complete' },
      cardKeys: Array.from({ length: KANBAN_LIMITS.ensureRangeCards.safe }, (_entry, key) => key),
      placementTokens: [],
    }));

    expect(() =>
      evaluateKanbanMoveEligibility({ ...baseline, current: { ...baseline.current, sourceCells } }),
    ).toThrow();
  });

  it('should reject hostile placement evidence without invoking getters or leaking proxy failures', () => {
    const getter = vi.fn(() => 'doing-r8');
    const evidence = Object.defineProperty(
      { edges: { start: 'complete', end: 'complete' }, cardKeys: [], placementTokens: [] },
      'cursorRevision',
      { enumerable: true, get: getter },
    );
    expect(() =>
      evaluateKanbanMovePositionCurrency({ kind: 'end', cursorRevision: 'doing-r8' }, evidence as never),
    ).toThrow();
    expect(getter).not.toHaveBeenCalled();

    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('private evidence payload');
        },
      },
    );
    expect(() =>
      evaluateKanbanMovePositionCurrency({ kind: 'end', cursorRevision: 'doing-r8' }, proxy as never),
    ).toThrow('Invalid Kanban semantic value.');
  });
});

describe('hostile runtime representations', () => {
  it('should contain descriptor traps without exposing their private failure text', () => {
    const hostile = new Proxy(moveProposal(), {
      getOwnPropertyDescriptor() {
        throw new Error('private descriptor payload');
      },
    });

    expect(() => snapshotKanbanRequestProposal(hostile)).toThrow();
    try {
      snapshotKanbanRequestProposal(hostile);
    } catch (error) {
      expect(String(error)).not.toContain('private descriptor payload');
    }
  });

  it('should reject a Promise subclass result without invoking its overridden then member', async () => {
    const request = createKanbanRequestEnvelope(moveProposal(), lifecycle());
    const then = vi.fn(() => {
      throw new Error('must not run');
    });
    class HostilePromise extends Promise<unknown> {}
    const outcome = new HostilePromise((resolve) => resolve({ kind: 'accepted', operationId: request.operationId }));
    Object.defineProperty(outcome, 'then', { configurable: true, value: then });

    await expect(dispatchKanbanRequest(request, () => outcome, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: request.operationId,
      code: 'invalid-dispatch-result',
    });
    expect(then).not.toHaveBeenCalled();
  });

  it('should reject a native Promise with an own constructor accessor without invoking species lookup', async () => {
    const request = createKanbanRequestEnvelope(moveProposal(), lifecycle());
    const constructorGetter = vi.fn(() => Promise);
    const outcome = Promise.resolve({ kind: 'accepted', operationId: request.operationId });
    Object.defineProperty(outcome, 'constructor', { configurable: true, get: constructorGetter });

    await expect(dispatchKanbanRequest(request, () => outcome, { capabilities: {} })).resolves.toEqual({
      kind: 'rejected',
      operationId: request.operationId,
      code: 'invalid-dispatch-result',
    });
    expect(constructorGetter).not.toHaveBeenCalled();
  });

  it('should reject a cross-realm proposal object before retaining its values', () => {
    const crossRealm = runInNewContext(`({ kind: 'card-delete', cardKey: 4 })`);

    expect(() => snapshotKanbanRequestProposal(crossRealm)).toThrow();
  });
});

describe('semantic failure ceilings', () => {
  it('should reject semantic data beyond the supported nesting depth', () => {
    let nested: unknown = null;
    for (let depth = 0; depth <= KANBAN_LIMITS.semanticDepth.safe; depth += 1) nested = { child: nested };

    expect(() => snapshotKanbanRequestProposal({ kind: 'card-update', cardKey: 4, patch: nested })).toThrow();
  });

  it('should neutralize terminal controls in saved-view labels before publication', () => {
    const snapshot = snapshotKanbanRequestProposal({
      kind: 'saved-view-rename',
      viewId: 'daily',
      label: '\u001b[31mDanger\u0000',
    });

    expect(snapshot.label).not.toContain('\u001b');
    expect(snapshot.label).not.toContain('\u0000');
    expect(snapshot.label).toContain('Danger');
  });

  it('should return a payload-free rejection when a standard dispatcher throws private data', async () => {
    const request = createKanbanRequestEnvelope(moveProposal(), lifecycle());

    const result = await dispatchKanbanRequest(
      request,
      () => {
        throw new Error('private application record body');
      },
      { capabilities: {} },
    );

    expect(result).toEqual({
      kind: 'rejected',
      operationId: request.operationId,
      code: 'dispatcher-failed',
    });
    expect(JSON.stringify(result)).not.toContain('private');
  });
});

/** Final destructive request used to exercise coordinator-owned confirmation. */
function destructiveRequest(operationId: KanbanOperationId): KanbanRequest {
  return createKanbanRequestEnvelope(
    { kind: 'card-delete', cardKey: 4 },
    {
      operationId,
      expected: { entities: [{ kind: 'card', cardKey: 4, revision: 'card-4-r1' }] },
      signal: new AbortController().signal,
    },
  );
}

describe('hostile operation callbacks and observations', () => {
  it('should let reentrant cancellation win over a synchronous dispatcher settlement', async () => {
    const operationId = createKanbanOperationId('operation-reentrant-dispatch-1');
    const holder: { authority?: KanbanBoardAuthority } = {};
    const dispatcher = vi.fn(() => {
      holder.authority?.cancel(operationId);
      return { kind: 'accepted', operationId } as const;
    });
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}), {
      confirm: () => true,
      revalidate: (_proposal, expected) => ({ expected, eligibility: { kind: 'allowed' } }),
    });
    holder.authority = authority;

    await expect(authority.request(destructiveRequest(operationId))).resolves.toEqual({
      kind: 'cancelled',
      operationId,
      code: 'operation-cancelled',
    });
    expect(dispatcher).toHaveBeenCalledOnce();
  });

  it('should reject a thenable confirmer without invoking it or dispatching', async () => {
    const operationId = createKanbanOperationId('operation-hostile-confirmer-1');
    const then = vi.fn(() => {
      throw new Error('private confirmer payload');
    });
    const dispatcher = vi.fn(() => ({ kind: 'accepted', operationId }) as const);
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}), {
      confirm: () => ({ then }),
    });

    await expect(authority.request(destructiveRequest(operationId))).resolves.toMatchObject({
      kind: 'cancelled',
      operationId,
    });
    expect(then).not.toHaveBeenCalled();
    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('should make late affirmative confirmation inert after disposal', async () => {
    const operationId = createKanbanOperationId('operation-late-confirmer-1');
    let approve: ((approved: boolean) => void) | undefined;
    const confirmation = new Promise<boolean>((resolve) => {
      approve = resolve;
    });
    const dispatcher = vi.fn(() => ({ kind: 'accepted', operationId }) as const);
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}), { confirm: () => confirmation });

    const completion = authority.request(destructiveRequest(operationId));
    authority.dispose();
    approve?.(true);
    await completion;

    expect(dispatcher).not.toHaveBeenCalled();
  });

  it('should reject a thenable inverse result without invoking it or dispatching a fresh request', async () => {
    const operationId = createKanbanOperationId('operation-hostile-inverse-1');
    const expectation = {
      operationId,
      subjects: [{ kind: 'card', cardKey: 4, baselineRevision: 'card-4-r1', expectedRevision: 'card-4-r2' }],
    } as const;
    const then = vi.fn(() => {
      throw new Error('private inverse payload');
    });
    const builder = vi.fn(() => ({ then }));
    const dispatcher = vi.fn(
      () =>
        ({
          kind: 'accepted',
          operationId,
          publication: expectation,
          undo: { kind: 'inverse-builder', build: builder },
        }) as const,
    );
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}), {
      confirm: () => true,
      revalidate: (_proposal, expected) => ({ expected, eligibility: { kind: 'allowed' } }),
    });

    await authority.request(destructiveRequest(operationId));
    authority.reconcilePublication({ kind: 'matching', ...expectation });
    await expect(authority.undo(operationId)).resolves.toMatchObject({ kind: 'rejected' });

    expect(builder).toHaveBeenCalledOnce();
    expect(then).not.toHaveBeenCalled();
    expect(dispatcher).toHaveBeenCalledOnce();
  });

  it('should make a late inverse proposal inert after reentrant disposal', async () => {
    const operationId = createKanbanOperationId('operation-late-inverse-1');
    const expectation = {
      operationId,
      subjects: [{ kind: 'card', cardKey: 4, baselineRevision: 'card-4-r1', expectedRevision: 'card-4-r2' }],
    } as const;
    let publishInverse: ((proposal: unknown) => void) | undefined;
    const inverse = new Promise<unknown>((resolve) => {
      publishInverse = resolve;
    });
    const dispatcher = vi.fn(
      () =>
        ({
          kind: 'accepted',
          operationId,
          publication: expectation,
          undo: { kind: 'inverse-builder', build: () => inverse },
        }) as const,
    );
    const authority = new KanbanBoardAuthority(dispatcher, () => ({}), {
      confirm: () => true,
      revalidate: (_proposal, expected) => ({ expected, eligibility: { kind: 'allowed' } }),
    });

    await authority.request(destructiveRequest(operationId));
    authority.reconcilePublication({ kind: 'matching', ...expectation });
    const completion = authority.undo(operationId);
    authority.dispose();
    publishInverse?.({ kind: 'card-update', cardKey: 4, patch: { title: 'must stay inert' } });
    await completion;

    expect(dispatcher).toHaveBeenCalledOnce();
  });

  it('should publish lifecycle observations without payloads, tokens, labels, or raw errors', async () => {
    const operationId = createKanbanOperationId('operation-observed-1');
    const observations: unknown[] = [];
    const authority = new KanbanBoardAuthority(
      () => {
        throw new Error('private raw dispatcher error');
      },
      () => ({}),
      { observe: (observation: unknown) => observations.push(observation) },
    );
    const requestWithPrivatePayload = createKanbanRequestEnvelope(
      {
        kind: 'extension',
        extensionId: 'example.private',
        payload: { body: 'private-card-body', token: 'private-placement-token', label: 'private-label' },
      },
      { operationId, expected: {}, signal: new AbortController().signal },
    );

    await authority.request(requestWithPrivatePayload);

    expect(observations.length).toBeGreaterThan(0);
    expect(observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operationId, kind: 'extension', state: 'rejected', code: 'dispatcher-failed' }),
      ]),
    );
    expect(JSON.stringify(observations)).not.toMatch(/private-card-body|private-placement-token|private-label|raw/u);
  });
});
