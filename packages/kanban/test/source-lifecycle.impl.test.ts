import { describe, expect, it, vi } from 'vitest';

import { KanbanDisposedResourceError, KanbanInvalidRangeError } from '../src/index.js';
import type { KanbanBoardCounts, KanbanCellCursor, KanbanDataSource, KanbanQuerySession } from '../src/index.js';
import { KanbanLoadScheduler } from '../src/source/load-scheduler.js';
import { KanbanRangeSet, snapshotKanbanRange } from '../src/source/range-set.js';
import { KanbanSessionCoordinator } from '../src/source/session-coordinator.js';
import { createKanbanDeferred } from '../src/testing.js';

/** Complete zero counts for ordinary lifecycle fakes. */
const ZERO_COUNTS: KanbanBoardCounts = {
  total: { quality: 'exact', value: 0 },
  matching: { quality: 'exact', value: 0 },
  loaded: { quality: 'exact', value: 0 },
  visible: { quality: 'exact', value: 0 },
  selected: { quality: 'exact', value: 0 },
  wip: { quality: 'exact', value: 0 },
};

describe('range-set arithmetic', () => {
  it('coalesces deterministic pseudo-random intervals to the same membership oracle', () => {
    let seed = 0x5eed;
    const next = (): number => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed;
    };
    const set = new KanbanRangeSet();
    const occupied = new Set<number>();
    for (let iteration = 0; iteration < 200; iteration += 1) {
      const start = next() % 200;
      const end = start + (next() % 20);
      const range = snapshotKanbanRange(start, end, 256);
      set.add(range);
      for (let index = start; index < end; index += 1) occupied.add(index);
    }

    for (let index = 0; index < 220; index += 1) {
      expect(set.covers({ start: index, end: index + 1 })).toBe(occupied.has(index));
    }
    const values = set.values();
    expect(values.every((range, index) => index === 0 || values[index - 1]!.end < range.start)).toBe(true);
  });

  it.each([
    [-1, 1],
    [0.5, 2],
    [4, 3],
    [0, 257],
  ])('rejects invalid range %s..%s', (start, end) => {
    expect(() => snapshotKanbanRange(start, end, 256)).toThrow(KanbanInvalidRangeError);
  });
});

describe('bounded load scheduling', () => {
  it('never exceeds configured concurrency and starts queued work in FIFO order', async () => {
    const scheduler = new KanbanLoadScheduler({ concurrency: 2, queued: 2 });
    const controls = Array.from({ length: 4 }, () => createKanbanDeferred<void>());
    const started: number[] = [];
    let active = 0;
    let maximumActive = 0;
    const operations = controls.map((control, index) =>
      scheduler.schedule(async () => {
        started.push(index);
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await control.promise;
        active -= 1;
      }),
    );

    expect(started).toEqual([0, 1]);
    controls[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual([0, 1, 2]);
    controls[1]!.resolve();
    controls[2]!.resolve();
    await Promise.resolve();
    await Promise.resolve();
    controls[3]!.resolve();
    await Promise.all(operations);
    expect(maximumActive).toBe(2);
  });

  it('settles active wrappers and aborts signals before late application completion', async () => {
    const scheduler = new KanbanLoadScheduler({ concurrency: 1, queued: 1 });
    const deferred = createKanbanDeferred<void>();
    const signals: AbortSignal[] = [];
    const operation = scheduler.schedule((signal) => {
      signals.push(signal);
      return deferred.promise;
    });

    scheduler.dispose();
    await expect(operation).rejects.toBeInstanceOf(KanbanDisposedResourceError);
    expect(signals[0]?.aborted).toBe(true);
    deferred.resolve();
  });
});

describe('session cursor retention and cleanup', () => {
  it('shares one cursor across explicit owners and disposes scopes before cursor and session', () => {
    const order: string[] = [];
    const cursor: KanbanCellCursor<{ readonly id: number }> = {
      state: () => ({ kind: 'ready' }),
      counts: () => ({
        total: { quality: 'exact', value: 0 },
        matching: { quality: 'exact', value: 0 },
        loaded: { quality: 'exact', value: 0 },
      }),
      length: () => ({ kind: 'exact', value: 0 }),
      cardAt: () => undefined,
      ensureRange: () => Promise.resolve(),
      revision: () => 1,
      placementAt: () => ({ kind: 'unavailable', code: 'empty', cursorRevision: 1 }),
      retry: () => undefined,
      dispose: () => order.push('cursor'),
    };
    const cell = vi.fn(() => cursor);
    const session: KanbanQuerySession<{ readonly id: number }> = {
      state: () => ({ kind: 'empty' }),
      revision: () => 1,
      columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      swimlanes: () => [],
      counts: () => ZERO_COUNTS,
      headers: () => ({ revision: 1, columns: [], swimlanes: [] }),
      identityChanges: () => ({ revision: 1, changes: [] }),
      cell,
      dispose: () => order.push('session'),
    };
    const source: KanbanDataSource<{ readonly id: number }> = { openQuery: () => session };
    const coordinator = new KanbanSessionCoordinator({ source, initialQuery: {} });

    coordinator.retainCursor({ columnId: 'ready' }, 'visible');
    coordinator.retainCursor({ columnId: 'ready' }, 'overscan');
    coordinator.registerCursorScope({ columnId: 'ready' }, () => order.push('scope'));
    coordinator.releaseCursor({ columnId: 'ready' }, 'visible');
    expect(cell).toHaveBeenCalledOnce();
    expect(order).toEqual([]);
    coordinator.releaseCursor({ columnId: 'ready' }, 'overscan');
    expect(order).toEqual(['scope', 'cursor']);

    coordinator.dispose();
    expect(order).toEqual(['scope', 'cursor', 'session']);
  });

  it('invalidates a generation and aborts its open-session signal before disposal', () => {
    const signals: AbortSignal[] = [];
    const disposed: number[] = [];
    let opened = 0;
    const makeSession = (): KanbanQuerySession<never> => {
      const id = ++opened;
      return {
        state: () => ({ kind: 'empty' }),
        revision: () => id,
        columns: () => [],
        swimlanes: () => [],
        counts: () => ZERO_COUNTS,
        headers: () => ({ revision: id, columns: [], swimlanes: [] }),
        identityChanges: () => ({ revision: id, changes: [] }),
        cell: () => {
          throw new Error('not retained');
        },
        dispose: () => disposed.push(id),
      };
    };
    const source: KanbanDataSource<never> = {
      openQuery: (_query, options) => {
        if (options?.signal !== undefined) signals.push(options.signal);
        return makeSession();
      },
    };
    const coordinator = new KanbanSessionCoordinator({ source, initialQuery: {} });
    const generation = coordinator.generation();

    coordinator.replaceQuery({ viewRevision: 2 });

    expect(coordinator.isCurrent(generation)).toBe(false);
    expect(signals[0]?.aborted).toBe(true);
    expect(disposed).toEqual([1]);
  });
});
