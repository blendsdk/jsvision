import type { KanbanActionKeymapHost } from '../command/defaults.js';
import { createKanbanActionInputAdapter } from '../command/input-adapter.js';
import type { KanbanActionInputAdapter, KanbanActionInputContext } from '../command/input-adapter.js';
import { createKanbanActionKeymap } from '../command/keymap.js';
import type { KanbanActionKeymap, KanbanActionKeymapReplacement } from '../command/keymap.js';
import { createKanbanActionRegistry } from '../command/registry.js';
import { createKanbanActionRouter } from '../command/router.js';
import type {
  KanbanActionDefinition,
  KanbanActionHandler,
  KanbanActionInvocation,
  KanbanActionInvocationTarget,
  KanbanActionKeyEvent,
  KanbanActionRegistry,
  KanbanActionRouter,
  KanbanActionTargetKind,
  KanbanActionTerminalOutcome,
  KanbanCapabilityProvider,
} from '../command/types.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import type { CardKey, KanbanBoardId } from '../contract/identity.js';
import { createKanbanBoardId } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import { createKanbanHistoryBinding } from '../event/history.js';
import type {
  KanbanEventHub,
  KanbanHistoryAuthority,
  KanbanHistoryBinding,
  KanbanHistoryProvider,
} from '../event/types.js';
import type { KanbanInteractionFacade } from '../interaction/facade.js';
import type { KanbanInteractionOrigin, KanbanScopedActionId } from '../interaction/intent.js';
import type { KanbanInteractionSnapshot, KanbanInteractionTransition } from '../interaction/types.js';
import type { KanbanActionScope } from '../layout/hit-map.js';
import type { KanbanSourceState } from '../source/states.js';
import type { KanbanCellAddress } from '../source/types.js';

/**
 * Optional board-owned action composition requested by one Kanban board.
 *
 * @example
 * ```ts
 * const actions: KanbanBoardActionOptions = {
 *   boardId: createKanbanBoardId('work-items'),
 *   host: { kind: 'terminal', platform: 'linux' },
 * };
 * ```
 */
export interface KanbanBoardActionOptions {
  /** Stable identity included in every invocation and required to match the optional event hub. */
  readonly boardId: KanbanBoardId;
  /** Host facts used to resolve semantic Primary bindings. */
  readonly host: KanbanActionKeymapHost;
  /** Optional pure presentation capability policy. */
  readonly capability?: KanbanCapabilityProvider;
  /** Optional namespaced application actions appended to the package inventory. */
  readonly extensions?: readonly KanbanActionDefinition[];
  /** Optional atomic initial keymap replacement. */
  readonly initialBindings?: KanbanActionKeymapReplacement;
  /** Optional application-owned undo/redo availability and proposal builder. */
  readonly history?: KanbanHistoryProvider;
  /** Optional fallback for package actions whose application-specific UI is not configured. */
  readonly executePackageAction?: KanbanActionHandler;
}

/**
 * Public board-owned action surface shared by keyboard, pointer, chrome, and application callers.
 *
 * @example
 * ```ts
 * board.actions()?.invoke('kanban.help.open', 'programmatic', { kind: 'board' });
 * ```
 */
export interface KanbanBoardActionBinding extends KanbanActionInputAdapter {
  /** Immutable package-plus-application action inventory. */
  readonly registry: KanbanActionRegistry;
  /** Reactive conflict-validated semantic keymap. */
  readonly keymap: KanbanActionKeymap;
  /** Shared capability and lifecycle router. */
  readonly router: KanbanActionRouter;
}

/** @internal Current revision and lifecycle readers retained by one board action binding. */
export interface KanbanBoardActionStateServices {
  /** Reports whether the owning board has released its lifecycle. */
  readonly disposed: () => boolean;
  /** Reads current source lifecycle state without application records. */
  readonly sourceState: () => KanbanSourceState | undefined;
  /** Reads current session, query, and optional view revisions. */
  readonly revisions: () => {
    readonly sessionRevision: KanbanRevision;
    readonly queryGeneration: number;
    readonly viewRevision?: KanbanRevision;
  };
  /** Reads controller-owned view revision when a controller is present. */
  readonly viewRevision: () => KanbanRevision | undefined;
}

/** @internal Existing board interaction seams consumed without transferring ownership. */
export interface KanbanBoardActionInteractionServices {
  /** Reads current detached interaction state. */
  readonly snapshot: () => KanbanInteractionSnapshot;
  /** Queues one semantic transition synchronously. */
  readonly accept: KanbanInteractionFacade['accept'];
  /** Queues one card activation synchronously. */
  readonly activate: (origin: KanbanInteractionOrigin, scope: Extract<KanbanActionScope, { kind: 'card' }>) => boolean;
  /** Queues one semantic context activation synchronously. */
  readonly openContext: (origin: KanbanInteractionOrigin, scope: KanbanActionScope) => boolean;
  /** Queues one existing scoped application action synchronously. */
  readonly scopedAction: (
    actionId: KanbanScopedActionId,
    scope: KanbanActionScope,
    origin: KanbanInteractionOrigin,
  ) => boolean;
  /** Cancels the most recent transient operation layer. */
  readonly cancelTransient: () => boolean;
}

/** @internal Board projection and optional view-chrome services used to resolve action targets. */
export interface KanbanBoardActionProjectionServices {
  /** Resolves current semantic focus. */
  readonly focusedScope: () => KanbanActionScope;
  /** Resolves one visible card to its current semantic cell. */
  readonly visibleCardScope: (cardKey: CardKey) => Extract<KanbanActionScope, { kind: 'card' }> | undefined;
  /** Returns the first currently projected cell for create-card keyboard routing. */
  readonly firstCell: () => KanbanCellAddress | undefined;
  /** Clears controller-owned filters when a controller is configured. */
  readonly clearFilters: () => boolean;
  /** Focuses package search chrome when it is mounted. */
  readonly focusSearch: () => boolean;
}

/** @internal Internal board services retained by one optional action binding. */
export interface KanbanBoardActionBindingServices {
  /** Existing board authority used by optional application history. */
  readonly authority: KanbanHistoryAuthority;
  /** Optional board-scoped event stream. */
  readonly events?: KanbanEventHub;
  /** Current bounded source/view state readers. */
  readonly state: KanbanBoardActionStateServices;
  /** Existing semantic interaction routes. */
  readonly interaction: KanbanBoardActionInteractionServices;
  /** Existing projection and optional view-chrome routes. */
  readonly projection: KanbanBoardActionProjectionServices;
}

/** @internal Owned binding plus its mounted producer routes and terminal resource release. */
export interface OwnedKanbanBoardActionBinding {
  /** Public action surface returned by the board. */
  readonly binding: KanbanBoardActionBinding;
  /** Routes a mounted key, or returns undefined when the shared keymap has no binding. */
  readonly routeKey: (event: KanbanActionKeyEvent) => boolean | undefined;
  /** Routes one pointer action through shared capability and handler policy. */
  readonly pointer: (actionId: string, scope: KanbanActionScope | undefined) => boolean;
  /** Applies selection before pointer activation through the same action graph. */
  readonly selectThenPointer: (
    command: KanbanInteractionTransition,
    actionId: string,
    scope: Extract<KanbanActionScope, { kind: 'card' }> | undefined,
  ) => boolean;
  /** Maps a legacy scoped pointer action onto its stable package or extension identity. */
  readonly scopedPointer: (
    actionId: KanbanScopedActionId,
    scope: KanbanActionScope,
    origin: KanbanInteractionOrigin,
  ) => boolean;
  /** Reports whether card dragging may begin after the ordinary click threshold. */
  readonly canStartCardDrag: (scope: Extract<KanbanActionScope, { kind: 'card' }>) => boolean;
  /** Reports whether structural dragging may begin after the ordinary click threshold. */
  readonly canStartStructureDrag: (scope: Extract<KanbanActionScope, { kind: 'column' | 'swimlane' }>) => boolean;
  /** Releases router and optional history resources idempotently. */
  readonly dispose: () => void;
}

/** Converts one immediate route admission into the router's closed terminal outcome. */
function admission(accepted: boolean): KanbanActionTerminalOutcome {
  return accepted
    ? Object.freeze({ kind: 'handled' as const })
    : Object.freeze({ kind: 'unavailable' as const, code: 'action-unavailable' as const });
}

/** Creates the exact action-router target represented by one semantic board scope. */
function targetForScope(scope: KanbanActionScope | undefined): KanbanActionInvocationTarget {
  if (scope === undefined || scope.kind === 'board' || scope.kind === 'state') return Object.freeze({ kind: 'board' });
  if (scope.kind === 'column') return Object.freeze({ kind: 'column', columnId: scope.columnId });
  if (scope.kind === 'swimlane') return Object.freeze({ kind: 'swimlane', swimlaneId: scope.swimlaneId });
  if (scope.kind === 'cell') {
    return Object.freeze({
      kind: 'cell',
      columnId: scope.address.columnId,
      ...(scope.address.swimlaneId === undefined ? {} : { swimlaneId: scope.address.swimlaneId }),
    });
  }
  return Object.freeze({ kind: 'card', cardKey: scope.cardKey });
}

/** Resolves one declared action target kind from current semantic focus and projection. */
function targetForKind(
  kind: KanbanActionTargetKind,
  services: KanbanBoardActionBindingServices,
): KanbanActionInvocationTarget | undefined {
  const scope = services.projection.focusedScope();
  if (kind === 'board') return Object.freeze({ kind: 'board' });
  if (kind === 'any') return targetForScope(scope);
  if (kind === 'selection') {
    return Object.freeze({ kind: 'selection', ...(scope.kind === 'card' ? { focusedCardKey: scope.cardKey } : {}) });
  }
  if (kind === 'card') return scope.kind === 'card' ? targetForScope(scope) : undefined;
  if (kind === 'column') {
    const columnId =
      scope.kind === 'column' ? scope.columnId : scope.kind === 'card' ? scope.address.columnId : undefined;
    return columnId === undefined ? undefined : Object.freeze({ kind: 'column', columnId });
  }
  if (kind === 'swimlane') {
    const swimlaneId =
      scope.kind === 'swimlane' ? scope.swimlaneId : scope.kind === 'card' ? scope.address.swimlaneId : undefined;
    return swimlaneId === undefined ? undefined : Object.freeze({ kind: 'swimlane', swimlaneId });
  }
  const address = scope.kind === 'card' ? scope.address : services.projection.firstCell();
  return address === undefined
    ? undefined
    : Object.freeze({
        kind: 'cell',
        columnId: address.columnId,
        ...(address.swimlaneId === undefined ? {} : { swimlaneId: address.swimlaneId }),
      });
}

/** Converts one validated action target to the existing semantic interaction scope. */
function scopeForTarget(
  target: KanbanActionInvocationTarget,
  services: KanbanBoardActionBindingServices,
): KanbanActionScope | undefined {
  if (target.kind === 'board') return Object.freeze({ kind: 'board' });
  if (target.kind === 'column') return Object.freeze({ kind: 'column', columnId: target.columnId });
  if (target.kind === 'swimlane') return Object.freeze({ kind: 'swimlane', swimlaneId: target.swimlaneId });
  if (target.kind === 'cell') {
    return Object.freeze({
      kind: 'cell',
      address: Object.freeze({
        columnId: target.columnId,
        ...(target.swimlaneId === undefined ? {} : { swimlaneId: target.swimlaneId }),
      }),
    });
  }
  const cardKey = target.kind === 'card' ? target.cardKey : target.focusedCardKey;
  if (cardKey === undefined) return undefined;
  const focused = services.projection.focusedScope();
  if (focused.kind === 'card' && typeof focused.cardKey === typeof cardKey && focused.cardKey === cardKey) {
    return focused;
  }
  return services.projection.visibleCardScope(cardKey);
}

/** Captures bounded record-free action context from one current board state read. */
function context(boardId: KanbanBoardId, services: KanbanBoardActionBindingServices): KanbanActionInputContext {
  const revisions = services.state.revisions();
  const source = services.state.sourceState();
  const state = services.state.disposed()
    ? ('disposed' as const)
    : source?.kind === 'error'
      ? ('error' as const)
      : source === undefined || source.kind === 'loading' || source.kind === 'refreshing'
        ? ('loading' as const)
        : ('ready' as const);
  return Object.freeze({
    boardId,
    selection: Object.freeze({ count: services.interaction.snapshot().selectedCardKeys.length }),
    source: Object.freeze({
      state,
      revision: revisions.sessionRevision,
      queryRevision: revisions.queryGeneration,
    }),
    view: Object.freeze({ revision: services.state.viewRevision() ?? revisions.viewRevision }),
  });
}

/** Preserves the existing first-shift selection anchor before one range navigation action. */
function extendSelection(
  direction: 'left' | 'right' | 'up' | 'down',
  services: KanbanBoardActionBindingServices,
): KanbanActionTerminalOutcome {
  const snapshot = services.interaction.snapshot();
  if (
    snapshot.focused.kind === 'card' &&
    snapshot.rangeAnchor === undefined &&
    !services.interaction.accept({ kind: 'selection', operation: 'replace' })
  ) {
    return admission(false);
  }
  return admission(services.interaction.accept({ kind: 'navigate', direction, extendSelection: true }));
}

/** Maps one package command to an established interaction, view, or application authority seam. */
function executePackageAction(
  invocation: KanbanActionInvocation,
  services: KanbanBoardActionBindingServices,
): KanbanActionTerminalOutcome {
  const scope = scopeForTarget(invocation.target, services);
  switch (invocation.actionId) {
    case 'kanban.navigation.left':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'left' }));
    case 'kanban.navigation.right':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'right' }));
    case 'kanban.navigation.up':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'up' }));
    case 'kanban.navigation.down':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'down' }));
    case 'kanban.navigation.cell-first':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'home' }));
    case 'kanban.navigation.cell-last':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'end' }));
    case 'kanban.navigation.page-up':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'page-up' }));
    case 'kanban.navigation.page-down':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'page-down' }));
    case 'kanban.navigation.board-first':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'board-start' }));
    case 'kanban.navigation.board-last':
      return admission(services.interaction.accept({ kind: 'navigate', direction: 'board-end' }));
    case 'kanban.selection.toggle':
      return admission(services.interaction.accept({ kind: 'selection', operation: 'toggle' }));
    case 'kanban.selection.select-all':
      return admission(services.interaction.accept({ kind: 'selection', operation: 'select-loaded-visible-matching' }));
    case 'kanban.selection.clear':
      return admission(services.interaction.accept({ kind: 'selection', operation: 'clear-multiple' }));
    case 'kanban.selection.extend-left':
      return extendSelection('left', services);
    case 'kanban.selection.extend-right':
      return extendSelection('right', services);
    case 'kanban.selection.extend-up':
      return extendSelection('up', services);
    case 'kanban.selection.extend-down':
      return extendSelection('down', services);
    case 'kanban.card.open':
    case 'kanban.card.activate':
    case 'kanban.card.edit':
      return admission(scope?.kind === 'card' && services.interaction.activate(invocation.origin, scope));
    case 'kanban.context.open': {
      const contextScope = invocation.target.kind === 'board' ? services.projection.focusedScope() : scope;
      return admission(contextScope !== undefined && services.interaction.openContext(invocation.origin, contextScope));
    }
    case 'kanban.card.create':
      return admission(
        scope?.kind === 'cell' && services.interaction.scopedAction('add-card', scope, invocation.origin),
      );
    case 'kanban.column.configure':
    case 'kanban.swimlane.configure':
      return admission(scope !== undefined && services.interaction.scopedAction('configure', scope, invocation.origin));
    case 'kanban.filter.clear':
      return admission(services.projection.clearFilters());
    case 'kanban.search.focus':
      return admission(services.projection.focusSearch());
    case 'kanban.help.open':
      // Help remains a reachable no-op until an application or the standard chrome supplies a presenter.
      return admission(true);
    case 'kanban.card.cancel-move':
    case 'kanban.transient.cancel':
      return admission(services.interaction.cancelTransient());
    default:
      return admission(false);
  }
}

/** @internal Creates one optional board-owned action graph without owning the board's event hub. */
export function createKanbanBoardActionBinding(
  options: KanbanBoardActionOptions,
  services: KanbanBoardActionBindingServices,
): OwnedKanbanBoardActionBinding {
  const boardId = createKanbanBoardId(options.boardId);
  if (services.events !== undefined && services.events.boardId !== boardId) {
    throw new KanbanInvalidSemanticValueError();
  }
  const registry = createKanbanActionRegistry({
    executePackageAction: (invocation) => {
      const outcome = executePackageAction(invocation, services);
      if (outcome.kind !== 'unavailable' || options.executePackageAction === undefined) return outcome;
      return options.executePackageAction(invocation);
    },
    ...(options.extensions === undefined ? {} : { extensions: options.extensions }),
  });
  const keymap = createKanbanActionKeymap({
    registry,
    host: options.host,
    ...(options.initialBindings === undefined ? {} : { initial: options.initialBindings }),
  });
  const history: KanbanHistoryBinding | undefined =
    options.history === undefined
      ? undefined
      : createKanbanHistoryBinding({ authority: services.authority, provider: options.history });
  const router = createKanbanActionRouter({
    registry,
    ...(options.capability === undefined ? {} : { capability: options.capability }),
    ...(services.events === undefined ? {} : { events: services.events }),
    ...(history === undefined ? {} : { history }),
  });
  const input = createKanbanActionInputAdapter({ keymap, router, context: () => context(boardId, services) });
  const binding: KanbanBoardActionBinding = Object.freeze({
    registry,
    keymap,
    router,
    keyboard: input.keyboard,
    pointer: input.pointer,
    invoke: input.invoke,
    pointerAffordance: input.pointerAffordance,
  });
  const pointer = (actionId: string, scope: KanbanActionScope | undefined): boolean =>
    binding.pointer(actionId, targetForScope(scope)).kind !== 'unavailable';
  let disposed = false;
  const owned: OwnedKanbanBoardActionBinding = {
    binding,
    routeKey: (event) => {
      const actionId = keymap.resolve(event);
      if (actionId === undefined) return undefined;
      const definition = registry.action(actionId);
      const target = definition === undefined ? undefined : targetForKind(definition.target, services);
      if (target === undefined) return true;
      return binding.keyboard(event, target) !== undefined;
    },
    pointer,
    selectThenPointer: (command, actionId, scope) => services.interaction.accept(command) && pointer(actionId, scope),
    scopedPointer: (actionId, scope, origin) => {
      if (actionId === 'clear-filters') return pointer('kanban.filter.clear', scope);
      if (actionId === 'add-card') return pointer('kanban.card.create', scope);
      if (actionId === 'configure') {
        return pointer(scope.kind === 'swimlane' ? 'kanban.swimlane.configure' : 'kanban.column.configure', scope);
      }
      if (actionId === 'collapse') return services.interaction.scopedAction(actionId, scope, origin);
      return pointer(actionId, scope);
    },
    canStartCardDrag: (scope) => {
      const affordance = binding.pointerAffordance('kanban.card.grab', targetForScope(scope));
      return affordance.visible && affordance.enabled;
    },
    canStartStructureDrag: (scope) => {
      const actionId = scope.kind === 'column' ? 'kanban.column.reorder' : 'kanban.swimlane.reorder';
      const affordance = binding.pointerAffordance(actionId, targetForScope(scope));
      return affordance.visible && affordance.enabled;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      router.dispose();
      history?.dispose();
    },
  };
  return Object.freeze(owned);
}
