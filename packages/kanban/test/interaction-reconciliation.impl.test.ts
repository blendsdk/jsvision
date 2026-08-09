import { describe, expect, it, vi } from 'vitest';

import { createKanbanInteractionController } from '../src/index.js';
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

/** One externally controlled promise used to verify cancellation without timers. */
interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

/** Creates a promise whose successful settlement remains owned by the test. */
function deferred<T>(): Deferred<T> {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  if (resolve === undefined) throw new Error('Deferred promise setup failed.');
  return Object.freeze({ promise, resolve });
}

/** Creates deterministic visible card geometry in one workflow cell. */
function scene(...cardKeys: readonly number[]): KanbanNavigationSnapshot {
  return Object.freeze({
    revision: cardKeys.join(',') || 'empty',
    targets: Object.freeze(
      cardKeys.map((cardKey, sceneIndex) =>
        Object.freeze({
          target: Object.freeze({ kind: 'card' as const, cardKey, address: Object.freeze({ columnId: 'ready' }) }),
          sceneIndex,
          centerColumn: 5,
          centerRow: sceneIndex * 3 + 1,
          enabled: true,
        }),
      ),
    ),
    viewportContentHeight: 10,
  });
}

/** Creates two focused-column headers where the destination may require responsive reveal. */
function headerScene(doingEnabled: boolean): KanbanNavigationSnapshot {
  return Object.freeze({
    revision: doingEnabled ? 'headers-visible' : 'headers-focused',
    targets: Object.freeze([
      Object.freeze({
        target: Object.freeze({ kind: 'column-header' as const, columnId: 'ready' }),
        sceneIndex: 0,
        centerColumn: 5,
        centerRow: 0,
        enabled: true,
      }),
      Object.freeze({
        target: Object.freeze({ kind: 'column-header' as const, columnId: 'doing' }),
        sceneIndex: 1,
        centerColumn: 5,
        centerRow: 0,
        enabled: doingEnabled,
      }),
    ]),
    viewportContentHeight: 10,
  });
}

/** Creates one controller environment over mutable scene and acquisition seams. */
function environment(
  currentScene: () => KanbanNavigationSnapshot,
  acquire: KanbanInteractionEnvironment['acquire'] = () => Object.freeze({ kind: 'available' }),
): KanbanInteractionEnvironment {
  return Object.freeze({
    scene: currentScene,
    revisions: () => Object.freeze({ sessionRevision: 1, queryGeneration: 1 }),
    reveal: () => Object.freeze({ kind: 'available' }),
    acquire,
    feedback: (code: KanbanInteractionFeedbackCode, count?: number) =>
      Object.freeze({ code, label: code, ...(count === undefined ? {} : { count }) }),
    invalidate: () => undefined,
  });
}

describe('interaction reconciliation lifecycle', () => {
  it('retains current focus during acquisition and clears superseded pending state once', async () => {
    let currentScene = scene(1);
    const work = deferred<KanbanInteractionAcquisitionResult>();
    let signal: AbortSignal | undefined;
    const controller = createKanbanInteractionController(
      environment(
        () => currentScene,
        (_request, options) => {
          signal = options?.signal;
          return work.promise;
        },
      ),
    );
    const subscriber = vi.fn();
    controller.subscribe(subscriber);
    const initial = controller.snapshot();

    const pending = controller.transition({
      kind: 'focus',
      target: { kind: 'card', cardKey: 99, address: { columnId: 'ready' } },
    });
    expect(pending).toMatchObject({
      kind: 'pending',
      snapshot: { focused: initial.focused, pendingNavigation: { target: { cardKey: 99 } } },
    });
    await Promise.resolve();
    expect(signal?.aborted).toBe(false);

    const superseded = controller.transition({ kind: 'selection', operation: 'clear-multiple' });
    expect(superseded).toMatchObject({ kind: 'changed', snapshot: { focused: initial.focused } });
    expect(controller.snapshot().pendingNavigation).toBeUndefined();
    expect(signal?.aborted).toBe(true);
    work.resolve(Object.freeze({ kind: 'available' }));
    currentScene = scene(1, 99);
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.snapshot().focused).toEqual(initial.focused);
    expect(subscriber).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it('starts cursor-unload acquisition and moves only after current scene confirms availability', async () => {
    let currentScene = scene(1, 2);
    const work = deferred<KanbanInteractionAcquisitionResult>();
    const acquire = vi.fn(() => work.promise);
    const controller = createKanbanInteractionController(environment(() => currentScene, acquire));
    controller.snapshot();
    currentScene = scene(2);

    const pending = controller.transition({ kind: 'reconcile', reason: 'cursor-unload' });
    expect(pending).toMatchObject({
      kind: 'pending',
      snapshot: { focused: { cardKey: 1 }, pendingNavigation: { target: { cardKey: 1 } } },
    });
    await Promise.resolve();
    expect(acquire).toHaveBeenCalledOnce();

    currentScene = scene(1, 2);
    work.resolve(Object.freeze({ kind: 'available' }));
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    expect(controller.snapshot()).toMatchObject({ focused: { cardKey: 1 } });
    expect(controller.snapshot().pendingNavigation).toBeUndefined();
    controller.dispose();
  });

  it('updates a retained card address after automatic source-publication acquisition', async () => {
    let currentScene = scene(1);
    const controller = createKanbanInteractionController(environment(() => currentScene));
    controller.snapshot();
    currentScene = Object.freeze({
      ...scene(),
      revision: 'moved',
      targets: Object.freeze([
        Object.freeze({
          target: Object.freeze({
            kind: 'card' as const,
            cardKey: 1,
            address: Object.freeze({ columnId: 'doing' }),
          }),
          sceneIndex: 0,
          centerColumn: 5,
          centerRow: 1,
          enabled: true,
        }),
      ]),
    });

    expect(controller.transition({ kind: 'reconcile', reason: 'source-publication' })).toMatchObject({
      kind: 'pending',
    });
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    expect(controller.snapshot()).toMatchObject({
      focused: { kind: 'card', cardKey: 1, address: { columnId: 'doing' } },
    });
    controller.dispose();
  });

  it('reveals a disabled focused-column header before publishing it', async () => {
    let currentScene = headerScene(false);
    const reveal = vi.fn(() => {
      currentScene = headerScene(true);
      return Object.freeze({ kind: 'available' as const });
    });
    const base = environment(() => currentScene);
    const controller = createKanbanInteractionController(Object.freeze({ ...base, reveal }));
    expect(controller.snapshot().focused).toEqual({ kind: 'column-header', columnId: 'ready' });

    await controller.transition({ kind: 'navigate', direction: 'next-column' });
    expect(reveal).toHaveBeenCalledWith(
      { kind: 'column-header', columnId: 'doing' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(controller.snapshot().focused).toEqual({ kind: 'column-header', columnId: 'doing' });
    controller.dispose();
  });

  it('rejects a completion whose revisions change during refreshed scene confirmation', async () => {
    let currentScene = scene(1);
    let revisions: { readonly sessionRevision: number; readonly queryGeneration: number } = Object.freeze({
      sessionRevision: 1,
      queryGeneration: 1,
    });
    let changeRevisionOnRead = false;
    const base = environment(() => currentScene);
    const controller = createKanbanInteractionController(
      Object.freeze({
        ...base,
        scene: () => {
          if (changeRevisionOnRead) {
            changeRevisionOnRead = false;
            revisions = Object.freeze({ sessionRevision: 2, queryGeneration: 1 });
          }
          return currentScene;
        },
        revisions: () => revisions,
      }),
    );
    const initial = controller.snapshot().focused;
    expect(
      controller.transition({
        kind: 'focus',
        target: { kind: 'card', cardKey: 99, address: { columnId: 'ready' } },
      }),
    ).toMatchObject({ kind: 'pending' });
    currentScene = scene(1, 99);
    changeRevisionOnRead = true;

    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    expect(controller.snapshot().focused).toEqual(initial);
    expect(controller.snapshot().pendingNavigation).toBeUndefined();
    controller.dispose();
  });

  it('prunes exact deleted identities while retaining selected unloaded cards', () => {
    let currentScene = scene(1, 2);
    const controller = createKanbanInteractionController(environment(() => currentScene));
    controller.snapshot();
    controller.transition({ kind: 'selection', operation: 'select-loaded-visible-matching' });
    currentScene = scene();

    const reconciled = controller.transition({ kind: 'reconcile', reason: 'deletion', deletedCardKeys: [1] });
    expect(reconciled).toMatchObject({
      kind: 'changed',
      snapshot: { focused: { kind: 'board-state' }, selectedCardKeys: [2] },
    });
    controller.dispose();
  });

  it('prunes only selected cards proven hidden across query reconciliation', () => {
    let currentScene = scene(1, 2);
    const controller = createKanbanInteractionController(environment(() => currentScene));
    controller.snapshot();
    controller.transition({ kind: 'selection', operation: 'select-loaded-visible-matching' });
    currentScene = scene(1);
    controller.transition({ kind: 'reconcile', reason: 'geometry' });
    currentScene = scene();

    const reconciled = controller.transition({ kind: 'reconcile', reason: 'query' });
    expect(reconciled).toMatchObject({
      kind: 'changed',
      snapshot: { selectedCardKeys: [2], feedback: { code: 'selection-pruned', count: 1 } },
    });
    controller.dispose();
  });

  it('keeps retained focus and unchanged selection as an exact semantic no-op', () => {
    const currentScene = scene(1, 2);
    const controller = createKanbanInteractionController(environment(() => currentScene));
    const initial = controller.snapshot();
    const reconciled = controller.transition({ kind: 'reconcile', reason: 'geometry' });

    expect(reconciled).toEqual({ kind: 'unchanged', snapshot: initial });
    expect(controller.snapshot()).toBe(initial);
    controller.dispose();
  });
});

describe('injected controller settlement integrity', () => {
  it('rejects contradictory changed and unchanged discriminators', async () => {
    const initial: KanbanInteractionSnapshot = Object.freeze({
      revision: 1,
      focused: Object.freeze({ kind: 'column-header', columnId: 'ready' }),
      selectedCardKeys: Object.freeze([]),
    });
    const changedState: KanbanInteractionSnapshot = Object.freeze({
      revision: 2,
      focused: Object.freeze({ kind: 'column-header', columnId: 'doing' }),
      selectedCardKeys: Object.freeze([]),
    });
    const changedRevisionOnly: KanbanInteractionSnapshot = Object.freeze({ ...initial, revision: 2 });
    const transition = vi
      .fn<KanbanInteractionController['transition']>()
      .mockReturnValueOnce(Object.freeze({ kind: 'unchanged', snapshot: changedState }))
      .mockReturnValueOnce(Object.freeze({ kind: 'changed', snapshot: changedRevisionOnly }));
    const controller: KanbanInteractionController = {
      snapshot: () => initial,
      transition,
      subscribe: () => () => undefined,
      dispose: () => undefined,
    };
    const facade = new KanbanInteractionFacadeOwner({
      snapshotEligibleSelection: () =>
        Object.freeze({ entries: Object.freeze([]), sessionRevision: 1, queryGeneration: 1 }),
      invalidate: () => undefined,
    });
    facade.attach(controller);

    await expect(facade.transition({ kind: 'navigate', direction: 'down' })).resolves.toMatchObject({
      kind: 'unavailable',
      snapshot: initial,
    });
    await expect(facade.transition({ kind: 'navigate', direction: 'up' })).resolves.toMatchObject({
      kind: 'unavailable',
      snapshot: initial,
    });
    facade.dispose();
  });

  it('reuses one immutable raw snapshot without revalidating its large members on every read', () => {
    const raw: KanbanInteractionSnapshot = Object.freeze({
      revision: 1,
      focused: Object.freeze({ kind: 'column-header', columnId: 'ready' }),
      selectedCardKeys: Object.freeze([1, 2, 3]),
    });
    const controller: KanbanInteractionController = {
      snapshot: () => raw,
      transition: (): KanbanInteractionResult => Object.freeze({ kind: 'unchanged', snapshot: raw }),
      subscribe: () => () => undefined,
      dispose: () => undefined,
    };
    const facade = new KanbanInteractionFacadeOwner({
      snapshotEligibleSelection: () =>
        Object.freeze({ entries: Object.freeze([]), sessionRevision: 1, queryGeneration: 1 }),
      invalidate: () => undefined,
    });
    facade.attach(controller);
    const stringify = vi.spyOn(JSON, 'stringify');

    facade.snapshot();
    facade.snapshot();
    expect(stringify).not.toHaveBeenCalled();
    stringify.mockRestore();
    facade.dispose();
  });
});
