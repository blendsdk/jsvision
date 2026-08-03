import { signal } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { createEagerKanbanDataSource } from '../src/index.js';
import type {
  CardKey,
  KanbanBoardCounts,
  KanbanCardLocation,
  KanbanColumnMeta,
  KanbanDataSource,
  KanbanObservation,
  KanbanQuery,
  KanbanQuerySession,
  KanbanRevision,
  KanbanSourceState,
} from '../src/index.js';
import { createKanbanQueryLifecycleHarness } from '../src/testing.js';

interface WorkItem {
  readonly id: CardKey;
  readonly columnId: string;
  readonly status: string;
  readonly title: string;
}

interface LocateOptions {
  readonly signal?: AbortSignal;
}

const READY_COLUMN: KanbanColumnMeta = {
  columnId: 'ready',
  label: 'Ready',
  revision: 'column-ready-1',
};
const DONE_COLUMN: KanbanColumnMeta = {
  columnId: 'done',
  label: 'Done',
  revision: 'column-done-1',
};
const ALL_QUERY: KanbanQuery = {
  filters: [],
  sort: [],
  visibleColumnIds: ['ready', 'done'],
  viewRevision: 'view-all',
};
const FILTERED_QUERY: KanbanQuery = {
  ...ALL_QUERY,
  filters: [{ fieldId: 'status', operatorId: 'example.equals', value: 'open' }],
  viewRevision: 'view-open',
};

/** Creates an authoritative count whose accuracy is explicit. */
function exact(value: number): { readonly quality: 'exact'; readonly value: number } {
  return { quality: 'exact', value };
}

/** Creates a complete count batch for one deterministic session publication. */
function boardCounts(values: {
  readonly total: number;
  readonly matching: number;
  readonly loaded: number;
  readonly visible: number;
  readonly selected: number;
  readonly wip: number;
}): KanbanBoardCounts {
  return {
    total: exact(values.total),
    matching: exact(values.matching),
    loaded: exact(values.loaded),
    visible: exact(values.visible),
    selected: exact(values.selected),
    wip: exact(values.wip),
  };
}

interface SessionOptions {
  readonly revision: KanbanRevision;
  readonly state: KanbanSourceState;
  readonly counts: KanbanBoardCounts;
  readonly columns?: readonly KanbanColumnMeta[];
  readonly locateCard?: KanbanQuerySession<WorkItem>['locateCard'];
  readonly onDispose?: () => void;
}

/** Creates an ordinary public session fake without exposing coordinator internals. */
function createSession(options: SessionOptions): KanbanQuerySession<WorkItem> {
  return {
    state: () => options.state,
    revision: () => options.revision,
    columns: () => options.columns ?? [READY_COLUMN, DONE_COLUMN],
    swimlanes: () => [],
    counts: () => options.counts,
    headers: () => ({ revision: options.revision, columns: [], swimlanes: [] }),
    identityChanges: () => ({ revision: options.revision, changes: [] }),
    cell: () => {
      throw new Error('this query-session oracle must not create or scan a cell cursor');
    },
    ...(options.locateCard === undefined ? {} : { locateCard: options.locateCard }),
    dispose: () => options.onDispose?.(),
  };
}

/** Returns a promise with a deterministic resolver for stale-work tests. */
function deferred<T>(): { readonly promise: Promise<T>; readonly resolve: (value: T) => void } {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => {
      if (resolvePromise === undefined) throw new Error('deferred resolver is unavailable');
      resolvePromise(value);
    },
  };
}

describe('Kanban query replacement', () => {
  it('should abort and dispose the old session before suppressing its late completion', async () => {
    // Replacing a query invalidates old work before cancellation and cannot republish stale state or counts.
    const staleLocation = deferred<KanbanCardLocation>();
    const oldSignals: AbortSignal[] = [];
    const disposeOld = vi.fn();
    let opened = 0;
    const source: KanbanDataSource<WorkItem> = {
      openQuery: (_query: KanbanQuery, options?: { readonly signal?: AbortSignal }) => {
        opened += 1;
        if (opened === 1) {
          if (options?.signal !== undefined) oldSignals.push(options.signal);
          return createSession({
            revision: 'old-revision',
            state: { kind: 'loading' },
            counts: boardCounts({ total: 10, matching: 10, loaded: 0, visible: 0, selected: 0, wip: 4 }),
            locateCard: () => staleLocation.promise,
            onDispose: disposeOld,
          });
        }
        return createSession({
          revision: 'active-revision',
          state: { kind: 'ready' },
          counts: boardCounts({ total: 3, matching: 2, loaded: 2, visible: 2, selected: 0, wip: 1 }),
        });
      },
    };
    const harness = createKanbanQueryLifecycleHarness({ source, initialQuery: ALL_QUERY });
    const oldLocate = harness.locateCard(7);

    harness.replaceQuery(FILTERED_QUERY);
    const activeBeforeLateResult = harness.snapshot();
    staleLocation.resolve({
      kind: 'found',
      address: { columnId: 'ready' },
      index: 0,
      sessionRevision: 'old-revision',
    });
    await oldLocate;

    expect(oldSignals).toHaveLength(1);
    expect(oldSignals[0]?.aborted).toBe(true);
    expect(disposeOld).toHaveBeenCalledOnce();
    expect(harness.snapshot()).toEqual(activeBeforeLateResult);
    expect(harness.snapshot()).toMatchObject({
      sessionRevision: 'active-revision',
      state: { kind: 'ready' },
    });
    expect(harness.observations()).toEqual([]);
  });
});

describe('Kanban count quality', () => {
  it('should change matching and visible counts without changing authoritative total or WIP', () => {
    // A local filter changes its projection counts, while authoritative workflow counts stay stable.
    const source: KanbanDataSource<WorkItem> = {
      openQuery: (query: KanbanQuery) =>
        createSession({
          revision: query.filters?.length === 0 ? 'all-revision' : 'filtered-revision',
          state: { kind: 'ready' },
          counts:
            query.filters?.length === 0
              ? boardCounts({ total: 20, matching: 20, loaded: 20, visible: 8, selected: 2, wip: 7 })
              : boardCounts({ total: 20, matching: 6, loaded: 6, visible: 3, selected: 2, wip: 7 }),
        }),
    };
    const harness = createKanbanQueryLifecycleHarness({ source, initialQuery: ALL_QUERY });
    const before = harness.snapshot().counts;

    harness.replaceQuery(FILTERED_QUERY);
    const after = harness.snapshot().counts;

    expect(after.total).toEqual(before.total);
    expect(after.wip).toEqual(before.wip);
    expect(after.matching).toEqual(exact(6));
    expect(after.visible).toEqual(exact(3));
  });

  it('should retain an explicit unknown count without fabricating a zero value', () => {
    // Unknown authority is a first-class quality state and never masquerades as numeric zero.
    const source: KanbanDataSource<WorkItem> = {
      openQuery: () =>
        createSession({
          revision: 'unknown-total',
          state: { kind: 'partial' },
          counts: {
            total: { quality: 'unknown' },
            matching: { quality: 'estimated', value: 400 },
            loaded: exact(25),
            visible: exact(8),
            selected: { quality: 'unknown' },
            wip: { quality: 'truncated', value: 100 },
          },
        }),
    };

    const snapshot = createKanbanQueryLifecycleHarness({ source, initialQuery: ALL_QUERY }).snapshot();

    expect(snapshot.state).toEqual({ kind: 'partial' });
    expect(snapshot.counts.total).toEqual({ quality: 'unknown' });
    expect(snapshot.counts.total).not.toHaveProperty('value');
  });
});

describe('Kanban source publication atomicity', () => {
  it('should reject duplicate keys and unknown columns atomically while retaining the last valid snapshot', () => {
    // Invalid recomputation cannot partially replace cards, counts, structure, or revision.
    const invalidPublications: readonly (readonly WorkItem[])[] = [
      [
        { id: 1, columnId: 'ready', status: 'open', title: 'First' },
        { id: 1, columnId: 'done', status: 'closed', title: 'Duplicate secret title' },
      ],
      [{ id: 2, columnId: 'missing', status: 'open', title: 'Unknown secret title' }],
    ];

    for (const invalidCards of invalidPublications) {
      const cards = signal<readonly WorkItem[]>([{ id: 1, columnId: 'ready', status: 'open', title: 'Original' }]);
      const columns = signal<readonly KanbanColumnMeta[]>([READY_COLUMN, DONE_COLUMN]);
      const observations: unknown[] = [];
      const source = createEagerKanbanDataSource(cards, {
        columns,
        keyOf: (card: WorkItem) => card.id,
        columnOf: (card: WorkItem) => card.columnId,
        observe: (observation: KanbanObservation) => observations.push(observation),
      });
      const active = source.openQuery(ALL_QUERY);
      const ready = active.cell({ columnId: 'ready' });
      const before = {
        revision: active.revision(),
        columns: active.columns(),
        counts: active.counts(),
        card: ready.cardAt(0),
      };

      cards.set(invalidCards);

      expect(active.revision()).toBe(before.revision);
      expect(active.columns()).toEqual(before.columns);
      expect(active.counts()).toEqual(before.counts);
      expect(active.cell({ columnId: 'ready' }).cardAt(0)).toBe(before.card);
      expect(observations).toHaveLength(1);
      expect(JSON.stringify(observations)).not.toContain('secret title');
    }
  });
});

describe('Kanban bounded identity location', () => {
  it('should perform one cancellable revision-bound lookup and preserve explicit unsupported results', async () => {
    // An unloaded identity uses one source lookup and returns only address/index/revision metadata.
    const locateCalls = vi.fn();
    const caller = new AbortController();
    const source: KanbanDataSource<WorkItem> = {
      openQuery: () =>
        createSession({
          revision: 'window-revision',
          state: { kind: 'partial' },
          counts: boardCounts({
            total: 100_000,
            matching: 100_000,
            loaded: 20,
            visible: 8,
            selected: 0,
            wip: 0,
          }),
          locateCard: (_key: CardKey, options?: LocateOptions) => {
            locateCalls(options?.signal);
            return {
              kind: 'unloaded',
              address: { columnId: 'done' },
              index: 99_999,
              sessionRevision: 'window-revision',
            };
          },
        }),
    };
    const harness = createKanbanQueryLifecycleHarness({ source, initialQuery: ALL_QUERY });

    const result = await harness.locateCard('unloaded-card', { signal: caller.signal });

    expect(result).toEqual({
      kind: 'unloaded',
      address: { columnId: 'done' },
      index: 99_999,
      sessionRevision: 'window-revision',
    });
    expect(locateCalls).toHaveBeenCalledOnce();
    expect(locateCalls).toHaveBeenCalledWith(caller.signal);
    expect(result).not.toHaveProperty('card');

    const signals: AbortSignal[] = [];
    const unsupportedLookups = vi.fn();
    const unsupportedSource: KanbanDataSource<WorkItem> = {
      openQuery: () =>
        createSession({
          revision: 'unsupported-revision',
          state: { kind: 'ready' },
          counts: boardCounts({ total: 1, matching: 1, loaded: 0, visible: 0, selected: 0, wip: 0 }),
          locateCard: (_key: CardKey, options?: LocateOptions) => {
            unsupportedLookups();
            const sourceSignal = options?.signal;
            if (sourceSignal === undefined) throw new Error('the locator must receive an owned cancellation signal');
            signals.push(sourceSignal);
            return new Promise<KanbanCardLocation>((resolve) => {
              sourceSignal.addEventListener(
                'abort',
                () => resolve({ kind: 'unsupported', sessionRevision: 'unsupported-revision' }),
                { once: true },
              );
            });
          },
        }),
    };
    const unsupportedHarness = createKanbanQueryLifecycleHarness({
      source: unsupportedSource,
      initialQuery: ALL_QUERY,
    });
    const cancelledCaller = new AbortController();
    const unsupportedResult = unsupportedHarness.locateCard(1, { signal: cancelledCaller.signal });

    cancelledCaller.abort();

    await expect(unsupportedResult).resolves.toEqual({
      kind: 'unsupported',
      sessionRevision: 'unsupported-revision',
    });
    expect(unsupportedLookups).toHaveBeenCalledOnce();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
  });

  it('should redact source failures without exposing card bodies or placement tokens', async () => {
    // Safe observations retain a code and source scope while removing hostile callback payloads.
    const secretTitle = 'confidential customer title';
    const secretToken = 'opaque-placement-token';
    const source: KanbanDataSource<WorkItem> = {
      openQuery: () =>
        createSession({
          revision: 'failure-revision',
          state: { kind: 'partial' },
          counts: boardCounts({ total: 1, matching: 1, loaded: 0, visible: 0, selected: 0, wip: 0 }),
          locateCard: () => Promise.reject(new Error(`${secretTitle}; ${secretToken}`)),
        }),
    };
    const harness = createKanbanQueryLifecycleHarness({ source, initialQuery: ALL_QUERY });

    await expect(harness.locateCard(44)).resolves.toEqual({
      kind: 'unknown',
      sessionRevision: 'failure-revision',
    });
    expect(harness.observations()).toHaveLength(1);
    expect(harness.observations()[0]).toMatchObject({ code: 'source-locate-failed', scope: 'source' });
    expect(JSON.stringify(harness.observations())).not.toContain(secretTitle);
    expect(JSON.stringify(harness.observations())).not.toContain(secretToken);
  });
});
