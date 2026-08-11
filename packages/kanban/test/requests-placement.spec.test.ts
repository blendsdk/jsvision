/**
 * Specification tests for standard mutation proposals and semantic move placement.
 *
 * The public proposal is application intent only. The package adds lifecycle authority when it
 * creates the dispatch envelope, while the legacy extension envelope remains an accepted input for
 * existing applications.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  classifyKanbanRequestConfirmation,
  createKanbanRequestEnvelope,
  createPlacementToken,
  evaluateKanbanMoveEligibility,
  evaluateKanbanTransition,
  evaluateKanbanWip,
  snapshotKanbanDefinitionOfDone,
  snapshotKanbanRequestProposal,
} from '../src/index.js';

beforeEach(() => {
  expect(snapshotKanbanRequestProposal).toBeTypeOf('function');
  expect(createKanbanRequestEnvelope).toBeTypeOf('function');
  expect(evaluateKanbanMoveEligibility).toBeTypeOf('function');
});

/** Lifecycle values captured by the package immediately before application dispatch. */
function lifecycle() {
  return {
    operationId: 'operation-17',
    expected: {
      board: 'board-4',
      source: 'source-8',
      query: 'query-12',
      entities: [{ kind: 'card', cardKey: 4, revision: 'card-4-r3' }],
    },
    signal: new AbortController().signal,
  };
}

/** Representative exact proposal for every standard and extension discriminator. */
function proposals(): readonly object[] {
  const cardTarget = { columnId: 'doing', swimlaneId: 'team-blue' };
  const columnPosition = { kind: 'between', beforeColumnId: 'ready', afterColumnId: 'done' };
  const swimlanePosition = { kind: 'after', swimlaneId: 'team-blue' };
  return [
    { kind: 'card-create', target: cardTarget, draft: { title: 'Review change' } },
    { kind: 'card-update', cardKey: 4, patch: { status: 'review' } },
    {
      kind: 'card-duplicate',
      cardKey: 4,
      target: cardTarget,
      position: { kind: 'end', cursorRevision: 'doing-r8' },
    },
    { kind: 'card-archive', cardKey: 4 },
    { kind: 'card-delete', cardKey: 4 },
    {
      kind: 'card-move',
      moved: [
        {
          cardKey: 4,
          source: { columnId: 'ready', swimlaneId: 'team-blue' },
          sourcePlacement: { kind: 'between', beforeCardKey: 1, afterCardKey: 5, cursorRevision: 'ready-r7' },
          sourceRevision: 'ready-r7',
          entityRevision: 'card-4-r3',
        },
      ],
      target: cardTarget,
      position: { kind: 'between', beforeCardKey: 8, afterCardKey: 9, cursorRevision: 'doing-r8' },
      viewRevision: 'view-r2',
    },
    { kind: 'column-add', draft: { columnId: 'verify', label: 'Verify' }, position: columnPosition },
    { kind: 'column-update', columnId: 'doing', patch: { label: 'In progress' } },
    { kind: 'column-reorder', columnId: 'doing', position: columnPosition },
    { kind: 'column-delete', columnId: 'doing', reassignTo: 'ready' },
    { kind: 'swimlane-add', draft: { swimlaneId: 'team-green', label: 'Team Green' }, position: swimlanePosition },
    { kind: 'swimlane-update', swimlaneId: 'team-blue', patch: { label: 'Blue Team' } },
    { kind: 'swimlane-reorder', swimlaneId: 'team-blue', position: swimlanePosition },
    { kind: 'swimlane-delete', swimlaneId: 'team-blue', reassignTo: 'team-green' },
    { kind: 'saved-view-save', viewId: 'daily', data: { filters: ['mine'] } },
    { kind: 'saved-view-rename', viewId: 'daily', label: 'My daily work' },
    { kind: 'saved-view-delete', viewId: 'daily' },
    { kind: 'extension', extensionId: 'example.review', payload: { cardKey: 4 } },
  ];
}

/** Complete current authority used as the allowed baseline for move-eligibility cases. */
function eligibleMoveInput() {
  return {
    proposal: proposals()[5]!,
    current: {
      boardRevision: 'board-4',
      sourceRevision: 'source-8',
      queryRevision: 'query-12',
      viewRevision: 'view-r2',
      columns: [
        { columnId: 'ready', revision: 'ready-r7' },
        { columnId: 'doing', revision: 'doing-r8' },
      ],
      swimlanes: [{ swimlaneId: 'team-blue', revision: 'team-blue-r3' }],
      cards: [{ cardKey: 4, revision: 'card-4-r3' }],
      sourceCells: [
        {
          address: { columnId: 'ready', swimlaneId: 'team-blue' },
          cursorRevision: 'ready-r7',
          edges: { start: 'complete', end: 'complete' },
          cardKeys: [1, 5],
          placementTokens: [],
        },
      ],
      targetCursorRevision: 'doing-r8',
      targetEdges: { start: 'complete', end: 'complete' },
      targetCardKeys: [8, 9],
      placementTokens: [],
    },
    expected: lifecycle().expected,
    capability: { state: 'allowed' },
    selection: { kind: 'loaded', orderedCardKeys: [4], maximum: 10_000 },
    ordering: { sorted: false, filtered: false, filteredPlacement: 'not-required' },
    transition: { kind: 'allowed' },
    definitionOfDone: { kind: 'allowed' },
    wip: { kind: 'allowed' },
    unchanged: false,
  };
}

describe('standard request proposal contract', () => {
  // Every producer uses one exact, detached proposal vocabulary before lifecycle values exist.
  it('should validate and deeply freeze every standard family and the extension proposal', () => {
    for (const proposal of proposals()) {
      const snapshot = snapshotKanbanRequestProposal(proposal);

      expect(snapshot).toEqual(proposal);
      expect(snapshot).not.toBe(proposal);
      expect(Object.isFrozen(snapshot)).toBe(true);
    }
  });

  // Unknown members cannot become an accidental public bypass or retain application data.
  it('should reject unknown discriminators and extra lifecycle-owned proposal members', () => {
    expect(() => snapshotKanbanRequestProposal({ kind: 'card-publish', cardKey: 4 })).toThrow();
    expect(() =>
      snapshotKanbanRequestProposal({
        kind: 'card-delete',
        cardKey: 4,
        operationId: 'caller-owned',
      }),
    ).toThrow();
    expect(() =>
      snapshotKanbanRequestProposal({
        kind: 'extension',
        extensionId: 'example.review',
        payload: null,
        signal: new AbortController().signal,
      }),
    ).toThrow();
  });

  // The package, not a standard producer, supplies operation identity, revisions, and cancellation.
  it('should create a detached standard dispatch envelope from package-owned lifecycle values', () => {
    const proposal = proposals()[5]!;
    const owned = lifecycle();

    const request = createKanbanRequestEnvelope(proposal, owned);

    expect(request).toMatchObject({
      ...proposal,
      operationId: owned.operationId,
      expected: owned.expected,
      signal: owned.signal,
    });
    expect(request.signal).toBe(owned.signal);
    expect(request.expected).not.toBe(owned.expected);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.expected)).toBe(true);
  });

  // Existing consumers may still pass their complete extension request without rewritten identity.
  it('should adopt a validated legacy extension envelope without replacing its ID or signal', () => {
    const controller = new AbortController();
    const legacy = {
      kind: 'extension',
      extensionId: 'example.review',
      operationId: 'legacy-operation-9',
      expected: { board: 'board-r4' },
      payload: { cardKey: 4 },
      signal: controller.signal,
    };

    const request = createKanbanRequestEnvelope(legacy);

    expect(request).toEqual(legacy);
    expect(request.operationId).toBe('legacy-operation-9');
    expect(request.signal).toBe(controller.signal);
    expect(request).not.toBe(legacy);
    expect(Object.isFrozen(request)).toBe(true);
  });
});

describe('semantic card move contract', () => {
  // Selection order and source evidence are semantic authority; visual indices are never authority.
  it('should preserve ordered moved snapshots and every required semantic revision field', () => {
    const proposal = {
      kind: 'card-move',
      moved: [4, 2, 7].map((cardKey) => ({
        cardKey,
        source: { columnId: 'ready', swimlaneId: 'team-blue' },
        sourcePlacement: {
          kind: 'between',
          beforeCardKey: cardKey - 1,
          afterCardKey: cardKey + 1,
          cursorRevision: 'ready-r7',
        },
        sourceRevision: 'ready-r7',
        entityRevision: `card-${cardKey}-r3`,
      })),
      target: { columnId: 'doing', swimlaneId: 'team-blue' },
      position: { kind: 'between', beforeCardKey: 8, afterCardKey: 9, cursorRevision: 'doing-r8' },
      viewRevision: 'view-r2',
    };

    const snapshot = snapshotKanbanRequestProposal(proposal);

    expect(snapshot).toEqual(proposal);
    expect(snapshot.moved.map(({ cardKey }) => cardKey)).toEqual([4, 2, 7]);
    expect(JSON.stringify(snapshot)).not.toMatch(/(?:index|rank)/u);
  });

  // Scrolling changes pixels and visible indices, not the source-issued semantic interval.
  it('should produce the same proposal for identical anchors at different visual positions', () => {
    const semantic = {
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

    const beforeScroll = snapshotKanbanRequestProposal(semantic);
    const afterScroll = snapshotKanbanRequestProposal({ ...semantic });

    expect(afterScroll).toEqual(beforeScroll);
  });

  // Incomplete windows require opaque current source evidence and cannot guess a numeric end.
  it('should retain a source-issued window-edge token without exposing numeric placement authority', () => {
    const token = createPlacementToken('opaque-window-edge-evidence');
    const snapshot = snapshotKanbanRequestProposal({
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
      position: {
        kind: 'window-edge',
        edge: 'after',
        neighborCardKey: 9,
        token,
        cursorRevision: 'doing-r8',
      },
    });

    expect(snapshot.position).toEqual({
      kind: 'window-edge',
      edge: 'after',
      neighborCardKey: 9,
      token,
      cursorRevision: 'doing-r8',
    });
    expect(JSON.stringify(snapshot.position)).not.toMatch(/(?:index|rank)/u);
  });
});

describe('move eligibility contract', () => {
  // Logical start and end require complete edge evidence; partial windows cannot guess either edge.
  it('should allow complete logical edges and make an unknown logical edge unavailable', () => {
    const complete = eligibleMoveInput();
    const start = {
      ...complete,
      proposal: { ...complete.proposal, position: { kind: 'start', cursorRevision: 'doing-r8' } },
    };
    const unknownEnd = {
      ...complete,
      proposal: { ...complete.proposal, position: { kind: 'end', cursorRevision: 'doing-r8' } },
      current: { ...complete.current, targetEdges: { start: 'complete', end: 'unknown' } },
    };

    expect(evaluateKanbanMoveEligibility(start)).toEqual({ kind: 'allowed' });
    expect(evaluateKanbanMoveEligibility(unknownEnd)).toEqual({
      kind: 'unavailable',
      code: 'placement-edge-unknown',
    });
  });

  // Loaded anchors and source-issued tokens are current evidence; absent or obsolete evidence is not.
  it('should require current anchors or the exact current window-edge token', () => {
    const baseline = eligibleMoveInput();
    const missingAnchor = {
      ...baseline,
      current: { ...baseline.current, targetCardKeys: [8] },
    };
    const token = createPlacementToken('current-edge-token');
    const windowEdge = {
      ...baseline,
      proposal: {
        ...baseline.proposal,
        position: {
          kind: 'window-edge',
          edge: 'after',
          neighborCardKey: 9,
          token,
          cursorRevision: 'doing-r8',
        },
      },
      current: { ...baseline.current, placementTokens: [token] },
    };

    expect(evaluateKanbanMoveEligibility(missingAnchor)).toEqual({
      kind: 'unavailable',
      code: 'placement-anchor-stale',
    });
    expect(evaluateKanbanMoveEligibility(windowEdge)).toEqual({ kind: 'allowed' });
    expect(
      evaluateKanbanMoveEligibility({
        ...windowEdge,
        current: { ...windowEdge.current, placementTokens: [] },
      }),
    ).toEqual({ kind: 'unavailable', code: 'placement-token-stale' });
  });

  // Manual reordering under sort is ambiguous; a policy-valid cross-column transition remains valid.
  it('should block sorted within-cell reorder but allow a cross-column move', () => {
    const baseline = eligibleMoveInput();
    const sortedWithinCell = {
      ...baseline,
      proposal: {
        ...baseline.proposal,
        target: { columnId: 'ready', swimlaneId: 'team-blue' },
        position: { kind: 'between', beforeCardKey: 6, afterCardKey: 7, cursorRevision: 'ready-r7' },
      },
      current: { ...baseline.current, targetCursorRevision: 'ready-r7', targetCardKeys: [6, 7] },
      ordering: { ...baseline.ordering, sorted: true },
    };
    const sortedCrossColumn = { ...baseline, ordering: { ...baseline.ordering, sorted: true } };

    expect(evaluateKanbanMoveEligibility(sortedWithinCell)).toEqual({
      kind: 'blocked',
      code: 'sorted-manual-order',
    });
    expect(evaluateKanbanMoveEligibility(sortedCrossColumn)).toEqual({ kind: 'allowed' });
  });

  // Filtering needs explicit source resolution when visible neighbors may not be logically adjacent.
  it('should require filtered placement resolution before dispatching a within-cell reorder', () => {
    const baseline = eligibleMoveInput();
    const withinCell = {
      ...baseline,
      proposal: {
        ...baseline.proposal,
        target: { columnId: 'ready', swimlaneId: 'team-blue' },
        position: { kind: 'between', beforeCardKey: 6, afterCardKey: 7, cursorRevision: 'ready-r7' },
      },
      current: { ...baseline.current, targetCursorRevision: 'ready-r7', targetCardKeys: [6, 7] },
      ordering: { sorted: false, filtered: true, filteredPlacement: 'unavailable' },
    };

    expect(evaluateKanbanMoveEligibility(withinCell)).toEqual({
      kind: 'unavailable',
      code: 'filtered-placement-unavailable',
    });
    expect(
      evaluateKanbanMoveEligibility({
        ...withinCell,
        ordering: { ...withinCell.ordering, filteredPlacement: 'resolved' },
      }),
    ).toEqual({ kind: 'allowed' });
  });

  // Application workflow advice is composable, but the first terminal pipeline stage always wins.
  it('should preserve transition, definition-of-done, WIP warning, and first-terminal ordering', () => {
    const baseline = eligibleMoveInput();

    expect(
      evaluateKanbanMoveEligibility({
        ...baseline,
        transition: { kind: 'blocked', code: 'transition-not-allowed' },
        wip: { kind: 'warning', code: 'wip-maximum-exceeded' },
      }),
    ).toEqual({ kind: 'blocked', code: 'transition-not-allowed' });
    expect(
      evaluateKanbanMoveEligibility({
        ...baseline,
        definitionOfDone: { kind: 'blocked', code: 'definition-of-done-not-met' },
      }),
    ).toEqual({ kind: 'blocked', code: 'definition-of-done-not-met' });
    expect(
      evaluateKanbanMoveEligibility({
        ...baseline,
        wip: { kind: 'warning', code: 'wip-maximum-exceeded', params: { maximum: 8 } },
      }),
    ).toEqual({
      kind: 'warning',
      code: 'wip-maximum-exceeded',
      params: { maximum: 8 },
    });
  });

  // A stale semantic snapshot is unavailable before presentation capability or workflow is consulted.
  it('should return stale revision before a disabled capability or workflow warning', () => {
    const baseline = eligibleMoveInput();
    const stale = {
      ...baseline,
      expected: { ...baseline.expected, source: 'source-7' },
      capability: { state: 'disabled', reasonCode: 'moves-disabled' },
      transition: { kind: 'warning', code: 'transition-warning' },
    };

    expect(evaluateKanbanMoveEligibility(stale)).toEqual({
      kind: 'unavailable',
      code: 'stale-source-revision',
    });
  });

  // Moving the same ordered cards back to their unchanged semantic interval is not dispatchable.
  it('should block a semantic no-op after every policy stage allows it', () => {
    const baseline = eligibleMoveInput();

    expect(evaluateKanbanMoveEligibility({ ...baseline, unchanged: true })).toEqual({
      kind: 'blocked',
      code: 'unchanged-placement',
    });
  });

  it('should reject stale captured entity revisions before policy evaluation', () => {
    const baseline = eligibleMoveInput();
    const expected = {
      ...baseline.expected,
      entities: [
        { kind: 'card', cardKey: 4, revision: 'card-4-r2' },
        { kind: 'column', columnId: 'doing', revision: 'doing-r8' },
        { kind: 'swimlane', swimlaneId: 'team-blue', revision: 'team-blue-r3' },
      ],
    };

    expect(evaluateKanbanMoveEligibility({ ...baseline, expected })).toEqual({
      kind: 'unavailable',
      code: 'stale-card-revision',
    });
    expect(
      evaluateKanbanMoveEligibility({
        ...baseline,
        expected: { ...expected, entities: [{ kind: 'column', columnId: 'missing', revision: 'r1' }] },
      }),
    ).toEqual({ kind: 'unavailable', code: 'column-not-found' });
  });

  it('should require current source cursor, anchors, and opaque tokens for every moved card', () => {
    const baseline = eligibleMoveInput();
    const source = baseline.current.sourceCells[0]!;
    expect(
      evaluateKanbanMoveEligibility({
        ...baseline,
        current: { ...baseline.current, sourceCells: [{ ...source, cursorRevision: 'ready-r6' }] },
      }),
    ).toEqual({ kind: 'unavailable', code: 'stale-source-placement' });
    expect(
      evaluateKanbanMoveEligibility({
        ...baseline,
        current: { ...baseline.current, sourceCells: [{ ...source, cardKeys: [1] }] },
      }),
    ).toEqual({ kind: 'unavailable', code: 'source-placement-anchor-stale' });

    const token = createPlacementToken('source-window-token');
    const moved = {
      cardKey: 4,
      source: { columnId: 'ready', swimlaneId: 'team-blue' },
      sourceRevision: 'ready-r7',
      entityRevision: 'card-4-r3',
    };
    const windowed = {
      ...baseline,
      proposal: {
        ...baseline.proposal,
        moved: [
          {
            ...moved,
            sourcePlacement: {
              kind: 'window-edge',
              edge: 'after',
              neighborCardKey: 5,
              token,
              cursorRevision: 'ready-r7',
            },
          },
        ],
      },
    };
    expect(evaluateKanbanMoveEligibility(windowed)).toEqual({
      kind: 'unavailable',
      code: 'source-placement-token-stale',
    });
  });

  it('should compose exact transition and WIP helper results', () => {
    const baseline = eligibleMoveInput();
    const transition = evaluateKanbanTransition(
      {
        source: { columnId: 'ready', swimlaneId: 'team-blue' },
        target: { columnId: 'doing', swimlaneId: 'team-blue' },
        cardKeys: [4],
        sourceRevision: 'ready-r7',
        targetRevision: 'doing-r8',
        sessionRevision: 'source-8',
        queryGeneration: 12,
        counts: { source: { quality: 'exact', value: 1 }, target: { quality: 'exact', value: 8 } },
        definitionOfDone: snapshotKanbanDefinitionOfDone({ summary: 'Reviewed' }),
      },
      () => ({ kind: 'blocked', code: 'review-required', label: 'Review required' }),
    );
    expect(evaluateKanbanMoveEligibility({ ...baseline, transition })).toEqual({
      kind: 'blocked',
      code: 'review-required',
      params: { label: 'Review required' },
    });

    const informationalWip = evaluateKanbanWip({
      policy: { maximum: 8, mode: 'informational', countDone: 'include' },
      authoritativeCount: { quality: 'exact', value: 8 },
      matchingCount: { quality: 'exact', value: 4 },
      doneCount: { quality: 'unknown' },
      proposedDelta: 1,
    });
    expect(evaluateKanbanMoveEligibility({ ...baseline, wip: informationalWip })).toEqual({ kind: 'allowed' });

    const wip = evaluateKanbanWip({
      policy: { maximum: 8, mode: 'blocking', countDone: 'exclude' },
      authoritativeCount: { quality: 'unknown' },
      matchingCount: { quality: 'exact', value: 4 },
      doneCount: { quality: 'unknown' },
      proposedDelta: 1,
    });
    expect(evaluateKanbanMoveEligibility({ ...baseline, wip })).toEqual({
      kind: 'unavailable',
      code: 'wip-count-unavailable',
      params: { retryable: true },
    });
  });
});

describe('confirmation classification contract', () => {
  it('should require confirmation for warnings and every destructive standard proposal', () => {
    const warning = classifyKanbanRequestConfirmation(proposals()[0], {
      kind: 'warning',
      code: 'review-required',
    });
    expect(warning).toEqual({ kind: 'warning', code: 'review-required' });

    for (const kind of ['card-archive', 'card-delete', 'column-delete', 'swimlane-delete', 'saved-view-delete']) {
      const proposal = proposals().find((candidate) => Reflect.get(candidate, 'kind') === kind);
      expect(classifyKanbanRequestConfirmation(proposal, { kind: 'allowed' })).toEqual({ kind: 'destructive' });
    }
    expect(classifyKanbanRequestConfirmation(proposals()[0], { kind: 'allowed' })).toEqual({
      kind: 'not-required',
    });
  });
});
