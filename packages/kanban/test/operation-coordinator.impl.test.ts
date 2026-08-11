import { describe, expect, it, vi } from 'vitest';

import { createKanbanOperationIdRegistry } from '../src/operation/operation-id.js';
import {
  KanbanCommittedUndoRegistry,
  KanbanOperationGenerationClock,
  KanbanOperationSnapshotRegistry,
} from '../src/operation/registries.js';
import { createKanbanOperationSubjectRegistry } from '../src/operation/subjects.js';
import type { KanbanOperationSnapshot, KanbanOperationSubject } from '../src/operation/types.js';

/** Build one payload-free transition for subscription ordering tests. */
function transition(state: 'proposed' | 'pending'): KanbanOperationSnapshot {
  return Object.freeze({
    operationId: 'operation-subscription-1',
    kind: 'extension',
    state,
    affected: Object.freeze([]),
    ...(state === 'pending'
      ? { projection: Object.freeze({ kind: 'extension' as const, state, cardKeys: Object.freeze([]) }) }
      : {}),
  });
}

describe('operation subject registry implementation', () => {
  it('keeps subject kinds and numeric/string card identities distinct', () => {
    const registry = createKanbanOperationSubjectRegistry(2);
    const distinct = [
      { kind: 'card', cardKey: 1 },
      { kind: 'card', cardKey: '1' },
      { kind: 'column', columnId: '1' },
      { kind: 'swimlane', swimlaneId: '1' },
    ] satisfies readonly KanbanOperationSubject[];

    const lease = registry.reserve('operation-distinct-1', distinct);

    expect(lease.affected).toEqual(distinct);
    expect(lease.active()).toBe(true);
    lease.release();
    expect(lease.active()).toBe(false);
  });

  it('rejects a conflict atomically without retaining unrelated subjects', () => {
    const registry = createKanbanOperationSubjectRegistry(3);
    const incumbent = registry.reserve('operation-incumbent-1', [{ kind: 'card', cardKey: 4 }]);

    expect(() =>
      registry.reserve('operation-conflict-1', [
        { kind: 'card', cardKey: 4 },
        { kind: 'column', columnId: 'free-column' },
      ]),
    ).toThrow();
    const unrelated = registry.reserve('operation-unrelated-1', [{ kind: 'column', columnId: 'free-column' }]);

    expect(incumbent.active()).toBe(true);
    expect(unrelated.active()).toBe(true);
  });
});

describe('operation snapshot registry implementation', () => {
  it('queues reentrant publication and isolates a failing subscriber', () => {
    const registry = new KanbanOperationSnapshotRegistry(2, 2);
    const observed: string[] = [];
    registry.subscribe((snapshot) => {
      observed.push(`first-${snapshot.state}`);
      if (snapshot.state === 'proposed') registry.publish(transition('pending'));
    });
    registry.subscribe((snapshot) => {
      observed.push(`second-${snapshot.state}`);
      if (snapshot.state === 'proposed') throw new Error('isolated subscriber failure');
    });

    registry.publish(transition('proposed'));

    expect(observed).toEqual(['first-proposed', 'second-proposed', 'first-pending', 'second-pending']);
    expect(registry.snapshot()).toEqual([transition('pending')]);
  });

  it('returns an idempotent unsubscribe and makes subscriptions inert after disposal', () => {
    const registry = new KanbanOperationSnapshotRegistry(1, 1);
    const subscriber = vi.fn();
    const unsubscribe = registry.subscribe(subscriber);

    unsubscribe();
    unsubscribe();
    registry.publish(transition('proposed'));
    registry.dispose();
    registry.subscribe(subscriber);

    expect(subscriber).not.toHaveBeenCalled();
    expect(registry.snapshot()).toEqual([]);
  });
});

describe('operation retention and generation implementation', () => {
  it('evicts retained operation identities in deterministic FIFO order', () => {
    const candidates = ['operation-retained-1', 'operation-retained-2', 'operation-retained-1'];
    const registry = createKanbanOperationIdRegistry({
      factory: () => candidates.shift() ?? 'operation-retained-fallback',
      retainedLimit: 1,
    });
    registry.acquire().retain();
    registry.acquire().retain();

    const reused = registry.acquire();

    expect(reused.operationId).toBe('operation-retained-1');
    expect(reused.active()).toBe(true);
  });

  it('evicts whole undo entries without invoking or partially copying their values', () => {
    const registry = new KanbanCommittedUndoRegistry<{ readonly invoke: () => void }>(1);
    const first = vi.fn();
    const second = vi.fn();
    registry.retain('operation-undo-1', Object.freeze({ invoke: first }));
    registry.retain('operation-undo-2', Object.freeze({ invoke: second }));

    expect(registry.operationIds()).toEqual(['operation-undo-2']);
    expect(registry.get('operation-undo-1')).toBeUndefined();
    expect(registry.get('operation-undo-2')?.invoke).toBe(second);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('invalidates exact generation captures on advance and permanently on dispose', () => {
    const clock = new KanbanOperationGenerationClock();
    const first = clock.capture();

    expect(clock.isCurrent(first)).toBe(true);
    const second = clock.advance();
    expect(clock.isCurrent(first)).toBe(false);
    expect(clock.isCurrent(second)).toBe(true);

    clock.dispose();
    expect(clock.isCurrent(second)).toBe(false);
    expect(clock.advance()).toBe(clock.capture());
  });
});
