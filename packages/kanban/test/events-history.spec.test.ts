/** Specification oracle for bounded ordered public Kanban events. */
import { describe, expect, it } from 'vitest';

import { createKanbanEventHub } from '../src/index.js';
import type { KanbanEvent } from '../src/index.js';

describe('Kanban public event ordering', () => {
  it('orders one accepted mutation lifecycle with one board and operation identity', () => {
    let timestamp = 100;
    const hub = createKanbanEventHub({ boardId: 'board-main', now: () => timestamp++ });
    const events: KanbanEvent[] = [];
    hub.subscribe((event) => events.push(event));

    expect(
      hub.publish({
        kind: 'action',
        actionId: 'kanban.card.move',
        origin: 'keyboard',
        state: 'intent',
      }),
    ).toEqual({ kind: 'published' });
    for (const state of ['proposed', 'pending', 'accepted', 'committed'] as const) {
      expect(
        hub.publish({
          kind: 'request',
          operationId: 'operation-move-1',
          requestKind: 'card-move',
          state,
        }),
      ).toEqual({ kind: 'published' });
    }

    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(events.map((event) => event.timestamp)).toEqual([100, 101, 102, 103, 104]);
    expect(events.every((event) => event.boardId === 'board-main' && Object.isFrozen(event))).toBe(true);
    expect(events.map((event) => (event.kind === 'request' ? event.state : event.state))).toEqual([
      'intent',
      'proposed',
      'pending',
      'accepted',
      'committed',
    ]);
    expect(events.slice(1).every((event) => event.kind === 'request' && event.operationId === 'operation-move-1')).toBe(
      true,
    );
  });

  it.each(['rejected', 'cancelled', 'superseded'] as const)(
    'publishes the exact %s terminal outcome without inventing a commit',
    (terminal) => {
      const hub = createKanbanEventHub({ boardId: 'board-main', now: () => 200 });
      const events: KanbanEvent[] = [];
      hub.subscribe((event) => events.push(event));

      hub.publish({
        kind: 'request',
        operationId: `operation-${terminal}`,
        requestKind: 'card-delete',
        state: 'pending',
      });
      hub.publish({
        kind: 'request',
        operationId: `operation-${terminal}`,
        requestKind: 'card-delete',
        state: terminal,
        code: `${terminal}-by-application`,
      });

      expect(events.map((event) => (event.kind === 'request' ? event.state : event.kind))).toEqual([
        'pending',
        terminal,
      ]);
      expect(events.some((event) => event.kind === 'request' && event.state === 'committed')).toBe(false);
    },
  );
});

describe('Kanban observable state events', () => {
  it('delivers focus and selection only after the new public state is readable', () => {
    const hub = createKanbanEventHub({ boardId: 'board-main', now: () => 300 });
    let focusedCardKey: string | number | undefined;
    let selectedCount = 0;
    const observations: Array<{
      readonly event: KanbanEvent;
      readonly focus?: string | number;
      readonly count: number;
    }> = [];
    hub.subscribe((event) => observations.push({ event, focus: focusedCardKey, count: selectedCount }));

    focusedCardKey = 1;
    hub.publish({ kind: 'focus', target: { kind: 'card', cardKey: 1 } });
    focusedCardKey = '1';
    hub.publish({ kind: 'focus', target: { kind: 'card', cardKey: '1' } });
    selectedCount = 2;
    hub.publish({ kind: 'selection', count: 2 });

    expect(observations.map(({ focus }) => focus)).toEqual([1, '1', '1']);
    expect(observations.at(-1)?.count).toBe(2);
    expect(
      observations
        .map(({ event }) => (event.kind === 'focus' && event.target.kind === 'card' ? event.target.cardKey : undefined))
        .filter((key) => key !== undefined),
    ).toEqual([1, '1']);
  });
});
