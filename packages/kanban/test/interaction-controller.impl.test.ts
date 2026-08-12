import { describe, expect, it, vi } from 'vitest';

import {
  KANBAN_NEUTRAL_INTERACTION_SNAPSHOT,
  KanbanDisposedResourceError,
  createKanbanInteractionController,
} from '../src/index.js';
import type {
  KanbanInteractionAcquisitionResult,
  KanbanInteractionController,
  KanbanInteractionEnvironment,
  KanbanInteractionFeedbackCode,
  KanbanInteractionResult,
  KanbanInteractionSnapshot,
  KanbanNavigationSnapshot,
} from '../src/index.js';
import { KanbanInteractionFacadeOwner } from '../src/interaction/facade.js';

/** One externally settled promise used to make transition ordering deterministic. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

/** Creates a promise whose settlement remains owned by the test. */
function deferred<T>(): Deferred<T> {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  if (resolve === undefined) throw new Error('Deferred promise setup failed.');
  return Object.freeze({ promise, resolve });
}

/** Creates one enabled card target at a deterministic scene position. */
function card(cardKey: number, sceneIndex: number): KanbanNavigationSnapshot['targets'][number] {
  return Object.freeze({
    target: Object.freeze({ kind: 'card', cardKey, address: Object.freeze({ columnId: 'ready' }) }),
    sceneIndex,
    centerColumn: 5,
    centerRow: sceneIndex * 3 + 1,
    enabled: true,
  });
}

/** Creates bounded navigation evidence for the supplied visible cards. */
function scene(...cardKeys: readonly number[]): KanbanNavigationSnapshot {
  return Object.freeze({
    revision: 1,
    targets: Object.freeze(cardKeys.map((cardKey, index) => card(cardKey, index))),
    viewportContentHeight: 12,
  });
}

/** Creates one controller environment with optional asynchronous acquisition ownership. */
function environment(
  options: {
    readonly scene?: () => KanbanNavigationSnapshot;
    readonly acquire?: KanbanInteractionEnvironment['acquire'];
  } = {},
): KanbanInteractionEnvironment {
  return Object.freeze({
    scene: options.scene ?? (() => scene(1, 2)),
    revisions: () => Object.freeze({ sessionRevision: 1, queryGeneration: 1 }),
    reveal: () => Object.freeze({ kind: 'available' }),
    acquire: options.acquire ?? (() => Object.freeze({ kind: 'available' })),
    feedback: (code: KanbanInteractionFeedbackCode, count?: number) =>
      Object.freeze({ code, label: code, ...(count === undefined ? {} : { count }) }),
    invalidate: () => undefined,
  });
}

describe('default interaction controller lifecycle', () => {
  it('publishes monotonic frozen revisions, isolates subscribers, and disposes idempotently', () => {
    const controller = createKanbanInteractionController(environment());
    const throwingSubscriber = vi.fn(() => {
      throw new Error('subscriber-secret');
    });
    const subscriber = vi.fn();
    const unsubscribeThrowing = controller.subscribe(throwingSubscriber);
    const unsubscribe = controller.subscribe(subscriber);

    const initial = controller.snapshot();
    expect(initial).toMatchObject({ revision: 1, focused: { kind: 'card', cardKey: 1 } });
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(initial.focused)).toBe(true);
    if (initial.focused.kind !== 'card') throw new Error('Expected initial card focus.');
    expect(Object.isFrozen(initial.focused.address)).toBe(true);
    expect(Object.isFrozen(initial.selectedCardKeys)).toBe(true);

    const unchanged = controller.transition({ kind: 'selection', operation: 'clear-multiple' });
    expect(unchanged).toEqual({ kind: 'unchanged', snapshot: initial });
    expect(controller.snapshot()).toBe(initial);
    expect(subscriber).not.toHaveBeenCalled();
    const moved = controller.transition({
      kind: 'focus',
      target: { kind: 'card', cardKey: 2, address: { columnId: 'ready' } },
    });
    expect(moved).toMatchObject({ kind: 'changed', snapshot: { revision: 2, focused: { cardKey: 2 } } });
    expect(throwingSubscriber).toHaveBeenCalledOnce();
    expect(subscriber).toHaveBeenCalledOnce();

    const movedSnapshot = controller.snapshot();
    const repeatedFocus = controller.transition({
      kind: 'focus',
      target: { kind: 'card', cardKey: 2, address: { columnId: 'ready' } },
    });
    expect(repeatedFocus).toEqual({ kind: 'unchanged', snapshot: movedSnapshot });
    expect(controller.snapshot()).toBe(movedSnapshot);
    expect(subscriber).toHaveBeenCalledOnce();

    unsubscribe();
    unsubscribe();
    controller.transition({ kind: 'selection', operation: 'toggle' });
    expect(controller.snapshot().revision).toBe(3);
    expect(subscriber).toHaveBeenCalledOnce();
    unsubscribeThrowing();

    controller.dispose();
    controller.dispose();
    expect(() => controller.transition({ kind: 'selection', operation: 'toggle' })).toThrow(
      KanbanDisposedResourceError,
    );
    expect(() => controller.subscribe(() => undefined)).toThrow(KanbanDisposedResourceError);
    expect(controller.snapshot().revision).toBe(3);
  });

  it('aborts pending acquisition and ignores its late completion after disposal', async () => {
    const acquisition = deferred<KanbanInteractionAcquisitionResult>();
    let signal: AbortSignal | undefined;
    const controller = createKanbanInteractionController(
      environment({
        acquire: (_request, options) => {
          signal = options?.signal;
          return acquisition.promise;
        },
      }),
    );
    const subscriber = vi.fn();
    controller.subscribe(subscriber);
    controller.snapshot();

    const pending = controller.transition({
      kind: 'focus',
      target: { kind: 'card', cardKey: 99, address: { columnId: 'ready' } },
    });
    expect(pending).toMatchObject({ kind: 'pending', snapshot: { pendingNavigation: { kind: 'acquire' } } });
    if (pending instanceof Promise || pending.kind !== 'pending') {
      throw new Error('Expected one synchronous pending acquisition publication.');
    }
    const pendingSnapshot = pending.snapshot;
    const pendingNavigation = pendingSnapshot.pendingNavigation;
    if (pendingNavigation === undefined) throw new Error('Expected pending navigation evidence.');
    expect(Object.isFrozen(pendingNavigation)).toBe(true);
    expect(Object.isFrozen(pendingNavigation.target)).toBe(true);
    if (pendingNavigation.target.kind !== 'card') throw new Error('Expected pending card focus.');
    expect(Object.isFrozen(pendingNavigation.target.address)).toBe(true);
    await Promise.resolve();
    expect(signal?.aborted).toBe(false);

    controller.dispose();
    expect(signal?.aborted).toBe(true);
    acquisition.resolve(Object.freeze({ kind: 'available' }));
    await acquisition.promise;
    await Promise.resolve();
    await Promise.resolve();
    expect(subscriber).toHaveBeenCalledOnce();
    expect(controller.snapshot()).toBe(pendingSnapshot);
  });

  it('keeps repeated header focus as a semantic no-op', () => {
    const headerScene: KanbanNavigationSnapshot = Object.freeze({
      revision: 1,
      targets: Object.freeze([
        Object.freeze({
          target: Object.freeze({ kind: 'column-header', columnId: 'ready' }),
          sceneIndex: 0,
          centerColumn: 5,
          centerRow: 0,
          enabled: true,
        }),
      ]),
      viewportContentHeight: 12,
    });
    const controller = createKanbanInteractionController(environment({ scene: () => headerScene }));
    const subscriber = vi.fn();
    controller.subscribe(subscriber);
    const initial = controller.snapshot();

    const repeated = controller.transition({
      kind: 'focus',
      target: { kind: 'column-header', columnId: 'ready' },
    });

    expect(repeated).toEqual({ kind: 'unchanged', snapshot: initial });
    expect(controller.snapshot()).toBe(initial);
    expect(subscriber).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('publishes an anchor change even when ordered selection membership is unchanged', () => {
    let currentScene = scene(1, 2);
    const controller = createKanbanInteractionController(environment({ scene: () => currentScene }));
    controller.snapshot();
    controller.transition({ kind: 'selection', operation: 'toggle' });
    controller.transition({
      kind: 'focus',
      target: { kind: 'card', cardKey: 2, address: { columnId: 'ready' } },
    });
    const before = controller.snapshot();
    expect(before).toMatchObject({ selectedCardKeys: [1], rangeAnchor: { cardKey: 1 } });

    currentScene = scene(2);
    const cleared = controller.transition({ kind: 'selection', operation: 'range' });

    expect(cleared).toMatchObject({
      kind: 'changed',
      snapshot: { revision: before.revision + 1, selectedCardKeys: [1] },
    });
    expect(controller.snapshot().rangeAnchor).toBeUndefined();
    controller.dispose();
  });
});

describe('interaction facade transition serialization', () => {
  it('publishes a synchronous accepted transition before accept returns', () => {
    let current = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT;
    const changed: KanbanInteractionSnapshot = Object.freeze({
      revision: 1,
      focused: Object.freeze({ kind: 'column-header', columnId: 'ready' }),
      selectedCardKeys: Object.freeze([]),
    });
    const controller: KanbanInteractionController = {
      snapshot: () => current,
      transition: () => {
        current = changed;
        return Object.freeze({ kind: 'changed', snapshot: changed });
      },
      subscribe: () => () => undefined,
      dispose: () => undefined,
    };
    const facade = new KanbanInteractionFacadeOwner({
      snapshotEligibleSelection: () =>
        Object.freeze({ entries: Object.freeze([]), sessionRevision: 0, queryGeneration: 0 }),
      invalidate: () => undefined,
    });
    facade.attach(controller);

    expect(facade.accept({ kind: 'navigate', direction: 'down' })).toBe(true);
    expect(facade.snapshot()).toEqual(changed);
    facade.dispose();
  });

  it('starts one owned transition at a time and publishes each validated settlement in order', async () => {
    const first = deferred<KanbanInteractionResult>();
    const second = deferred<KanbanInteractionResult>();
    const transition = vi
      .fn<KanbanInteractionController['transition']>()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    let current = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT;
    let controllerInvalidate: (() => void) | undefined;
    const controller: KanbanInteractionController = {
      snapshot: () => current,
      transition,
      subscribe: (invalidateController) => {
        controllerInvalidate = invalidateController;
        return () => undefined;
      },
      dispose: () => undefined,
    };
    const invalidate = vi.fn();
    const facade = new KanbanInteractionFacadeOwner({
      snapshotEligibleSelection: () =>
        Object.freeze({ entries: Object.freeze([]), sessionRevision: 0, queryGeneration: 0 }),
      invalidate,
    });
    facade.attach(controller);
    const subscriber = vi.fn();
    facade.subscribe(subscriber);
    invalidate.mockClear();

    const one = facade.transition({ kind: 'navigate', direction: 'down' });
    const two = facade.transition({ kind: 'navigate', direction: 'up' });
    expect(transition).toHaveBeenCalledOnce();
    expect(transition).toHaveBeenNthCalledWith(1, { kind: 'navigate', direction: 'down' });

    const snapshotOne: KanbanInteractionSnapshot = Object.freeze({
      revision: 1,
      focused: Object.freeze({ kind: 'column-header', columnId: 'ready' }),
      selectedCardKeys: Object.freeze([]),
    });
    current = snapshotOne;
    controllerInvalidate?.();
    first.resolve(Object.freeze({ kind: 'changed', snapshot: snapshotOne }));
    await expect(one).resolves.toMatchObject({ kind: 'changed', snapshot: { revision: 1 } });
    await Promise.resolve();
    expect(transition).toHaveBeenCalledTimes(2);
    expect(transition).toHaveBeenNthCalledWith(2, { kind: 'navigate', direction: 'up' });

    second.resolve(Object.freeze({ kind: 'unchanged', snapshot: snapshotOne }));
    await expect(two).resolves.toMatchObject({ kind: 'unchanged', snapshot: { revision: 1 } });
    expect(facade.snapshot()).toEqual(snapshotOne);
    expect(invalidate).toHaveBeenCalledOnce();
    expect(subscriber).toHaveBeenCalledOnce();
    facade.dispose();
  });

  it('contains an in-flight settlement after facade disposal', async () => {
    const settlement = deferred<KanbanInteractionResult>();
    let current = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT;
    const dispose = vi.fn();
    const controller: KanbanInteractionController = {
      snapshot: () => current,
      transition: () => settlement.promise,
      subscribe: () => () => undefined,
      dispose,
    };
    const invalidate = vi.fn();
    const facade = new KanbanInteractionFacadeOwner({
      snapshotEligibleSelection: () =>
        Object.freeze({ entries: Object.freeze([]), sessionRevision: 0, queryGeneration: 0 }),
      invalidate,
    });
    facade.attach(controller);
    const retained = facade.snapshot();
    const subscriber = vi.fn();
    facade.subscribe(subscriber);
    invalidate.mockClear();

    const pending = facade.transition({ kind: 'navigate', direction: 'down' });
    facade.dispose();
    current = Object.freeze({
      revision: 1,
      focused: Object.freeze({ kind: 'column-header', columnId: 'ready' }),
      selectedCardKeys: Object.freeze([]),
    });
    settlement.resolve(Object.freeze({ kind: 'changed', snapshot: current }));

    await expect(pending).resolves.toMatchObject({ kind: 'unavailable', snapshot: { revision: 0 } });
    expect(facade.snapshot()).toBe(retained);
    expect(subscriber).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('rejects conflicting or regressive controller revisions without facade divergence', async () => {
    const baseline: KanbanInteractionSnapshot = Object.freeze({
      revision: 2,
      focused: Object.freeze({ kind: 'column-header', columnId: 'ready' }),
      selectedCardKeys: Object.freeze([]),
    });
    const regressive: KanbanInteractionSnapshot = Object.freeze({
      revision: 1,
      focused: Object.freeze({ kind: 'column-header', columnId: 'other' }),
      selectedCardKeys: Object.freeze([]),
    });
    const conflicting: KanbanInteractionSnapshot = Object.freeze({
      revision: 2,
      focused: Object.freeze({ kind: 'column-header', columnId: 'other' }),
      selectedCardKeys: Object.freeze([]),
    });
    let current = baseline;
    let controllerInvalidate: (() => void) | undefined;
    const dispose = vi.fn();
    const transition = vi
      .fn<KanbanInteractionController['transition']>()
      .mockReturnValueOnce(Object.freeze({ kind: 'changed', snapshot: regressive }))
      .mockReturnValueOnce(Object.freeze({ kind: 'changed', snapshot: conflicting }));
    const controller: KanbanInteractionController = {
      snapshot: () => current,
      transition,
      subscribe: (invalidateController) => {
        controllerInvalidate = invalidateController;
        return () => undefined;
      },
      dispose,
    };
    const invalidate = vi.fn();
    const facade = new KanbanInteractionFacadeOwner({
      snapshotEligibleSelection: () =>
        Object.freeze({ entries: Object.freeze([]), sessionRevision: 0, queryGeneration: 0 }),
      invalidate,
    });
    facade.attach(controller);
    const retained = facade.snapshot();
    invalidate.mockClear();

    controllerInvalidate?.();
    expect(invalidate).toHaveBeenCalledOnce();
    invalidate.mockClear();
    await expect(facade.transition({ kind: 'navigate', direction: 'down' })).resolves.toMatchObject({
      kind: 'unavailable',
      snapshot: { revision: 2, focused: { columnId: 'ready' } },
    });
    await expect(facade.transition({ kind: 'navigate', direction: 'up' })).resolves.toMatchObject({
      kind: 'unavailable',
      snapshot: { revision: 2, focused: { columnId: 'ready' } },
    });
    expect(facade.snapshot()).toBe(retained);
    expect(invalidate).not.toHaveBeenCalled();

    current = regressive;
    controllerInvalidate?.();
    expect(facade.snapshot()).toBe(retained);
    expect(invalidate).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
  });
});
