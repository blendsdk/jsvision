import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanCollapsedHoverController,
  evaluateKanbanTransition,
  evaluateKanbanWip,
  resolveKanbanStructure,
  resolveKanbanStructureState,
  snapshotKanbanDefinitionOfDone,
} from '../src/index.js';
import type {
  KanbanColumnMeta,
  KanbanStructurePolicy,
  KanbanStructureStateInput,
  KanbanTransitionContext,
  KanbanWorkflowEvaluation,
} from '../src/index.js';

interface WorkItem {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const COLUMNS: readonly KanbanColumnMeta[] = Object.freeze([
  Object.freeze({ columnId: 'ready', label: 'Ready', revision: 'ready-v1' }),
  Object.freeze({ columnId: 'doing', label: 'Doing', revision: 'doing-v1' }),
  Object.freeze({ columnId: 'done', label: 'Done', revision: 'done-v1' }),
]);

const CARDS: readonly WorkItem[] = Object.freeze([
  Object.freeze({ id: 1, columnId: 'ready', title: 'First' }),
  Object.freeze({ id: 2, columnId: 'doing', title: 'Second' }),
  Object.freeze({ id: 3, columnId: 'done', title: 'Third' }),
]);

function structurePolicy(columns: KanbanStructurePolicy<WorkItem>['columns'] = []): KanbanStructurePolicy<WorkItem> {
  return {
    revision: 'structure-policy-v1',
    columns,
  };
}

function transitionContext(): KanbanTransitionContext {
  return {
    source: { columnId: 'done' },
    target: { columnId: 'doing' },
    cardKeys: [3, 1],
    sourceRevision: 'source-v3',
    targetRevision: 'target-v7',
    sessionRevision: 'session-v9',
    queryGeneration: 4,
    counts: {
      source: { quality: 'exact', value: 2 },
      target: { quality: 'exact', value: 8 },
    },
    definitionOfDone: snapshotKanbanDefinitionOfDone({
      summary: 'Tests pass',
      details: 'Tests pass and the release is approved',
    }),
  };
}

describe('Kanban structure and workflow contract', () => {
  it('keeps stable column identity across labels and authoritative source order', () => {
    const original = resolveKanbanStructure({
      revision: 'structure-v1',
      columns: COLUMNS,
      policy: structurePolicy(),
    });
    const renamedAndReordered = resolveKanbanStructure({
      revision: 'structure-v2',
      columns: [{ columnId: 'done', label: 'Released', revision: 'done-v2' }, COLUMNS[0]!, COLUMNS[1]!],
      policy: structurePolicy(),
    });

    expect(original.columns.map(({ columnId }: { readonly columnId: string }) => columnId)).toEqual([
      'ready',
      'doing',
      'done',
    ]);
    expect(renamedAndReordered.columns.map(({ columnId }: { readonly columnId: string }) => columnId)).toEqual([
      'done',
      'ready',
      'doing',
    ]);
    expect(renamedAndReordered.columns[0]).toMatchObject({ columnId: 'done', label: 'Released' });
    expect(
      renamedAndReordered.columns.find(({ columnId }: { readonly columnId: string }) => columnId === 'done')
        ?.semanticReference,
    ).toEqual({ kind: 'column', columnId: 'done' });
    expect(Object.isFrozen(renamedAndReordered)).toBe(true);
    expect(Object.isFrozen(renamedAndReordered.columns)).toBe(true);
  });

  it('accepts zero columns as a frozen no-columns structure', () => {
    const structure = resolveKanbanStructure({
      revision: 'structure-empty',
      columns: [],
      policy: structurePolicy(),
    });

    expect(structure.columns).toEqual([]);
    expect(structure.detached.columns).toEqual([]);
    expect(structure.state).toEqual({ code: 'no-columns', scope: { kind: 'board' }, actions: [] });
    expect([structure, structure.columns, structure.detached, structure.state].every(Object.isFrozen)).toBe(true);
  });

  it('keeps hidden and collapsed columns semantically distinct without changing application cards', () => {
    const before = JSON.stringify(CARDS);
    const structure = resolveKanbanStructure({
      revision: 'structure-visibility',
      columns: COLUMNS,
      policy: structurePolicy([
        { columnId: 'ready', visible: false },
        { columnId: 'doing', collapsed: true },
      ]),
    });

    expect(structure.columns.map(({ columnId }: { readonly columnId: string }) => columnId)).toEqual(['doing', 'done']);
    expect(structure.columns.find(({ columnId }: { readonly columnId: string }) => columnId === 'doing')).toMatchObject(
      {
        visibility: 'visible',
        collapse: 'collapsed',
        cardRegion: 'suppressed',
      },
    );
    expect(
      structure.detached.columns.find(({ columnId }: { readonly columnId: string }) => columnId === 'ready'),
    ).toMatchObject({
      visibility: 'hidden',
      collapse: 'expanded',
    });
    expect(
      structure.detached.columns.find(({ columnId }: { readonly columnId: string }) => columnId === 'doing'),
    ).toMatchObject({
      visibility: 'visible',
      collapse: 'collapsed',
    });
    expect(JSON.stringify(CARDS)).toBe(before);
    expect(CARDS.map(({ columnId }) => columnId)).toEqual(['ready', 'doing', 'done']);
  });

  it('retains collapsed header evidence while hidden entities remain detached', () => {
    const collapsed = resolveKanbanStructure({
      revision: 'structure-collapsed',
      columns: COLUMNS,
      policy: structurePolicy([
        {
          columnId: 'doing',
          collapsed: true,
          definitionOfDone: { summary: 'Reviewed', details: 'Reviewed by the owning team' },
          capabilities: ['collapse', 'configure'],
        },
      ]),
    });
    const hidden = resolveKanbanStructure({
      revision: 'structure-hidden',
      columns: COLUMNS,
      policy: structurePolicy([{ columnId: 'doing', visible: false }]),
    });

    expect(collapsed.columns.find(({ columnId }: { readonly columnId: string }) => columnId === 'doing')).toMatchObject(
      {
        label: 'Doing',
        collapse: 'collapsed',
        cardRegion: 'suppressed',
        definitionOfDone: { summary: 'Reviewed' },
        capabilities: ['collapse', 'configure'],
      },
    );
    expect(hidden.columns.some(({ columnId }: { readonly columnId: string }) => columnId === 'doing')).toBe(false);
    expect(
      hidden.detached.columns.find(({ columnId }: { readonly columnId: string }) => columnId === 'doing')?.visibility,
    ).toBe('hidden');
  });

  it('uses authoritative WIP instead of matching counts in every policy mode', () => {
    const input = {
      policy: { minimum: 1, maximum: 8, countDone: 'include' as const },
      authoritativeCount: { quality: 'exact' as const, value: 8 },
      matchingCount: { quality: 'exact' as const, value: 4 },
      doneCount: { quality: 'exact' as const, value: 2 },
      proposedDelta: 1,
    };
    const informational = evaluateKanbanWip({ ...input, policy: { ...input.policy, mode: 'informational' } });
    const advisory = evaluateKanbanWip({ ...input, policy: { ...input.policy, mode: 'advisory' } });
    const blocking = evaluateKanbanWip({ ...input, policy: { ...input.policy, mode: 'blocking' } });

    expect(informational).toEqual({
      kind: 'allowed',
      violation: {
        boundary: 'maximum',
        authoritativeCount: 8,
        matchingCount: 4,
        proposedCount: 9,
        limit: 8,
      },
    });
    expect(advisory).toEqual({ kind: 'warning', code: 'wip-maximum-exceeded' });
    expect(blocking).toEqual({ kind: 'blocked', code: 'wip-maximum-exceeded' });
    expect([informational, informational.violation, advisory, blocking].every(Object.isFrozen)).toBe(true);
  });

  it('fails closed when blocking WIP authority is unknown', () => {
    const result = evaluateKanbanWip({
      policy: { maximum: 8, mode: 'blocking', countDone: 'exclude' },
      authoritativeCount: { quality: 'unknown' },
      matchingCount: { quality: 'exact', value: 4 },
      doneCount: { quality: 'unknown' },
      proposedDelta: 1,
    });

    expect(result).toEqual({ kind: 'unavailable', code: 'wip-count-unavailable', retryable: true });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('mirrors application transition advice without assuming direction or dispatching', () => {
    const cardsBefore = JSON.stringify(CARDS);
    const resolver = vi
      .fn<(context: KanbanTransitionContext) => KanbanWorkflowEvaluation>()
      .mockReturnValueOnce({ kind: 'allowed' })
      .mockReturnValueOnce({ kind: 'blocked', code: 'return-not-approved', label: 'Approval required' });
    const dispatch = vi.fn();
    const context = transitionContext();

    const allowed = evaluateKanbanTransition(context, resolver);
    const blocked = evaluateKanbanTransition(context, resolver);

    expect(allowed).toEqual({ kind: 'allowed' });
    expect(blocked).toEqual({ kind: 'blocked', code: 'return-not-approved', label: 'Approval required' });
    expect(resolver).toHaveBeenNthCalledWith(1, context);
    expect(resolver.mock.calls[0]?.[0].cardKeys).toEqual([3, 1]);
    expect(Object.isFrozen(resolver.mock.calls[0]?.[0])).toBe(true);
    expect(Object.isFrozen(resolver.mock.calls[0]?.[0].cardKeys)).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
    expect(JSON.stringify(CARDS)).toBe(cardsBefore);
  });

  it('contains transition resolver failures as sanitized unavailable advice', () => {
    const observations: unknown[] = [];
    const result = evaluateKanbanTransition(
      transitionContext(),
      () => {
        throw new Error('transition-secret\u001b[31m');
      },
      (observation: unknown) => observations.push(observation),
    );

    expect(result).toEqual({ kind: 'unavailable', code: 'transition-resolver-failed', retryable: false });
    expect(observations).toHaveLength(1);
    expect(JSON.stringify(observations)).not.toContain('transition-secret');
    expect(JSON.stringify(observations)).not.toContain('\u001b');
  });

  it('sanitizes compact and complete definition-of-done evidence without expanding chrome', () => {
    const definition = snapshotKanbanDefinitionOfDone({
      summary: 'Reviewed\u001b[31m',
      details: 'Reviewed\nby the release owner\u202e',
    });

    expect(definition).toEqual({
      summary: 'Reviewed',
      details: 'Reviewed by the release owner',
      indicator: 'configured',
    });
    expect(Object.isFrozen(definition)).toBe(true);
  });

  it('maps structural lifecycle facts to distinct frozen state codes and action routes', () => {
    const fixtures: readonly (readonly [KanbanStructureStateInput, string, readonly string[]])[] = [
      [
        { scope: { kind: 'cell', address: { columnId: 'ready' } }, source: { kind: 'empty' }, filtered: false },
        'true-empty',
        [],
      ],
      [
        { scope: { kind: 'cell', address: { columnId: 'ready' } }, source: { kind: 'empty' }, filtered: true },
        'filtered-empty',
        ['clear-filters'],
      ],
      [{ scope: { kind: 'board' }, source: { kind: 'loading' }, filtered: false }, 'loading', []],
      [{ scope: { kind: 'board' }, source: { kind: 'refreshing' }, filtered: false }, 'refreshing', []],
      [{ scope: { kind: 'column', columnId: 'doing' }, source: { kind: 'partial' }, filtered: false }, 'partial', []],
      [
        { scope: { kind: 'column', columnId: 'doing' }, source: { kind: 'ready' }, collapsed: true, filtered: false },
        'collapsed',
        [],
      ],
      [
        { scope: { kind: 'column', columnId: 'doing' }, source: { kind: 'ready' }, hidden: true, filtered: false },
        'hidden',
        [],
      ],
      [
        {
          scope: { kind: 'cell', address: { columnId: 'doing' } },
          source: { kind: 'error', code: 'range-failed', retry: 'available' },
          filtered: false,
        },
        'error',
        ['retry'],
      ],
    ];

    for (const [input, code, actions] of fixtures) {
      const state = resolveKanbanStructureState(input);
      expect(state.code).toBe(code);
      expect(state.actions.map(({ kind }: { readonly kind: string }) => kind)).toEqual(actions);
      expect(state.nonColorCue).not.toBe('');
      expect([state, state.actions].every(Object.isFrozen)).toBe(true);
    }
  });

  it('temporarily expands one visible collapsed swimlane after the fixed hover threshold', () => {
    vi.useFakeTimers();
    try {
      const saved = Object.freeze({ collapsedSwimlaneIds: Object.freeze(['team-a']) });
      const controller = createKanbanCollapsedHoverController();

      expect(controller.begin({ swimlaneId: 'team-a', visible: true, collapsed: true })).toBe(true);
      vi.advanceTimersByTime(499);
      expect(controller.snapshot()).toEqual({ kind: 'waiting', swimlaneId: 'team-a' });
      vi.advanceTimersByTime(1);
      expect(controller.snapshot()).toEqual({ kind: 'expanded', swimlaneId: 'team-a', temporary: true });
      expect(saved.collapsedSwimlaneIds).toEqual(['team-a']);

      controller.leave('team-a');
      expect(controller.snapshot()).toEqual({ kind: 'idle' });
      expect(controller.begin({ swimlaneId: 'team-hidden', visible: false, collapsed: true })).toBe(false);
      expect(controller.snapshot()).toEqual({ kind: 'idle' });

      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels stale hover generations and restores the underlying collapsed state', () => {
    vi.useFakeTimers();
    try {
      const controller = createKanbanCollapsedHoverController();
      controller.begin({ swimlaneId: 'team-a', visible: true, collapsed: true });
      vi.advanceTimersByTime(300);
      controller.begin({ swimlaneId: 'team-b', visible: true, collapsed: true });
      vi.advanceTimersByTime(200);
      expect(controller.snapshot()).toEqual({ kind: 'waiting', swimlaneId: 'team-b' });
      vi.advanceTimersByTime(300);
      expect(controller.snapshot()).toEqual({ kind: 'expanded', swimlaneId: 'team-b', temporary: true });

      controller.cancel();
      expect(controller.snapshot()).toEqual({ kind: 'idle' });
      controller.dispose();
      vi.runAllTimers();
      expect(controller.snapshot()).toEqual({ kind: 'disposed' });
    } finally {
      vi.useRealTimers();
    }
  });
});
