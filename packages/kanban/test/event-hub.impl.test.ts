import { describe, expect, it, vi } from 'vitest';

import { createKanbanEventHub } from '../src/index.js';

describe('Kanban event hub implementation', () => {
  it.each([256, 4_096])('drains %s nested events and rejects only the next event', (capacity) => {
    const observe = vi.fn();
    const hub = createKanbanEventHub({ boardId: 'board-main', capacity, observe });
    const outcomes: string[] = [];
    const sequences: number[] = [];
    hub.subscribe((event) => {
      sequences.push(event.sequence);
      if (event.kind !== 'action') return;
      for (let index = 0; index <= capacity; index += 1) {
        outcomes.push(hub.publish({ kind: 'selection', count: index }).kind);
      }
    });

    hub.publish({ kind: 'action', actionId: 'acme.nested', origin: 'programmatic', state: 'intent' });

    expect(outcomes.filter((kind) => kind === 'published')).toHaveLength(capacity);
    expect(outcomes.at(-1)).toBe('event-queue-overflow');
    expect(sequences).toHaveLength(capacity + 1);
    expect(sequences.at(-1)).toBe(capacity + 1);
    expect(observe).toHaveBeenCalledOnce();
  });

  it('contains invalid clocks, bounds retention, and clears everything on disposal', () => {
    const hub = createKanbanEventHub({
      boardId: 'board-main',
      retained: 2,
      now: () => {
        throw new Error('clock secret');
      },
    });
    hub.publish({ kind: 'selection', count: 0 });
    hub.publish({ kind: 'selection', count: 1 });
    hub.publish({ kind: 'selection', count: 2 });

    expect(hub.snapshot().map(({ sequence, timestamp }) => [sequence, timestamp])).toEqual([
      [2, 0],
      [3, 0],
    ]);
    hub.dispose();
    expect(hub.snapshot()).toEqual([]);
    expect(hub.publish({ kind: 'selection', count: 3 })).toEqual({ kind: 'disposed' });
    expect(() => hub.subscribe(() => undefined)).toThrow();
  });

  it('rejects invalid queue and retention ceilings before allocating subscribers', () => {
    expect(() => createKanbanEventHub({ boardId: 'board-main', capacity: 0 })).toThrow();
    expect(() => createKanbanEventHub({ boardId: 'board-main', capacity: 4_097 })).toThrow();
    expect(() => createKanbanEventHub({ boardId: 'board-main', retained: 4_097 })).toThrow();
  });
});
