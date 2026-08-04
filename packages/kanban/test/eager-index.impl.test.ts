import { signal } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import {
  KanbanInvalidQueryError,
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
  it('applies lexicographic sort directives and preserves source order for equal values', () => {
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', points: 3, rank: 2, status: 'open', title: 'third' },
      { id: '1', columnId: 'ready', points: 1, rank: 1, status: 'open', title: 'first tie' },
      { id: 3, columnId: 'ready', points: 2, rank: 1, status: 'open', title: 'second tie' },
    ];
    const session = sourceFor(() => cards).openQuery({ sort: [{ fieldId: 'rank', direction: 'ascending' }] });
    const cursor = session.cell({ columnId: 'ready' });

    expect([cursor.cardAt(0)?.id, cursor.cardAt(1)?.id, cursor.cardAt(2)?.id]).toEqual(['1', 3, 1]);
    expect(session.locateCard?.(1)).toMatchObject({ kind: 'found', index: 2 });
    expect(session.locateCard?.('1')).toMatchObject({ kind: 'found', index: 0 });
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
});
