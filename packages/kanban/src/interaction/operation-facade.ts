import type { CardKey, KanbanOperationId } from '../contract/identity.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import {
  createKanbanCardKey,
  createKanbanColumnId,
  createKanbanOperationId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import type {
  KanbanCardMoveProposal,
  KanbanColumnPosition,
  KanbanRequestProposal,
  KanbanRequestResult,
  KanbanSwimlanePosition,
} from '../contract/request.js';
import { createKanbanRejectedResult } from '../contract/request-validation.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import { snapshotKanbanCellAddress } from '../source/address.js';
import type { KanbanCellAddress } from '../source/types.js';
import type { KanbanSelectionSnapshot } from './types.js';

/** Direction names resolved against the current semantic scene rather than terminal coordinates. */
export type KanbanMoveDirection = 'left' | 'right' | 'start' | 'end';

/** Caller-facing destination that is completed with current cursor revision evidence. */
export type KanbanCardMovePositionInput = { readonly kind: 'start' } | { readonly kind: 'end' };

/** Options for moving one explicit card through the stable facade. */
export interface KanbanMoveCardOptions {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Explicit semantic destination; omission requires a scene-relative direction. */
  readonly target?: KanbanCellAddress;
  /** Semantic edge resolved through the current destination cursor. */
  readonly position?: KanbanCardMovePositionInput;
  /** Scene-relative destination used when an explicit position or target is omitted. */
  readonly direction?: KanbanMoveDirection;
  /** Input origin retained only for parity diagnostics; it never changes request semantics. */
  readonly origin?: 'pointer' | 'keyboard' | 'programmatic';
}

/** Options for moving the current bounded loaded selection atomically. */
export type KanbanMoveSelectedBlockOptions = Omit<KanbanMoveCardOptions, 'cardKey'>;

/** Options for reordering one workflow column among stable siblings. */
export interface KanbanReorderColumnOptions {
  /** Stable column being moved. */
  readonly columnId: string;
  /** Stable-neighbor destination. */
  readonly position: KanbanColumnPosition;
}

/** Options for reordering one explicit swimlane among stable siblings. */
export interface KanbanReorderSwimlaneOptions {
  /** Stable explicit swimlane being moved. */
  readonly swimlaneId: string;
  /** Stable-neighbor destination. */
  readonly position: KanbanSwimlanePosition;
}

/** Board-owned seams used by operation methods without transferring coordinator ownership. */
export interface KanbanOperationFacadeServices {
  /** Captures the current eligible loaded selection. */
  readonly selection: () => KanbanSelectionSnapshot;
  /** Resolves current source and placement revisions into one complete move proposal. */
  readonly resolveCardMove: (
    cardKeys: readonly CardKey[],
    options: Omit<KanbanMoveCardOptions, 'cardKey'>,
  ) => KanbanCardMoveProposal | undefined;
  /** Sends every proposal through the board's sole operation coordinator. */
  readonly request: (proposal: KanbanRequestProposal) => Promise<KanbanRequestResult>;
  /** Cancels one explicit or most-recent cancellable operation. */
  readonly cancel: (operationId?: KanbanOperationId) => boolean;
  /** Resolves one committed inverse descriptor as fresh work. */
  readonly undo: (operationId: KanbanOperationId) => Promise<KanbanRequestResult>;
  /** Resolves one committed inverse-of-inverse descriptor as fresh work. */
  readonly redo: (operationId: KanbanOperationId) => Promise<KanbanRequestResult>;
}

/** Typed mutation methods composed into the stable board interaction facade. */
export interface KanbanOperationFacadeApi {
  /** Moves one explicit card through current semantic placement authority. */
  moveCard(options: KanbanMoveCardOptions): Promise<KanbanRequestResult>;
  /** Moves the current bounded loaded selection as one ordered operation. */
  moveSelectedBlock(options: KanbanMoveSelectedBlockOptions): Promise<KanbanRequestResult>;
  /** Reorders one workflow column among stable siblings. */
  reorderColumn(options: KanbanReorderColumnOptions): Promise<KanbanRequestResult>;
  /** Reorders one explicit swimlane among stable siblings. */
  reorderSwimlane(options: KanbanReorderSwimlaneOptions): Promise<KanbanRequestResult>;
  /** Cancels one explicit or most-recent cancellable operation. */
  cancel(operationId?: KanbanOperationId): boolean;
  /** Dispatches one retained inverse descriptor as fresh work. */
  undo(operationId: KanbanOperationId): Promise<KanbanRequestResult>;
  /** Dispatches one retained inverse-of-inverse descriptor as fresh work. */
  redo(operationId: KanbanOperationId): Promise<KanbanRequestResult>;
}

/** Stable payload-free result returned when current semantic move evidence is unavailable. */
function unavailableResult(): KanbanRequestResult {
  return createKanbanRejectedResult(createKanbanOperationId('operation-unavailable'), 'operation-unavailable');
}

const MOVE_CARD_KEYS = new Set(['cardKey', 'target', 'position', 'direction', 'origin']);
const MOVE_BLOCK_KEYS = new Set(['target', 'position', 'direction', 'origin']);
const COLUMN_REORDER_KEYS = new Set(['columnId', 'position']);
const SWIMLANE_REORDER_KEYS = new Set(['swimlaneId', 'position']);
const EDGE_KEYS = new Set(['kind']);

/** Snapshots a caller-facing edge without invoking accessors or retaining its object. */
function snapshotEdge(value: unknown): KanbanCardMovePositionInput {
  const properties = snapshotKanbanDataProperties(value, EDGE_KEYS.size);
  validateKanbanDataKeys(properties, EDGE_KEYS);
  if (properties.kind !== 'start' && properties.kind !== 'end') throw new Error('Invalid move edge.');
  return Object.freeze({ kind: properties.kind });
}

/** Detaches the shared destination fields accepted by card and selected-block moves. */
function snapshotMoveDestination(
  properties: Readonly<Record<string, unknown>>,
): Omit<KanbanMoveCardOptions, 'cardKey'> {
  const target = properties.target === undefined ? undefined : snapshotKanbanCellAddress(properties.target);
  const position = properties.position === undefined ? undefined : snapshotEdge(properties.position);
  const direction = properties.direction;
  if (
    direction !== undefined &&
    direction !== 'left' &&
    direction !== 'right' &&
    direction !== 'start' &&
    direction !== 'end'
  ) {
    throw new Error('Invalid move direction.');
  }
  const origin = properties.origin;
  if (origin !== undefined && origin !== 'pointer' && origin !== 'keyboard' && origin !== 'programmatic') {
    throw new Error('Invalid move origin.');
  }
  return Object.freeze({
    ...(target === undefined ? {} : { target }),
    ...(position === undefined ? {} : { position }),
    ...(direction === undefined ? {} : { direction }),
    ...(origin === undefined ? {} : { origin }),
  });
}

/** Implements typed operation methods while leaving serialization to the coordinator. */
export class KanbanOperationFacade implements KanbanOperationFacadeApi {
  readonly #services: KanbanOperationFacadeServices;

  /** Captures board-owned services without reading them until one method is called. */
  constructor(services?: KanbanOperationFacadeServices) {
    this.#services =
      services ??
      Object.freeze({
        selection: () => Object.freeze({ entries: Object.freeze([]), sessionRevision: 0, queryGeneration: 0 }),
        resolveCardMove: () => undefined,
        request: () => Promise.resolve(unavailableResult()),
        cancel: () => false,
        undo: () => Promise.resolve(unavailableResult()),
        redo: () => Promise.resolve(unavailableResult()),
      });
  }

  /** Moves one explicit card using current source and destination cursor evidence. */
  moveCard(options: KanbanMoveCardOptions): Promise<KanbanRequestResult> {
    return this.#contained(async () => {
      const properties = snapshotKanbanDataProperties(options, MOVE_CARD_KEYS.size);
      validateKanbanDataKeys(properties, MOVE_CARD_KEYS);
      const rawCardKey = properties.cardKey;
      if (typeof rawCardKey !== 'string' && typeof rawCardKey !== 'number') return unavailableResult();
      const cardKey = createKanbanCardKey(rawCardKey);
      return this.#resolvedMove([cardKey], snapshotMoveDestination(properties));
    });
  }

  /** Moves the current bounded loaded selection as one ordered atomic proposal. */
  moveSelectedBlock(options: KanbanMoveSelectedBlockOptions): Promise<KanbanRequestResult> {
    return this.#contained(async () => {
      const properties = snapshotKanbanDataProperties(options, MOVE_BLOCK_KEYS.size);
      validateKanbanDataKeys(properties, MOVE_BLOCK_KEYS);
      const keys = this.#services.selection().entries.map(({ cardKey }) => cardKey);
      return this.#resolvedMove(keys, snapshotMoveDestination(properties));
    });
  }

  /** Reorders one workflow column through the board coordinator. */
  reorderColumn(options: KanbanReorderColumnOptions): Promise<KanbanRequestResult> {
    return this.#contained(async () => {
      const properties = snapshotKanbanDataProperties(options, COLUMN_REORDER_KEYS.size);
      validateKanbanDataKeys(properties, COLUMN_REORDER_KEYS);
      if (typeof properties.columnId !== 'string') return unavailableResult();
      const proposal = snapshotKanbanRequestProposal({
        kind: 'column-reorder',
        columnId: createKanbanColumnId(properties.columnId),
        position: properties.position,
      });
      return this.#services.request(proposal);
    });
  }

  /** Reorders one explicit swimlane through the board coordinator. */
  reorderSwimlane(options: KanbanReorderSwimlaneOptions): Promise<KanbanRequestResult> {
    return this.#contained(async () => {
      const properties = snapshotKanbanDataProperties(options, SWIMLANE_REORDER_KEYS.size);
      validateKanbanDataKeys(properties, SWIMLANE_REORDER_KEYS);
      if (typeof properties.swimlaneId !== 'string') return unavailableResult();
      const proposal = snapshotKanbanRequestProposal({
        kind: 'swimlane-reorder',
        swimlaneId: createKanbanSwimlaneId(properties.swimlaneId),
        position: properties.position,
      });
      return this.#services.request(proposal);
    });
  }

  /** Cancels one explicit operation or the most recent cancellable operation when omitted. */
  cancel(operationId?: KanbanOperationId): boolean {
    try {
      return this.#services.cancel(operationId === undefined ? undefined : createKanbanOperationId(operationId));
    } catch {
      return false;
    }
  }

  /** Dispatches a retained inverse descriptor as a fresh operation. */
  undo(operationId: KanbanOperationId): Promise<KanbanRequestResult> {
    return this.#contained(() => this.#services.undo(createKanbanOperationId(operationId)));
  }

  /** Dispatches a retained inverse-of-inverse descriptor as a fresh operation. */
  redo(operationId: KanbanOperationId): Promise<KanbanRequestResult> {
    return this.#contained(() => this.#services.redo(createKanbanOperationId(operationId)));
  }

  /** Contains hostile runtime values and callback failures behind the typed result boundary. */
  #contained(operation: () => Promise<KanbanRequestResult>): Promise<KanbanRequestResult> {
    return Promise.resolve().then(async () => {
      try {
        return await operation();
      } catch {
        return unavailableResult();
      }
    });
  }

  /** Resolves one move immediately before coordinator admission to avoid stale queued evidence. */
  #resolvedMove(
    cardKeys: readonly CardKey[],
    options: Omit<KanbanMoveCardOptions, 'cardKey'>,
  ): Promise<KanbanRequestResult> {
    const proposal = cardKeys.length === 0 ? undefined : this.#services.resolveCardMove(cardKeys, options);
    return proposal === undefined ? Promise.resolve(unavailableResult()) : this.#services.request(proposal);
  }
}
