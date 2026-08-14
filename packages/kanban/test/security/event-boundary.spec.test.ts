/** Security oracle for public-event redaction, subscriber isolation, and breadth-first reentrancy. */
import { describe, expect, it, vi } from 'vitest';

import { createKanbanEventHub } from '../../src/index.js';
import type { KanbanEvent, KanbanObservation } from '../../src/index.js';

describe('Kanban event boundary', () => {
  it('isolates a throwing subscriber and emits one sanitized observation while siblings continue', () => {
    const observations: KanbanObservation[] = [];
    const later = vi.fn();
    const hub = createKanbanEventHub({
      boardId: 'board-main',
      now: () => 10,
      observe: (observation) => observations.push(observation),
    });
    hub.subscribe(() => {
      throw new Error('secret-card-body');
    });
    hub.subscribe(later);

    expect(hub.publish({ kind: 'selection', count: 1 })).toEqual({ kind: 'published' });

    expect(later).toHaveBeenCalledOnce();
    expect(observations).toEqual([expect.objectContaining({ code: 'event-subscriber-failed', scope: 'board' })]);
    expect(JSON.stringify(observations)).not.toContain('secret-card-body');
  });

  it('queues nested publication breadth-first so every subscriber finishes the current event first', () => {
    const hub = createKanbanEventHub({ boardId: 'board-main', now: () => 20 });
    const order: string[] = [];
    hub.subscribe((event) => {
      order.push(`first:${event.kind}`);
      if (event.kind === 'action') hub.publish({ kind: 'selection', count: 2 });
    });
    hub.subscribe((event) => order.push(`second:${event.kind}`));

    hub.publish({
      kind: 'action',
      actionId: 'kanban.selection.select-all',
      origin: 'keyboard',
      state: 'intent',
    });

    expect(order).toEqual(['first:action', 'second:action', 'first:selection', 'second:selection']);
  });

  it('rejects payload-bearing and accessor-based event input before publishing or retaining it', () => {
    const received: KanbanEvent[] = [];
    const hub = createKanbanEventHub({ boardId: 'board-main', now: () => 30 });
    hub.subscribe((event) => received.push(event));
    const record = { title: 'private card title' };
    const hostile = {
      kind: 'selection',
      count: 1,
      record,
      draft: { description: 'private editor draft' },
      filter: 'customer-secret',
      placementToken: 'opaque-placement-token',
      undoToken: 'opaque-undo-token',
    };

    expect(() => Reflect.apply(hub.publish, undefined, [hostile])).toThrowError(
      expect.objectContaining({ name: 'KanbanInvalidSemanticValueError' }),
    );
    expect(received).toEqual([]);
    expect(JSON.stringify(hub.snapshot())).not.toContain('private');
  });

  it('contains a throwing observation sink without changing event delivery', () => {
    const received: KanbanEvent[] = [];
    const hub = createKanbanEventHub({
      boardId: 'board-main',
      now: () => 40,
      observe: () => {
        throw new Error('diagnostic failure');
      },
    });
    hub.subscribe(() => {
      throw new Error('subscriber failure');
    });
    hub.subscribe((event) => received.push(event));

    expect(hub.publish({ kind: 'selection', count: 0 })).toEqual({ kind: 'published' });
    expect(received).toHaveLength(1);
  });
});
