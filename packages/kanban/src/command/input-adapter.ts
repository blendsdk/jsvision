import type {
  KanbanActionAffordance,
  KanbanActionInvocation,
  KanbanActionOrigin,
  KanbanActionOutcome,
  KanbanActionRouter,
  KanbanActionSelectionSnapshot,
  KanbanActionSourceSnapshot,
  KanbanActionInvocationTarget,
  KanbanActionViewSnapshot,
} from './types.js';
import type { KanbanBoardId } from '../contract/identity.js';
import type { KanbanActionKeyEvent } from './types.js';
import type { KanbanActionKeymap } from './keymap.js';

/** Record-free live state captured immediately before one input-origin action route. */
export interface KanbanActionInputContext {
  /** Exact board instance that owns the current input snapshot. */
  readonly boardId: KanbanBoardId;
  /** Current selection count only, never selected records. */
  readonly selection: KanbanActionSelectionSnapshot;
  /** Current bounded source lifecycle evidence. */
  readonly source: KanbanActionSourceSnapshot;
  /** Current view revision evidence. */
  readonly view: KanbanActionViewSnapshot;
}

/** Services used by the keyboard/pointer/chrome action adapter. */
export interface KanbanActionInputAdapterOptions {
  /** Current semantic keymap. */
  readonly keymap: KanbanActionKeymap;
  /** One shared action router used by every origin. */
  readonly router: KanbanActionRouter;
  /** Captures current record-free context once per route or affordance check. */
  readonly context: () => KanbanActionInputContext;
}

/** Origin-neutral adapter that keeps input surfaces out of private mutation helpers. */
export interface KanbanActionInputAdapter {
  /** Resolves and routes one keyboard event; unbound events return no outcome. */
  readonly keyboard: (
    event: KanbanActionKeyEvent,
    target: KanbanActionInvocationTarget,
  ) => KanbanActionOutcome | undefined;
  /** Routes one exact pointer action through the shared capability/handler path. */
  readonly pointer: (actionId: string, target: KanbanActionInvocationTarget) => KanbanActionOutcome;
  /** Routes one menu, context-menu, status, or programmatic action identically. */
  readonly invoke: (
    actionId: string,
    origin: Exclude<KanbanActionOrigin, 'keyboard' | 'pointer'>,
    target: KanbanActionInvocationTarget,
  ) => KanbanActionOutcome;
  /** Resolves whether one pointer action should participate in presentation and hit testing. */
  readonly pointerAffordance: (actionId: string, target: KanbanActionInvocationTarget) => KanbanActionAffordance;
}

/** Payload-free failure used when the application context seam cannot be safely read. */
const INPUT_CONTEXT_UNAVAILABLE: KanbanActionOutcome = Object.freeze({
  kind: 'unavailable',
  code: 'action-unavailable',
});
/** Inert pointer presentation used when current context is unavailable. */
const INPUT_AFFORDANCE_UNAVAILABLE: KanbanActionAffordance = Object.freeze({ visible: false, enabled: false });

/** Creates one detached invocation from a single current-context read. */
function invocation(
  options: KanbanActionInputAdapterOptions,
  actionId: string,
  origin: KanbanActionOrigin,
  target: KanbanActionInvocationTarget,
): KanbanActionInvocation | undefined {
  try {
    const context = options.context();
    return Object.freeze({
      actionId,
      boardId: context.boardId,
      origin,
      target,
      selection: context.selection,
      source: context.source,
      view: context.view,
    });
  } catch {
    return undefined;
  }
}

/**
 * Creates keyboard, pointer, and chrome adapters over one action router.
 *
 * The adapter never calls board mutation helpers directly. It captures only IDs, revisions, counts,
 * and source state, then lets the router enforce current capability and handler policy.
 *
 * @example
 * ```ts
 * const input = createKanbanActionInputAdapter({ keymap, router, context });
 * input.pointer('kanban.card.open', { kind: 'card', cardKey: 42 });
 * ```
 */
export function createKanbanActionInputAdapter(options: KanbanActionInputAdapterOptions): KanbanActionInputAdapter {
  const adapter: KanbanActionInputAdapter = {
    keyboard: (event, target) => {
      const actionId = options.keymap.resolve(event);
      if (actionId === undefined) return undefined;
      const request = invocation(options, actionId, 'keyboard', target);
      return request === undefined ? INPUT_CONTEXT_UNAVAILABLE : options.router.invoke(request);
    },
    pointer: (actionId, target) => {
      const request = invocation(options, actionId, 'pointer', target);
      return request === undefined ? INPUT_CONTEXT_UNAVAILABLE : options.router.invoke(request);
    },
    invoke: (actionId, origin, target) => {
      const request = invocation(options, actionId, origin, target);
      return request === undefined ? INPUT_CONTEXT_UNAVAILABLE : options.router.invoke(request);
    },
    pointerAffordance: (actionId, target) => {
      const request = invocation(options, actionId, 'pointer', target);
      return request === undefined ? INPUT_AFFORDANCE_UNAVAILABLE : options.router.affordance(request);
    },
  };
  return Object.freeze(adapter);
}
