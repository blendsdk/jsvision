import { snapshotKanbanCapabilities, snapshotKanbanLabel, snapshotKanbanReasonCode } from './capability.js';
import type { KanbanRequestContext } from './capability.js';
import { snapshotKanbanDataArray, snapshotKanbanDataProperties, validateKanbanDataKeys } from './data-snapshot.js';
import type { KanbanDataProperties } from './data-snapshot.js';
import { KanbanInvalidSemanticValueError } from './error.js';
import {
  createKanbanColumnId,
  createKanbanExtensionId,
  createKanbanOperationId,
  createKanbanSwimlaneId,
} from './identity.js';
import type { CardKey, KanbanOperationId } from './identity.js';
import { KANBAN_LIMITS } from './limits.js';
import type {
  KanbanExpectedEntityRevision,
  KanbanExtensionRequest,
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
  KanbanPublicationReconciliation,
  KanbanPublicationSubject,
  KanbanRequest,
  KanbanRequestDispatcher,
  KanbanRequestExpectedRevisions,
  KanbanRequestResult,
} from './request.js';
import type { KanbanRevision } from './revision.js';
import { snapshotKanbanSemanticValue } from './semantic-query.js';

/** Maximum entity subjects retained in one request or publication expectation. */
const MAX_SUBJECTS = KANBAN_LIMITS.selectedKeys.safe;
/** Maximum simultaneously pending application operations. */
const MAX_PENDING_OPERATIONS = KANBAN_LIMITS.pendingOperations.safe;
/** Terminal controls forbidden from card keys and revision strings retained as metadata. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
/** Shared encoder for bounded authority metadata. */
const AUTHORITY_ENCODER = new TextEncoder();
/** Same-realm Promise intrinsic used without reading an application object's `then` property. */
const NATIVE_PROMISE_THEN = Promise.prototype.then;
/** Exact request envelope members. */
const REQUEST_KEYS = new Set(['kind', 'extensionId', 'operationId', 'expected', 'payload', 'signal']);
/** Exact captured-revision envelope members. */
const EXPECTED_KEYS = new Set(['board', 'source', 'query', 'entities']);
/** Exact expected-entity members by discriminator. */
const EXPECTED_ENTITY_KEYS = new Set(['kind', 'cardKey', 'columnId', 'swimlaneId', 'revision']);
/** Exact captured card-revision members. */
const EXPECTED_CARD_KEYS = new Set(['kind', 'cardKey', 'revision']);
/** Exact captured column-revision members. */
const EXPECTED_COLUMN_KEYS = new Set(['kind', 'columnId', 'revision']);
/** Exact captured swimlane-revision members. */
const EXPECTED_SWIMLANE_KEYS = new Set(['kind', 'swimlaneId', 'revision']);
/** Exact publication-subject members by discriminator. */
const SUBJECT_KEYS = new Set(['kind', 'cardKey', 'columnId', 'swimlaneId', 'baselineRevision', 'expectedRevision']);
/** Exact card-publication members. */
const CARD_SUBJECT_KEYS = new Set(['kind', 'cardKey', 'baselineRevision', 'expectedRevision']);
/** Exact column-publication members. */
const COLUMN_SUBJECT_KEYS = new Set(['kind', 'columnId', 'baselineRevision', 'expectedRevision']);
/** Exact swimlane-publication members. */
const SWIMLANE_SUBJECT_KEYS = new Set(['kind', 'swimlaneId', 'baselineRevision', 'expectedRevision']);
/** Exact publication expectation members. */
const EXPECTATION_KEYS = new Set(['operationId', 'subjects']);
/** Exact publication notice members. */
const NOTICE_KEYS = new Set(['kind', 'operationId', 'subjects']);
/** Exact dispatcher result members across all four variants. */
const RESULT_KEYS = new Set(['kind', 'operationId', 'publication', 'code', 'label']);
/** Exact accepted-result members. */
const ACCEPTED_RESULT_KEYS = new Set(['kind', 'operationId', 'publication']);
/** Exact rejected-result members. */
const REJECTED_RESULT_KEYS = new Set(['kind', 'operationId', 'code', 'label']);
/** Exact cancellation and supersession result members. */
const OPTIONAL_REASON_RESULT_KEYS = new Set(['kind', 'operationId', 'code', 'label']);
/** Exact dispatcher context members. */
const CONTEXT_KEYS = new Set(['capabilities']);

/** Reads a required string data member. */
function requiredString(properties: KanbanDataProperties, key: string): string {
  const value = properties[key];
  if (typeof value !== 'string') throw new KanbanInvalidSemanticValueError();
  return value;
}

/** Returns true only for finite, bounded string-or-number revisions. */
function isRevision(value: unknown): value is KanbanRevision {
  return (
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' &&
      value.length > 0 &&
      value.length <= KANBAN_LIMITS.idBytes.safe &&
      !CONTROL_CHARACTERS.test(value) &&
      AUTHORITY_ENCODER.encode(value).byteLength <= KANBAN_LIMITS.idBytes.safe)
  );
}

/** Validates one application card key while preserving string and number identity. */
function snapshotCardKey(value: unknown): CardKey {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= KANBAN_LIMITS.idBytes.safe &&
    !CONTROL_CHARACTERS.test(value) &&
    AUTHORITY_ENCODER.encode(value).byteLength <= KANBAN_LIMITS.idBytes.safe
  ) {
    return value;
  }
  throw new KanbanInvalidSemanticValueError();
}

/** Copies one typed captured entity revision from descriptor-vetted input. */
function snapshotExpectedEntity(value: unknown): KanbanExpectedEntityRevision {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, EXPECTED_ENTITY_KEYS);
  const kind = requiredString(properties, 'kind');
  const revision = properties.revision;
  if (!isRevision(revision)) throw new KanbanInvalidSemanticValueError();
  switch (kind) {
    case 'card':
      validateKanbanDataKeys(properties, EXPECTED_CARD_KEYS);
      return Object.freeze({ kind, cardKey: snapshotCardKey(properties.cardKey), revision });
    case 'column':
      validateKanbanDataKeys(properties, EXPECTED_COLUMN_KEYS);
      return Object.freeze({ kind, columnId: createKanbanColumnId(requiredString(properties, 'columnId')), revision });
    case 'swimlane':
      validateKanbanDataKeys(properties, EXPECTED_SWIMLANE_KEYS);
      return Object.freeze({
        kind,
        swimlaneId: createKanbanSwimlaneId(requiredString(properties, 'swimlaneId')),
        revision,
      });
    default:
      throw new KanbanInvalidSemanticValueError();
  }
}

/** Creates a detached bounded revision snapshot. */
function snapshotExpectedRevisions(value: unknown): KanbanRequestExpectedRevisions {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, EXPECTED_KEYS);
  const revisions: Partial<Record<'board' | 'source' | 'query', KanbanRevision>> = {};
  for (const key of ['board', 'source', 'query'] as const) {
    const revision = properties[key];
    if (revision !== undefined) {
      if (!isRevision(revision)) throw new KanbanInvalidSemanticValueError();
      revisions[key] = revision;
    }
  }
  const entityInputs =
    properties.entities === undefined ? [] : snapshotKanbanDataArray(properties.entities, MAX_SUBJECTS);
  const entities = entityInputs.map(snapshotExpectedEntity);
  const entityIdentities = entities.map(expectedEntityKey);
  if (new Set(entityIdentities).size !== entityIdentities.length) {
    throw new KanbanInvalidSemanticValueError();
  }
  return Object.freeze({
    ...revisions,
    ...(entities.length === 0 ? {} : { entities: Object.freeze(entities) }),
  });
}

/** Produces a collision-free in-memory key for duplicate expected-entity rejection. */
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

/** Validates a same-realm AbortSignal without leaking host errors. */
function snapshotSignal(value: unknown): AbortSignal {
  try {
    if (!(value instanceof AbortSignal)) throw new KanbanInvalidSemanticValueError();
    return value;
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Validates and detaches a request before invoking application code. */
function snapshotRequest(request: unknown): KanbanRequest {
  const properties = snapshotKanbanDataProperties(request);
  validateKanbanDataKeys(properties, REQUEST_KEYS);
  if (properties.kind !== 'extension') throw new KanbanInvalidSemanticValueError();
  return Object.freeze({
    kind: 'extension',
    extensionId: createKanbanExtensionId(requiredString(properties, 'extensionId')),
    operationId: createKanbanOperationId(requiredString(properties, 'operationId')),
    expected: snapshotExpectedRevisions(properties.expected),
    payload: snapshotKanbanSemanticValue(properties.payload),
    signal: snapshotSignal(properties.signal),
  } satisfies KanbanExtensionRequest);
}

/** Copies one publication subject without retaining application records. */
function snapshotPublicationSubject(value: unknown): KanbanPublicationSubject {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, SUBJECT_KEYS);
  const kind = requiredString(properties, 'kind');
  const baselineRevision = properties.baselineRevision;
  const expectedRevision = properties.expectedRevision;
  if (!isRevision(baselineRevision) || !isRevision(expectedRevision)) {
    throw new KanbanInvalidSemanticValueError();
  }
  switch (kind) {
    case 'card':
      validateKanbanDataKeys(properties, CARD_SUBJECT_KEYS);
      return Object.freeze({
        kind,
        cardKey: snapshotCardKey(properties.cardKey),
        baselineRevision,
        expectedRevision,
      });
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
}

/** Produces a collision-free in-memory key for duplicate-subject rejection. */
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

/** Copies and rejects duplicate publication subjects. */
function snapshotSubjects(value: unknown): readonly KanbanPublicationSubject[] {
  const inputs = snapshotKanbanDataArray(value, MAX_SUBJECTS);
  if (inputs.length === 0) throw new KanbanInvalidSemanticValueError();
  const subjects = inputs.map(snapshotPublicationSubject);
  const identities = subjects.map(publicationSubjectKey);
  if (new Set(identities).size !== identities.length) throw new KanbanInvalidSemanticValueError();
  return Object.freeze(subjects);
}

/** Creates a detached bounded publication expectation. */
function snapshotPublicationExpectation(value: unknown): KanbanPublicationExpectation {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, EXPECTATION_KEYS);
  return Object.freeze({
    operationId: createKanbanOperationId(requiredString(properties, 'operationId')),
    subjects: snapshotSubjects(properties.subjects),
  });
}

/** Creates a sanitized rejection correlated to the validated request operation. */
function rejected(operationId: KanbanOperationId, code: string): KanbanRequestResult {
  return Object.freeze({ kind: 'rejected', operationId, code });
}

/** Validates and detaches one application result. */
function snapshotResult(value: unknown, operationId: KanbanOperationId): KanbanRequestResult {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, RESULT_KEYS);
  const resultOperationId = createKanbanOperationId(requiredString(properties, 'operationId'));
  if (resultOperationId !== operationId) return rejected(operationId, 'operation-mismatch');
  const kind = requiredString(properties, 'kind');
  switch (kind) {
    case 'accepted': {
      validateKanbanDataKeys(properties, ACCEPTED_RESULT_KEYS);
      const publication =
        properties.publication === undefined ? undefined : snapshotPublicationExpectation(properties.publication);
      if (publication !== undefined && publication.operationId !== operationId) {
        return rejected(operationId, 'operation-mismatch');
      }
      return Object.freeze({
        kind,
        operationId,
        ...(publication === undefined ? {} : { publication }),
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

/** Accepts only unmodified, same-realm native Promise instances. */
function isExactNativePromise(value: unknown): value is Promise<KanbanRequestResult> {
  try {
    return (
      value instanceof Promise &&
      Object.getPrototypeOf(value) === Promise.prototype &&
      Object.getOwnPropertyDescriptor(value, 'then') === undefined
    );
  } catch {
    return false;
  }
}

/** Outcome captured from the native Promise intrinsic without thenable assimilation. */
type NativePromiseSettlement =
  { readonly kind: 'fulfilled'; readonly value: KanbanRequestResult } | { readonly kind: 'rejected' };

/**
 * Settles a branded native Promise without looking up its public `then` member.
 *
 * Calling the intrinsic rejects transparent proxies because they do not carry Promise internal
 * slots. The wrapper resolves with a plain box so an application result is never assimilated as a
 * thenable by this boundary.
 */
function settleExactNativePromise(value: Promise<KanbanRequestResult>): Promise<NativePromiseSettlement> {
  return new Promise((resolve, reject) => {
    try {
      NATIVE_PROMISE_THEN.call(
        value,
        (result) => resolve({ kind: 'fulfilled', value: result }),
        () => resolve({ kind: 'rejected' }),
      );
    } catch (error) {
      reject(error);
    }
  });
}

/** Creates one descriptor-vetted dispatcher context snapshot. */
function snapshotContext(value: unknown): KanbanRequestContext {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, CONTEXT_KEYS);
  return Object.freeze({ capabilities: snapshotKanbanCapabilities(properties.capabilities) });
}

/**
 * Validates and dispatches one raw request without consulting UX capabilities or mutating records.
 *
 * Application throws and rejected exact same-realm native promises become sanitized rejections.
 * Promise subclasses, modified Promise instances, cross-realm promises, and arbitrary thenables are
 * rejected as malformed results without invoking their `then` members.
 */
export async function dispatchKanbanRequest(
  request: KanbanRequest,
  dispatcher: KanbanRequestDispatcher,
  context: KanbanRequestContext,
): Promise<KanbanRequestResult> {
  const snapshot = snapshotRequest(request);
  const capturedContext = snapshotContext(context);
  let dispatched: unknown;
  try {
    dispatched = dispatcher(snapshot, capturedContext);
  } catch {
    return rejected(snapshot.operationId, 'dispatcher-failed');
  }

  if (isExactNativePromise(dispatched)) {
    try {
      const settlement = await settleExactNativePromise(dispatched);
      if (settlement.kind === 'rejected') return rejected(snapshot.operationId, 'dispatcher-failed');
      dispatched = settlement.value;
    } catch {
      return rejected(snapshot.operationId, 'invalid-dispatch-result');
    }
  }
  try {
    return snapshotResult(dispatched, snapshot.operationId);
  } catch {
    return rejected(snapshot.operationId, 'invalid-dispatch-result');
  }
}

/**
 * Clears publication metadata after either matching or contradictory authoritative data arrives.
 *
 * The helper is pure: it receives no application records and never mutates the pending collection.
 */
export function reconcileKanbanPublication(
  pending: readonly KanbanPublicationExpectation[],
  notice: KanbanPublicationNotice,
): KanbanPublicationReconciliation {
  const pendingInputs = snapshotKanbanDataArray(pending, MAX_PENDING_OPERATIONS);
  const expectations = pendingInputs.map(snapshotPublicationExpectation);
  const operationIds = expectations.map(({ operationId }) => operationId);
  if (new Set(operationIds).size !== operationIds.length) throw new KanbanInvalidSemanticValueError();

  const noticeProperties = snapshotKanbanDataProperties(notice);
  validateKanbanDataKeys(noticeProperties, NOTICE_KEYS);
  const kind = noticeProperties.kind;
  if (kind !== 'matching' && kind !== 'contradictory') throw new KanbanInvalidSemanticValueError();
  const operationId = createKanbanOperationId(requiredString(noticeProperties, 'operationId'));
  const subjects = snapshotSubjects(noticeProperties.subjects);
  const cleared = Object.freeze({ kind, operationId, subjects });
  const remaining = expectations.filter((expectation) => expectation.operationId !== operationId);
  const matched = remaining.length !== expectations.length;
  return Object.freeze({
    pending: Object.freeze(remaining),
    ...(matched ? { cleared } : {}),
  });
}
