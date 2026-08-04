import { describe, expect, it, vi } from 'vitest';

import {
  KanbanDisposedResourceError,
  KanbanInvalidRangeError,
  KanbanInvalidSourcePublicationError,
  createEagerKanbanDataSource,
  snapshotKanbanSessionPublication,
} from '../src/index.js';
import type { KanbanBoardCounts, KanbanCellCursor, KanbanDataSource, KanbanQuerySession } from '../src/index.js';
import { KanbanLoadScheduler } from '../src/source/load-scheduler.js';
import { KanbanRangeSet, snapshotKanbanRange } from '../src/source/range-set.js';
import { KanbanSessionCoordinator } from '../src/source/session-coordinator.js';
import {
  createKanbanCursorLifecycleHarness,
  createKanbanDeferred,
  createKanbanQueryLifecycleHarness,
  createWindowedKanbanFixture,
} from '../src/testing.js';

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

describe('cursor acquisition hardening', () => {
  it('does not start undelegated application work during disposal', async () => {
    const ensureRange = vi.fn(() => Promise.resolve());
    const cursor: KanbanCellCursor<never> = {
      state: () => ({ kind: 'partial' }),
      counts: () => ({
        total: { quality: 'unknown' },
        matching: { quality: 'unknown' },
        loaded: { quality: 'unknown' },
      }),
      length: () => ({ kind: 'unknown' }),
      cardAt: () => undefined,
      ensureRange,
      revision: () => 1,
      placementAt: () => ({ kind: 'unavailable', code: 'not-loaded', cursorRevision: 1 }),
      retry: () => undefined,
      dispose: () => undefined,
    };
    const harness = createKanbanCursorLifecycleHarness({ cursor, address: { columnId: 'ready' }, keyOf: () => 1 });
    const pending = harness.ensureRange(0, 10);
    harness.dispose();
    await expect(pending).rejects.toBeInstanceOf(KanbanDisposedResourceError);
    expect(ensureRange).not.toHaveBeenCalled();
  });

  it('splits adjacent coalesced requests at the configured source-call bound', async () => {
    const calls: { readonly start: number; readonly end: number }[] = [];
    const cursor: KanbanCellCursor<never> = {
      state: () => ({ kind: 'partial' }),
      counts: () => ({
        total: { quality: 'unknown' },
        matching: { quality: 'unknown' },
        loaded: { quality: 'exact', value: 0 },
      }),
      length: () => ({ kind: 'unknown' }),
      cardAt: () => undefined,
      ensureRange: (start, end) => {
        calls.push({ start, end });
        return Promise.resolve();
      },
      revision: () => 1,
      placementAt: () => ({ kind: 'unavailable', code: 'not-loaded', cursorRevision: 1 }),
      retry: () => undefined,
      dispose: () => undefined,
    };
    const harness = createKanbanCursorLifecycleHarness({
      cursor,
      address: { columnId: 'ready' },
      keyOf: () => 1,
      limits: { values: { ensureRangeCards: 256 } },
    });

    await Promise.all([harness.ensureRange(0, 256), harness.ensureRange(256, 512)]);

    expect(calls).toEqual([
      { start: 0, end: 256 },
      { start: 256, end: 512 },
    ]);
  });

  it('subtracts active acquisitions before delegating a later overlap', async () => {
    const calls: { readonly start: number; readonly end: number }[] = [];
    const controls: ReturnType<typeof createKanbanDeferred<void>>[] = [];
    const cursor: KanbanCellCursor<never> = {
      state: () => ({ kind: 'partial' }),
      counts: () => ({
        total: { quality: 'unknown' },
        matching: { quality: 'unknown' },
        loaded: { quality: 'exact', value: 0 },
      }),
      length: () => ({ kind: 'unknown' }),
      cardAt: () => undefined,
      ensureRange: (start, end) => {
        calls.push({ start, end });
        const control = createKanbanDeferred<void>();
        controls.push(control);
        return control.promise;
      },
      revision: () => 1,
      placementAt: () => ({ kind: 'unavailable', code: 'not-loaded', cursorRevision: 1 }),
      retry: () => undefined,
      dispose: () => undefined,
    };
    const harness = createKanbanCursorLifecycleHarness({ cursor, address: { columnId: 'ready' }, keyOf: () => 1 });
    const first = harness.ensureRange(0, 20);
    await Promise.resolve();
    const second = harness.ensureRange(10, 30);
    await Promise.resolve();

    expect(calls).toEqual([
      { start: 0, end: 20 },
      { start: 20, end: 30 },
    ]);
    for (const control of controls) control.resolve();
    await Promise.all([first, second]);
  });

  it('disposes the application cursor even when final inspection throws', () => {
    const dispose = vi.fn();
    const cursor: KanbanCellCursor<never> = {
      state: () => {
        throw new Error('hostile getter');
      },
      counts: () => ({
        total: { quality: 'unknown' },
        matching: { quality: 'unknown' },
        loaded: { quality: 'unknown' },
      }),
      length: () => ({ kind: 'unknown' }),
      cardAt: () => undefined,
      ensureRange: () => Promise.resolve(),
      revision: () => 1,
      placementAt: () => ({ kind: 'unavailable', code: 'not-loaded', cursorRevision: 1 }),
      retry: () => undefined,
      dispose,
    };
    const harness = createKanbanCursorLifecycleHarness({ cursor, address: { columnId: 'ready' }, keyOf: () => 1 });
    expect(() => harness.dispose()).toThrow('hostile getter');
    expect(dispose).toHaveBeenCalledOnce();
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

  it('rejects a torn session snapshot whose revision changes during its getters', () => {
    let revision = 1;
    const session: KanbanQuerySession<never> = {
      state: () => {
        revision = 2;
        return { kind: 'ready' };
      },
      revision: () => revision,
      columns: () => [],
      swimlanes: () => [],
      counts: () => ZERO_COUNTS,
      headers: () => ({ revision: 1, columns: [], swimlanes: [] }),
      identityChanges: () => ({ revision: 1, changes: [] }),
      cell: () => {
        throw new Error('not retained');
      },
      dispose: () => undefined,
    };
    const coordinator = new KanbanSessionCoordinator({ source: { openQuery: () => session }, initialQuery: {} });
    expect(() => coordinator.snapshot()).toThrow(KanbanInvalidSourcePublicationError);
  });

  it('aborts a coordinator-owned locator signal on replacement even with caller cancellation', async () => {
    const deferred = createKanbanDeferred<Awaited<ReturnType<NonNullable<KanbanQuerySession<never>['locateCard']>>>>();
    const signals: AbortSignal[] = [];
    let disposed = false;
    let opened = 0;
    const source: KanbanDataSource<never> = {
      openQuery: () => {
        opened += 1;
        const revision = opened;
        return {
          state: () => ({ kind: 'empty' }),
          revision: () => {
            if (disposed && revision === 1) throw new Error('disposed session revision read');
            return revision;
          },
          columns: () => [],
          swimlanes: () => [],
          counts: () => ZERO_COUNTS,
          headers: () => ({ revision, columns: [], swimlanes: [] }),
          identityChanges: () => ({ revision, changes: [] }),
          cell: () => {
            throw new Error('not retained');
          },
          locateCard: (_key, options) => {
            if (options?.signal !== undefined) signals.push(options.signal);
            return deferred.promise;
          },
          dispose: () => {
            if (revision === 1) disposed = true;
          },
        };
      },
    };
    const coordinator = new KanbanSessionCoordinator({ source, initialQuery: {} });
    const caller = new AbortController();
    const result = coordinator.locateCard(1, { signal: caller.signal });
    coordinator.replaceQuery({ viewRevision: 2 });
    expect(signals[0]?.aborted).toBe(true);
    deferred.resolve({ kind: 'unknown', sessionRevision: 1 });
    await expect(result).resolves.toEqual({ kind: 'unknown', sessionRevision: 1 });
  });

  it('settles locator cancellation when an application ignores its aborted signal', async () => {
    let opened = 0;
    const source: KanbanDataSource<never> = {
      openQuery: () => {
        const revision = ++opened;
        return {
          state: () => ({ kind: 'empty' }),
          revision: () => revision,
          columns: () => [],
          swimlanes: () => [],
          counts: () => ZERO_COUNTS,
          headers: () => ({ revision, columns: [], swimlanes: [] }),
          identityChanges: () => ({ revision, changes: [] }),
          cell: () => {
            throw new Error('not retained');
          },
          locateCard: () => new Promise(() => undefined),
          dispose: () => undefined,
        };
      },
    };
    const coordinator = new KanbanSessionCoordinator({ source, initialQuery: {} });
    const pending = coordinator.locateCard(1);
    coordinator.replaceQuery({ viewRevision: 2 });
    await expect(pending).resolves.toEqual({ kind: 'unknown', sessionRevision: 1 });
  });

  it('aborts and settles an ignored locator before direct coordinator disposal completes', async () => {
    let locatorSignal: AbortSignal | undefined;
    const session: KanbanQuerySession<never> = {
      state: () => ({ kind: 'empty' }),
      revision: () => 1,
      columns: () => [],
      swimlanes: () => [],
      counts: () => ZERO_COUNTS,
      headers: () => ({ revision: 1, columns: [], swimlanes: [] }),
      identityChanges: () => ({ revision: 1, changes: [] }),
      cell: () => {
        throw new Error('not retained');
      },
      locateCard: (_key, options) => {
        locatorSignal = options?.signal;
        return new Promise(() => undefined);
      },
      dispose: () => undefined,
    };
    const coordinator = new KanbanSessionCoordinator({ source: { openQuery: () => session }, initialQuery: {} });
    const pending = coordinator.locateCard(1);

    coordinator.dispose();

    expect(locatorSignal?.aborted).toBe(true);
    await expect(pending).resolves.toEqual({ kind: 'unknown', sessionRevision: 1 });
  });

  it.each(['', 'unsafe\u001brevision', '界'.repeat(1_025), Number.NaN])(
    'rejects an invalid session revision before generating locator outcome %#',
    async (revision) => {
      const source: KanbanDataSource<never> = {
        openQuery: () => ({
          state: () => ({ kind: 'empty' }),
          revision: () => revision,
          columns: () => [],
          swimlanes: () => [],
          counts: () => ZERO_COUNTS,
          headers: () => ({ revision, columns: [], swimlanes: [] }),
          identityChanges: () => ({ revision, changes: [] }),
          cell: () => {
            throw new Error('not retained');
          },
          dispose: () => undefined,
        }),
      };
      const coordinator = new KanbanSessionCoordinator({ source, initialQuery: {} });
      await expect(coordinator.locateCard(1)).rejects.toBeInstanceOf(KanbanInvalidSourcePublicationError);
    },
  );
});

describe('publication and testing-fixture integrity', () => {
  it('requires headers to be a unique complete identity projection', () => {
    const base = {
      revision: 1,
      state: { kind: 'empty' as const },
      columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      swimlanes: [],
      counts: ZERO_COUNTS,
      identityChanges: { revision: 1, changes: [] },
    };
    expect(() =>
      snapshotKanbanSessionPublication({ ...base, headers: { revision: 1, columns: [], swimlanes: [] } }),
    ).toThrow(KanbanInvalidSourcePublicationError);
    expect(() =>
      snapshotKanbanSessionPublication({
        ...base,
        headers: {
          revision: 1,
          columns: [
            { columnId: 'ready', label: 'Ready' },
            { columnId: 'ready', label: 'Again' },
          ],
          swimlanes: [],
        },
      }),
    ).toThrow(KanbanInvalidSourcePublicationError);
  });

  it('keeps windowed state partial, session counts distinct, diagnostics safe, and cursors reacquirable', async () => {
    const fixture = createWindowedKanbanFixture({
      logicalCardCount: 10,
      columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      materialize: ({ start, end }) => Array.from({ length: end - start }, (_, offset) => ({ id: start + offset })),
      keyOf: (card) => card.id,
    });
    const session = fixture.source.openQuery({});
    const first = session.cell({ columnId: 'ready' });
    const load = first.ensureRange(0, 2);
    fixture.controller.resolveRange(fixture.controller.pendingRanges()[0]!.requestId);
    await load;
    expect(first.state()).toEqual({ kind: 'partial' });
    expect(session.counts().loaded).toEqual({ quality: 'exact', value: 2 });

    const duplicate = first.ensureRange(0, 2);
    fixture.controller.resolveRange(fixture.controller.pendingRanges()[0]!.requestId);
    await duplicate;
    expect(session.counts().loaded).toEqual({ quality: 'exact', value: 2 });

    const rejected = first.ensureRange(4, 5);
    fixture.controller.rejectRange(fixture.controller.pendingRanges()[0]!.requestId, {
      code: 'secret\u001bpayload',
    });
    await expect(rejected).rejects.toBeInstanceOf(KanbanInvalidSourcePublicationError);
    expect(first.state()).toMatchObject({ kind: 'error', code: 'range-failed' });
    expect(JSON.stringify(fixture.metrics().retainedEvents)).not.toContain('secret');

    first.dispose();
    const second = session.cell({ columnId: 'ready' });
    expect(second).not.toBe(first);
    expect(fixture.metrics().createdCursors).toBe(2);
    expect(session.counts().loaded).toEqual({ quality: 'exact', value: 0 });
  });

  it('rejects duplicate identities across windowed ranges and retains validated placement keys', async () => {
    const materialized = [{ id: 'stable' }, { id: 'stable' }];
    const fixture = createWindowedKanbanFixture({
      logicalCardCount: 2,
      columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      materialize: ({ start, end }) => materialized.slice(start, end),
      keyOf: (card) => card.id,
    });
    const cursor = fixture.source.openQuery({}).cell({ columnId: 'ready' });
    const first = cursor.ensureRange(0, 1);
    fixture.controller.resolveRange(fixture.controller.pendingRanges()[0]!.requestId);
    await first;
    materialized[0]!.id = 'unsafe\u001bchanged';
    expect(cursor.placementAt(1)).toMatchObject({ neighborCardKey: 'stable' });

    const duplicate = cursor.ensureRange(1, 2);
    fixture.controller.resolveRange(fixture.controller.pendingRanges()[0]!.requestId);
    await expect(duplicate).rejects.toBeInstanceOf(KanbanInvalidSourcePublicationError);
    expect(cursor.counts().loaded).toEqual({ quality: 'exact', value: 1 });
  });

  it('returns bounded resident card identities for explicitly inspected query cells', () => {
    const cards = [{ id: 'card-1', columnId: 'ready' }];
    const columns = [{ columnId: 'ready', label: 'Ready', revision: 1 }] as const;
    const source = createEagerKanbanDataSource(() => cards, {
      columns: () => columns,
      keyOf: (card) => card.id,
      columnOf: (card) => card.columnId,
    });
    const harness = createKanbanQueryLifecycleHarness({
      source,
      initialQuery: {},
      inspectedAddresses: [{ columnId: 'ready' }],
      keyOf: (card) => card.id,
    });
    expect(harness.snapshot().inspectedCells).toEqual([
      { address: { columnId: 'ready' }, cards: [{ index: 0, cardKey: 'card-1' }] },
    ]);
  });
});
