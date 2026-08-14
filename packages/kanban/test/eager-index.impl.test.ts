import { signal } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import {
  KanbanInvalidQueryError,
  KanbanInvalidSourcePublicationError,
  assertKanbanPlacementCurrent,
  createEagerKanbanDataSource,
  snapshotKanbanBoardCounts,
  snapshotKanbanCount,
} from '../src/index.js';
import type { CardKey, KanbanColumnMeta, KanbanObservation } from '../src/index.js';

interface WorkItem {
  readonly id: CardKey;
  readonly columnId: string;
  readonly points: number;
  readonly rank: number;
  readonly status: string;
  readonly title: string;
}

const COLUMNS: readonly KanbanColumnMeta[] = [
  { columnId: 'ready', label: 'Ready', revision: 1 },
  { columnId: 'done', label: 'Done', revision: 1 },
];

/** Builds the ordinary eager options used by implementation cases. */
function sourceFor(cards: () => readonly WorkItem[], observations: KanbanObservation[] = []) {
  return createEagerKanbanDataSource(cards, {
    columns: () => COLUMNS,
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
    filterFields: [
      {
        fieldId: 'status',
        operators: [{ operatorId: 'example.equals', matches: (card, value) => card.status === value }],
      },
    ],
    sortFields: [
      {
        fieldId: 'rank',
        compare: (left, right) => (left.rank < right.rank ? -1 : left.rank > right.rank ? 1 : 0),
      },
    ],
    summaries: [
      { summaryId: 'all-points', scope: 'authoritative', aggregation: 'sum', valueOf: (card) => card.points },
      { summaryId: 'shown-points', scope: 'loaded-only', aggregation: 'average', valueOf: (card) => card.points },
    ],
    observe: (observation) => observations.push(observation),
  });
}

describe('eager index ordering and identity', () => {
  it('applies sort directives and uses total card-key order for equal values', () => {
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', points: 3, rank: 2, status: 'open', title: 'third' },
      { id: '1', columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'first tie' },
      { id: 3, columnId: 'ready', points: 2, rank: 1, status: 'open', title: 'second tie' },
    ];
    const session = sourceFor(() => cards).openQuery({ sort: [{ fieldId: 'rank', direction: 'ascending' }] });
    const cursor = session.cell({ columnId: 'ready' });

    expect([cursor.cardAt(0)?.id, cursor.cardAt(1)?.id, cursor.cardAt(2)?.id]).toEqual([3, '1', 1]);
    expect(session.locateCard?.(1)).toMatchObject({ kind: 'found', index: 2 });
    expect(session.locateCard?.('1')).toMatchObject({ kind: 'found', index: 1 });
  });

  it('keeps authoritative summaries stable while loaded-only summaries follow filtering', () => {
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', points: 10, rank: 1, status: 'open', title: 'open' },
      { id: 2, columnId: 'ready', points: 30, rank: 2, status: 'closed', title: 'closed' },
    ];
    const session = sourceFor(() => cards).openQuery({
      filters: [{ fieldId: 'status', operatorId: 'example.equals', value: 'open' }],
    });

    expect(session.counts()).toMatchObject({
      total: { quality: 'exact', value: 2 },
      matching: { quality: 'exact', value: 1 },
      loaded: { quality: 'exact', value: 1 },
      selected: { quality: 'unknown' },
    });
    expect(session.headers().columns[0]?.summaries).toEqual({
      'all-points': { scope: 'authoritative', quality: 'exact', value: 40 },
      'shown-points': { scope: 'loaded-only', quality: 'exact', value: 10 },
    });
  });

  it('rejects unsupported operators before opening a session', () => {
    const source = sourceFor(() => []);
    expect(() =>
      source.openQuery({ filters: [{ fieldId: 'status', operatorId: 'example.missing', value: 'open' }] }),
    ).toThrow(KanbanInvalidQueryError);
  });

  it('requires an explicit search predicate and applies it before publication', () => {
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'Needle task' },
      { id: 2, columnId: 'ready', points: 1, rank: 2, status: 'open', title: 'Other task' },
    ];
    expect(() => sourceFor(() => cards).openQuery({ search: 'needle' })).toThrow(KanbanInvalidQueryError);

    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => COLUMNS,
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      search: (card, term) => card.title.toLocaleLowerCase().includes(term.toLocaleLowerCase()),
    });
    const session = source.openQuery({ search: 'needle' });
    expect(session.counts()).toMatchObject({ total: { value: 2 }, matching: { value: 1 } });
    expect(session.cell({ columnId: 'ready' }).cardAt(0)).toBe(cards[0]);
  });

  it('recomputes nested reactive adapter reads through an explicit application revision', () => {
    const applicationRevision = signal(1);
    const firstRank = signal(2);
    const secondRank = signal(1);
    const firstStatus = signal('open');
    const cards = [
      { id: 1, columnId: 'ready', rank: firstRank, status: firstStatus },
      { id: 2, columnId: 'ready', rank: secondRank, status: signal('open') },
    ] as const;
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => COLUMNS,
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      revision: applicationRevision,
      filterFields: [
        {
          fieldId: 'status',
          operators: [{ operatorId: 'example.equals', matches: (card, value) => card.status() === value }],
        },
      ],
      sortFields: [
        {
          fieldId: 'rank',
          compare: (left, right) => (left.rank() < right.rank() ? -1 : left.rank() > right.rank() ? 1 : 0),
        },
      ],
    });
    const session = source.openQuery({
      filters: [{ fieldId: 'status', operatorId: 'example.equals', value: 'open' }],
      sort: [{ fieldId: 'rank', direction: 'ascending' }],
    });
    const cursor = session.cell({ columnId: 'ready' });
    const initialRevision = session.revision();
    expect(cursor.cardAt(0)?.id).toBe(2);

    firstRank.set(0);
    applicationRevision.set(2);
    expect(cursor.cardAt(0)?.id).toBe(1);
    expect(session.revision()).not.toBe(initialRevision);

    firstStatus.set('closed');
    applicationRevision.set(3);
    expect(cursor.cardAt(0)?.id).toBe(2);
    expect(session.identityChanges().changes).toEqual([]);
  });

  it('keeps declared swimlane metadata available for an ordinary ungrouped query', () => {
    const card: WorkItem = { id: 1, columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'card' };
    const source = createEagerKanbanDataSource(() => [card], {
      columns: () => COLUMNS,
      swimlanes: () => [{ swimlaneId: 'team-a', label: 'Team A', revision: 1 }],
      keyOf: (entry) => entry.id,
      columnOf: (entry) => entry.columnId,
      groupingFields: [{ id: 'team', swimlaneOf: () => 'team-a' }],
    });
    const session = source.openQuery({});
    expect(session.swimlanes()).toHaveLength(1);
    expect(session.cell({ columnId: 'ready' }).cardAt(0)).toBe(card);
  });

  it('allocates source-global revisions so placements cannot survive query replacement', () => {
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'card' },
    ];
    const source = sourceFor(() => cards);
    const oldPlacement = source.openQuery({}).cell({ columnId: 'ready' }).placementAt(0);
    const currentRevision = source.openQuery({ search: '' }).cell({ columnId: 'ready' }).revision();
    expect(oldPlacement.cursorRevision).not.toBe(currentRevision);
    expect(() => assertKanbanPlacementCurrent(oldPlacement, currentRevision)).toThrow(
      KanbanInvalidSourcePublicationError,
    );
  });

  it('reports deletion of an authoritative card even when the prior query filtered it out', () => {
    const cards = signal<readonly WorkItem[]>([
      { id: 1, columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'shown' },
      { id: 2, columnId: 'ready', points: 1, rank: 2, status: 'closed', title: 'hidden' },
    ]);
    const session = sourceFor(cards).openQuery({
      filters: [{ fieldId: 'status', operatorId: 'example.equals', value: 'open' }],
    });
    session.revision();
    cards.set(cards().filter((card) => card.id !== 2));
    expect(session.identityChanges().changes).toEqual([{ kind: 'deleted-card', cardKey: 2 }]);
  });
});

describe('eager publication atomicity', () => {
  it.each([
    [
      [
        { id: 1, columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'duplicate a' },
        { id: 1, columnId: 'done', points: 2, rank: 2, status: 'open', title: 'duplicate secret' },
      ],
    ],
    [[{ id: 2, columnId: 'missing', points: 2, rank: 2, status: 'open', title: 'unknown secret' }]],
  ] satisfies readonly (readonly [readonly WorkItem[]])[])(
    'retains the last complete index for invalid cards %#',
    (invalid) => {
      const cards = signal<readonly WorkItem[]>([
        { id: 1, columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'valid' },
      ]);
      const observations: KanbanObservation[] = [];
      const session = sourceFor(cards, observations).openQuery({});
      const cursor = session.cell({ columnId: 'ready' });
      const revision = session.revision();
      const original = cursor.cardAt(0);

      cards.set(invalid);

      expect(session.revision()).toBe(revision);
      expect(cursor.cardAt(0)).toBe(original);
      expect(observations).toEqual([{ code: 'source-publication-invalid', scope: 'source' }]);
      expect(JSON.stringify(observations)).not.toContain('secret');
    },
  );

  it('validates unknown and numeric count qualities without retaining caller records', () => {
    const unknown = snapshotKanbanCount({ quality: 'unknown' });
    const input = {
      total: { quality: 'exact', value: 4 },
      matching: { quality: 'estimated', value: 3 },
      loaded: { quality: 'truncated', value: 2 },
      visible: { quality: 'exact', value: 1 },
      selected: { quality: 'unknown' },
      wip: { quality: 'unknown' },
    } as const;
    const snapshot = snapshotKanbanBoardCounts(input);

    expect(unknown).toEqual({ quality: 'unknown' });
    expect(unknown).not.toHaveProperty('value');
    expect(snapshot).toEqual(input);
    expect(snapshot).not.toBe(input);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('publishes unknown counts when the first authoritative publication is invalid', () => {
    const invalid: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'first' },
      { id: 1, columnId: 'done', points: 1, rank: 2, status: 'open', title: 'duplicate' },
    ];
    const session = sourceFor(() => invalid).openQuery({});
    expect(session.state()).toEqual({ kind: 'error', code: 'source-publication-invalid' });
    expect(session.counts()).toEqual({
      total: { quality: 'unknown' },
      matching: { quality: 'unknown' },
      loaded: { quality: 'unknown' },
      visible: { quality: 'unknown' },
      selected: { quality: 'unknown' },
      wip: { quality: 'unknown' },
    });
  });

  it.each(['unsafe\u001bkey', '界'.repeat(129)])('rejects unsafe string card key %#', (id) => {
    const session = sourceFor(() => [
      { id, columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'unsafe' },
    ]).openQuery({});
    expect(session.state()).toMatchObject({ kind: 'error' });
  });
});
