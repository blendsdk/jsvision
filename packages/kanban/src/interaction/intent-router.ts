import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import {
  createKanbanCardKey,
  createKanbanColumnId,
  createKanbanExtensionId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import type { KanbanExtensionId } from '../contract/identity.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanActionScope } from '../layout/hit-map.js';
import type { KanbanCellAddress } from '../source/types.js';
import type { KanbanStructureStateCode } from '../structure/model.js';
import type {
  KanbanInteractionHandler,
  KanbanInteractionIntent,
  KanbanInteractionOrigin,
  KanbanScopedActionId,
} from './intent.js';
import type { KanbanSelectionSnapshot } from './types.js';

/** Internal intent request captured before eligible selection is snapshotted. */
export type KanbanIntentRequest =
  | {
      readonly kind: 'open-card';
      readonly origin: KanbanInteractionOrigin;
      readonly scope: Extract<KanbanActionScope, { readonly kind: 'card' }>;
      readonly actionId?: KanbanExtensionId;
    }
  | {
      readonly kind: 'open-context';
      readonly origin: KanbanInteractionOrigin;
      readonly scope: KanbanActionScope;
    }
  | {
      readonly kind: 'scoped-action';
      readonly origin: KanbanInteractionOrigin;
      readonly actionId: KanbanScopedActionId;
      readonly scope: KanbanActionScope;
    };

/** Returns whether a structural state discriminator belongs to the closed public union. */
function structureState(value: string): value is KanbanStructureStateCode {
  return (
    value === 'no-columns' ||
    value === 'true-empty' ||
    value === 'filtered-empty' ||
    value === 'loading' ||
    value === 'refreshing' ||
    value === 'partial' ||
    value === 'ready' ||
    value === 'collapsed' ||
    value === 'hidden' ||
    value === 'error'
  );
}

/** Accepts only the three public interaction-origin discriminators. */
function snapshotOrigin(origin: KanbanInteractionOrigin): KanbanInteractionOrigin {
  if (origin === 'keyboard' || origin === 'pointer' || origin === 'programmatic') return origin;
  throw new TypeError('Invalid Kanban interaction origin.');
}

/** Accepts a package-owned action or validates an application-namespaced extension action. */
function snapshotActionId(actionId: KanbanScopedActionId): KanbanScopedActionId {
  if (actionId === 'collapse' || actionId === 'clear-filters' || actionId === 'configure' || actionId === 'add-card') {
    return actionId;
  }
  return createKanbanExtensionId(actionId);
}

/** Creates one frozen validated semantic cell address. */
function snapshotAddress(address: KanbanCellAddress): KanbanCellAddress {
  return Object.freeze({
    columnId: createKanbanColumnId(address.columnId),
    ...(address.swimlaneId === undefined ? {} : { swimlaneId: createKanbanSwimlaneId(address.swimlaneId) }),
  });
}

/** Creates one detached frozen closed action scope. */
function snapshotScope(scope: KanbanActionScope): KanbanActionScope {
  switch (scope.kind) {
    case 'board':
      return Object.freeze({ kind: 'board' });
    case 'column':
      return Object.freeze({ kind: 'column', columnId: createKanbanColumnId(scope.columnId) });
    case 'swimlane':
      return Object.freeze({ kind: 'swimlane', swimlaneId: createKanbanSwimlaneId(scope.swimlaneId) });
    case 'cell':
      return Object.freeze({ kind: 'cell', address: snapshotAddress(scope.address) });
    case 'card':
      return Object.freeze({
        kind: 'card',
        cardKey: createKanbanCardKey(scope.cardKey),
        address: snapshotAddress(scope.address),
      });
    case 'state': {
      if (!structureState(scope.state)) throw new TypeError('Invalid Kanban state scope.');
      return Object.freeze({
        kind: 'state',
        state: scope.state,
        ...(scope.address === undefined ? {} : { address: snapshotAddress(scope.address) }),
      });
    }
  }
}

/** Revalidates and detaches eligible selection at the final application boundary. */
function snapshotSelection(selection: KanbanSelectionSnapshot): KanbanSelectionSnapshot {
  if (!Number.isSafeInteger(selection.queryGeneration) || selection.queryGeneration < 0) {
    throw new TypeError('Invalid Kanban query generation.');
  }
  return Object.freeze({
    entries: Object.freeze(
      selection.entries.map((entry) =>
        Object.freeze({
          cardKey: createKanbanCardKey(entry.cardKey),
          address: snapshotAddress(entry.address),
          entityRevision: snapshotKanbanRevision(entry.entityRevision),
        }),
      ),
    ),
    sessionRevision: snapshotKanbanRevision(selection.sessionRevision),
    queryGeneration: selection.queryGeneration,
    ...(selection.viewRevision === undefined ? {} : { viewRevision: snapshotKanbanRevision(selection.viewRevision) }),
  });
}

/** Creates the final frozen public intent without retaining the internal request object. */
function snapshotIntent(request: KanbanIntentRequest, selection: KanbanSelectionSnapshot): KanbanInteractionIntent {
  const detachedSelection = snapshotSelection(selection);
  const scope = snapshotScope(request.scope);
  switch (request.kind) {
    case 'open-card': {
      if (scope.kind !== 'card') throw new TypeError('Invalid Kanban card intent scope.');
      return Object.freeze({
        kind: 'open-card',
        origin: snapshotOrigin(request.origin),
        selection: detachedSelection,
        cardKey: scope.cardKey,
        address: scope.address,
        ...(request.actionId === undefined ? {} : { actionId: snapshotActionId(request.actionId) }),
      });
    }
    case 'open-context':
      return Object.freeze({
        kind: 'open-context',
        origin: snapshotOrigin(request.origin),
        selection: detachedSelection,
        scope,
      });
    case 'scoped-action':
      return Object.freeze({
        kind: 'scoped-action',
        origin: snapshotOrigin(request.origin),
        selection: detachedSelection,
        actionId: snapshotActionId(request.actionId),
        scope,
      });
  }
}

/**
 * Final application boundary for immutable semantic interaction intents.
 *
 * Validation and application handler failures are observed without payloads and never escape the
 * facade queue. An absent optional handler still accepts a valid semantic interaction.
 */
export class KanbanIntentRouter {
  readonly #handler: KanbanInteractionHandler | undefined;
  readonly #observe: ((observation: KanbanObservation) => void) | undefined;
  #disposed = false;

  /** Captures optional application seams once so later option mutation cannot replace them. */
  constructor(options: {
    readonly handler?: KanbanInteractionHandler;
    readonly observe?: (observation: KanbanObservation) => void;
  }) {
    this.#handler = options.handler;
    this.#observe = options.observe;
  }

  /** Validates and delivers one intent exactly once, returning whether the request was valid. */
  deliver(request: KanbanIntentRequest, selection: KanbanSelectionSnapshot): boolean {
    if (this.#disposed) return false;
    let intent: KanbanInteractionIntent;
    try {
      intent = snapshotIntent(request, selection);
    } catch {
      this.#report('interaction-intent-invalid');
      return false;
    }
    try {
      this.#handler?.(intent);
    } catch {
      this.#report('interaction-handler-failed');
    }
    return true;
  }

  /** Rejects later delivery idempotently. */
  dispose(): void {
    this.#disposed = true;
  }

  /** Emits one payload-free board observation while isolating diagnostic sink failures. */
  #report(code: string): void {
    try {
      this.#observe?.(createKanbanObservation({ code, scope: 'board' }));
    } catch {
      // Diagnostics never participate in semantic intent delivery.
    }
  }
}
