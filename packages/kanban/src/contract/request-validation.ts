import { snapshotKanbanCapabilities, snapshotKanbanLabel, snapshotKanbanReasonCode } from './capability.js';
import type { KanbanRequestContext } from './capability.js';
import { snapshotKanbanDataArray, snapshotKanbanDataProperties, validateKanbanDataKeys } from './data-snapshot.js';
import type { KanbanDataProperties } from './data-snapshot.js';
import { KanbanInvalidSemanticValueError } from './error.js';
import {
  createKanbanCardKey,
  createKanbanColumnId,
  createKanbanExtensionId,
  createKanbanOperationId,
  createKanbanSwimlaneId,
  createKanbanViewId,
} from './identity.js';
import type { CardKey, KanbanOperationId } from './identity.js';
import { KANBAN_LIMITS } from './limits.js';
import type {
  KanbanExpectedEntityRevision,
  KanbanRequestLifecycle,
  KanbanPublicationExpectation,
  KanbanPublicationSubject,
  KanbanRequest,
  KanbanRequestExpectedRevisions,
  KanbanRequestProposal,
  KanbanRequestResult,
} from './request.js';
import { snapshotKanbanRevision } from './revision.js';
import type { KanbanRevision } from './revision.js';
import { snapshotKanbanSemanticValue } from './semantic-query.js';
import { snapshotKanbanCellAddress } from '../source/address.js';
import { snapshotKanbanCardMoveProposal, snapshotKanbanMovePosition } from '../operation/placement.js';
import { snapshotKanbanUndoDescriptor } from '../operation/undo.js';

/** Maximum entity subjects retained by one request or publication expectation. */
const MAX_SUBJECTS = KANBAN_LIMITS.selectedKeys.safe;
/** Exact legacy extension request-envelope members. */
const EXTENSION_REQUEST_KEYS = new Set(['kind', 'extensionId', 'operationId', 'expected', 'payload', 'signal']);
/** Exact captured-revision envelope members. */
const EXPECTED_KEYS = new Set(['board', 'source', 'query', 'entities']);
/** Exact expected-entity members before discriminator narrowing. */
const EXPECTED_ENTITY_KEYS = new Set(['kind', 'cardKey', 'columnId', 'swimlaneId', 'revision']);
/** Exact captured card-revision members. */
const EXPECTED_CARD_KEYS = new Set(['kind', 'cardKey', 'revision']);
/** Exact captured column-revision members. */
const EXPECTED_COLUMN_KEYS = new Set(['kind', 'columnId', 'revision']);
/** Exact captured swimlane-revision members. */
const EXPECTED_SWIMLANE_KEYS = new Set(['kind', 'swimlaneId', 'revision']);
/** Exact publication-subject members before discriminator narrowing. */
const SUBJECT_KEYS = new Set(['kind', 'cardKey', 'columnId', 'swimlaneId', 'baselineRevision', 'expectedRevision']);
/** Exact card-publication members. */
const CARD_SUBJECT_KEYS = new Set(['kind', 'cardKey', 'baselineRevision', 'expectedRevision']);
/** Exact column-publication members. */
const COLUMN_SUBJECT_KEYS = new Set(['kind', 'columnId', 'baselineRevision', 'expectedRevision']);
/** Exact swimlane-publication members. */
const SWIMLANE_SUBJECT_KEYS = new Set(['kind', 'swimlaneId', 'baselineRevision', 'expectedRevision']);
/** Exact publication expectation members. */
const EXPECTATION_KEYS = new Set(['operationId', 'subjects']);
/** Exact dispatcher result members before discriminator narrowing. */
const RESULT_KEYS = new Set(['kind', 'operationId', 'publication', 'undo', 'code', 'label']);
/** Exact accepted-result members. */
const ACCEPTED_RESULT_KEYS = new Set(['kind', 'operationId', 'publication', 'undo']);
/** Exact rejected-result members. */
const REJECTED_RESULT_KEYS = new Set(['kind', 'operationId', 'code', 'label']);
/** Exact cancellation and supersession result members. */
const OPTIONAL_REASON_RESULT_KEYS = new Set(['kind', 'operationId', 'code', 'label']);
/** Exact dispatcher-context members. */
const CONTEXT_KEYS = new Set(['capabilities']);
/** Lifecycle members added only by the coordinator. */
const LIFECYCLE_KEYS = new Set(['operationId', 'expected', 'signal']);
/** Maximum union of proposal members before discriminator narrowing. */
const PROPOSAL_KEYS = new Set([
  'kind',
  'target',
  'draft',
  'cardKey',
  'patch',
  'position',
  'moved',
  'viewRevision',
  'columnId',
  'swimlaneId',
  'reassignTo',
  'viewId',
  'data',
  'label',
  'extensionId',
  'payload',
]);
/** Exact proposal members by simple discriminator. */
const CARD_CREATE_KEYS = new Set(['kind', 'target', 'draft']);
const CARD_UPDATE_KEYS = new Set(['kind', 'cardKey', 'patch']);
const CARD_DUPLICATE_KEYS = new Set(['kind', 'cardKey', 'target', 'position']);
const CARD_IDENTITY_KEYS = new Set(['kind', 'cardKey']);
const STRUCTURE_ADD_KEYS = new Set(['kind', 'draft', 'position']);
const COLUMN_UPDATE_KEYS = new Set(['kind', 'columnId', 'patch']);
const COLUMN_REORDER_KEYS = new Set(['kind', 'columnId', 'position']);
const COLUMN_DELETE_KEYS = new Set(['kind', 'columnId', 'reassignTo']);
const SWIMLANE_UPDATE_KEYS = new Set(['kind', 'swimlaneId', 'patch']);
const SWIMLANE_REORDER_KEYS = new Set(['kind', 'swimlaneId', 'position']);
const SWIMLANE_DELETE_KEYS = new Set(['kind', 'swimlaneId', 'reassignTo']);
const SAVED_VIEW_SAVE_KEYS = new Set(['kind', 'viewId', 'data']);
const SAVED_VIEW_RENAME_KEYS = new Set(['kind', 'viewId', 'label']);
const SAVED_VIEW_DELETE_KEYS = new Set(['kind', 'viewId']);
const EXTENSION_PROPOSAL_KEYS = new Set(['kind', 'extensionId', 'payload']);
/** Exact generic structural draft members. */
const COLUMN_DRAFT_KEYS = new Set(['columnId', 'label', 'data']);
const SWIMLANE_DRAFT_KEYS = new Set(['swimlaneId', 'label', 'data']);
/** Exact semantic structural position members. */
const COLUMN_POSITION_KEYS = new Set(['kind', 'beforeColumnId', 'afterColumnId']);
const SWIMLANE_POSITION_KEYS = new Set(['kind', 'swimlaneId']);

/** Read one required string data member without coercion. */
function requiredString(properties: KanbanDataProperties, key: string): string {
  const value = properties[key];
  if (typeof value !== 'string') throw new KanbanInvalidSemanticValueError();
  return value;
}

/** Convert a source-oriented revision failure into the request boundary's semantic error. */
function revision(value: unknown): KanbanRevision {
  try {
    return snapshotKanbanRevision(value);
  } catch {
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Validate one application card key while preserving string and number identity. */
function cardKey(value: unknown): CardKey {
  if (typeof value !== 'string' && typeof value !== 'number') throw new KanbanInvalidSemanticValueError();
  try {
    return createKanbanCardKey(value);
  } catch {
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Copy one typed captured entity revision from descriptor-vetted input. */
function expectedEntity(value: unknown): KanbanExpectedEntityRevision {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, EXPECTED_ENTITY_KEYS);
  const kind = requiredString(properties, 'kind');
  const entityRevision = revision(properties.revision);
  try {
    switch (kind) {
      case 'card':
        validateKanbanDataKeys(properties, EXPECTED_CARD_KEYS);
        return Object.freeze({ kind, cardKey: cardKey(properties.cardKey), revision: entityRevision });
      case 'column':
        validateKanbanDataKeys(properties, EXPECTED_COLUMN_KEYS);
        return Object.freeze({
          kind,
          columnId: createKanbanColumnId(requiredString(properties, 'columnId')),
          revision: entityRevision,
        });
      case 'swimlane':
        validateKanbanDataKeys(properties, EXPECTED_SWIMLANE_KEYS);
        return Object.freeze({
          kind,
          swimlaneId: createKanbanSwimlaneId(requiredString(properties, 'swimlaneId')),
          revision: entityRevision,
        });
      default:
        throw new KanbanInvalidSemanticValueError();
    }
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Produce a collision-safe in-memory key for duplicate expected-entity rejection. */
function expectedEntityKey(entity: KanbanExpectedEntityRevision): string {
  switch (entity.kind) {
    case 'card':
      return typeof entity.cardKey === 'number'
        ? `card:number:${entity.cardKey}`
        : `card:string:${entity.cardKey.length}:${entity.cardKey}`;
    case 'column':
      return `column:${entity.columnId.length}:${entity.columnId}`;
    case 'swimlane':
      return `swimlane:${entity.swimlaneId.length}:${entity.swimlaneId}`;
  }
}

/** Create a detached bounded revision snapshot. */
export function snapshotKanbanRequestExpectedRevisions(value: unknown): KanbanRequestExpectedRevisions {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, EXPECTED_KEYS);
  const revisions: Partial<Record<'board' | 'source' | 'query', KanbanRevision>> = {};
  for (const key of ['board', 'source', 'query'] as const) {
    if (properties[key] !== undefined) revisions[key] = revision(properties[key]);
  }
  const inputs = properties.entities === undefined ? [] : snapshotKanbanDataArray(properties.entities, MAX_SUBJECTS);
  const entities = inputs.map(expectedEntity);
  const identities = entities.map(expectedEntityKey);
  if (new Set(identities).size !== identities.length) throw new KanbanInvalidSemanticValueError();
  return Object.freeze({
    ...revisions,
    ...(entities.length === 0 ? {} : { entities: Object.freeze(entities) }),
  });
}

/** Validate a same-realm AbortSignal while normalizing hostile brand checks. */
export function snapshotKanbanRequestSignal(value: unknown): AbortSignal {
  try {
    if (!(value instanceof AbortSignal)) throw new KanbanInvalidSemanticValueError();
    return value;
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Require one safe non-empty human-readable label. */
function requiredLabel(value: unknown): string {
  const label = snapshotKanbanLabel(value);
  if (label === undefined) throw new KanbanInvalidSemanticValueError();
  return label;
}

/** Validate one semantic workflow-column position without numeric authority. */
function columnPosition(value: unknown) {
  const properties = snapshotKanbanDataProperties(value, COLUMN_POSITION_KEYS.size);
  validateKanbanDataKeys(properties, COLUMN_POSITION_KEYS);
  if (properties.kind === 'start' || properties.kind === 'end') {
    if (Object.keys(properties).length !== 1) throw new KanbanInvalidSemanticValueError();
    return Object.freeze({ kind: properties.kind });
  }
  if (properties.kind !== 'between' || Object.keys(properties).length !== 3) {
    throw new KanbanInvalidSemanticValueError();
  }
  const beforeColumnId =
    properties.beforeColumnId === null ? null : createKanbanColumnId(requiredString(properties, 'beforeColumnId'));
  const afterColumnId =
    properties.afterColumnId === null ? null : createKanbanColumnId(requiredString(properties, 'afterColumnId'));
  if (
    (beforeColumnId === null && afterColumnId === null) ||
    (beforeColumnId !== null && afterColumnId !== null && beforeColumnId === afterColumnId)
  ) {
    throw new KanbanInvalidSemanticValueError();
  }
  return Object.freeze({ kind: 'between' as const, beforeColumnId, afterColumnId });
}

/** Validate one semantic swimlane position without numeric authority. */
function swimlanePosition(value: unknown) {
  const properties = snapshotKanbanDataProperties(value, SWIMLANE_POSITION_KEYS.size);
  validateKanbanDataKeys(properties, SWIMLANE_POSITION_KEYS);
  if (properties.kind === 'start' || properties.kind === 'end') {
    if (Object.keys(properties).length !== 1) throw new KanbanInvalidSemanticValueError();
    return Object.freeze({ kind: properties.kind });
  }
  if (
    (properties.kind !== 'before' && properties.kind !== 'after') ||
    Object.keys(properties).length !== SWIMLANE_POSITION_KEYS.size
  ) {
    throw new KanbanInvalidSemanticValueError();
  }
  return Object.freeze({
    kind: properties.kind,
    swimlaneId: createKanbanSwimlaneId(requiredString(properties, 'swimlaneId')),
  });
}

/** Validate and detach one generic workflow-column draft. */
function columnDraft(value: unknown) {
  const properties = snapshotKanbanDataProperties(value, COLUMN_DRAFT_KEYS.size);
  validateKanbanDataKeys(properties, COLUMN_DRAFT_KEYS);
  return Object.freeze({
    columnId: createKanbanColumnId(requiredString(properties, 'columnId')),
    label: requiredLabel(properties.label),
    ...(properties.data === undefined ? {} : { data: snapshotKanbanSemanticValue(properties.data) }),
  });
}

/** Validate and detach one generic explicit-swimlane draft. */
function swimlaneDraft(value: unknown) {
  const properties = snapshotKanbanDataProperties(value, SWIMLANE_DRAFT_KEYS.size);
  validateKanbanDataKeys(properties, SWIMLANE_DRAFT_KEYS);
  return Object.freeze({
    swimlaneId: createKanbanSwimlaneId(requiredString(properties, 'swimlaneId')),
    label: requiredLabel(properties.label),
    ...(properties.data === undefined ? {} : { data: snapshotKanbanSemanticValue(properties.data) }),
  });
}

/**
 * Validate, deeply detach, and freeze one caller-facing request proposal.
 *
 * @example
 * ```ts
 * const proposal = snapshotKanbanRequestProposal({
 *   kind: 'card-delete',
 *   cardKey: 'work-42',
 * });
 * ```
 */
export function snapshotKanbanRequestProposal<const T>(value: T): T & KanbanRequestProposal;
/**
 * Runtime implementation of the proposal snapshot overload.
 *
 * @example
 * ```ts
 * snapshotKanbanRequestProposal({ kind: 'card-archive', cardKey: 42 });
 * ```
 */
export function snapshotKanbanRequestProposal(value: unknown): KanbanRequestProposal {
  const properties = snapshotKanbanDataProperties(value, PROPOSAL_KEYS.size);
  validateKanbanDataKeys(properties, PROPOSAL_KEYS);
  try {
    switch (properties.kind) {
      case 'card-create':
        validateKanbanDataKeys(properties, CARD_CREATE_KEYS);
        return Object.freeze({
          kind: properties.kind,
          target: snapshotKanbanCellAddress(properties.target),
          draft: snapshotKanbanSemanticValue(properties.draft),
        });
      case 'card-update':
        validateKanbanDataKeys(properties, CARD_UPDATE_KEYS);
        return Object.freeze({
          kind: properties.kind,
          cardKey: cardKey(properties.cardKey),
          patch: snapshotKanbanSemanticValue(properties.patch),
        });
      case 'card-duplicate':
        validateKanbanDataKeys(properties, CARD_DUPLICATE_KEYS);
        return Object.freeze({
          kind: properties.kind,
          cardKey: cardKey(properties.cardKey),
          target: snapshotKanbanCellAddress(properties.target),
          position: snapshotKanbanMovePosition(properties.position),
        });
      case 'card-archive':
      case 'card-delete':
        validateKanbanDataKeys(properties, CARD_IDENTITY_KEYS);
        return Object.freeze({ kind: properties.kind, cardKey: cardKey(properties.cardKey) });
      case 'card-move':
        return snapshotKanbanCardMoveProposal(value);
      case 'column-add':
        validateKanbanDataKeys(properties, STRUCTURE_ADD_KEYS);
        return Object.freeze({
          kind: properties.kind,
          draft: columnDraft(properties.draft),
          position: columnPosition(properties.position),
        });
      case 'column-update':
        validateKanbanDataKeys(properties, COLUMN_UPDATE_KEYS);
        return Object.freeze({
          kind: properties.kind,
          columnId: createKanbanColumnId(requiredString(properties, 'columnId')),
          patch: snapshotKanbanSemanticValue(properties.patch),
        });
      case 'column-reorder':
        validateKanbanDataKeys(properties, COLUMN_REORDER_KEYS);
        return Object.freeze({
          kind: properties.kind,
          columnId: createKanbanColumnId(requiredString(properties, 'columnId')),
          position: columnPosition(properties.position),
        });
      case 'column-delete': {
        validateKanbanDataKeys(properties, COLUMN_DELETE_KEYS);
        const reassignTo =
          properties.reassignTo === undefined
            ? undefined
            : createKanbanColumnId(requiredString(properties, 'reassignTo'));
        return Object.freeze({
          kind: properties.kind,
          columnId: createKanbanColumnId(requiredString(properties, 'columnId')),
          ...(reassignTo === undefined ? {} : { reassignTo }),
        });
      }
      case 'swimlane-add':
        validateKanbanDataKeys(properties, STRUCTURE_ADD_KEYS);
        return Object.freeze({
          kind: properties.kind,
          draft: swimlaneDraft(properties.draft),
          position: swimlanePosition(properties.position),
        });
      case 'swimlane-update':
        validateKanbanDataKeys(properties, SWIMLANE_UPDATE_KEYS);
        return Object.freeze({
          kind: properties.kind,
          swimlaneId: createKanbanSwimlaneId(requiredString(properties, 'swimlaneId')),
          patch: snapshotKanbanSemanticValue(properties.patch),
        });
      case 'swimlane-reorder':
        validateKanbanDataKeys(properties, SWIMLANE_REORDER_KEYS);
        return Object.freeze({
          kind: properties.kind,
          swimlaneId: createKanbanSwimlaneId(requiredString(properties, 'swimlaneId')),
          position: swimlanePosition(properties.position),
        });
      case 'swimlane-delete': {
        validateKanbanDataKeys(properties, SWIMLANE_DELETE_KEYS);
        const reassignTo =
          properties.reassignTo === undefined
            ? undefined
            : createKanbanSwimlaneId(requiredString(properties, 'reassignTo'));
        return Object.freeze({
          kind: properties.kind,
          swimlaneId: createKanbanSwimlaneId(requiredString(properties, 'swimlaneId')),
          ...(reassignTo === undefined ? {} : { reassignTo }),
        });
      }
      case 'saved-view-save':
        validateKanbanDataKeys(properties, SAVED_VIEW_SAVE_KEYS);
        return Object.freeze({
          kind: properties.kind,
          viewId: createKanbanViewId(requiredString(properties, 'viewId')),
          data: snapshotKanbanSemanticValue(properties.data),
        });
      case 'saved-view-rename':
        validateKanbanDataKeys(properties, SAVED_VIEW_RENAME_KEYS);
        return Object.freeze({
          kind: properties.kind,
          viewId: createKanbanViewId(requiredString(properties, 'viewId')),
          label: requiredLabel(properties.label),
        });
      case 'saved-view-delete':
        validateKanbanDataKeys(properties, SAVED_VIEW_DELETE_KEYS);
        return Object.freeze({
          kind: properties.kind,
          viewId: createKanbanViewId(requiredString(properties, 'viewId')),
        });
      case 'extension':
        validateKanbanDataKeys(properties, EXTENSION_PROPOSAL_KEYS);
        return Object.freeze({
          kind: properties.kind,
          extensionId: createKanbanExtensionId(requiredString(properties, 'extensionId')),
          payload: snapshotKanbanSemanticValue(properties.payload),
        });
      default:
        throw new KanbanInvalidSemanticValueError();
    }
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Validate and detach package-owned lifecycle values. */
function requestLifecycle(value: unknown): KanbanRequestLifecycle {
  const properties = snapshotKanbanDataProperties(value, LIFECYCLE_KEYS.size);
  validateKanbanDataKeys(properties, LIFECYCLE_KEYS);
  try {
    return Object.freeze({
      operationId: createKanbanOperationId(requiredString(properties, 'operationId')),
      expected: snapshotKanbanRequestExpectedRevisions(properties.expected),
      signal: snapshotKanbanRequestSignal(properties.signal),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Validate and detach one complete standard or legacy-extension request envelope. */
export function snapshotKanbanRequest(value: unknown): KanbanRequest {
  const properties = snapshotKanbanDataProperties(value, PROPOSAL_KEYS.size + LIFECYCLE_KEYS.size);
  const proposalProperties: Record<string, unknown> = Object.create(null);
  const lifecycleProperties: Record<string, unknown> = Object.create(null);
  for (const [key, member] of Object.entries(properties)) {
    if (LIFECYCLE_KEYS.has(key)) lifecycleProperties[key] = member;
    else proposalProperties[key] = member;
  }
  const proposal = snapshotKanbanRequestProposal(proposalProperties);
  const lifecycle = requestLifecycle(lifecycleProperties);
  return Object.freeze({ ...proposal, ...lifecycle });
}

/**
 * Create a coordinator-owned envelope or adopt one validated legacy extension envelope.
 *
 * Standard and new extension proposals require explicit lifecycle values. The one-argument form is
 * reserved for the historical complete extension request and preserves its operation ID and signal.
 *
 * @example
 * ```ts
 * const request = createKanbanRequestEnvelope(proposal, {
 *   operationId: 'board-1-operation-4',
 *   expected: { source: 'source-8' },
 *   signal: controller.signal,
 * });
 * ```
 */
export function createKanbanRequestEnvelope(proposal: unknown, lifecycle?: unknown): KanbanRequest {
  if (lifecycle === undefined) {
    const properties = snapshotKanbanDataProperties(proposal, EXTENSION_REQUEST_KEYS.size);
    validateKanbanDataKeys(properties, EXTENSION_REQUEST_KEYS);
    if (properties.kind !== 'extension') throw new KanbanInvalidSemanticValueError();
    return snapshotKanbanRequest(proposal);
  }
  const snapshot = snapshotKanbanRequestProposal(proposal);
  const owned = requestLifecycle(lifecycle);
  return snapshotKanbanRequest({ ...snapshot, ...owned });
}

/** Copy one publication subject without retaining application records. */
function publicationSubject(value: unknown): KanbanPublicationSubject {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, SUBJECT_KEYS);
  const kind = requiredString(properties, 'kind');
  const baselineRevision = revision(properties.baselineRevision);
  const expectedRevision = revision(properties.expectedRevision);
  try {
    switch (kind) {
      case 'card':
        validateKanbanDataKeys(properties, CARD_SUBJECT_KEYS);
        return Object.freeze({ kind, cardKey: cardKey(properties.cardKey), baselineRevision, expectedRevision });
      case 'column':
        validateKanbanDataKeys(properties, COLUMN_SUBJECT_KEYS);
        return Object.freeze({
          kind,
          columnId: createKanbanColumnId(requiredString(properties, 'columnId')),
          baselineRevision,
          expectedRevision,
        });
      case 'swimlane':
        validateKanbanDataKeys(properties, SWIMLANE_SUBJECT_KEYS);
        return Object.freeze({
          kind,
          swimlaneId: createKanbanSwimlaneId(requiredString(properties, 'swimlaneId')),
          baselineRevision,
          expectedRevision,
        });
      default:
        throw new KanbanInvalidSemanticValueError();
    }
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Produce a collision-safe key for duplicate publication-subject rejection. */
function publicationSubjectKey(subject: KanbanPublicationSubject): string {
  switch (subject.kind) {
    case 'card':
      return typeof subject.cardKey === 'number'
        ? `card:number:${subject.cardKey}`
        : `card:string:${subject.cardKey.length}:${subject.cardKey}`;
    case 'column':
      return `column:${subject.columnId.length}:${subject.columnId}`;
    case 'swimlane':
      return `swimlane:${subject.swimlaneId.length}:${subject.swimlaneId}`;
  }
}

/** Copy and atomically reject duplicate publication subjects. */
export function snapshotKanbanPublicationSubjects(value: unknown): readonly KanbanPublicationSubject[] {
  const subjects = snapshotKanbanDataArray(value, MAX_SUBJECTS).map(publicationSubject);
  if (subjects.length === 0) throw new KanbanInvalidSemanticValueError();
  const identities = subjects.map(publicationSubjectKey);
  if (new Set(identities).size !== identities.length) throw new KanbanInvalidSemanticValueError();
  return Object.freeze(subjects);
}

/** Create detached bounded publication metadata for one accepted operation. */
export function snapshotKanbanPublicationExpectation(value: unknown): KanbanPublicationExpectation {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, EXPECTATION_KEYS);
  return Object.freeze({
    operationId: createKanbanOperationId(requiredString(properties, 'operationId')),
    subjects: snapshotKanbanPublicationSubjects(properties.subjects),
  });
}

/** Create a sanitized rejection correlated to the validated request operation. */
export function createKanbanRejectedResult(operationId: KanbanOperationId, code: string): KanbanRequestResult {
  return Object.freeze({ kind: 'rejected', operationId, code });
}

/** Validate and detach one application result without retaining rejected values. */
export function snapshotKanbanRequestResult(value: unknown, operationId: KanbanOperationId): KanbanRequestResult {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, RESULT_KEYS);
  const resultOperationId = createKanbanOperationId(requiredString(properties, 'operationId'));
  if (resultOperationId !== operationId) return createKanbanRejectedResult(operationId, 'operation-mismatch');
  const kind = requiredString(properties, 'kind');
  switch (kind) {
    case 'accepted': {
      validateKanbanDataKeys(properties, ACCEPTED_RESULT_KEYS);
      const publication =
        properties.publication === undefined ? undefined : snapshotKanbanPublicationExpectation(properties.publication);
      const undo = properties.undo === undefined ? undefined : snapshotKanbanUndoDescriptor(properties.undo);
      if (publication !== undefined && publication.operationId !== operationId) {
        return createKanbanRejectedResult(operationId, 'operation-mismatch');
      }
      return Object.freeze({
        kind,
        operationId,
        ...(publication === undefined ? {} : { publication }),
        ...(undo === undefined ? {} : { undo }),
      });
    }
    case 'rejected': {
      validateKanbanDataKeys(properties, REJECTED_RESULT_KEYS);
      const code = snapshotKanbanReasonCode(properties.code);
      if (code === undefined) throw new KanbanInvalidSemanticValueError();
      const label = snapshotKanbanLabel(properties.label);
      return Object.freeze({ kind, operationId, code, ...(label === undefined ? {} : { label }) });
    }
    case 'cancelled':
    case 'superseded': {
      validateKanbanDataKeys(properties, OPTIONAL_REASON_RESULT_KEYS);
      const code = snapshotKanbanReasonCode(properties.code);
      const label = snapshotKanbanLabel(properties.label);
      return Object.freeze({
        kind,
        operationId,
        ...(code === undefined ? {} : { code }),
        ...(label === undefined ? {} : { label }),
      });
    }
    default:
      throw new KanbanInvalidSemanticValueError();
  }
}

/** Create one descriptor-vetted dispatcher context snapshot. */
export function snapshotKanbanRequestContext(value: unknown): KanbanRequestContext {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, CONTEXT_KEYS);
  return Object.freeze({ capabilities: snapshotKanbanCapabilities(properties.capabilities) });
}
