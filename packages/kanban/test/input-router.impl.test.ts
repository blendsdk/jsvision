import { describe, expect, it, vi } from 'vitest';

import type {
  KanbanActionTarget,
  KanbanInteractionIntent,
  KanbanInteractionSnapshot,
  KanbanObservation,
  KanbanSelectionSnapshot,
} from '../src/index.js';
import { KanbanPointerRouter, routeKanbanKeyInput } from '../src/testing.js';
import type { KanbanKeyInputSink, KanbanPointerRouterSink } from '../src/testing.js';
import { KanbanIntentRouter } from '../src/interaction/intent-router.js';

const CARD_FOCUS: KanbanInteractionSnapshot = Object.freeze({
  revision: 1,
  focused: Object.freeze({
    kind: 'card',
    cardKey: 1,
    address: Object.freeze({ columnId: 'ready' }),
  }),
  selectedCardKeys: Object.freeze([]),
});

const SELECTION: KanbanSelectionSnapshot = Object.freeze({
  entries: Object.freeze([
    Object.freeze({
      cardKey: 1,
      address: Object.freeze({ columnId: 'ready' }),
      entityRevision: 3,
    }),
  ]),
  sessionRevision: 2,
  queryGeneration: 4,
});

/** Creates one deterministic whole-card pointer target. */
function cardTarget(cardKey = 1): KanbanActionTarget {
  const address = Object.freeze({ columnId: 'ready' });
  return Object.freeze({
    kind: 'card',
    scope: Object.freeze({ kind: 'card', cardKey, address }),
    x: 1,
    y: cardKey * 3,
    width: 18,
    height: 2,
    zIndex: 400,
    cardKey,
    address,
    logicalIndex: cardKey - 1,
  });
}

/** Creates complete pointer seams with only the requested behavior replaced. */
function pointerSink(overrides: Partial<KanbanPointerRouterSink> = {}): KanbanPointerRouterSink {
  return {
    snapshotSelection: () => SELECTION,
    beginPrimary: () => true,
    completeCard: () => true,
    completeCardAction: () => true,
    completeScopedAction: () => true,
    completeRetry: () => true,
    openContext: () => true,
    ...overrides,
  };
}

describe('normalized Kanban key routing', () => {
  it('routes only the closed key subset and propagates synchronous acceptance', () => {
    const accept = vi.fn(() => true);
    const activate = vi.fn(() => true);
    const sink: KanbanKeyInputSink = { snapshot: () => CARD_FOCUS, accept, activate };

    expect(routeKanbanKeyInput({ key: 'pageup', ctrl: false, alt: false, shift: false }, sink)).toBe(true);
    expect(accept).toHaveBeenLastCalledWith({ kind: 'navigate', direction: 'page-up' });
    expect(routeKanbanKeyInput({ key: 'a', ctrl: true, alt: false, shift: false }, sink)).toBe(true);
    expect(accept).toHaveBeenLastCalledWith({
      kind: 'selection',
      operation: 'select-loaded-visible-matching',
    });
    expect(routeKanbanKeyInput({ key: 'enter', ctrl: false, alt: false, shift: false }, sink)).toBe(true);
    expect(activate).toHaveBeenCalledWith('keyboard');

    const calls = accept.mock.calls.length + activate.mock.calls.length;
    expect(routeKanbanKeyInput({ key: 'f12', ctrl: false, alt: false, shift: false }, sink)).toBe(false);
    expect(routeKanbanKeyInput({ key: 'a', ctrl: false, alt: true, shift: false }, sink)).toBe(false);
    expect(routeKanbanKeyInput({ key: 'a', ctrl: true, alt: false, shift: true }, sink)).toBe(false);
    expect(accept.mock.calls.length + activate.mock.calls.length).toBe(calls);
  });

  it('starts a card range before Shift navigation and stops when admission rejects', () => {
    const accepted = vi.fn(() => true);
    const enabled: KanbanKeyInputSink = {
      snapshot: () => CARD_FOCUS,
      accept: accepted,
      activate: () => true,
    };

    expect(routeKanbanKeyInput({ key: 'down', ctrl: false, alt: false, shift: true }, enabled)).toBe(true);
    expect(accepted.mock.calls).toEqual([
      [{ kind: 'selection', operation: 'replace' }],
      [{ kind: 'navigate', direction: 'down', extendSelection: true }],
    ]);

    const rejected = vi.fn(() => false);
    expect(
      routeKanbanKeyInput(
        { key: 'down', ctrl: false, alt: false, shift: true },
        { snapshot: () => CARD_FOCUS, accept: rejected, activate: () => true },
      ),
    ).toBe(false);
    expect(rejected).toHaveBeenCalledOnce();
  });
});

describe('bounded Kanban pointer routing', () => {
  it('focuses on down and reports completion acceptance on the matching up', () => {
    const beginPrimary = vi.fn(() => true);
    const completeCard = vi.fn(() => false);
    const router = new KanbanPointerRouter(pointerSink({ beginPrimary, completeCard }));
    const target = cardTarget();

    expect(router.route({ kind: 'down', button: 0, ctrl: false, clickCount: 1, target, sceneRevision: 7 })).toBe(true);
    expect(beginPrimary).toHaveBeenCalledWith(target);
    expect(router.pending()).toMatchObject({ target, clickCount: 1, ctrl: false });
    expect(router.route({ kind: 'up', button: 0, ctrl: false, target, sceneRevision: 7 })).toBe(false);
    expect(completeCard).toHaveBeenCalledWith(target, { toggle: false, activate: false });
    expect(router.pending()).toBeUndefined();
  });

  it('normalizes only framework count two as double-click activation', () => {
    const completeCard = vi.fn(() => true);
    const router = new KanbanPointerRouter(pointerSink({ completeCard }));
    const target = cardTarget();

    router.route({ kind: 'down', button: 0, ctrl: true, clickCount: 2, target, sceneRevision: 8 });
    expect(router.route({ kind: 'up', button: 0, ctrl: true, target, sceneRevision: 8 })).toBe(true);
    expect(completeCard).toHaveBeenLastCalledWith(target, { toggle: true, activate: true });

    router.route({ kind: 'down', button: 0, ctrl: false, clickCount: 3, target, sceneRevision: 8 });
    router.route({ kind: 'up', button: 0, ctrl: false, target, sceneRevision: 8 });
    expect(completeCard).toHaveBeenLastCalledWith(target, { toggle: false, activate: false });
  });

  it('cancels stale, moved, mismatched, unavailable, and disposed presses', () => {
    const unavailable = new KanbanPointerRouter(pointerSink({ beginPrimary: () => false }));
    const target = cardTarget();
    expect(unavailable.route({ kind: 'down', button: 0, ctrl: false, target, sceneRevision: 1 })).toBe(false);
    expect(unavailable.pending()).toBeUndefined();

    const completeCard = vi.fn(() => true);
    const router = new KanbanPointerRouter(pointerSink({ completeCard }));
    router.route({ kind: 'down', button: 0, ctrl: false, target, sceneRevision: 1 });
    expect(router.route({ kind: 'up', button: 0, ctrl: false, target, sceneRevision: 2 })).toBe(false);
    router.route({ kind: 'down', button: 0, ctrl: false, target, sceneRevision: 1 });
    expect(router.route({ kind: 'move', button: 0, ctrl: false, target, sceneRevision: 1 })).toBe(false);
    router.route({ kind: 'down', button: 0, ctrl: false, target, sceneRevision: 1 });
    expect(router.route({ kind: 'up', button: 0, ctrl: false, target: cardTarget(2), sceneRevision: 1 })).toBe(false);
    expect(completeCard).not.toHaveBeenCalled();

    router.dispose();
    router.dispose();
    expect(router.route({ kind: 'down', button: 0, ctrl: false, target, sceneRevision: 1 })).toBe(false);
  });

  it('routes right-click only to a card context target', () => {
    const openContext = vi.fn(() => true);
    const router = new KanbanPointerRouter(pointerSink({ openContext }));
    const target = cardTarget();

    expect(router.route({ kind: 'down', button: 2, ctrl: false, clickCount: 1, target, sceneRevision: 3 })).toBe(true);
    expect(openContext).toHaveBeenCalledWith(target);
    expect(router.pending()).toBeUndefined();
  });
});

describe('Kanban intent handler isolation', () => {
  it('contains handler and diagnostic failures without leaking callback payloads', () => {
    const observations: KanbanObservation[] = [];
    const handler = vi.fn((_intent: KanbanInteractionIntent) => {
      throw new Error('application-secret');
    });
    const router = new KanbanIntentRouter({
      handler,
      observe: (observation) => observations.push(observation),
    });

    expect(
      router.deliver(
        { kind: 'scoped-action', origin: 'pointer', actionId: 'collapse', scope: { kind: 'board' } },
        SELECTION,
      ),
    ).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    expect(Object.isFrozen(handler.mock.calls[0]?.[0])).toBe(true);
    expect(observations).toEqual([{ code: 'interaction-handler-failed', scope: 'board' }]);
    expect(JSON.stringify(observations)).not.toContain('application-secret');

    const failingObserver = new KanbanIntentRouter({
      handler,
      observe: () => {
        throw new Error('diagnostic-secret');
      },
    });
    expect(
      failingObserver.deliver(
        { kind: 'scoped-action', origin: 'keyboard', actionId: 'configure', scope: { kind: 'board' } },
        SELECTION,
      ),
    ).toBe(true);
  });
});
