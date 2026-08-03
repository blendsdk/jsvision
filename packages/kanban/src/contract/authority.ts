import { snapshotKanbanCapabilities, snapshotKanbanLabel, snapshotKanbanReasonCode } from './capability.js';
import type { KanbanRequestContext } from './capability.js';
import { KanbanInvalidSemanticValueError } from './error.js';
import {
  createKanbanColumnId,
  createKanbanOperationId,
  createKanbanSwimlaneId,
  createKanbanExtensionId,
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

/** Maximum entity or publication subjects accepted in one authority envelope. */
const MAX_SUBJECTS = KANBAN_LIMITS.pendingOperations.safe;
/** Terminal controls forbidden from card keys and revision strings retained as metadata. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
/** Shared encoder for bounded authority metadata. */
const AUTHORITY_ENCODER = new TextEncoder();

/** Returns true only for finite string-or-number revisions. */
function isRevision(value: unknown): value is KanbanRevision {
  return (
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' &&
      value.length > 0 &&
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
    !CONTROL_CHARACTERS.test(value) &&
    AUTHORITY_ENCODER.encode(value).byteLength <= KANBAN_LIMITS.idBytes.safe
  ) {
    return value;
  }
  throw new KanbanInvalidSemanticValueError();
}

/** Copies one typed captured entity revision. */
function snapshotExpectedEntity(value: KanbanExpectedEntityRevision): KanbanExpectedEntityRevision {
  if (!isRevision(value.revision)) throw new KanbanInvalidSemanticValueError();
  switch (value.kind) {
    case 'card':
      return Object.freeze({ kind: 'card', cardKey: snapshotCardKey(value.cardKey), revision: value.revision });
    case 'column':
      return Object.freeze({
        kind: 'column',
        columnId: createKanbanColumnId(value.columnId),
        revision: value.revision,
      });
    case 'swimlane':
      return Object.freeze({
        kind: 'swimlane',
        swimlaneId: createKanbanSwimlaneId(value.swimlaneId),
        revision: value.revision,
      });
  }
}

/** Creates a detached bounded revision snapshot. */
function snapshotExpectedRevisions(value: KanbanRequestExpectedRevisions): KanbanRequestExpectedRevisions {
  const revisions: Partial<Record<'board' | 'source' | 'query', KanbanRevision>> = {};
  for (const key of ['board', 'source', 'query'] as const) {
    const revision = value[key];
    if (revision !== undefined) {
      if (!isRevision(revision)) throw new KanbanInvalidSemanticValueError();
      revisions[key] = revision;
    }
  }
  const entities = value.entities ?? [];
  if (!Array.isArray(entities) || entities.length > MAX_SUBJECTS) {
    throw new KanbanInvalidSemanticValueError();
  }
  return Object.freeze({
    ...revisions,
    ...(entities.length === 0 ? {} : { entities: Object.freeze(entities.map(snapshotExpectedEntity)) }),
  });
}

/** Validates and detaches a request before invoking application code. */
function snapshotRequest(request: KanbanRequest): KanbanRequest {
  if (request.kind !== 'extension' || !(request.signal instanceof AbortSignal)) {
    throw new KanbanInvalidSemanticValueError();
  }
  return Object.freeze({
    kind: 'extension',
    extensionId: createKanbanExtensionId(request.extensionId),
    operationId: createKanbanOperationId(request.operationId),
    expected: snapshotExpectedRevisions(request.expected),
    payload: snapshotKanbanSemanticValue(request.payload),
    signal: request.signal,
  } satisfies KanbanExtensionRequest);
}

/** Copies one publication subject without retaining application records. */
function snapshotPublicationSubject(subject: KanbanPublicationSubject): KanbanPublicationSubject {
  if (!isRevision(subject.baselineRevision) || !isRevision(subject.expectedRevision)) {
    throw new KanbanInvalidSemanticValueError();
  }
  switch (subject.kind) {
    case 'card':
      return Object.freeze({
        kind: 'card',
        cardKey: snapshotCardKey(subject.cardKey),
        baselineRevision: subject.baselineRevision,
        expectedRevision: subject.expectedRevision,
      });
    case 'column':
      return Object.freeze({
        kind: 'column',
        columnId: createKanbanColumnId(subject.columnId),
        baselineRevision: subject.baselineRevision,
        expectedRevision: subject.expectedRevision,
      });
    case 'swimlane':
      return Object.freeze({
        kind: 'swimlane',
        swimlaneId: createKanbanSwimlaneId(subject.swimlaneId),
        baselineRevision: subject.baselineRevision,
        expectedRevision: subject.expectedRevision,
      });
  }
}

/** Creates a detached bounded publication expectation. */
function snapshotPublicationExpectation(value: KanbanPublicationExpectation): KanbanPublicationExpectation {
  if (!Array.isArray(value.subjects) || value.subjects.length === 0 || value.subjects.length > MAX_SUBJECTS) {
    throw new KanbanInvalidSemanticValueError();
  }
  return Object.freeze({
    operationId: createKanbanOperationId(value.operationId),
    subjects: Object.freeze(value.subjects.map(snapshotPublicationSubject)),
  });
}

/** Creates a sanitized rejection correlated to the validated request operation. */
function rejected(operationId: KanbanOperationId, code: string): KanbanRequestResult {
  return Object.freeze({ kind: 'rejected', operationId, code });
}

/** Narrows an untrusted dispatcher value without invoking accessor properties. */
function isRequestResult(value: object): value is KanbanRequestResult {
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return false;
  }
  const kind = descriptors.kind;
  const operationId = descriptors.operationId;
  if (
    kind === undefined ||
    kind.get !== undefined ||
    kind.set !== undefined ||
    operationId === undefined ||
    operationId.get !== undefined ||
    operationId.set !== undefined ||
    typeof operationId.value !== 'string'
  ) {
    return false;
  }
  if (kind.value === 'rejected') {
    const code = descriptors.code;
    return code !== undefined && code.get === undefined && code.set === undefined && typeof code.value === 'string';
  }
  return kind.value === 'accepted' || kind.value === 'cancelled' || kind.value === 'superseded';
}

/** Validates and detaches one application result. */
function snapshotResult(result: KanbanRequestResult, operationId: KanbanOperationId): KanbanRequestResult {
  if (result.operationId !== operationId) return rejected(operationId, 'operation-mismatch');
  switch (result.kind) {
    case 'accepted': {
      const publication =
        result.publication === undefined ? undefined : snapshotPublicationExpectation(result.publication);
      if (publication !== undefined && publication.operationId !== operationId) {
        return rejected(operationId, 'operation-mismatch');
      }
      return Object.freeze({
        kind: 'accepted',
        operationId,
        ...(publication === undefined ? {} : { publication }),
      });
    }
    case 'rejected': {
      const code = snapshotKanbanReasonCode(result.code) ?? 'application-rejected';
      const label = snapshotKanbanLabel(result.label);
      return Object.freeze({
        kind: 'rejected',
        operationId,
        code,
        ...(label === undefined ? {} : { label }),
      });
    }
    case 'cancelled':
    case 'superseded': {
      const code = snapshotKanbanReasonCode(result.code);
      const label = snapshotKanbanLabel(result.label);
      return Object.freeze({
        kind: result.kind,
        operationId,
        ...(code === undefined ? {} : { code }),
        ...(label === undefined ? {} : { label }),
      });
    }
  }
}

/**
 * Validates and dispatches one raw request without consulting UX capabilities or mutating records.
 *
 * Application throws, rejected native promises, and malformed outcomes become sanitized rejections.
 * Arbitrary thenables are treated as malformed synchronous results and their `then` member is never
 * invoked.
 */
export async function dispatchKanbanRequest(
  request: KanbanRequest,
  dispatcher: KanbanRequestDispatcher,
  context: KanbanRequestContext,
): Promise<KanbanRequestResult> {
  const snapshot = snapshotRequest(request);
  const capturedContext = Object.freeze({ capabilities: snapshotKanbanCapabilities(context.capabilities) });
  try {
    const dispatched: unknown = dispatcher(snapshot, capturedContext);
    const result: unknown = dispatched instanceof Promise ? await dispatched : dispatched;
    if (typeof result !== 'object' || result === null || 'then' in result || !isRequestResult(result)) {
      return rejected(snapshot.operationId, 'invalid-dispatch-result');
    }
    return snapshotResult(result, snapshot.operationId);
  } catch {
    return rejected(snapshot.operationId, 'dispatcher-failed');
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
  const operationId = createKanbanOperationId(notice.operationId);
  const subjects = Object.freeze(notice.subjects.map(snapshotPublicationSubject));
  if (subjects.length === 0 || subjects.length > MAX_SUBJECTS) throw new KanbanInvalidSemanticValueError();
  const cleared = Object.freeze({ kind: notice.kind, operationId, subjects });
  const remaining = pending
    .map(snapshotPublicationExpectation)
    .filter((expectation) => expectation.operationId !== operationId);
  const matched = remaining.length !== pending.length;
  return Object.freeze({
    pending: Object.freeze(remaining),
    ...(matched ? { cleared } : {}),
  });
}
