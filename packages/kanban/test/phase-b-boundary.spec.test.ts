import { Group, Window, createApplication, createRenderRoot, resolveCapabilities, signal } from '@jsvision/ui';
import type { Application, DispatchEvent, View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import { KANBAN_NEUTRAL_INTERACTION_SNAPSHOT, KanbanBoard, createEagerKanbanDataSource } from '../src/index.js';
import type {
  KanbanCardAdapter,
  KanbanInteractionController,
  KanbanInteractionEnvironment,
  KanbanInteractionSnapshot,
  KanbanInteractionTransition,
  KanbanObservation,
  KanbanQuery,
} from '../src/index.js';
import { createWindowedKanbanFixture } from '../src/testing.js';

interface Card {
  readonly id: number;
  readonly columnId: string;
  readonly title: string;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const QUERY: KanbanQuery = Object.freeze({ filters: [], sort: [] });
const CARD: KanbanCardAdapter<Card> = {
  keyOf: (card) => card.id,
  titleOf: (card) => card.title,
  statusOf: () => 'Ready',
};

/** Mounts one board through the same public surface used by a host application. */
function mount(board: KanbanBoard<Card>) {
  board.setLayout({ position: 'fill' });
  const host = new Group();
  host.add(board);
  const render = createRenderRoot({ width: 40, height: 12 }, { caps: CAPS });
  render.mount(host);
  render.flush();
  return render;
}

/** Creates a populated eager source without retaining ownership of its application records. */
function source() {
  return createEagerKanbanDataSource<Card>(() => [{ id: 1, columnId: 'ready', title: 'Card' }], {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
}

/** Creates a multi-card eager source for mounted input and host-equivalence scenarios. */
function cardsSource(cards: () => readonly Card[]) {
  return createEagerKanbanDataSource<Card>(cards, {
    columns: () => [{ columnId: 'ready', label: 'Ready', revision: 1 }],
    keyOf: (card) => card.id,
    columnOf: (card) => card.columnId,
  });
}

/** Waits for serialized mounted-input work and semantic intent delivery. */
async function settleInput(): Promise<void> {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

/** Delivers a local event directly to a mounted viewport and returns handled evidence. */
function deliver(
  board: KanbanBoard<Card>,
  event: DispatchEvent['event'],
  local?: { readonly x: number; readonly y: number },
  clickCount?: number,
): DispatchEvent {
  const envelope: DispatchEvent = {
    event,
    handled: false,
    ...(local === undefined ? {} : { local }),
    ...(clickCount === undefined ? {} : { clickCount }),
  };
  board.viewport.onEvent(envelope);
  return envelope;
}

/** Returns one card target or fails with a contract-focused fixture error. */
function cardTarget(board: KanbanBoard<Card>, cardKey: number) {
  const target = board
    .inspection()
    .actionTargets.find((candidate) => candidate.kind === 'card' && candidate.cardKey === cardKey);
  if (target === undefined) throw new Error(`Expected mounted card target ${cardKey}.`);
  return target;
}

/** Returns all descendants created under a board without walking into its application-owned parent. */
function boardDescendants(board: KanbanBoard<Card>): readonly View[] {
  const descendants: View[] = [];
  const visit = (view: View): void => {
    descendants.push(view);
    if (view instanceof Group) view.children.forEach(visit);
  };
  board.children.forEach(visit);
  return descendants;
}

/** Mounts the same board either directly or inside one explicitly application-owned window. */
function mountApplicationHost(board: KanbanBoard<Card>, host: 'surface' | 'window'): Application {
  board.setLayout({ position: 'fill' });
  if (host === 'surface') {
    return createApplication({ content: board, viewport: { width: 40, height: 12 }, caps: CAPS });
  }
  const app = createApplication({ viewport: { width: 48, height: 18 }, caps: CAPS });
  const window = new Window('Application-owned Kanban host');
  window.setLayout({ rect: { x: 3, y: 2, width: 42, height: 15 } });
  window.add(board);
  app.desktop.addWindow(window);
  app.loop.renderRoot.flush();
  return app;
}

/** Converts one viewport-local target point into its host's absolute terminal coordinates. */
function absoluteTarget(
  app: Application,
  board: KanbanBoard<Card>,
  target: { readonly x: number; readonly y: number },
) {
  const origin = app.loop.renderRoot.originOf(board.viewport);
  if (origin === null) throw new Error('Expected the mounted viewport to have a host origin.');
  return { x: origin.x + target.x + 1, y: origin.y + target.y + 1 };
}

/** Builds a complete injected controller with overridable lifecycle behavior. */
function controller(
  options: {
    readonly snapshot?: () => KanbanInteractionSnapshot;
    readonly transition?: (
      command: KanbanInteractionTransition,
    ) => ReturnType<KanbanInteractionController['transition']>;
    readonly subscribe?: (invalidate: () => void) => () => void;
    readonly dispose?: () => void;
  } = {},
): KanbanInteractionController {
  return {
    snapshot: options.snapshot ?? (() => KANBAN_NEUTRAL_INTERACTION_SNAPSHOT),
    transition: options.transition ?? (() => ({ kind: 'unchanged', snapshot: KANBAN_NEUTRAL_INTERACTION_SNAPSHOT })),
    subscribe: options.subscribe ?? (() => () => undefined),
    dispose: options.dispose ?? (() => undefined),
  };
}

describe('Kanban Phase B controller ownership boundary', () => {
  it('should keep one stable facade while one injected controller owns state and disposal', async () => {
    // The board facade remains stable across mount while the factory controller is created and disposed exactly once.
    const dispose = vi.fn();
    let invalidateController: (() => void) | undefined;
    const transition = vi.fn(() => ({ kind: 'unchanged' as const, snapshot: KANBAN_NEUTRAL_INTERACTION_SNAPSHOT }));
    const injected = controller({
      transition,
      dispose,
      subscribe: (invalidate) => {
        invalidateController = invalidate;
        return () => undefined;
      },
    });
    const factory = vi.fn((_environment: KanbanInteractionEnvironment) => injected);
    const board = new KanbanBoard({ source: source(), query: () => QUERY, card: CARD, interactionFactory: factory });
    const beforeMount = board.interaction();
    const render = mount(board);

    expect(board.interaction()).toBe(beforeMount);
    expect(factory).toHaveBeenCalledOnce();
    const subscriber = vi.fn();
    const unsubscribe = beforeMount.subscribe(subscriber);
    invalidateController?.();
    expect(subscriber).toHaveBeenCalledOnce();
    await beforeMount.transition({ kind: 'navigate', direction: 'board-start' });
    expect(transition).toHaveBeenCalledOnce();
    unsubscribe();
    render.unmount();
    board.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('should expose only bounded scene services to an interaction factory', () => {
    // Factory code receives semantic scene/revision/reveal/acquire/feedback services, never records or host handles.
    let received: KanbanInteractionEnvironment | undefined;
    const board = new KanbanBoard({
      source: source(),
      query: () => QUERY,
      card: CARD,
      interactionFactory: (environment) => {
        received = environment;
        return controller();
      },
    });
    const render = mount(board);

    expect(received).toBeDefined();
    expect(Object.keys(received ?? {}).sort()).toEqual([
      'acquire',
      'feedback',
      'invalidate',
      'reveal',
      'revisions',
      'scene',
    ]);
    expect(received).not.toHaveProperty('cards');
    expect(received).not.toHaveProperty('host');
    expect(received).not.toHaveProperty('viewport');
    render.unmount();
  });

  it('should reject a mixed legacy identity seed and controller factory before acquiring resources', () => {
    // A deprecated identity seed may initialize only the default controller and cannot compete with an injected owner.
    const factory = vi.fn(() => controller());
    expect(
      () =>
        new KanbanBoard({
          source: source(),
          query: () => QUERY,
          card: CARD,
          identity: () => ({ focusedCardKey: 1, selectedCardKeys: [1] }),
          interactionFactory: factory,
        }),
    ).toThrow();
    expect(factory).not.toHaveBeenCalled();
  });

  it('should reject controller reuse without transferring its ownership twice', async () => {
    // One controller instance belongs to one board, so a second board cannot subscribe to or dispose the same owner.
    const dispose = vi.fn();
    const injected = controller({ dispose });
    const first = new KanbanBoard({
      source: source(),
      query: () => QUERY,
      card: CARD,
      interactionFactory: () => injected,
    });
    const second = new KanbanBoard({
      source: source(),
      query: () => QUERY,
      card: CARD,
      interactionFactory: () => injected,
    });
    const firstRender = mount(first);

    const secondRender = mount(second);
    expect(second.interaction().snapshot()).toEqual(KANBAN_NEUTRAL_INTERACTION_SNAPSHOT);
    await expect(
      second.interaction().transition({ kind: 'navigate', direction: 'board-start' }),
    ).resolves.toMatchObject({ kind: 'unavailable' });
    firstRender.unmount();
    secondRender.unmount();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it.each(['factory', 'snapshot', 'subscribe'] as const)(
    'should roll back source and controller resources atomically when %s setup fails',
    async (failure) => {
      // Failed setup releases every acquired session/cursor/controller and leaves the stable facade permanently unavailable.
      const fixture = createWindowedKanbanFixture<Card>({
        logicalCardCount: 10,
        columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
        materialize: ({ start, end }) =>
          Array.from({ length: end - start }, (_, offset) => ({
            id: start + offset,
            columnId: 'ready',
            title: `Card ${start + offset}`,
          })),
        keyOf: (card) => card.id,
      });
      const dispose = vi.fn();
      const injected = controller({
        dispose,
        ...(failure === 'snapshot'
          ? {
              snapshot: () => {
                throw new Error('snapshot-secret');
              },
            }
          : {}),
        ...(failure === 'subscribe'
          ? {
              subscribe: () => {
                throw new Error('subscribe-secret');
              },
            }
          : {}),
      });
      const observations: KanbanObservation[] = [];
      const board = new KanbanBoard({
        source: fixture.source,
        query: () => QUERY,
        card: CARD,
        observe: (observation) => observations.push(observation),
        interactionFactory: () => {
          if (failure === 'factory') throw new Error('factory-secret');
          return injected;
        },
      });
      const render = mount(board);
      const metrics = fixture.metrics();

      expect(metrics.openedSessions).toBe(1);
      expect(metrics.disposedSessions).toBe(1);
      expect(metrics.disposedCursors).toBe(metrics.createdCursors);
      expect(dispose).toHaveBeenCalledTimes(failure === 'factory' ? 0 : 1);
      expect(board.interaction().snapshot()).toEqual(KANBAN_NEUTRAL_INTERACTION_SNAPSHOT);
      await expect(
        board.interaction().transition({ kind: 'navigate', direction: 'board-start' }),
      ).resolves.toMatchObject({ kind: 'unavailable' });
      expect(JSON.stringify(observations)).not.toMatch(/factory-secret|snapshot-secret|subscribe-secret/u);
      expect(observations).toHaveLength(1);
      render.unmount();
      fixture.dispose();
    },
  );

  it('should contain transition failure and preserve the last valid snapshot', async () => {
    // Controller failure settles as typed unavailability and cannot escape or corrupt already-published interaction state.
    const observations: KanbanObservation[] = [];
    const before = Object.freeze({
      ...KANBAN_NEUTRAL_INTERACTION_SNAPSHOT,
      revision: 3,
      focused: Object.freeze({ kind: 'column-header' as const, columnId: 'ready' }),
    });
    const injected = controller({
      snapshot: () => before,
      transition: () => {
        throw new Error('transition-secret');
      },
    });
    const board = new KanbanBoard({
      source: source(),
      query: () => QUERY,
      card: CARD,
      observe: (observation) => observations.push(observation),
      interactionFactory: () => injected,
    });
    const render = mount(board);
    const result = await board.interaction().transition({ kind: 'navigate', direction: 'board-end' });

    expect(result).toMatchObject({ kind: 'unavailable' });
    expect(board.interaction().snapshot()).toEqual(before);
    expect(JSON.stringify(observations)).not.toContain('transition-secret');
    render.unmount();
  });

  it('should serialize transitions without allowing a later command to overtake pending work', async () => {
    // Facade serialization prevents a later command from overtaking an unresolved earlier controller transition.
    const order: string[] = [];
    let settleFirst: (() => void) | undefined;
    const injected = controller({
      transition: (command) => {
        const label = command.kind === 'navigate' ? command.direction : command.kind;
        order.push(`start:${label}`);
        if (label === 'board-end') {
          return new Promise((resolve) => {
            settleFirst = () => {
              order.push(`finish:${label}`);
              resolve({ kind: 'unchanged', snapshot: KANBAN_NEUTRAL_INTERACTION_SNAPSHOT });
            };
          });
        }
        order.push(`finish:${label}`);
        return { kind: 'unchanged', snapshot: KANBAN_NEUTRAL_INTERACTION_SNAPSHOT };
      },
    });
    const board = new KanbanBoard({
      source: source(),
      query: () => QUERY,
      card: CARD,
      interactionFactory: () => injected,
    });
    const render = mount(board);
    const first = board.interaction().transition({ kind: 'navigate', direction: 'board-end' });
    const second = board.interaction().transition({ kind: 'navigate', direction: 'board-start' });
    expect(order).toEqual(['start:board-end']);
    settleFirst?.();
    await Promise.all([first, second]);

    expect(order).toEqual(['start:board-end', 'finish:board-end', 'start:board-start', 'finish:board-start']);
    render.unmount();
  });
});

describe('Kanban Phase B mounted host and input boundary', () => {
  it('should produce equivalent semantics on a surface and in an application-owned window', async () => {
    // Hosting changes only parent geometry; the same semantic input sequence has identical board outcomes.
    const outcomes: unknown[] = [];
    for (const host of ['surface', 'window'] as const) {
      const intents: unknown[] = [];
      const records = Array.from({ length: 8 }, (_, index) => ({
        id: index + 1,
        columnId: 'ready',
        title: `Card ${index + 1}`,
      }));
      const board = new KanbanBoard({
        source: cardsSource(() => records),
        query: () => QUERY,
        card: CARD,
        onInteraction: (intent: unknown) => intents.push(intent),
      });
      const app = mountApplicationHost(board, host);
      app.loop.renderRoot.flush();
      const target = absoluteTarget(app, board, cardTarget(board, 2));

      app.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...target });
      app.loop.dispatch({ type: 'mouse', kind: 'up', button: 0, ...target });
      await settleInput();
      app.loop.dispatch({ type: 'key', key: 'up', ctrl: false, alt: false, shift: false });
      app.loop.dispatch({ type: 'key', key: 'space', ctrl: false, alt: false, shift: false });
      app.loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift: false });
      await settleInput();
      board.scrollTo({ y: 3 });
      app.loop.renderRoot.flush();

      const inspection = board.inspection();
      expect(board.interaction().snapshot().focused).toMatchObject({ kind: 'card', cardKey: 1 });
      expect(board.interaction().snapshot().selectedCardKeys).toEqual([2, 1]);
      expect(board.viewport.metrics().offsets.y).toBeGreaterThan(0);
      expect(intents).toHaveLength(1);
      expect(intents[0]).toMatchObject({ kind: 'open-card', origin: 'keyboard' });
      outcomes.push({
        scene: {
          columns: inspection.visibleColumns.map(({ columnId }) => columnId),
          cards: inspection.visibleCards.map(({ cardKey }) => cardKey),
          targets: inspection.actionTargets.map(({ kind, cardKey }) => ({ kind, cardKey })),
        },
        interaction: board.interaction().snapshot(),
        scroll: board.viewport.metrics().offsets,
        intents,
      });
      const ownedDescendants = boardDescendants(board);
      expect(ownedDescendants.map((view) => view.constructor.name)).not.toEqual(
        expect.arrayContaining(['Window', 'Dialog']),
      );
      expect(Reflect.has(board, 'shadow')).toBe(false);
      app.loop.dispose();
      board.dispose();
    }

    expect(outcomes).toHaveLength(2);
    expect(outcomes[1]).toEqual(outcomes[0]);
  });

  it('should cancel a pending primary press before controller and source disposal and ignore late settlement', async () => {
    // Disposal rejects input first, cancels the pending press, then releases controller and source ownership once.
    const fixture = createWindowedKanbanFixture<Card>({
      logicalCardCount: 20,
      columns: [{ columnId: 'ready', label: 'Ready', revision: 1 }],
      materialize: ({ start, end }) =>
        Array.from({ length: end - start }, (_, offset) => ({
          id: start + offset,
          columnId: 'ready',
          title: `Card ${start + offset}`,
        })),
      keyOf: (card) => card.id,
    });
    let settleTransition: ((result: ReturnType<KanbanInteractionController['transition']>) => void) | undefined;
    const transitions: KanbanInteractionTransition[] = [];
    const intents: unknown[] = [];
    let disposalUp: DispatchEvent | undefined;
    const disposeController = vi.fn(() => {
      expect(fixture.metrics().disposedSessions).toBe(0);
      disposalUp = deliver(
        board,
        { type: 'mouse', kind: 'up', button: 0, x: targetPoint.x, y: targetPoint.y },
        targetPoint,
      );
    });
    const injected = controller({
      transition: (command) => {
        transitions.push(command);
        if (command.kind !== 'focus') {
          return { kind: 'unchanged', snapshot: KANBAN_NEUTRAL_INTERACTION_SNAPSHOT };
        }
        return new Promise((resolve) => {
          settleTransition = resolve;
        });
      },
      dispose: disposeController,
    });
    const board = new KanbanBoard({
      source: fixture.source,
      query: () => QUERY,
      card: CARD,
      interactionFactory: () => injected,
      onInteraction: (intent: unknown) => intents.push(intent),
    });
    const render = mount(board);
    for (const pending of fixture.controller.pendingRanges()) fixture.controller.resolveRange(pending.requestId);
    await settleInput();
    render.flush();
    const target = cardTarget(board, 0);
    const targetPoint = { x: target.x, y: target.y };
    const transitionsBeforeDown = transitions.length;
    const down = deliver(board, { type: 'mouse', kind: 'down', button: 0, x: target.x, y: target.y }, targetPoint, 1);
    expect(down.handled).toBe(true);
    expect(transitions).toHaveLength(transitionsBeforeDown + 1);

    board.dispose();
    board.dispose();
    expect(disposalUp?.handled).toBe(false);
    expect(transitions).toHaveLength(transitionsBeforeDown + 1);
    expect(disposeController).toHaveBeenCalledOnce();
    expect(fixture.metrics().disposedSessions).toBe(1);
    expect(fixture.metrics().disposedCursors).toBe(fixture.metrics().createdCursors);

    settleTransition?.({
      kind: 'changed',
      snapshot: Object.freeze({
        revision: 1,
        focused: Object.freeze({ kind: 'card', cardKey: 0, address: Object.freeze({ columnId: 'ready' }) }),
        selectedCardKeys: Object.freeze([0]),
      }),
    });
    await settleInput();
    const lateUp = deliver(board, { type: 'mouse', kind: 'up', button: 0, x: target.x, y: target.y }, targetPoint);
    expect(lateUp.handled).toBe(false);
    expect(board.interaction().snapshot()).toEqual(KANBAN_NEUTRAL_INTERACTION_SNAPSHOT);
    expect(intents).toEqual([]);

    render.unmount();
    fixture.dispose();
  });

  it('should use Ctrl as the only mounted Primary transport while keeping the programmatic equivalent available', async () => {
    // Current input carries Ctrl but no Meta field; synthetic Meta-only input remains deferred and unhandled.
    const board = new KanbanBoard({
      source: cardsSource(() => [
        { id: 1, columnId: 'ready', title: 'One' },
        { id: 2, columnId: 'ready', title: 'Two' },
      ]),
      query: () => QUERY,
      card: CARD,
    });
    const render = mount(board);
    const ctrlA = deliver(board, { type: 'key', key: 'a', ctrl: true, alt: false, shift: false });
    await settleInput();
    expect(ctrlA.handled).toBe(true);
    expect(board.interaction().snapshot().selectedCardKeys).toEqual([1, 2]);

    await board.interaction().transition({ kind: 'selection', operation: 'clear-multiple' });
    const metaOnlyEvent = {
      type: 'key' as const,
      key: 'a',
      ctrl: false,
      alt: false,
      shift: false,
      meta: true,
    };
    const metaA = deliver(board, metaOnlyEvent);
    expect(metaA.handled).toBe(false);
    expect(board.interaction().snapshot().selectedCardKeys).toEqual([]);
    expect(
      'meta' in ({ type: 'key', key: 'a', ctrl: false, alt: false, shift: false } satisfies DispatchEvent['event']),
    ).toBe(false);

    const programmatic = await board
      .interaction()
      .transition({ kind: 'selection', operation: 'select-loaded-visible-matching' });
    expect(programmatic).toMatchObject({ kind: 'changed' });
    expect(board.interaction().snapshot().selectedCardKeys).toEqual([1, 2]);

    render.unmount();
  });

  it('should reject a disappeared pending target and clipped or non-actionable coordinates without side effects', async () => {
    // Matching up requires the original current target; stale, clipped, and gap coordinates stay inert.
    const cards = signal<readonly Card[]>([
      { id: 1, columnId: 'ready', title: 'One' },
      { id: 2, columnId: 'ready', title: 'Deferred target' },
    ]);
    const intents: unknown[] = [];
    const board = new KanbanBoard({
      source: cardsSource(cards),
      query: () => QUERY,
      card: CARD,
      onInteraction: (intent: unknown) => intents.push(intent),
    });
    const render = mount(board);
    const target = cardTarget(board, 2);
    const point = { x: target.x, y: target.y };
    const mounted = board.inspection();
    const firstCardRegion = mounted.regions.find((region) => region.kind === 'card' && region.cardKey === 1);
    const secondCardRegion = mounted.regions.find((region) => region.kind === 'card' && region.cardKey === 2);
    if (firstCardRegion === undefined || secondCardRegion === undefined) {
      throw new Error('Expected both card regions around the mounted inter-card gap.');
    }
    const gapPoint = { x: firstCardRegion.x, y: firstCardRegion.y + firstCardRegion.height };
    expect(secondCardRegion.y - gapPoint.y).toBeGreaterThan(0);
    expect(
      mounted.actionTargets.some(
        (candidate) =>
          gapPoint.x >= candidate.x &&
          gapPoint.x < candidate.x + candidate.width &&
          gapPoint.y >= candidate.y &&
          gapPoint.y < candidate.y + candidate.height,
      ),
    ).toBe(false);
    const down = deliver(board, { type: 'mouse', kind: 'down', button: 0, x: point.x, y: point.y }, point, 1);
    await settleInput();
    expect(down.handled).toBe(true);

    cards.set(cards().slice(0, 1));
    render.flush();
    await settleInput();
    render.flush();
    const beforeRejectedInput = board.interaction().snapshot();
    const staleUp = deliver(board, { type: 'mouse', kind: 'up', button: 0, x: point.x, y: point.y }, point);
    const clipped = deliver(board, { type: 'mouse', kind: 'down', button: 0, x: -1, y: -1 }, { x: -1, y: -1 }, 1);
    const nonActionable = deliver(
      board,
      { type: 'mouse', kind: 'down', button: 0, x: gapPoint.x, y: gapPoint.y },
      gapPoint,
      1,
    );

    expect([staleUp.handled, clipped.handled, nonActionable.handled]).toEqual([false, false, false]);
    expect(board.interaction().snapshot()).toEqual(beforeRejectedInput);
    expect(intents).toEqual([]);
    expect(cards()).toEqual([{ id: 1, columnId: 'ready', title: 'One' }]);

    render.unmount();
  });
});
