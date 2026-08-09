import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
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
