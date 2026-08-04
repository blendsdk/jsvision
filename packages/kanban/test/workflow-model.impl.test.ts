import { describe, expect, it } from 'vitest';

import {
  KanbanInvalidPresentationError,
  KanbanInvalidSourcePublicationError,
  createEagerKanbanDataSource,
  resolveKanbanGrouping,
  resolveKanbanStructure,
  validateKanbanLimitOptions,
} from '../src/index.js';
import type {
  KanbanColumnMeta,
  KanbanGroupingPolicy,
  KanbanObservation,
  KanbanStructurePolicy,
  KanbanSwimlaneMeta,
} from '../src/index.js';
import { buildEagerKanbanIndex } from '../src/source/eager-index.js';

interface WorkItem {
  readonly id: number | string;
  readonly columnId: string;
  readonly team?: string;
}

const COLUMNS: readonly KanbanColumnMeta[] = Object.freeze([
  Object.freeze({ columnId: 'ready', label: 'Ready', revision: 1 }),
  Object.freeze({ columnId: 'doing', label: 'Doing', revision: 1 }),
  Object.freeze({ columnId: 'done', label: 'Done', revision: 1 }),
]);

const SWIMLANES: readonly KanbanSwimlaneMeta[] = Object.freeze([
  Object.freeze({ swimlaneId: 'alpha', label: 'Alpha', revision: 1 }),
  Object.freeze({ swimlaneId: 'beta', label: 'Beta', revision: 1 }),
]);

/** Builds the minimal immutable structure policy used by projection cases. */
function structurePolicy(columns: KanbanStructurePolicy<WorkItem>['columns'] = []): KanbanStructurePolicy<WorkItem> {
  return { revision: 'policy-v1', columns };
}

/** Builds a query-owned grouping policy while allowing one focused override. */
function groupingPolicy(replacement: Partial<KanbanGroupingPolicy<WorkItem>> = {}): KanbanGroupingPolicy<WorkItem> {
  return {
    fieldId: 'team',
    unassigned: { swimlaneId: 'unassigned', label: 'Unassigned', revision: 1 },
    ...replacement,
  };
}

/** Registry entry shared by ordinary derived-grouping cases. */
function teamRegistry() {
  return [
    {
      fieldId: 'team',
      groups: SWIMLANES,
      resolve: (card: WorkItem) => card.team,
    },
  ] as const;
}

describe('workflow structure projection', () => {
  it('preserves stable identities and source order across deterministic label changes', () => {
    for (let rotation = 0; rotation < COLUMNS.length; rotation += 1) {
      const ordered = [...COLUMNS.slice(rotation), ...COLUMNS.slice(0, rotation)].map((column, index) => ({
        ...column,
        label: `${column.label} ${rotation}-${index}`,
        revision: `revision-${rotation}-${index}`,
      }));

      const result = resolveKanbanStructure({
        revision: `structure-${rotation}`,
        columns: ordered,
        policy: structurePolicy(),
      });

      expect(result.columns.map((column) => column.columnId)).toEqual(ordered.map((column) => column.columnId));
      expect(result.columns.map((column) => column.semanticReference)).toEqual(
        ordered.map((column) => ({ kind: 'column', columnId: column.columnId })),
      );
      expect(result.columns.map((column) => column.label)).toEqual(ordered.map((column) => column.label));
    }
  });

  it.each([
    { visible: true, collapsed: false, visibility: 'visible', collapse: 'expanded', cardRegion: 'active' },
    { visible: true, collapsed: true, visibility: 'visible', collapse: 'collapsed', cardRegion: 'suppressed' },
    { visible: false, collapsed: false, visibility: 'hidden', collapse: 'expanded', cardRegion: 'suppressed' },
    { visible: false, collapsed: true, visibility: 'hidden', collapse: 'collapsed', cardRegion: 'suppressed' },
  ] as const)('projects visibility and collapse independently for %#', (expected) => {
    const result = resolveKanbanStructure({
      revision: 'visibility-v1',
      columns: COLUMNS,
      policy: structurePolicy([{ columnId: 'doing', visible: expected.visible, collapsed: expected.collapsed }]),
    });
    const detached = result.detached.columns.find((column) => column.columnId === 'doing');

    expect(detached).toMatchObject({
      visibility: expected.visibility,
      collapse: expected.collapse,
      cardRegion: expected.cardRegion,
    });
    expect(result.columns.some((column) => column.columnId === 'doing')).toBe(expected.visible);
  });

  it('rejects duplicate and accessor-backed policy identities without partial projection', () => {
    expect(() =>
      resolveKanbanStructure({
        revision: 'invalid-duplicate',
        columns: COLUMNS,
        policy: structurePolicy([{ columnId: 'doing' }, { columnId: 'doing' }]),
      }),
    ).toThrow(KanbanInvalidPresentationError);

    const hostile: Record<string, unknown> = { revision: 'hostile', columns: [] };
    Object.defineProperty(hostile, 'grouping', {
      enumerable: true,
      get: () => {
        throw new Error('secret-policy-payload');
      },
    });
    expect(() =>
      resolveKanbanStructure({ revision: 'invalid-accessor', columns: COLUMNS, policy: hostile as never }),
    ).toThrow(KanbanInvalidPresentationError);
  });
});

describe('query-owned grouping projection', () => {
  it('preserves number and string card keys as distinct ordered membership identities', () => {
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', team: 'alpha' },
      { id: '1', columnId: 'ready', team: 'alpha' },
      { id: 2, columnId: 'doing', team: 'beta' },
    ];
    const result = resolveKanbanGrouping({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards,
      policy: groupingPolicy(),
      registry: teamRegistry(),
    });

    expect(result.memberships.map((membership) => membership.cardKey)).toEqual([1, '1', 2]);
    expect(new Set(result.memberships.map((membership) => membership.cardKey)).size).toBe(3);
    expect(Object.isFrozen(result.memberships)).toBe(true);
  });

  it('keeps hidden membership detached and restores the same semantic address on reveal', () => {
    const cards: readonly WorkItem[] = [{ id: 1, columnId: 'ready', team: 'alpha' }];
    const hidden = resolveKanbanGrouping({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards,
      policy: groupingPolicy({ visibleSwimlaneIds: ['beta', 'unassigned'] }),
      registry: teamRegistry(),
    });
    const revealed = resolveKanbanGrouping({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards,
      policy: groupingPolicy(),
      registry: teamRegistry(),
      previous: hidden,
    });

    expect(hidden.memberships).toEqual([]);
    expect(hidden.detached.memberships).toEqual([{ cardKey: 1, address: { swimlaneId: 'alpha' } }]);
    expect(revealed.memberships).toEqual([{ cardKey: 1, address: { swimlaneId: 'alpha' } }]);
  });

  it.each([
    [' Team   Alpha ', 'team alpha'],
    ['Café', 'Cafe\u0301'],
    ['ALPHA', 'alpha'],
  ])('rejects normalized-equal labels %j and %j without unique disambiguators', (left, right) => {
    const groups: readonly KanbanSwimlaneMeta[] = [
      { swimlaneId: 'left', label: left, revision: 1 },
      { swimlaneId: 'right', label: right, revision: 1 },
    ];
    const input = {
      query: { filters: [], sort: [], groupBy: 'team' },
      cards: [] as readonly WorkItem[],
      explicit: { groups, memberships: [] },
    } as const;

    expect(() => resolveKanbanGrouping({ ...input, policy: groupingPolicy() })).toThrow(KanbanInvalidPresentationError);
    expect(() =>
      resolveKanbanGrouping({
        ...input,
        policy: groupingPolicy({
          allowDuplicateLabels: true,
          disambiguators: { left: 'North', right: 'South' },
        }),
      }),
    ).not.toThrow();
  });

  it('isolates a hostile resolver and observation sink while retaining other groups', () => {
    const observations: KanbanObservation[] = [];
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', team: 'alpha' },
      { id: 2, columnId: 'ready', team: 'beta' },
    ];
    const result = resolveKanbanGrouping({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards,
      policy: groupingPolicy({
        resolverFallback: { swimlaneId: 'unavailable', label: 'Unavailable', revision: 1 },
      }),
      registry: [
        {
          fieldId: 'team',
          groups: SWIMLANES,
          resolve: (card: WorkItem) => {
            if (card.id === 1) throw new Error('resolver-secret\u001b[31m');
            return card.team;
          },
        },
      ],
      observe: (observation) => {
        observations.push(observation);
        throw new Error('observer-secret');
      },
    });

    expect(result.memberships).toContainEqual({ cardKey: 1, address: { swimlaneId: 'unavailable' } });
    expect(result.memberships).toContainEqual({ cardKey: 2, address: { swimlaneId: 'beta' } });
    expect(observations).toEqual([{ code: 'group-resolver-failed', scope: 'renderer' }]);
    expect(JSON.stringify(observations)).not.toMatch(/resolver-secret|observer-secret|\u001b/u);
  });

  it('routes a malformed derived group identity through the redacted fallback path', () => {
    const observations: KanbanObservation[] = [];
    const result = resolveKanbanGrouping({
      query: { filters: [], sort: [], groupBy: 'team' },
      cards: [{ id: 1, columnId: 'ready', team: 'alpha' }] as const,
      policy: groupingPolicy({
        resolverFallback: { swimlaneId: 'unavailable', label: 'Unavailable', revision: 1 },
      }),
      registry: [
        {
          fieldId: 'team',
          groups: SWIMLANES,
          resolve: () => '\u001b[31m',
        },
      ],
      observe: (observation) => observations.push(observation),
    });

    expect(result.memberships).toEqual([{ cardKey: 1, address: { swimlaneId: 'unavailable' } }]);
    expect(observations).toEqual([{ code: 'group-resolver-failed', scope: 'renderer' }]);
  });

  it('rejects a policy for a field other than the sole query grouping field', () => {
    expect(() =>
      resolveKanbanGrouping({
        query: { filters: [], sort: [], groupBy: 'team' },
        cards: [] as readonly WorkItem[],
        policy: groupingPolicy({ fieldId: 'project' }),
        registry: teamRegistry(),
      }),
    ).toThrow(KanbanInvalidPresentationError);
  });
});

describe('sparse eager grouping index', () => {
  it('allocates only occupied semantic addresses across a wide column and swimlane domain', () => {
    const columns = Array.from({ length: 16 }, (_, index): KanbanColumnMeta => ({
      columnId: `column-${index}`,
      label: `Column ${index}`,
      revision: 1,
    }));
    const swimlanes = Array.from({ length: 32 }, (_, index): KanbanSwimlaneMeta => ({
      swimlaneId: `team-${index}`,
      label: `Team ${index}`,
      revision: 1,
    }));
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'column-0', team: 'team-0' },
      { id: 2, columnId: 'column-7', team: 'team-13' },
      { id: 3, columnId: 'column-15', team: 'team-31' },
    ];
    const sourceOptions = {
      columns: () => columns,
      swimlanes: () => swimlanes,
      keyOf: (card: WorkItem) => card.id,
      columnOf: (card: WorkItem) => card.columnId,
      groupingFields: [{ id: 'team', swimlaneOf: (card: WorkItem) => card.team }],
    } as const;
    const index = buildEagerKanbanIndex(cards, columns, swimlanes, {
      query: { filters: [], sort: [], groupBy: 'team' },
      revision: 'sparse-v1',
      sourceOptions,
      limits: validateKanbanLimitOptions(),
    });

    expect(index.allocationCounts).toEqual({
      addresses: cards.length,
      matchingCellBuckets: cards.length,
      authoritativeCellBuckets: cards.length,
    });
    expect(index.cells.size).toBe(cards.length);
    expect(index.cells.size).toBeLessThan(columns.length * swimlanes.length);
  });

  it('maps missing and valid-unmapped values into the declared unassigned swimlane', () => {
    const swimlanes: readonly KanbanSwimlaneMeta[] = [
      ...SWIMLANES,
      { swimlaneId: 'unassigned', label: 'Unassigned', revision: 1 },
      { swimlaneId: 'unavailable', label: 'Unavailable', revision: 1 },
    ];
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready' },
      { id: 2, columnId: 'ready', team: 'not-declared' },
    ];
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => COLUMNS,
      swimlanes: () => swimlanes,
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      groupingFields: [
        {
          id: 'team',
          swimlaneOf: (card) => card.team,
          unassignedSwimlaneId: 'unassigned',
          resolverFallbackSwimlaneId: 'unavailable',
        },
      ],
    });
    const session = source.openQuery({ groupBy: 'team' });
    const unassigned = session.cell({ columnId: 'ready', swimlaneId: 'unassigned' });

    expect([unassigned.cardAt(0)?.id, unassigned.cardAt(1)?.id]).toEqual([1, 2]);
    expect(() => session.cell({ columnId: 'ready' })).toThrow(KanbanInvalidSourcePublicationError);
  });

  it('contains throwing and malformed eager resolvers in the declared fallback swimlane', () => {
    const observations: KanbanObservation[] = [];
    const swimlanes: readonly KanbanSwimlaneMeta[] = [
      ...SWIMLANES,
      { swimlaneId: 'unassigned', label: 'Unassigned', revision: 1 },
      { swimlaneId: 'unavailable', label: 'Unavailable', revision: 1 },
    ];
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', team: 'throw' },
      { id: 2, columnId: 'ready', team: 'malformed' },
      { id: 3, columnId: 'ready', team: 'beta' },
    ];
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => COLUMNS,
      swimlanes: () => swimlanes,
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      groupingFields: [
        {
          id: 'team',
          swimlaneOf: (card) => {
            if (card.team === 'throw') throw new Error('eager-resolver-secret');
            return card.team === 'malformed' ? '\u001b[31m' : card.team;
          },
          unassignedSwimlaneId: 'unassigned',
          resolverFallbackSwimlaneId: 'unavailable',
        },
      ],
      observe: (observation) => observations.push(observation),
    });
    const session = source.openQuery({ groupBy: 'team' });
    const fallback = session.cell({ columnId: 'ready', swimlaneId: 'unavailable' });

    expect([fallback.cardAt(0)?.id, fallback.cardAt(1)?.id]).toEqual([1, 2]);
    expect(session.cell({ columnId: 'ready', swimlaneId: 'beta' }).cardAt(0)?.id).toBe(3);
    expect(observations).toEqual([
      { code: 'group-resolver-failed', scope: 'source' },
      { code: 'group-resolver-failed', scope: 'source' },
    ]);
    expect(JSON.stringify(observations)).not.toMatch(/eager-resolver-secret|\u001b/u);
  });
});
