/**
 * Specification tests for standard mutation proposals and semantic move placement.
 *
 * The public proposal is application intent only. The package adds lifecycle authority when it
 * creates the dispatch envelope, while the legacy extension envelope remains an accepted input for
 * existing applications.
 */
import { describe, expect, it } from 'vitest';

import { createKanbanRequestEnvelope, createPlacementToken, snapshotKanbanRequestProposal } from '../src/index.js';

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
