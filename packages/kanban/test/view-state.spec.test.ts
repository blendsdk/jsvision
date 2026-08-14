import { createApplication, resolveCapabilities } from '@jsvision/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, createKanbanViewController } from '../src/index.js';
import type { CardKey, KanbanCardAdapter, KanbanQuery, KanbanQuerySession } from '../src/index.js';

interface WorkItem {
  readonly id: CardKey;
  readonly columnId: 'ready';
  readonly priority: number;
  readonly rank: number;
  readonly title: string;
}

const COLUMN = Object.freeze({ columnId: 'ready', label: 'Ready', revision: 'ready-r1' });
const CARD: KanbanCardAdapter<WorkItem> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};
const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

afterEach(() => {
  vi.useRealTimers();
});

/** Compares the fixture priority without widening its bounded comparator result. */
function comparePriority(left: WorkItem, right: WorkItem): -1 | 0 | 1 {
  if (left.priority < right.priority) return -1;
  if (left.priority > right.priority) return 1;
  return 0;
}

/** Reads every resident card key from the sole test cell, then releases the cursor. */
function sessionKeys(session: KanbanQuerySession<WorkItem>): readonly CardKey[] {
  const cursor = session.cell({ columnId: 'ready' });
  const length = cursor.length();
  if (length.kind !== 'exact') throw new Error('The eager specification fixture must have exact length.');
  const keys = Array.from({ length: length.value }, (_, index) => {
    const card = cursor.cardAt(index);
    if (card === undefined) throw new Error(`Expected resident card at ${index}.`);
    return card.id;
  });
  cursor.dispose();
  return Object.freeze(keys);
}

/** Opens one eager query and returns detached ordering evidence. */
function queryKeys(
  source: ReturnType<typeof createEagerKanbanDataSource<WorkItem>>,
  query: KanbanQuery,
): readonly CardKey[] {
  const session = source.openQuery(query);
  try {
    return sessionKeys(session);
  } finally {
    session.dispose();
  }
}

describe('Kanban Phase D view-state specification', () => {
  it('publishes immutable unbound transitions without mutating the prior state', () => {
    const controller = createKanbanViewController({ initial: { density: 'comfortable' } });
    const before = controller.state();

    const result = controller.apply({ kind: 'set-density', density: 'compact' });
    const after = controller.state();

    expect(result.kind).toBe('changed');
    expect(after).not.toBe(before);
    expect(after.revision).not.toBe(before.revision);
    expect(before.presentation.density).toBe('comfortable');
    expect(after.presentation.density).toBe('compact');
    expect(Object.isFrozen(before)).toBe(true);
    expect(Object.isFrozen(after)).toBe(true);
    controller.dispose();
  });

  it('preserves the legacy single compare function and restores source rank after clearing sort', () => {
    const cards: readonly WorkItem[] = [
      { id: 'later', columnId: 'ready', priority: 2, rank: 2, title: 'Later' },
      { id: 'first', columnId: 'ready', priority: 1, rank: 1, title: 'First' },
    ];
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [COLUMN],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      compare: (left, right) => left.rank - right.rank,
      sortFields: [
        {
          fieldId: 'priority',
          compare: comparePriority,
        },
      ],
    });

    expect(queryKeys(source, { filters: [], sort: [{ fieldId: 'priority', direction: 'descending' }] })).toEqual([
      'later',
      'first',
    ]);
    expect(queryKeys(source, { filters: [], sort: [] })).toEqual(['first', 'later']);
  });

  it('resolves additive comparator IDs and uses one mixed CardKey order for equal values', () => {
    const cards: readonly WorkItem[] = [
      { id: '2', columnId: 'ready', priority: 1, rank: 0, title: 'String two' },
      { id: '\u{10000}', columnId: 'ready', priority: 1, rank: 1, title: 'Astral' },
      { id: 10, columnId: 'ready', priority: 1, rank: 2, title: 'Number ten' },
      { id: '\ue000', columnId: 'ready', priority: 1, rank: 3, title: 'BMP private use' },
      { id: '1', columnId: 'ready', priority: 1, rank: 4, title: 'String one' },
      { id: 2, columnId: 'ready', priority: 1, rank: 5, title: 'Number two' },
    ];
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [COLUMN],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      sortFields: [
        {
          fieldId: 'priority',
          comparators: [
            {
              comparatorId: 'app.priority',
              default: true,
              compare: comparePriority,
            },
          ],
        },
      ],
    });

    const explicit = queryKeys(source, {
      filters: [],
      sort: [{ fieldId: 'priority', comparatorId: 'app.priority', direction: 'ascending' }],
    });
    const defaulted = queryKeys(source, {
      filters: [],
      sort: [{ fieldId: 'priority', direction: 'ascending' }],
    });

    expect(explicit).toEqual([2, 10, '1', '2', '\ue000', '\u{10000}']);
    expect(defaulted).toEqual(explicit);
  });

  it('lets controller facets override legacy density while preserving record-dependent presentation', () => {
    const card: WorkItem = { id: 1, columnId: 'ready', priority: 1, rank: 1, title: 'Visible card' };
    const source = createEagerKanbanDataSource(() => [card], {
      columns: () => [COLUMN],
      keyOf: (item) => item.id,
      columnOf: (item) => item.columnId,
    });
    const controller = createKanbanViewController({ initial: { density: 'compact' } });
    const cardPresentation = vi.fn((_item: WorkItem) => undefined);
    const board = new KanbanBoard({
      source,
      query: controller.query,
      card: CARD,
      density: () => 'spacious',
      cardPresentation,
      view: { controller },
    });
    board.setLayout({ position: 'fill' });
    const application = createApplication({ content: board, viewport: { width: 40, height: 12 }, caps: CAPS });
    application.loop.renderRoot.flush();

    expect(board.inspection().visibleCards[0]?.descriptor.density).toBe('compact');
    expect(cardPresentation).toHaveBeenCalledWith(card);
    application.loop.dispose();
    controller.dispose();
  });

  it('keeps search draft out of committed state until the exact debounce boundary', () => {
    vi.useFakeTimers();
    const controller = createKanbanViewController({ debounceMs: 150 });
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    const pending = controller.apply({ kind: 'set-search', search: 'alpha' });

    expect(pending.kind).toBe('pending');
    expect(controller.state().search).toBe('');
    expect(controller.query().search).toBeUndefined();
    vi.advanceTimersByTime(149);
    expect(controller.state().search).toBe('');
    expect(subscriber).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(controller.state().search).toBe('alpha');
    expect(controller.query().search).toBe('alpha');
    expect(subscriber).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it('cancels older search generations and publishes only the newest query', () => {
    vi.useFakeTimers();
    const controller = createKanbanViewController({ debounceMs: 150 });
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    controller.apply({ kind: 'set-search', search: 'a' });
    vi.advanceTimersByTime(50);
    controller.apply({ kind: 'set-search', search: 'al' });
    vi.advanceTimersByTime(50);
    controller.apply({ kind: 'set-search', search: 'alp' });
    vi.advanceTimersByTime(149);
    expect(controller.query().search).toBeUndefined();
    vi.advanceTimersByTime(1);

    expect(controller.state().search).toBe('alp');
    expect(controller.query().search).toBe('alp');
    expect(subscriber).toHaveBeenCalledOnce();
    controller.dispose();
  });

  it('cancels pending search publication when disposed', () => {
    vi.useFakeTimers();
    const controller = createKanbanViewController({ debounceMs: 150 });
    const subscriber = vi.fn();
    controller.subscribe(subscriber);

    controller.apply({ kind: 'set-search', search: 'late' });
    controller.dispose();
    vi.advanceTimersByTime(150);

    expect(subscriber).not.toHaveBeenCalled();
    expect(controller.apply({ kind: 'set-density', density: 'compact' }).kind).toBe('unavailable');
  });

  it('reports filtered-empty counts without rewriting total or authoritative WIP', () => {
    vi.useFakeTimers();
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', priority: 1, rank: 1, title: 'Alpha' },
      { id: 2, columnId: 'ready', priority: 2, rank: 2, title: 'Beta' },
    ];
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [COLUMN],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      search: (card, term) => card.title.toLocaleLowerCase('en-US').includes(term),
    });
    const controller = createKanbanViewController({ debounceMs: 150 });
    const board = new KanbanBoard({ source, query: controller.query, card: CARD, view: { controller } });
    board.setLayout({ position: 'fill' });
    const application = createApplication({ content: board, viewport: { width: 40, height: 12 }, caps: CAPS });
    application.loop.renderRoot.flush();

    controller.apply({ kind: 'set-search', search: 'missing' });
    vi.advanceTimersByTime(150);
    application.loop.renderRoot.flush();

    expect(controller.summary()).toMatchObject({
      total: { quality: 'exact', value: 2 },
      matching: { quality: 'exact', value: 0 },
      loaded: { quality: 'exact', value: 2 },
      visible: 0,
      emptyState: 'filtered',
      wip: { quality: 'exact', value: 2 },
    });
    application.loop.dispose();
    controller.dispose();
  });

  it('reconciles focus only after a committed query hides the focused card', async () => {
    vi.useFakeTimers();
    const cards: readonly WorkItem[] = [
      { id: 1, columnId: 'ready', priority: 1, rank: 1, title: 'Alpha' },
      { id: 2, columnId: 'ready', priority: 2, rank: 2, title: 'Beta' },
    ];
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => [COLUMN],
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
      search: (card, term) => card.title.toLocaleLowerCase('en-US').includes(term),
    });
    const controller = createKanbanViewController({ debounceMs: 150 });
    const board = new KanbanBoard({ source, query: controller.query, card: CARD, view: { controller } });
    board.setLayout({ position: 'fill' });
    const application = createApplication({ content: board, viewport: { width: 40, height: 12 }, caps: CAPS });
    application.loop.renderRoot.flush();
    await board.interaction().transition({
      kind: 'focus',
      target: { kind: 'card', cardKey: 2, address: { columnId: 'ready' } },
    });

    controller.apply({ kind: 'set-search', search: 'alpha' });
    expect(board.interaction().snapshot().focused).toMatchObject({ kind: 'card', cardKey: 2 });
    vi.advanceTimersByTime(150);
    application.loop.renderRoot.flush();

    expect(controller.query().search).toBe('alpha');
    expect(board.interaction().snapshot().focused).not.toMatchObject({ kind: 'card', cardKey: 2 });
    application.loop.dispose();
    controller.dispose();
  });
});
