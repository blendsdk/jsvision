import { Button, Text, col, fixed, grow, onCleanup, row } from '@jsvision/ui';
import { createKanbanBoardId, createKanbanEventHub } from '@jsvision/kanban';
import type {
  KanbanActionDefinition,
  KanbanActionCapabilityContext,
  KanbanActionInvocation,
  KanbanBoardActionOptions,
  KanbanHistoryProvider,
} from '@jsvision/kanban';

import type { KanbanStory } from '../story.js';
import { createShowcaseBoard } from '../work-items.js';
import type { ShowcaseCard } from '../work-items.js';

/** Cards provide targets for selection, focus, move, and custom-action events. */
const ACTION_CARDS: readonly ShowcaseCard[] = Object.freeze([
  Object.freeze({ key: 801, columnId: 'backlog', title: 'Inspect action routing', status: 'Ready' }),
  Object.freeze({ key: 802, columnId: 'active', title: 'Observe event ordering', status: 'In progress' }),
  Object.freeze({ key: 803, columnId: 'done', title: 'Review local history', status: 'Done' }),
]);

/** Permanent story for one shared action graph and bounded payload-free event history. */
export const ACTIONS_HISTORY_STORY: KanbanStory = {
  id: 'kanban/actions-history',
  category: 'Actions',
  title: 'Actions & history',
  blurb: 'Try a custom action, move cards, and inspect the bounded event history shared by every input origin.',
  build: () => {
    const boardId = createKanbanBoardId('showcase-actions-history');
    const events = createKanbanEventHub({ boardId, retained: 16 });
    let readOnly = false;
    let historyBuilds = 0;
    let setActivity = (_message: string): void => undefined;
    const inspectAction: KanbanActionDefinition = Object.freeze({
      id: 'showcase.inspect-events',
      category: 'application',
      labelMessageId: 'showcase.inspect-events.label',
      helpMessageId: 'showcase.inspect-events.help',
      target: 'board',
      capability: 'showcase.inspect-events',
      bindings: Object.freeze([]),
      handler: () => {
        setActivity(`Custom action handled · ${events.snapshot().length} retained events`);
        return Object.freeze({ kind: 'handled' as const });
      },
    });
    const history: KanbanHistoryProvider = Object.freeze({
      availability: () =>
        Object.freeze({
          revision: `showcase-history-${String(historyBuilds)}`,
          undo: Object.freeze({ labelMessageId: 'showcase.history.undo' }),
          redo: Object.freeze({ labelMessageId: 'showcase.history.redo' }),
        }),
      subscribe: () => () => undefined,
      build: (direction: 'undo' | 'redo') => {
        historyBuilds += 1;
        setActivity(`Fresh ${direction} proposal ${String(historyBuilds)} built by the application`);
        return Object.freeze({ kind: 'card-archive' as const, cardKey: direction === 'undo' ? 802 : 803 });
      },
    });
    const actions: KanbanBoardActionOptions = Object.freeze({
      boardId,
      host: Object.freeze({ kind: 'terminal' as const, platform: 'linux' }),
      extensions: Object.freeze([inspectAction]),
      initialBindings: Object.freeze({
        bindings: Object.freeze([{ chord: 'ctrl+i', actionId: 'showcase.inspect-events' }]),
      }),
      capability: (context: KanbanActionCapabilityContext) =>
        readOnly && context.definition.mutation === true
          ? Object.freeze({ state: 'disabled' as const, reasonCode: 'read-only' as const })
          : Object.freeze({ state: 'allowed' as const }),
      history,
      executePackageAction: (invocation: KanbanActionInvocation) => {
        setActivity(`Package action · ${invocation.actionId} · ${invocation.origin}`);
        return Object.freeze({ kind: 'handled' as const });
      },
    });
    const result = createShowcaseBoard({
      cards: ACTION_CARDS,
      events,
      actions,
      initialActivity: 'Try: invoke the custom action, select a card, or drag between lanes',
    });
    setActivity = result.setActivity;
    const unsubscribe = events.subscribe((event) => {
      const detail = event.kind === 'action' ? `${event.actionId} · ${event.state}` : event.kind;
      setActivity(`Event ${event.sequence} · ${detail} · history ${events.snapshot().length}/16`);
    });
    onCleanup(() => {
      unsubscribe();
      events.dispose();
    });
    const invoke = new Button('~I~nvoke action', {
      onClick: () => {
        const outcome = result.board.actions()?.invoke('showcase.inspect-events', 'menu', { kind: 'board' });
        if (outcome === undefined) setActivity('Action surface unavailable');
      },
    });
    const keymap = new Button('~K~eymap route', {
      onClick: () => {
        const outcome = result.board
          .actions()
          ?.keyboard({ type: 'key', key: 'i', ctrl: true, alt: false, shift: false }, { kind: 'board' });
        setActivity(`Custom Ctrl+I route · ${outcome?.kind ?? 'unavailable'}`);
      },
    });
    const historyAction = new Button('~U~ndo', {
      onClick: () => {
        const outcome = result.board.actions()?.invoke('kanban.history.undo', 'status', { kind: 'board' });
        setActivity(`History invoked from status origin · ${outcome?.kind ?? 'unavailable'}`);
      },
    });
    const readOnlyAction = new Button('Read-~o~nly', {
      onClick: () => {
        readOnly = !readOnly;
        const affordance = result.board.actions()?.pointerAffordance('kanban.card.edit', {
          kind: 'card',
          cardKey: 801,
        });
        setActivity(`Read-only ${readOnly ? 'on' : 'off'} · edit enabled ${String(affordance?.enabled ?? false)}`);
      },
    });
    const summarize = new Button('Show ~h~istory', {
      onClick: () => setActivity(`Bounded history · ${events.snapshot().length} events retained`),
    });
    const view = col(
      { padding: { left: 1, right: 1, top: 0, bottom: 0 }, gap: 1 },
      fixed(new Text('Keyboard, pointer, menu, status, and code converge on one observable action route.'), 1),
      fixed(row({ gap: 1 }, grow(invoke), grow(keymap), grow(historyAction)), 2),
      fixed(row({ gap: 1 }, grow(readOnlyAction), grow(summarize)), 2),
      grow(result.board),
      fixed(new Text(() => `Activity: ${result.activity()}`), 1),
    );
    return { view, board: result.board, activity: result.activity };
  },
};
