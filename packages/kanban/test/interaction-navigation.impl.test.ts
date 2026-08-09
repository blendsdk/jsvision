import { describe, expect, it } from 'vitest';

import { KanbanDisposedResourceError, KanbanInvalidGeometryError } from '../src/index.js';
import type {
  KanbanFocusTarget,
  KanbanInteractionAcquisitionResult,
  KanbanInteractionRevisions,
  KanbanNavigationSnapshot,
  KanbanNavigationTarget,
} from '../src/index.js';
import { KanbanAcquisitionCoordinator } from '../src/interaction/acquisition.js';
import { resolveKanbanNavigation } from '../src/interaction/navigation.js';
import {
  reconcileKanbanFocus,
  resolveInitialKanbanFocus,
  snapshotKanbanNavigationSnapshot,
} from '../src/interaction/reconciliation.js';

/** One externally controlled promise used to settle acquisition without timers. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: Error) => void;
}

/** Creates a promise whose success and failure remain owned by the test. */
function deferred<T>(): Deferred<T> {
  let resolve: ((value: T) => void) | undefined;
  let reject: ((reason: Error) => void) | undefined;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  if (resolve === undefined || reject === undefined) throw new Error('Deferred promise setup failed.');
  return Object.freeze({ promise, resolve, reject });
}

/** Creates one enabled navigation target at deterministic scene geometry. */
function target(targetValue: KanbanFocusTarget, sceneIndex: number, centerRow: number): KanbanNavigationTarget {
  return Object.freeze({ target: Object.freeze(targetValue), sceneIndex, centerColumn: 4, centerRow, enabled: true });
}

/** Creates one card target with an optional swimlane identity. */
function card(
  cardKey: string | number,
  columnId: string,
  sceneIndex: number,
  centerRow: number,
  swimlaneId?: string,
): KanbanNavigationTarget {
  return target(
    {
      kind: 'card',
      cardKey,
      address: Object.freeze({ columnId, ...(swimlaneId === undefined ? {} : { swimlaneId }) }),
    },
    sceneIndex,
    centerRow,
  );
}

/** Creates immutable scene evidence from targets that may arrive out of order. */
function scene(...targets: readonly KanbanNavigationTarget[]): KanbanNavigationSnapshot {
  return Object.freeze({ revision: 1, targets: Object.freeze(targets), viewportContentHeight: 5 });
}

/** Creates one acquisition request and captured revision envelope. */
function acquisitionOptions(
  revisions: KanbanInteractionRevisions,
  currentRevisions: () => KanbanInteractionRevisions,
  execute: (options: { readonly signal: AbortSignal }) => Promise<KanbanInteractionAcquisitionResult>,
) {
  return Object.freeze({
    request: Object.freeze({
      kind: 'acquire' as const,
      target: Object.freeze({ kind: 'card' as const, cardKey: 9, address: Object.freeze({ columnId: 'ready' }) }),
    }),
    revisions,
    currentRevisions,
    execute,
  });
}

describe('pure navigation geometry', () => {
  it('uses preferred visual rows, stable tie-breaking, and explicit loaded boundaries', () => {
    const readyHeader = target({ kind: 'column-header', columnId: 'ready' }, 0, 0);
    const doingHeader = target({ kind: 'column-header', columnId: 'doing' }, 3, 0);
    const ready = card('ready-high', 'ready', 2, 10);
    const doingEarlier = card('doing-earlier', 'doing', 4, 6);
    const doingLater = card('doing-later', 'doing', 5, 14);
    const geometry = scene(doingLater, ready, doingHeader, doingEarlier, readyHeader);

    const moved = resolveKanbanNavigation({
      current: ready.target,
      direction: 'right',
      scene: geometry,
      preferredCenterRow: 10,
    });
    expect(moved).toMatchObject({
      kind: 'changed',
      focused: { kind: 'card', cardKey: 'doing-earlier' },
      preferredCenterRow: 10,
      reveal: true,
    });
    expect(resolveKanbanNavigation({ current: doingLater.target, direction: 'right', scene: geometry })).toMatchObject({
      kind: 'unchanged',
      focused: { cardKey: 'doing-later' },
      boundary: 'right',
      reveal: false,
    });
  });

  it('resolves vertical, cell-edge, page, and board-edge commands from semantic geometry', () => {
    const columnHeader = target({ kind: 'column-header', columnId: 'ready' }, 0, 0);
    const laneAHeader = target({ kind: 'swimlane-header', swimlaneId: 'team-a' }, 1, 1);
    const laneAFirst = card('a-1', 'ready', 2, 3, 'team-a');
    const laneALast = card('a-2', 'ready', 3, 7, 'team-a');
    const laneBHeader = target({ kind: 'swimlane-header', swimlaneId: 'team-b' }, 4, 9);
    const laneBFirst = card('b-1', 'ready', 5, 11, 'team-b');
    const geometry = scene(columnHeader, laneAHeader, laneAFirst, laneALast, laneBHeader, laneBFirst);

    expect(resolveKanbanNavigation({ current: laneAFirst.target, direction: 'up', scene: geometry }).focused).toEqual(
      laneAHeader.target,
    );
    expect(resolveKanbanNavigation({ current: laneALast.target, direction: 'down', scene: geometry }).focused).toEqual(
      laneBFirst.target,
    );
    expect(resolveKanbanNavigation({ current: laneALast.target, direction: 'home', scene: geometry }).focused).toEqual(
      laneAFirst.target,
    );
    expect(resolveKanbanNavigation({ current: laneAFirst.target, direction: 'end', scene: geometry }).focused).toEqual(
      laneALast.target,
    );
    expect(
      resolveKanbanNavigation({ current: laneAFirst.target, direction: 'page-down', scene: geometry }).focused,
    ).toEqual(laneALast.target);
    expect(
      resolveKanbanNavigation({ current: laneALast.target, direction: 'board-start', scene: geometry }).focused,
    ).toEqual(columnHeader.target);
    expect(
      resolveKanbanNavigation({ current: laneAFirst.target, direction: 'board-end', scene: geometry }).focused,
    ).toEqual(laneBFirst.target);
  });

  it('validates, sorts, freezes, and rejects ambiguous geometry snapshots', () => {
    const safe = snapshotKanbanNavigationSnapshot(scene(card(1, 'ready', 2, 4), card('1', 'ready', 1, 2)));
    expect(safe.targets.map((entry) => entry.target)).toMatchObject([{ cardKey: '1' }, { cardKey: 1 }]);
    expect(Object.isFrozen(safe)).toBe(true);
    expect(Object.isFrozen(safe.targets)).toBe(true);
    expect(resolveInitialKanbanFocus(safe)).toMatchObject({ kind: 'card', cardKey: '1' });

    expect(() => snapshotKanbanNavigationSnapshot(scene(card(1, 'ready', 1, 2), card(2, 'ready', 1, 4)))).toThrow(
      KanbanInvalidGeometryError,
    );
    expect(() => snapshotKanbanNavigationSnapshot(scene(card(1, 'ready', 1, 2), card(1, 'ready', 2, 4)))).toThrow(
      KanbanInvalidGeometryError,
    );
  });
});

describe('focus reconciliation', () => {
  it('falls back from local neighbors to adjacent columns, headers, and board state', () => {
    const readyHeader = target({ kind: 'column-header', columnId: 'ready' }, 0, 0);
    const doingHeader = target({ kind: 'column-header', columnId: 'doing' }, 3, 0);
    const first = card(1, 'ready', 1, 2);
    const removed = card(2, 'ready', 2, 6);
    const doing = card(3, 'doing', 4, 7);
    const previous = scene(readyHeader, first, removed, doingHeader, doing);

    expect(
      reconcileKanbanFocus({
        current: removed.target,
        scene: scene(readyHeader, first, doingHeader, doing),
        previousScene: previous,
        reason: 'deletion',
      }),
    ).toMatchObject({ kind: 'changed', focused: { cardKey: 1 } });
    expect(
      reconcileKanbanFocus({
        current: removed.target,
        scene: scene(readyHeader, doingHeader, doing),
        previousScene: previous,
        reason: 'visibility',
        preferredCenterRow: 6,
      }),
    ).toMatchObject({ kind: 'changed', focused: { cardKey: 3 } });
    expect(
      reconcileKanbanFocus({
        current: removed.target,
        scene: scene(readyHeader),
        previousScene: previous,
        reason: 'deletion',
      }),
    ).toEqual({ kind: 'changed', focused: readyHeader.target });
    expect(
      reconcileKanbanFocus({ current: removed.target, scene: scene(), previousScene: previous, reason: 'deletion' }),
    ).toEqual({ kind: 'changed', focused: { kind: 'board-state' } });
    expect(
      reconcileKanbanFocus({
        current: removed.target,
        scene: scene(),
        previousScene: previous,
        reason: 'cursor-unload',
      }),
    ).toEqual({ kind: 'acquire', focused: removed.target });
  });
});

describe('bounded acquisition coordinator', () => {
  it('supersedes one generation and rejects a later completion after revisions change', async () => {
    const coordinator = new KanbanAcquisitionCoordinator();
    let revisions: KanbanInteractionRevisions = Object.freeze({ sessionRevision: 1, queryGeneration: 1 });
    const firstWork = deferred<KanbanInteractionAcquisitionResult>();
    const secondWork = deferred<KanbanInteractionAcquisitionResult>();
    let firstSignal: AbortSignal | undefined;
    const first = coordinator.start(
      acquisitionOptions(
        revisions,
        () => revisions,
        ({ signal }) => {
          firstSignal = signal;
          return firstWork.promise;
        },
      ),
    );
    await Promise.resolve();
    const second = coordinator.start(
      acquisitionOptions(
        revisions,
        () => revisions,
        () => secondWork.promise,
      ),
    );

    expect(await first.settlement).toEqual({ kind: 'stale', reason: 'superseded' });
    expect(firstSignal?.aborted).toBe(true);
    first.cancel();
    expect(coordinator.activeGeneration()).toBe(second.generation);
    revisions = Object.freeze({ sessionRevision: 1, queryGeneration: 2 });
    secondWork.resolve(Object.freeze({ kind: 'available' }));
    expect(await second.settlement).toEqual({ kind: 'stale', reason: 'revision-changed' });
    firstWork.reject(new Error('late-secret'));
    await Promise.resolve();
    expect(coordinator.activeGeneration()).toBeUndefined();
  });

  it('normalizes failures, cancels immediately, and disposes idempotently', async () => {
    const coordinator = new KanbanAcquisitionCoordinator();
    const revisions = Object.freeze({ sessionRevision: 's1', queryGeneration: 1 });
    const unavailable = coordinator.start(
      acquisitionOptions(
        revisions,
        () => revisions,
        async () => Object.freeze({ kind: 'unavailable', retry: 'unavailable' }),
      ),
    );
    expect(await unavailable.settlement).toMatchObject({
      kind: 'unavailable',
      code: 'navigation-unavailable',
      retry: 'unavailable',
    });

    const failed = coordinator.start(
      acquisitionOptions(
        revisions,
        () => revisions,
        async () => {
          throw new Error('application-secret');
        },
      ),
    );
    expect(await failed.settlement).toMatchObject({
      kind: 'unavailable',
      code: 'navigation-error',
      retry: 'available',
    });

    const pending = deferred<KanbanInteractionAcquisitionResult>();
    let signal: AbortSignal | undefined;
    const cancelled = coordinator.start(
      acquisitionOptions(
        revisions,
        () => revisions,
        ({ signal: currentSignal }) => {
          signal = currentSignal;
          return pending.promise;
        },
      ),
    );
    await Promise.resolve();
    cancelled.cancel();
    expect(await cancelled.settlement).toEqual({ kind: 'stale', reason: 'cancelled' });
    expect(signal?.aborted).toBe(true);

    const disposed = coordinator.start(
      acquisitionOptions(
        revisions,
        () => revisions,
        () => pending.promise,
      ),
    );
    coordinator.dispose();
    coordinator.dispose();
    expect(await disposed.settlement).toEqual({ kind: 'stale', reason: 'disposed' });
    expect(() =>
      coordinator.start(
        acquisitionOptions(
          revisions,
          () => revisions,
          () => pending.promise,
        ),
      ),
    ).toThrow(KanbanDisposedResourceError);
    pending.resolve(Object.freeze({ kind: 'available' }));
    await Promise.resolve();
  });
});
