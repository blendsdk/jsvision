import { describe, expect, it, vi } from 'vitest';

import type { CardKey, KanbanCellAddress, KanbanColumnMeta, KanbanQuery } from '../src/index.js';
import { createWindowedKanbanFixture } from '../src/testing.js';

interface LogicalCard {
  readonly id: CardKey;
  readonly title: string;
}

const COLUMNS: readonly KanbanColumnMeta[] = Array.from({ length: 8 }, (_, index) => ({
  columnId: `column-${index}`,
  label: `Column ${index}`,
  revision: `column-${index}-1`,
}));
const SWIMLANES = Array.from({ length: 8 }, (_, index) => ({
  swimlaneId: `team-${index}`,
  label: `Team ${index}`,
  revision: `team-${index}-1`,
}));
const ALL_QUERY: KanbanQuery = { filters: [], sort: [] };

/** Produces a stable semantic key without retaining a logical-card-sized collection. */
function cardKey(address: KanbanCellAddress, index: number): CardKey {
  return `${address.columnId}/${address.swimlaneId ?? 'ungrouped'}/${index}`;
}

describe('windowed Kanban source scale semantics', () => {
  it('should materialize and read only explicitly requested visible and finite-overscan ranges', async () => {
    // Logical capacity must not allocate cards or cursors for untouched theoretical cells.
    const materialize = vi.fn(
      ({
        address,
        start,
        end,
      }: {
        readonly address: KanbanCellAddress;
        readonly start: number;
        readonly end: number;
      }) =>
        Array.from({ length: end - start }, (_, offset): LogicalCard => {
          const index = start + offset;
          return { id: cardKey(address, index), title: `Card ${index}` };
        }),
    );
    const fixture = createWindowedKanbanFixture<LogicalCard>({
      logicalCardCount: 100_000,
      columns: COLUMNS,
      swimlanes: SWIMLANES,
      initialRevision: 'windowed-1',
      materialize,
      keyOf: (card: LogicalCard) => card.id,
      eventCapacity: 32,
    });

    expect(fixture.metrics()).toMatchObject({
      logicalCardCount: 100_000,
      openedSessions: 0,
      createdCursors: 0,
      ensureRangeCalls: 0,
      materializedCards: 0,
      cardAtReads: 0,
    });
    expect(materialize).not.toHaveBeenCalled();

    const session = fixture.source.openQuery(ALL_QUERY);
    const visibleAddress = { columnId: 'column-0', swimlaneId: 'team-0' } as const;
    const overscanAddress = { columnId: 'column-1', swimlaneId: 'team-0' } as const;
    const visibleCursor = session.cell(visibleAddress);
    const overscanCursor = session.cell(overscanAddress);
    const visibleLoad = visibleCursor.ensureRange(0, 12);
    const overscanLoad = overscanCursor.ensureRange(20, 36);

    expect(materialize).not.toHaveBeenCalled();
    expect(fixture.controller.pendingRanges()).toMatchObject([
      { address: visibleAddress, start: 0, end: 12 },
      { address: overscanAddress, start: 20, end: 36 },
    ]);

    for (const request of fixture.controller.pendingRanges()) {
      fixture.controller.resolveRange(request.requestId);
    }
    await Promise.all([visibleLoad, overscanLoad]);

    expect(materialize).toHaveBeenCalledTimes(2);
    expect(materialize).toHaveBeenNthCalledWith(1, { address: visibleAddress, start: 0, end: 12 });
    expect(materialize).toHaveBeenNthCalledWith(2, { address: overscanAddress, start: 20, end: 36 });
    expect(visibleCursor.cardAt(0)?.id).toBe(cardKey(visibleAddress, 0));
    expect(visibleCursor.cardAt(11)?.id).toBe(cardKey(visibleAddress, 11));
    expect(overscanCursor.cardAt(20)?.id).toBe(cardKey(overscanAddress, 20));
    expect(overscanCursor.cardAt(35)?.id).toBe(cardKey(overscanAddress, 35));

    const metrics = fixture.metrics();
    expect(metrics).toMatchObject({
      logicalCardCount: 100_000,
      openedSessions: 1,
      createdCursors: 2,
      ensureRangeCalls: 2,
      requestedRanges: [
        { address: visibleAddress, start: 0, end: 12 },
        { address: overscanAddress, start: 20, end: 36 },
      ],
      materializedCards: 28,
      cardAtReads: 4,
    });
    expect(Object.isFrozen(metrics)).toBe(true);
    expect(metrics.createdCursors).toBeLessThan(COLUMNS.length * SWIMLANES.length);
    expect(metrics.materializedCards).toBeLessThan(metrics.logicalCardCount);

    visibleCursor.dispose();
    overscanCursor.dispose();
    session.dispose();
    fixture.dispose();
  });
});
