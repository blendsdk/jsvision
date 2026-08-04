import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanCollapsedHoverController,
  createKanbanSwimlanePresentationResolver,
  evaluateKanbanTransition,
  evaluateKanbanWip,
  resolveKanbanGrouping,
  resolveKanbanStructure,
  resolveKanbanStructureState,
  snapshotKanbanDefinitionOfDone,
} from '../src/index.js';
import type {
  KanbanColumnMeta,
  KanbanGroupingPolicy,
  KanbanStructurePolicy,
  KanbanStructureStateInput,
  KanbanSwimlaneMeta,
  KanbanTransitionContext,
  KanbanWorkflowEvaluation,
} from '../src/index.js';

interface WorkItem {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
  readonly team?: string;
  readonly project?: string;
}

const COLUMNS: readonly KanbanColumnMeta[] = Object.freeze([
  Object.freeze({ columnId: 'ready', label: 'Ready', revision: 'ready-v1' }),
  Object.freeze({ columnId: 'doing', label: 'Doing', revision: 'doing-v1' }),
  Object.freeze({ columnId: 'done', label: 'Done', revision: 'done-v1' }),
]);

const CARDS: readonly WorkItem[] = Object.freeze([
  Object.freeze({ id: 1, columnId: 'ready', title: 'First', team: 'alpha', project: 'phoenix' }),
  Object.freeze({ id: 2, columnId: 'doing', title: 'Second', team: 'beta', project: 'phoenix' }),
  Object.freeze({ id: 3, columnId: 'done', title: 'Third' }),
]);

const SWIMLANES: readonly KanbanSwimlaneMeta[] = Object.freeze([
  Object.freeze({ swimlaneId: 'team-alpha', label: 'Team Alpha', revision: 'team-alpha-v1' }),
  Object.freeze({ swimlaneId: 'team-beta', label: 'Team Beta', revision: 'team-beta-v1' }),
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

function groupingPolicy(replacement: Partial<KanbanGroupingPolicy<WorkItem>> = {}): KanbanGroupingPolicy<WorkItem> {
  return {
    fieldId: 'team',
    unassigned: { swimlaneId: 'unassigned', label: 'Unassigned', revision: 'unassigned-v1' },
    ...replacement,
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

  it('accepts zero or one query-owned grouping field and rejects competing fields atomically', () => {
    const ungrouped = resolveKanbanGrouping<WorkItem>({
      query: { filters: [], sort: [] },
      cards: CARDS,
    });
    const grouped = resolveKanbanGrouping<WorkItem>({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards: CARDS,
      policy: groupingPolicy(),
      registry: [
        {
          fieldId: 'team',
          groups: SWIMLANES,
          resolve: (card: WorkItem) => (card.team === undefined ? undefined : `team-${card.team}`),
        },
      ],
    });
    const ungroupedFingerprint = JSON.stringify(ungrouped);
    const groupedFingerprint = JSON.stringify(grouped);
    const twoFields: unknown = {
      filters: [],
      sort: [],
      groupBy: ['team', 'project'],
    };

    expect(ungrouped).toMatchObject({ kind: 'none', activeFieldId: undefined, groups: [], memberships: [] });
    expect(grouped).toMatchObject({ kind: 'grouped', activeFieldId: 'team' });
    expect(() =>
      resolveKanbanGrouping({ query: twoFields, cards: CARDS, policy: groupingPolicy(), previous: grouped }),
    ).toThrow();
    expect(() =>
      resolveKanbanGrouping({
        query: { filters: [], sort: [], groupBy: 'team' },
        cards: CARDS,
        policy: groupingPolicy({ fieldId: 'project' }),
        previous: grouped,
      }),
    ).toThrow();
    expect(JSON.stringify(ungrouped)).toBe(ungroupedFingerprint);
    expect(JSON.stringify(grouped)).toBe(groupedFingerprint);
    expect([ungrouped, grouped, grouped.groups, grouped.memberships].every(Object.isFrozen)).toBe(true);
  });

  it('normalizes explicit memberships without changing semantic addresses', () => {
    const grouped = resolveKanbanGrouping<WorkItem>({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards: CARDS,
      policy: groupingPolicy(),
      explicit: {
        groups: SWIMLANES,
        memberships: [
          { cardKey: 1, swimlaneId: 'team-alpha' },
          { cardKey: 2, swimlaneId: 'team-beta' },
          { cardKey: 3 },
        ],
      },
    });

    expect(grouped.groups.map(({ swimlaneId }: { readonly swimlaneId: string }) => swimlaneId)).toEqual([
      'team-alpha',
      'team-beta',
      'unassigned',
    ]);
    expect(grouped.memberships).toEqual([
      { cardKey: 1, address: { swimlaneId: 'team-alpha' } },
      { cardKey: 2, address: { swimlaneId: 'team-beta' } },
      { cardKey: 3, address: { swimlaneId: 'unassigned' } },
    ]);
  });

  it('resolves derived values once and sends only missing or unmapped values to unassigned', () => {
    const resolve = vi.fn((card: WorkItem) =>
      card.team === 'alpha' ? 'team-alpha' : card.team === 'beta' ? 'team-beta' : undefined,
    );
    const grouped = resolveKanbanGrouping<WorkItem>({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards: CARDS,
      policy: groupingPolicy(),
      registry: [{ fieldId: 'team', groups: SWIMLANES, resolve }],
    });

    expect(resolve).toHaveBeenCalledTimes(CARDS.length);
    expect(resolve.mock.calls.map(([card]) => card)).toEqual(CARDS);
    expect(grouped.memberships).toEqual([
      { cardKey: 1, address: { swimlaneId: 'team-alpha' } },
      { cardKey: 2, address: { swimlaneId: 'team-beta' } },
      { cardKey: 3, address: { swimlaneId: 'unassigned' } },
    ]);
  });

  it('restores hidden group membership without remapping cards to unassigned', () => {
    const hidden = resolveKanbanGrouping<WorkItem>({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards: CARDS,
      policy: groupingPolicy({ visibleSwimlaneIds: ['team-beta', 'unassigned'] }),
      registry: [
        {
          fieldId: 'team',
          groups: SWIMLANES,
          resolve: (card: WorkItem) => (card.team === undefined ? undefined : `team-${card.team}`),
        },
      ],
    });
    const revealed = resolveKanbanGrouping<WorkItem>({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards: CARDS,
      policy: groupingPolicy(),
      registry: [
        {
          fieldId: 'team',
          groups: SWIMLANES,
          resolve: (card: WorkItem) => (card.team === undefined ? undefined : `team-${card.team}`),
        },
      ],
      previous: hidden,
    });

    expect(hidden.groups.some(({ swimlaneId }: { readonly swimlaneId: string }) => swimlaneId === 'team-alpha')).toBe(
      false,
    );
    expect(hidden.memberships.some(({ cardKey }: { readonly cardKey: number }) => cardKey === 1)).toBe(false);
    expect(hidden.detached.memberships).toContainEqual({ cardKey: 1, address: { swimlaneId: 'team-alpha' } });
    expect(hidden.detached.memberships).not.toContainEqual({ cardKey: 1, address: { swimlaneId: 'unassigned' } });
    expect(revealed.memberships).toContainEqual({ cardKey: 1, address: { swimlaneId: 'team-alpha' } });
  });

  it('rejects normalized duplicate labels unless every collision has a distinct disambiguator', () => {
    const collidingGroups: readonly KanbanSwimlaneMeta[] = [
      { swimlaneId: 'alpha-one', label: ' Team   Alpha ', revision: 'alpha-one-v1' },
      { swimlaneId: 'alpha-two', label: 'team alpha', revision: 'alpha-two-v1' },
    ];
    const base = {
      query: { filters: [], sort: [], groupBy: 'team' } as const,
      cards: CARDS,
      explicit: { groups: collidingGroups, memberships: [] },
    };

    expect(() => resolveKanbanGrouping({ ...base, policy: groupingPolicy() })).toThrow();
    expect(() =>
      resolveKanbanGrouping({
        ...base,
        policy: groupingPolicy({
          allowDuplicateLabels: true,
          disambiguators: { 'alpha-one': 'North', 'alpha-two': 'North' },
        }),
      }),
    ).toThrow();

    const resolved = resolveKanbanGrouping({
      ...base,
      policy: groupingPolicy({
        allowDuplicateLabels: true,
        disambiguators: { 'alpha-one': 'North', 'alpha-two': 'South' },
      }),
    });
    expect(
      resolved.groups.map(({ label, disambiguator }: { readonly label: string; readonly disambiguator?: string }) => ({
        label,
        disambiguator,
      })),
    ).toEqual([
      { label: 'Team Alpha', disambiguator: 'North' },
      { label: 'team alpha', disambiguator: 'South' },
      { label: 'Unassigned', disambiguator: undefined },
    ]);
  });

  it('contains hostile derived, style, and summary resolver failures per group', () => {
    const observations: unknown[] = [];
    const grouped = resolveKanbanGrouping<WorkItem>({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards: CARDS,
      policy: groupingPolicy({
        resolverFallback: { swimlaneId: 'group-unavailable', label: 'Unavailable', revision: 'fallback-v1' },
      }),
      registry: [
        {
          fieldId: 'team',
          groups: SWIMLANES,
          resolve: (card: WorkItem) => {
            if (card.id === 2) throw new Error('derived-secret\u001b[31m');
            return card.team === undefined ? undefined : `team-${card.team}`;
          },
          styleOf: (group: KanbanSwimlaneMeta) => {
            if (group.swimlaneId === 'team-alpha') throw new Error('style-secret');
            return { role: 'swimlane.header' };
          },
          summaryOf: (group: KanbanSwimlaneMeta) => {
            if (group.swimlaneId === 'team-alpha') throw new Error('summary-secret');
            return { count: 1, label: 'One' };
          },
        },
      ],
      observe: (observation: unknown) => observations.push(observation),
    });

    expect(grouped.memberships).toContainEqual({ cardKey: 2, address: { swimlaneId: 'group-unavailable' } });
    expect(grouped.memberships).not.toContainEqual({ cardKey: 2, address: { swimlaneId: 'unassigned' } });
    expect(
      grouped.groups.find(({ swimlaneId }: { readonly swimlaneId: string }) => swimlaneId === 'team-alpha'),
    ).toMatchObject({ style: undefined, summary: undefined });
    expect(grouped.groups.some(({ swimlaneId }: { readonly swimlaneId: string }) => swimlaneId === 'team-beta')).toBe(
      true,
    );
    expect(observations).toHaveLength(3);
    expect(JSON.stringify(observations)).not.toMatch(/derived-secret|style-secret|summary-secret|\u001b/u);
  });

  it('keeps semantic swimlane content equal across built-in presentation variants', () => {
    const resolver = createKanbanSwimlanePresentationResolver();
    const swimlane = {
      swimlaneId: 'team-alpha',
      label: 'Team Alpha',
      count: { quality: 'exact' as const, value: 2 },
      summary: { count: 5, label: 'Points' },
      revision: 'team-alpha-visible-v1',
    };
    const variants = ['hybrid', 'separator', 'band', 'rail'] as const;
    const resolved = variants.map((presentation) =>
      resolver.resolve({
        presentation,
        swimlane,
        availableWidth: 80,
        columns: [
          { columnId: 'ready', minimumWidth: 18 },
          { columnId: 'doing', minimumWidth: 18 },
        ],
        railWidth: 10,
      }),
    );

    expect(resolved.map(({ resolvedVariant }) => resolvedVariant)).toEqual(variants);
    expect(resolved.map(({ semantic }) => semantic)).toEqual([swimlane, swimlane, swimlane, swimlane]);
    expect(new Set(resolved.map(({ chrome }) => chrome.kind))).toEqual(new Set(variants));
    expect(resolved.every(Object.isFrozen)).toBe(true);
    resolver.dispose();
  });

  it('degrades rail to hybrid before any card column falls below eighteen cells', () => {
    const resolver = createKanbanSwimlanePresentationResolver();
    const result = resolver.resolve({
      presentation: 'rail',
      swimlane: { swimlaneId: 'team-alpha', label: 'Team Alpha', revision: 'team-alpha-visible-v1' },
      availableWidth: 45,
      columns: [
        { columnId: 'ready', minimumWidth: 18 },
        { columnId: 'doing', minimumWidth: 18 },
      ],
      railWidth: 10,
    });

    expect(result).toMatchObject({ requestedVariant: 'rail', resolvedVariant: 'hybrid', degraded: true });
    expect(
      result.columns.every(({ availableWidth }: { readonly availableWidth: number }) => availableWidth >= 18),
    ).toBe(true);
    resolver.dispose();
  });

  it('falls back locally for an over-budget custom descriptor and caches once per visible revision', () => {
    const observations: unknown[] = [];
    const render = vi.fn(() => ({
      rows: 33,
      railWidth: 80,
      text: ['Unsafe\u001b[31m'],
      roles: ['host.raw-role'],
      regions: Array.from({ length: 100 }, () => ({ x: 0, y: 0, width: 1, height: 1 })),
      actions: Array.from({ length: 100 }, (_, index) => ({ actionId: `action-${index}` })),
      targets: [{ kind: 'drop' }],
    }));
    const resolver = createKanbanSwimlanePresentationResolver({
      observe: (observation: unknown) => observations.push(observation),
    });
    const input = {
      presentation: { kind: 'custom' as const, revision: 'custom-v1', render },
      swimlane: { swimlaneId: 'team-alpha', label: 'Team Alpha', revision: 'visible-v1' },
      availableWidth: 80,
      columns: [{ columnId: 'ready', minimumWidth: 18 }],
    };

    const first = resolver.resolve(input);
    const repeated = resolver.resolve(input);
    const nextRevision = resolver.resolve({
      ...input,
      swimlane: { ...input.swimlane, revision: 'visible-v2' },
    });

    expect(first).toMatchObject({ requestedVariant: 'custom', resolvedVariant: 'hybrid', fallback: 'invalid-custom' });
    expect(repeated).toEqual(first);
    expect(nextRevision).toMatchObject({
      requestedVariant: 'custom',
      resolvedVariant: 'hybrid',
      fallback: 'invalid-custom',
    });
    expect(render).toHaveBeenCalledTimes(2);
    expect(observations).toHaveLength(2);
    expect(JSON.stringify([first, repeated, nextRevision, observations])).not.toContain('\u001b');
    expect([first, repeated, nextRevision].every(Object.isFrozen)).toBe(true);
    resolver.dispose();
  });
});
