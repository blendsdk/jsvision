import { describe, expect, it } from 'vitest';

import { createEagerKanbanDataSource } from '../src/index.js';
import type { CardKey, KanbanColumnMeta, KanbanQuery } from '../src/index.js';

interface WorkItem {
  readonly id: CardKey;
  readonly columnId: string;
  readonly rank: number;
  readonly title: string;
}

const COLUMNS: readonly KanbanColumnMeta[] = [
  { columnId: 'ready', label: 'Ready', revision: 'ready-1' },
  { columnId: 'done', label: 'Done', revision: 'done-1' },
];
const ALL_QUERY: KanbanQuery = { filters: [], sort: [] };

/** Creates a deterministic resident collection split evenly across two columns. */
function createCards(count: number): readonly WorkItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    columnId: index % 2 === 0 ? 'ready' : 'done',
    rank: index,
    title: `Work item ${index}`,
  }));
}

describe('eager Kanban source scale semantics', () => {
  it('should expose 5,000 cards synchronously with exact counts and original object identity', async () => {
    // Eager indexing may derive once, but cursor reads must stay synchronous and retain application records.
    const cards = createCards(5_000);
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => COLUMNS,
      keyOf: (card: WorkItem) => card.id,
      columnOf: (card: WorkItem) => card.columnId,
    });
    const session = source.openQuery(ALL_QUERY);

    expect(session.counts()).toMatchObject({
      total: { quality: 'exact', value: 5_000 },
      matching: { quality: 'exact', value: 5_000 },
      loaded: { quality: 'exact', value: 5_000 },
    });
    expect(session.columns()).toEqual(COLUMNS);

    const ready = session.cell({ columnId: 'ready' });
    const done = session.cell({ columnId: 'done' });

    expect(ready.length()).toEqual({ kind: 'exact', value: 2_500 });
    expect(done.length()).toEqual({ kind: 'exact', value: 2_500 });
    expect(ready.counts()).toEqual({
      total: { quality: 'exact', value: 2_500 },
      matching: { quality: 'exact', value: 2_500 },
      loaded: { quality: 'exact', value: 2_500 },
    });
    expect(done.counts()).toEqual(ready.counts());

    for (let index = 0; index < 2_500; index += 1) {
      expect(ready.cardAt(index)).toBe(cards[index * 2]);
      expect(done.cardAt(index)).toBe(cards[index * 2 + 1]);
    }

    await expect(ready.ensureRange(0, 256)).resolves.toBeUndefined();
    await expect(done.ensureRange(2_244, 2_500)).resolves.toBeUndefined();
    expect(ready.cardAt(0)).toBe(cards[0]);
    expect(done.cardAt(2_499)).toBe(cards[4_999]);

    ready.dispose();
    done.dispose();
    session.dispose();
  });
});
