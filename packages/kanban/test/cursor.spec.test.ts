import { describe, expect, it, vi } from 'vitest';

import {
  KANBAN_LIMITS,
  KanbanInvalidRangeError,
  KanbanInvalidSourcePublicationError,
  assertKanbanPlacementCurrent,
  createPlacementToken,
  snapshotKanbanIdentityChangeBatch,
  snapshotKanbanPlacement,
} from '../src/index.js';
import type {
  CardKey,
  KanbanCellCounts,
  KanbanCellCursor,
  KanbanCellState,
  KanbanKnownLength,
  KanbanPlacement,
  KanbanRevision,
} from '../src/index.js';
import { createKanbanCursorLifecycleHarness } from '../src/testing.js';

interface WorkItem {
  readonly id: CardKey;
  readonly title: string;
}

const ADDRESS = { columnId: 'ready' } as const;
const EMPTY_COUNTS: KanbanCellCounts = {
  total: { quality: 'exact', value: 0 },
  matching: { quality: 'exact', value: 0 },
  loaded: { quality: 'exact', value: 0 },
};

interface CursorOptions {
  readonly state?: KanbanCellState;
  readonly counts?: KanbanCellCounts;
  readonly length?: KanbanKnownLength;
  readonly revision?: KanbanRevision;
  readonly cards?: ReadonlyMap<number, WorkItem>;
  readonly placementAt?: (slot: number) => KanbanPlacement;
  readonly ensureRange?: (start: number, end: number, options?: { readonly signal?: AbortSignal }) => Promise<void>;
  readonly retry?: () => Promise<void> | void;
  readonly dispose?: () => void;
}

/** Creates an ordinary public cursor fake for black-box lifecycle assertions. */
function createCursor(options: CursorOptions = {}): KanbanCellCursor<WorkItem> {
  return {
    state: () => options.state ?? { kind: 'ready' },
    counts: () => options.counts ?? EMPTY_COUNTS,
    length: () => options.length ?? { kind: 'exact', value: 0 },
    cardAt: (index: number) => options.cards?.get(index),
    ensureRange: (start: number, end: number, rangeOptions?: { readonly signal?: AbortSignal }) =>
      options.ensureRange?.(start, end, rangeOptions) ?? Promise.resolve(),
    revision: () => options.revision ?? 'cursor-revision',
    placementAt: (slot: number) =>
      options.placementAt?.(slot) ?? {
        kind: 'unavailable',
        code: 'not-loaded',
        cursorRevision: options.revision ?? 'cursor-revision',
      },
    retry: () => options.retry?.(),
    dispose: () => options.dispose?.(),
  };
}

/** Creates the testing-only lifecycle harness without exposing its coordinator. */
function createHarness(cursor: KanbanCellCursor<WorkItem>) {
  return createKanbanCursorLifecycleHarness({
    cursor,
    address: ADDRESS,
    keyOf: (card: WorkItem) => card.id,
  });
}

/** Returns a controlled promise used to settle acquisition after disposal. */
function deferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => {
      if (resolvePromise === undefined) throw new Error('deferred resolver is unavailable');
      resolvePromise();
    },
  };
}

describe('Kanban cursor range lifecycle', () => {
  it('should coalesce overlapping half-open ranges into bounded source acquisition', async () => {
    // Overlap is acquired at most once and never expanded into one callback per card.
    const calls: Array<readonly [number, number]> = [];
    const cursor = createCursor({
      ensureRange: (start, end) => {
        calls.push([start, end]);
        return Promise.resolve();
      },
    });
    const harness = createHarness(cursor);

    await Promise.all([harness.ensureRange(0, 20), harness.ensureRange(10, 30)]);

    expect(calls.length).toBeLessThanOrEqual(2);
    expect(calls.reduce((total, [start, end]) => total + (end - start), 0)).toBeLessThanOrEqual(30);
    expect(calls.some(([start, end]) => start === 0 && end >= 20)).toBe(true);
    expect(calls.some(([, end]) => end === 30)).toBe(true);
  });

  it('should reject invalid ranges before invoking the application cursor', async () => {
    // Negative, fractional, reversed, and over-limit ranges cannot reach application code.
    const ensureRange = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const harness = createHarness(createCursor({ ensureRange }));

    for (const [start, end] of [
      [-1, 1],
      [0.5, 2],
      [4, 3],
      [0, 257],
    ] as const) {
      await expect(harness.ensureRange(start, end)).rejects.toBeInstanceOf(KanbanInvalidRangeError);
    }
    expect(ensureRange).not.toHaveBeenCalled();
  });

  it('should preserve unloaded reads and isolate one error cursor from a ready neighbor', () => {
    // An unloaded slot remains partial and does not reduce authoritative counts or poison another cell.
    const partialCounts: KanbanCellCounts = {
      total: { quality: 'exact', value: 10 },
      matching: { quality: 'exact', value: 10 },
      loaded: { quality: 'exact', value: 2 },
    };
    const partialCursor = createCursor({
      state: { kind: 'partial' },
      counts: partialCounts,
      length: { kind: 'at-least', value: 10 },
    });
    const errorCursor = createCursor({
      state: { kind: 'error', code: 'range-failed', label: 'Retry range', retry: 'available' },
    });
    const readyCursor = createCursor({
      cards: new Map([[0, { id: 7, title: 'Ready card' }]]),
      counts: {
        total: { quality: 'exact', value: 1 },
        matching: { quality: 'exact', value: 1 },
        loaded: { quality: 'exact', value: 1 },
      },
      length: { kind: 'exact', value: 1 },
    });

    expect(partialCursor.cardAt(5)).toBeUndefined();
    expect(createHarness(partialCursor).snapshot({ indices: [5] })).toMatchObject({
      state: { kind: 'partial' },
      counts: partialCounts,
      length: { kind: 'at-least', value: 10 },
    });
    expect(createHarness(errorCursor).snapshot().state).toMatchObject({
      kind: 'error',
      code: 'range-failed',
      retry: 'available',
    });
    expect(createHarness(readyCursor).snapshot({ indices: [0] })).toMatchObject({
      state: { kind: 'ready' },
      counts: { loaded: { quality: 'exact', value: 1 } },
    });
  });
});

describe('Kanban cursor placement', () => {
  it('should keep an incomplete final slot at a window edge and reserve logical end for exact length', () => {
    // A loaded-window boundary never claims authoritative logical completeness.
    const token = createPlacementToken('opaque-window-token');
    const windowEdge = snapshotKanbanPlacement({
      kind: 'window-edge',
      edge: 'after',
      neighborCardKey: 8,
      token,
      cursorRevision: 'window-revision',
    });
    const logicalEnd = snapshotKanbanPlacement({
      kind: 'end',
      cursorRevision: 'complete-revision',
    });
    const partial = createHarness(
      createCursor({
        revision: 'window-revision',
        length: { kind: 'at-least', value: 8 },
        placementAt: () => windowEdge,
      }),
    ).snapshot({ slots: [8] });
    const complete = createHarness(
      createCursor({
        revision: 'complete-revision',
        length: { kind: 'exact', value: 8 },
        placementAt: () => logicalEnd,
      }),
    ).snapshot({ slots: [8] });

    expect(JSON.stringify(partial)).toContain('window-edge');
    expect(JSON.stringify(partial)).not.toContain(token);
    expect(JSON.stringify(complete)).toContain('end');
  });

  it('should reject a stale placement token before any future dispatch callback', () => {
    // Placement revisions are equality-only guards checked before application mutation routing.
    const dispatch = vi.fn();
    const placement = snapshotKanbanPlacement({
      kind: 'window-edge',
      edge: 'after',
      neighborCardKey: 'card-8',
      token: createPlacementToken('opaque-stale-token'),
      cursorRevision: 'cursor-revision-1',
    });

    expect(() => {
      const current = assertKanbanPlacementCurrent(placement, 'cursor-revision-2');
      dispatch(current);
    }).toThrow(KanbanInvalidSourcePublicationError);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('Kanban cursor cleanup and identity facts', () => {
  it('should dispose once, abort owned acquisition, and suppress every late settlement', async () => {
    // Disposal invalidates the harness before aborting work and never republishes late data or observations.
    const acquisition = deferred();
    const signals: AbortSignal[] = [];
    const disposeCursor = vi.fn();
    const cursor = createCursor({
      ensureRange: (_start, _end, options) => {
        if (options?.signal !== undefined) signals.push(options.signal);
        return acquisition.promise;
      },
      dispose: disposeCursor,
    });
    const harness = createHarness(cursor);
    const pending = harness.ensureRange(0, 10);

    harness.dispose();
    harness.dispose();
    const snapshotAfterDispose = harness.snapshot();
    const observationsAfterDispose = harness.observations();
    acquisition.resolve();
    await pending.catch(() => undefined);

    expect(disposeCursor).toHaveBeenCalledOnce();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
    expect(harness.snapshot()).toEqual(snapshotAfterDispose);
    expect(harness.observations()).toEqual(observationsAfterDispose);
  });

  it('should snapshot bounded deletion facts atomically without treating page unload as deletion', () => {
    // Source identity batches contain authoritative deletions only; transient unload is not a change kind.
    const batch = snapshotKanbanIdentityChangeBatch({
      revision: 'identity-revision-2',
      changes: [
        { kind: 'deleted-card', cardKey: 1 },
        { kind: 'deleted-column', columnId: 'done' },
        { kind: 'deleted-swimlane', swimlaneId: 'team-a' },
      ],
    });

    expect(batch).toEqual({
      revision: 'identity-revision-2',
      changes: [
        { kind: 'deleted-card', cardKey: 1 },
        { kind: 'deleted-column', columnId: 'done' },
        { kind: 'deleted-swimlane', swimlaneId: 'team-a' },
      ],
    });
    expect(Object.isFrozen(batch)).toBe(true);
    expect(() =>
      snapshotKanbanIdentityChangeBatch({
        revision: 'identity-revision-3',
        changes: [
          { kind: 'deleted-card', cardKey: 1 },
          { kind: 'deleted-card', cardKey: 1 },
        ],
      }),
    ).toThrow(KanbanInvalidSourcePublicationError);
    expect(() =>
      snapshotKanbanIdentityChangeBatch({
        revision: 'identity-revision-4',
        changes: [{ kind: 'unloaded-card', cardKey: 1 }],
      }),
    ).toThrow(KanbanInvalidSourcePublicationError);
    expect(() =>
      snapshotKanbanIdentityChangeBatch({
        revision: 'identity-revision-5',
        changes: Array.from({ length: KANBAN_LIMITS.selectedKeys.safe + 1 }, (_, cardKey) => ({
          kind: 'deleted-card',
          cardKey,
        })),
      }),
    ).toThrow(KanbanInvalidSourcePublicationError);
  });
});
