import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import {
  createKanbanCardKey,
  createKanbanColumnId,
  createKanbanOperationId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import type { CardKey, KanbanColumnId, KanbanOperationId, KanbanSwimlaneId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import type {
  KanbanMovePosition,
  KanbanRequest,
  KanbanRequestExpectedRevisions,
  KanbanRequestProposal,
} from '../contract/request.js';
import { snapshotKanbanCellAddress } from '../source/address.js';
import type { KanbanCellAddress } from '../source/types.js';
import type { KanbanEligibility } from './eligibility.js';
import { snapshotKanbanMovePosition } from './placement.js';

/** Durable operation states exposed without request payloads or application records. */
export type KanbanOperationState =
  'proposed' | 'pending' | 'accepted' | 'committed' | 'rejected' | 'cancelled' | 'superseded';

/** Stable card identity affected or reserved by an operation. */
export interface KanbanCardOperationSubject {
  /** Subject discriminator. */
  readonly kind: 'card';
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
}

/** Stable workflow-column identity affected or reserved by an operation. */
export interface KanbanColumnOperationSubject {
  /** Subject discriminator. */
  readonly kind: 'column';
  /** Stable workflow-column identity. */
  readonly columnId: KanbanColumnId;
}

/** Stable explicit-swimlane identity affected or reserved by an operation. */
export interface KanbanSwimlaneOperationSubject {
  /** Subject discriminator. */
  readonly kind: 'swimlane';
  /** Stable explicit-swimlane identity. */
  readonly swimlaneId: KanbanSwimlaneId;
}

/** Type-preserving identity used for conflict detection without retaining application records. */
export type KanbanOperationSubject =
  KanbanCardOperationSubject | KanbanColumnOperationSubject | KanbanSwimlaneOperationSubject;

/** Minimal pending projection for card movement, including no full card records. */
export interface KanbanMovePendingProjection {
  /** Request discriminator represented by this projection. */
  readonly kind: 'card-move';
  /** Lifecycle states that continue to render as pending. */
  readonly state: 'pending' | 'accepted';
  /** Ordered stable card identities represented atomically. */
  readonly cardKeys: readonly CardKey[];
  /** Semantic source cells aligned by index with `cardKeys`. */
  readonly sources: readonly KanbanCellAddress[];
  /** Shared semantic destination cell. */
  readonly target: KanbanCellAddress;
  /** Revision-bound semantic destination interval. */
  readonly position: KanbanMovePosition;
}

/** Minimal pending marker for non-move request families. */
export interface KanbanMarkerPendingProjection {
  /** Non-move request discriminator represented by this projection. */
  readonly kind: Exclude<KanbanRequest['kind'], 'card-move'>;
  /** Lifecycle states that continue to render as pending. */
  readonly state: 'pending' | 'accepted';
  /** Bounded related card identities when the request exposes them directly. */
  readonly cardKeys: readonly CardKey[];
}

/** Payload-free semantic projection retained only while an operation is pending or accepted. */
export type KanbanPendingProjection = KanbanMovePendingProjection | KanbanMarkerPendingProjection;

/** Immutable payload-free state published by the board operation coordinator. */
export interface KanbanOperationSnapshot {
  /** Stable identity of the operation. */
  readonly operationId: KanbanOperationId;
  /** Request discriminator without its application-owned payload. */
  readonly kind: KanbanRequest['kind'];
  /** Current lifecycle state. */
  readonly state: KanbanOperationState;
  /** Sorted type-preserving identities reserved or affected by the operation. */
  readonly affected: readonly KanbanOperationSubject[];
  /** Optional semantic pending projection for pending and accepted states only. */
  readonly projection?: KanbanPendingProjection;
  /** Optional safe machine-readable terminal or policy reason. */
  readonly code?: string;
}

/** Callback invoked with one immutable payload-free lifecycle snapshot. */
export type KanbanOperationSubscriber = (snapshot: KanbanOperationSnapshot) => void;

/** Build the payload-free pending projection for one already-validated proposal. */
export function createKanbanPendingProjection(proposal: KanbanRequestProposal): KanbanPendingProjection {
  if (proposal.kind === 'card-move') {
    return Object.freeze({
      kind: proposal.kind,
      state: 'pending',
      cardKeys: Object.freeze(proposal.moved.map(({ cardKey }) => cardKey)),
      sources: Object.freeze(proposal.moved.map(({ source }) => source)),
      target: proposal.target,
      position: proposal.position,
    });
  }
  const cardKeys =
    proposal.kind === 'card-update' ||
    proposal.kind === 'card-duplicate' ||
    proposal.kind === 'card-archive' ||
    proposal.kind === 'card-delete'
      ? Object.freeze([proposal.cardKey])
      : Object.freeze([]);
  return Object.freeze({ kind: proposal.kind, state: 'pending', cardKeys });
}

/** Copy one pending projection into its accepted-but-unpublished lifecycle state. */
export function acceptKanbanPendingProjection(projection: KanbanPendingProjection): KanbanPendingProjection {
  const snapshot = snapshotKanbanPendingProjection(projection);
  return Object.freeze({ ...snapshot, state: 'accepted' });
}

declare const kanbanUndoTokenBrand: unique symbol;

/** Opaque bounded application token used only to request a fresh undo operation. */
export type KanbanUndoToken = string & { readonly [kanbanUndoTokenBrand]: true };

/** Exact confirmation facts exposed without application records or terminal geometry. */
export interface KanbanConfirmationContext {
  /** Reserved operation identity. */
  readonly operationId: KanbanOperationId;
  /** Detached validated proposal awaiting dispatch. */
  readonly proposal: KanbanRequestProposal;
  /** Sorted semantic subjects reserved by this operation. */
  readonly affected: readonly KanbanOperationSubject[];
  /** Equality-only revisions captured at admission. */
  readonly expected: KanbanRequestExpectedRevisions;
  /** Warning or destructive classification that requires a user decision. */
  readonly eligibility: Extract<KanbanEligibility, { readonly kind: 'warning' }> | { readonly kind: 'destructive' };
  /** Live coordinator-owned cancellation signal. */
  readonly signal: AbortSignal;
}

/** Application confirmation callback with an exact synchronous-or-native-Promise result. */
export type KanbanConfirmer = (context: KanbanConfirmationContext) => boolean | Promise<boolean>;

/** Exact metadata supplied when an application builds a fresh inverse proposal. */
export interface KanbanInverseRequestContext {
  /** Payload-free snapshot of the committed operation being undone. */
  readonly prior: KanbanOperationSnapshot;
  /** Opaque committed descriptor selected for this fresh operation. */
  readonly undo: KanbanUndoDescriptor;
  /** Current equality-only revisions captured for the inverse request. */
  readonly expected: KanbanRequestExpectedRevisions;
  /** Current presentation capabilities; application authorization remains in the dispatcher. */
  readonly capabilities: KanbanCapabilities;
  /** Live coordinator-owned cancellation signal. */
  readonly signal: AbortSignal;
}

/** Trusted application callback that constructs one fresh proposal from current authority. */
export type KanbanInverseRequestBuilder = (
  context: KanbanInverseRequestContext,
) => KanbanRequestProposal | Promise<KanbanRequestProposal>;

/** Mutually exclusive application undo token or inverse-proposal builder. */
export type KanbanUndoDescriptor =
  | { readonly kind: 'token'; readonly token: KanbanUndoToken }
  | { readonly kind: 'inverse-builder'; readonly build: KanbanInverseRequestBuilder };

/** Exact subject members before discriminator narrowing. */
const SUBJECT_KEYS = new Set(['kind', 'cardKey', 'columnId', 'swimlaneId']);
const CARD_SUBJECT_KEYS = new Set(['kind', 'cardKey']);
const COLUMN_SUBJECT_KEYS = new Set(['kind', 'columnId']);
const SWIMLANE_SUBJECT_KEYS = new Set(['kind', 'swimlaneId']);
/** Exact projection members before discriminator narrowing. */
const PROJECTION_KEYS = new Set(['kind', 'state', 'cardKeys', 'sources', 'target', 'position']);
const MOVE_PROJECTION_KEYS = new Set(['kind', 'state', 'cardKeys', 'sources', 'target', 'position']);
const MARKER_PROJECTION_KEYS = new Set(['kind', 'state', 'cardKeys']);
/** Exact operation snapshot members. */
const SNAPSHOT_KEYS = new Set(['operationId', 'kind', 'state', 'affected', 'projection', 'code']);
/** Safe machine-readable reason-code grammar. */
const REASON_CODE = /^[a-z][a-z0-9-]*$/u;
/** Every standard and extension request discriminator. */
/** Reject malformed operation metadata without retaining application values. */
function invalidOperation(): never {
  throw new KanbanInvalidSemanticValueError();
}

/** Validate one request discriminator without coercion. */
function requestKind(value: unknown): KanbanRequest['kind'] {
  switch (value) {
    case 'card-create':
    case 'card-update':
    case 'card-duplicate':
    case 'card-archive':
    case 'card-delete':
    case 'card-move':
    case 'column-add':
    case 'column-update':
    case 'column-reorder':
    case 'column-delete':
    case 'swimlane-add':
    case 'swimlane-update':
    case 'swimlane-reorder':
    case 'swimlane-delete':
    case 'saved-view-save':
    case 'saved-view-rename':
    case 'saved-view-delete':
    case 'extension':
      return value;
    default:
      return invalidOperation();
  }
}

/** Validate one lifecycle state without coercion. */
function operationState(value: unknown): KanbanOperationState {
  switch (value) {
    case 'proposed':
    case 'pending':
    case 'accepted':
    case 'committed':
    case 'rejected':
    case 'cancelled':
    case 'superseded':
      return value;
    default:
      return invalidOperation();
  }
}

/** Validate one card identity while preserving string and numeric identity. */
function cardKey(value: unknown): CardKey {
  if (typeof value !== 'string' && typeof value !== 'number') return invalidOperation();
  try {
    return createKanbanCardKey(value);
  } catch {
    return invalidOperation();
  }
}

/** Return a collision-safe identity for one type-preserving subject. */
export function canonicalizeKanbanOperationSubject(subject: KanbanOperationSubject): string {
  const snapshot = snapshotKanbanOperationSubject(subject);
  if (snapshot.kind === 'card') {
    return typeof snapshot.cardKey === 'number'
      ? `card:number:${snapshot.cardKey}`
      : `card:string:${snapshot.cardKey.length}:${snapshot.cardKey}`;
  }
  return snapshot.kind === 'column'
    ? `column:${snapshot.columnId.length}:${snapshot.columnId}`
    : `swimlane:${snapshot.swimlaneId.length}:${snapshot.swimlaneId}`;
}

/** Validate, detach, and freeze one operation subject. */
export function snapshotKanbanOperationSubject(value: unknown): KanbanOperationSubject {
  const properties = snapshotKanbanDataProperties(value, SUBJECT_KEYS.size);
  validateKanbanDataKeys(properties, SUBJECT_KEYS);
  try {
    if (properties.kind === 'card') {
      validateKanbanDataKeys(properties, CARD_SUBJECT_KEYS);
      return Object.freeze({ kind: 'card', cardKey: cardKey(properties.cardKey) });
    }
    if (properties.kind === 'column') {
      validateKanbanDataKeys(properties, COLUMN_SUBJECT_KEYS);
      if (typeof properties.columnId !== 'string') return invalidOperation();
      return Object.freeze({ kind: 'column', columnId: createKanbanColumnId(properties.columnId) });
    }
    if (properties.kind !== 'swimlane') return invalidOperation();
    validateKanbanDataKeys(properties, SWIMLANE_SUBJECT_KEYS);
    if (typeof properties.swimlaneId !== 'string') return invalidOperation();
    return Object.freeze({ kind: 'swimlane', swimlaneId: createKanbanSwimlaneId(properties.swimlaneId) });
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    return invalidOperation();
  }
}

/** Maximum standard move subjects: selected cards, destination axes, and two placement anchors. */
const MAX_AFFECTED_SUBJECTS = KANBAN_LIMITS.selectedKeys.safe + 4;

/** Validate a bounded sorted unique affected-subject set. */
export function snapshotKanbanOperationSubjects(value: unknown): readonly KanbanOperationSubject[] {
  const subjects = snapshotKanbanDataArray(value, MAX_AFFECTED_SUBJECTS).map(snapshotKanbanOperationSubject);
  const identities = subjects.map(canonicalizeKanbanOperationSubject);
  if (new Set(identities).size !== identities.length) return invalidOperation();
  if (identities.some((identity, index) => index > 0 && identity < identities[index - 1]!)) {
    return invalidOperation();
  }
  return Object.freeze(subjects);
}

/** Snapshot a bounded unique card-key list. */
function cardKeys(value: unknown): readonly CardKey[] {
  const keys = snapshotKanbanDataArray(value, KANBAN_LIMITS.selectedKeys.safe).map(cardKey);
  const identities = keys.map((key) => (typeof key === 'number' ? `n:${key}` : `s:${key.length}:${key}`));
  if (new Set(identities).size !== identities.length) return invalidOperation();
  return Object.freeze(keys);
}

/** Validate and detach one payload-free semantic pending projection. */
export function snapshotKanbanPendingProjection(value: unknown): KanbanPendingProjection {
  const properties = snapshotKanbanDataProperties(value, PROJECTION_KEYS.size);
  validateKanbanDataKeys(properties, PROJECTION_KEYS);
  if (properties.state !== 'pending' && properties.state !== 'accepted') return invalidOperation();
  const kind = requestKind(properties.kind);
  const keys = cardKeys(properties.cardKeys);
  if (kind !== 'card-move') {
    validateKanbanDataKeys(properties, MARKER_PROJECTION_KEYS);
    return Object.freeze({ kind, state: properties.state, cardKeys: keys });
  }
  validateKanbanDataKeys(properties, MOVE_PROJECTION_KEYS);
  const sources = snapshotKanbanDataArray(properties.sources, KANBAN_LIMITS.selectedKeys.safe).map(
    snapshotKanbanCellAddress,
  );
  if (sources.length !== keys.length || keys.length === 0) return invalidOperation();
  return Object.freeze({
    kind,
    state: properties.state,
    cardKeys: keys,
    sources: Object.freeze(sources),
    target: snapshotKanbanCellAddress(properties.target),
    position: snapshotKanbanMovePosition(properties.position),
  });
}

/** Validate, detach, and freeze one payload-free lifecycle snapshot. */
export function snapshotKanbanOperationSnapshot(value: unknown): KanbanOperationSnapshot {
  const properties = snapshotKanbanDataProperties(value, SNAPSHOT_KEYS.size);
  validateKanbanDataKeys(properties, SNAPSHOT_KEYS);
  const state = operationState(properties.state);
  const kind = requestKind(properties.kind);
  const projection =
    properties.projection === undefined ? undefined : snapshotKanbanPendingProjection(properties.projection);
  if ((state === 'pending' || state === 'accepted') !== (projection !== undefined)) return invalidOperation();
  if (projection !== undefined && (projection.kind !== kind || projection.state !== state)) return invalidOperation();
  const code = properties.code;
  if (code !== undefined && (typeof code !== 'string' || !REASON_CODE.test(code))) return invalidOperation();
  return Object.freeze({
    operationId:
      typeof properties.operationId === 'string' ? createKanbanOperationId(properties.operationId) : invalidOperation(),
    kind,
    state,
    affected: snapshotKanbanOperationSubjects(properties.affected),
    ...(projection === undefined ? {} : { projection }),
    ...(code === undefined ? {} : { code }),
  });
}
