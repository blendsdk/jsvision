import { Button, ListBox, Text, col, fixed, grow, onCleanup, row, signal } from '@jsvision/ui';
import { KanbanBoard, createEagerKanbanDataSource } from '@jsvision/kanban';
import type { KanbanOperationId, KanbanOperationState, KanbanRequest, KanbanRequestResult } from '@jsvision/kanban';

import type {
  KanbanPhaseCPointerHost,
  KanbanPhaseCScenario,
  KanbanPhaseCScenarioEvidence,
  KanbanPhaseCStoryDriver,
  KanbanStory,
} from '../story.js';
import { SHOWCASE_CARD_ADAPTER, SHOWCASE_COLUMNS } from '../work-items.js';
import type { ShowcaseCard } from '../work-items.js';

const QUERY = Object.freeze({ filters: Object.freeze([]), sort: Object.freeze([]), viewRevision: 'modern-v1' });
const SCENARIOS: readonly KanbanPhaseCScenario[] = Object.freeze([
  'warning',
  'blocked',
  'unavailable',
  'pending',
  'rejected',
  'publication',
  'bulk',
  'autoscroll',
]);

/** Cards keep the drag source and destination visible while providing enough rows for autoscroll. */
function initialCards(): readonly ShowcaseCard[] {
  return Object.freeze([
    Object.freeze({ key: 1, columnId: 'active', title: 'Drag release candidate', status: 'In progress' }),
    Object.freeze({ key: 3, columnId: 'active', title: 'Atomic companion card', status: 'In progress' }),
    Object.freeze({ key: 4, columnId: 'active', title: 'Visible placement anchor', status: 'In progress' }),
    Object.freeze({ key: 2, columnId: 'active', title: 'Drop target anchor', status: 'In progress' }),
    ...Array.from({ length: 18 }, (_, index) =>
      Object.freeze({
        key: 20 + index,
        columnId: index % 3 === 0 ? 'backlog' : index % 3 === 1 ? 'active' : 'done',
        title: `Scrollable work item ${String(index + 1).padStart(2, '0')}`,
        status: index % 2 === 0 ? 'In progress' : 'Done',
      }),
    ),
  ]);
}

/** Resolves microtask-backed interaction and coordinator queues without host-time assumptions. */
async function settleQueues(): Promise<void> {
  for (let index = 0; index < 16; index += 1) await Promise.resolve();
}

/** Returns one absolute point safely inside a detached viewport-local rectangle. */
function absolutePoint(
  host: KanbanPhaseCPointerHost,
  rectangle: Readonly<{ x: number; y: number; width: number; height: number }>,
): Readonly<{ x: number; y: number }> {
  const origin = host.origin();
  if (origin === null) throw new Error('The modern Kanban story must be mounted before it can be exercised.');
  return Object.freeze({
    x: origin.x + rectangle.x + Math.min(1, Math.max(0, rectangle.width - 1)) + 1,
    y: origin.y + rectangle.y + Math.min(1, Math.max(0, rectangle.height - 1)) + 1,
  });
}

/** Mutable deferred result retained only until the application settles or cancels one request. */
interface PendingResult {
  readonly operationId: KanbanOperationId;
  resolve(result: KanbanRequestResult): void;
}

/** Builds the truthful modern interaction story and its bounded mounted verification driver. */
function buildModernInteractionStory() {
  const cards = signal(initialCards());
  const activity = signal('Try: drag the first card to In progress · warnings confirm · blocked targets stay put');
  let scenario: KanbanPhaseCScenario = 'warning';
  let dispatcherCalls = 0;
  let confirmationCalls = 0;
  let activeTimers = 0;
  let captureLeases = 0;
  let disposed = false;
  let exerciseGeneration = 0;
  let boundHost: KanbanPhaseCPointerHost | undefined;
  let subscriptionActive = true;
  let lifecycle: KanbanOperationState[] = [];
  let movedCardKeys: readonly (string | number)[] = Object.freeze([]);
  const pending = new Map<KanbanOperationId, PendingResult>();
  const delays = new Map<ReturnType<typeof setTimeout>, () => void>();

  const source = createEagerKanbanDataSource(cards, {
    columns: () => SHOWCASE_COLUMNS,
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });

  /** Application-owned dispatcher deliberately never mutates the source projection. */
  const dispatcher = (request: KanbanRequest): KanbanRequestResult | Promise<KanbanRequestResult> => {
    dispatcherCalls += 1;
    movedCardKeys = Object.freeze(
      request.kind === 'card-move' ? request.moved.map(({ cardKey }) => cardKey) : Object.freeze([]),
    );
    if (scenario === 'pending') {
      return new Promise<KanbanRequestResult>((resolve) => {
        pending.set(request.operationId, Object.freeze({ operationId: request.operationId, resolve }));
      });
    }
    if (scenario === 'rejected') {
      return Object.freeze({ kind: 'rejected', operationId: request.operationId, code: 'showcase-policy-rejected' });
    }
    return Object.freeze({ kind: 'accepted', operationId: request.operationId });
  };

  const board = new KanbanBoard({
    source,
    query: () => QUERY,
    card: SHOWCASE_CARD_ADAPTER,
    density: () => 'compact',
    dispatcher,
    operationEligibility: () => {
      if (scenario === 'warning') return Object.freeze({ kind: 'warning' as const, code: 'wip-warning' });
      if (scenario === 'blocked' || scenario === 'autoscroll') {
        return Object.freeze({ kind: 'blocked' as const, code: 'transition-blocked' });
      }
      if (scenario === 'unavailable') {
        return Object.freeze({ kind: 'unavailable' as const, code: 'placement-loading' });
      }
      return Object.freeze({ kind: 'allowed' as const });
    },
    confirmOperation: () => {
      confirmationCalls += 1;
      return true;
    },
  });
  const unsubscribe = board.subscribeOperations((snapshot) => {
    lifecycle.push(snapshot.state);
  });

  /** Releases earlier accepted/pending work before the next independent demonstration. */
  async function resetScenario(next: KanbanPhaseCScenario): Promise<void> {
    exerciseGeneration += 1;
    for (const operation of board.operationSnapshot()) {
      const deferred = pending.get(operation.operationId);
      deferred?.resolve({ kind: 'cancelled', operationId: operation.operationId, code: 'showcase-reset' });
      pending.delete(operation.operationId);
      board.cancelOperation(operation.operationId);
    }
    await settleQueues();
    scenario = next;
    dispatcherCalls = 0;
    confirmationCalls = 0;
    lifecycle = [];
    movedCardKeys = Object.freeze([]);
    activity.set(`Scenario: ${next}`);
  }

  /** Waits for one story-owned delay that cleanup can synchronously cancel and settle. */
  function waitForAutoscroll(): Promise<void> {
    activeTimers += 1;
    return new Promise((resolve) => {
      const settle = (): void => {
        if (!delays.delete(handle)) return;
        activeTimers -= 1;
        resolve();
      };
      const handle = setTimeout(settle, 70);
      delays.set(handle, settle);
    });
  }

  /** Performs one genuine capture-backed pointer drag using current rendered card geometry. */
  async function dragToAnchor(
    host: KanbanPhaseCPointerHost,
    edge = false,
    requestedSourceKey?: string | number,
    requestedDestinationKey?: string | number,
  ): Promise<void> {
    host.flush();
    const inspection = board.inspection();
    const visible = inspection.actionTargets.filter(({ kind }) => kind === 'card');
    const sourceTarget =
      requestedSourceKey === undefined ? visible[0] : visible.find(({ cardKey }) => cardKey === requestedSourceKey);
    const destination =
      requestedDestinationKey === undefined
        ? visible.find(
            ({ cardKey, address }) =>
              cardKey !== sourceTarget?.cardKey && address?.columnId === sourceTarget?.address?.columnId,
          )
        : visible.find(({ cardKey }) => cardKey === requestedDestinationKey);
    if (sourceTarget === undefined || destination === undefined) {
      const visibleKeys = inspection.actionTargets
        .filter(({ kind }) => kind === 'card')
        .map(({ cardKey }) => String(cardKey))
        .join(',');
      throw new Error(`The modern Kanban story cannot find drag geometry among visible cards: ${visibleKeys}.`);
    }
    const down = absolutePoint(host, sourceTarget);
    const threshold = Object.freeze({ x: down.x + 2, y: down.y });
    const target = edge
      ? (() => {
          const origin = host.origin();
          if (origin === null) throw new Error('The modern Kanban story lost its mounted viewport.');
          const bounds = board.viewport.metrics().assignedRect;
          return Object.freeze({
            x: origin.x + Math.max(1, bounds.width - 2),
            y: origin.y + Math.max(1, bounds.height - 1),
          });
        })()
      : absolutePoint(host, destination);
    host.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
    host.dispatch({ type: 'mouse', kind: 'move', button: 0, ...threshold });
    captureLeases = 1;
    host.dispatch({ type: 'mouse', kind: 'drag', button: 0, ...target });
    if (edge) {
      const generation = exerciseGeneration;
      await waitForAutoscroll();
      if (disposed || generation !== exerciseGeneration) return;
    }
    host.dispatch({ type: 'mouse', kind: 'up', button: 0, ...target });
    captureLeases = 0;
    await settleQueues();
    host.flush();
  }

  /** Selects exactly two visible cards and returns a stable destination in another workflow lane. */
  async function prepareBulkSelection(
    host: KanbanPhaseCPointerHost,
  ): Promise<Readonly<{ sourceKey: string | number; destinationKey: string | number }>> {
    host.flush();
    const visible = board.inspection().actionTargets.filter(({ kind }) => kind === 'card');
    const first = visible[0];
    const sameCell = visible.filter(({ address }) => address?.columnId === first?.address?.columnId);
    const companion = sameCell[1];
    const destination = visible.find(({ address }) => address?.columnId !== first?.address?.columnId);
    if (first?.cardKey === undefined || companion?.cardKey === undefined || destination?.cardKey === undefined) {
      throw new Error('The modern Kanban story needs two source cards and a visible destination for atomic drag.');
    }
    const point = absolutePoint(host, first);
    host.dispatch({ type: 'mouse', kind: 'down', button: 0, ...point });
    host.dispatch({ type: 'mouse', kind: 'up', button: 0, ...point });
    await settleQueues();
    host.dispatch({ type: 'key', key: 'down', ctrl: false, alt: false, shift: false });
    host.dispatch({ type: 'key', key: 'space', ctrl: false, alt: false, shift: false });
    await settleQueues();
    host.flush();
    return Object.freeze({ sourceKey: first.cardKey, destinationKey: destination.cardKey });
  }

  const driver: KanbanPhaseCStoryDriver = Object.freeze({
    bind: (host: KanbanPhaseCPointerHost) => {
      if (disposed) throw new Error('The modern Kanban story driver has been disposed.');
      boundHost = host;
    },
    exercise: async (
      next: KanbanPhaseCScenario,
      host: KanbanPhaseCPointerHost,
    ): Promise<KanbanPhaseCScenarioEvidence> => {
      if (disposed) throw new Error('The modern Kanban story driver has been disposed.');
      await resetScenario(next);
      const generation = exerciseGeneration;
      const beforeColumns = new Map(cards().map((card) => [card.key, card.columnId]));
      const scrollBefore = Object.freeze({ ...board.viewport.metrics().offsets });
      const bulkSelection = next === 'bulk' ? await prepareBulkSelection(host) : undefined;
      await dragToAnchor(host, next === 'autoscroll', bulkSelection?.sourceKey, bulkSelection?.destinationKey);
      if (disposed || generation !== exerciseGeneration) {
        throw new Error('The modern Kanban interaction was cancelled during story teardown.');
      }

      const sourceChangedBeforePublication = movedCardKeys.some(
        (key) => cards().find((card) => card.key === key)?.columnId !== beforeColumns.get(key),
      );
      let sourceChangedAfterPublication = sourceChangedBeforePublication;
      if (next === 'publication') {
        const accepted = board.operationSnapshot().find(({ state }) => state === 'accepted');
        if (accepted === undefined) throw new Error('The publication scenario did not reach accepted state.');
        const moved = new Set(movedCardKeys);
        cards.set(
          cards().map((card) => {
            if (!moved.has(card.key)) return card;
            return Object.freeze({ ...card, columnId: card.columnId === 'done' ? 'backlog' : 'done' });
          }),
        );
        board.reconcilePublication({ kind: 'confirmed', operationId: accepted.operationId });
        await settleQueues();
        host.flush();
        sourceChangedAfterPublication = movedCardKeys.some(
          (key) => cards().find((card) => card.key === key)?.columnId !== beforeColumns.get(key),
        );
        activity.set('Published and committed by the application source');
      } else if (next === 'rejected') {
        activity.set('Move rejected; authoritative cards remain unchanged');
      } else if (next === 'pending') {
        activity.set('Move pending; source waits for application publication');
      } else if (next === 'warning') {
        activity.set('Warning confirmed; move is pending publication');
      } else if (next === 'blocked') {
        activity.set('Blocked target; no request was dispatched');
      } else if (next === 'unavailable') {
        activity.set('Target unavailable; retry after placement data becomes current');
      } else if (next === 'bulk') {
        activity.set('Atomic selected-card block submitted once');
      } else {
        activity.set('Pointer edge autoscrolled the board deterministically');
      }
      return Object.freeze({
        inputOrigin: 'pointer' as const,
        ...(next === 'warning' || next === 'blocked' || next === 'unavailable' ? { targetState: next } : {}),
        dispatcherCalls,
        confirmationCalls,
        lifecycleStates: Object.freeze([...lifecycle]),
        movedCardKeys,
        sourceChangedBeforePublication,
        sourceChangedAfterPublication,
        scrollBefore,
        scrollAfter: Object.freeze({ ...board.viewport.metrics().offsets }),
        activity: activity(),
      });
    },
    snapshot: () =>
      Object.freeze({
        disposed,
        timers: activeTimers,
        captureLeases,
        subscriptions: subscriptionActive ? 1 : 0,
      }),
  });

  onCleanup(() => {
    exerciseGeneration += 1;
    captureLeases = 0;
    boundHost = undefined;
    for (const [handle, settle] of [...delays]) {
      clearTimeout(handle);
      settle();
    }
    for (const operation of board.operationSnapshot()) board.cancelOperation(operation.operationId);
    for (const deferred of pending.values()) {
      deferred.resolve({ kind: 'cancelled', operationId: deferred.operationId, code: 'showcase-disposed' });
    }
    pending.clear();
    unsubscribe();
    subscriptionActive = false;
    disposed = true;
  });

  const selectedScenario = signal(0);
  const scenarioList = new ListBox({
    items: signal(SCENARIOS.map((entry) => entry)),
    focused: selectedScenario,
    selected: selectedScenario,
    typeAhead: true,
  });
  const runScenario = new Button('~R~un scenario', {
    onClick: () => {
      const host = boundHost;
      const selected = SCENARIOS[selectedScenario()];
      if (host === undefined || selected === undefined) {
        activity.set('Scenario controls are waiting for the mounted application host');
        return;
      }
      void driver.exercise(selected, host).catch(() => {
        if (!disposed) activity.set('Scenario cancelled while the story was changing');
      });
    },
  });

  const view = col(
    { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
    fixed(new Text('Choose a scenario, then Run. Drag cards directly with the mouse at any time.'), 1),
    fixed(row({ gap: 1 }, grow(scenarioList), fixed(runScenario, 16)), 2),
    grow(board),
    fixed(new Text(() => `Activity: ${activity()}`), 1),
  );
  return { view, board, activity, phaseC: driver };
}

/** Permanent story showing modern pointer and application-authority behavior in one live board. */
export const MODERN_INTERACTION_STORY: KanbanStory = {
  id: 'kanban/modern-interaction',
  category: 'Interaction',
  title: 'Modern drag & operation lab',
  blurb: 'Run warning, blocked, unavailable, pending/rejected, publication, bulk, and edge-scroll scenarios.',
  build: buildModernInteractionStory,
};
