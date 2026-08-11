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
} from './identity.js';
import type { CardKey, KanbanOperationId } from './identity.js';
import { KANBAN_LIMITS } from './limits.js';
import type {
  KanbanExpectedEntityRevision,
  KanbanExtensionRequest,
  KanbanPublicationExpectation,
  KanbanPublicationSubject,
  KanbanRequest,
  KanbanRequestExpectedRevisions,
  KanbanRequestResult,
} from './request.js';
import { snapshotKanbanRevision } from './revision.js';
import type { KanbanRevision } from './revision.js';
import { snapshotKanbanSemanticValue } from './semantic-query.js';

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
const RESULT_KEYS = new Set(['kind', 'operationId', 'publication', 'code', 'label']);
/** Exact accepted-result members. */
const ACCEPTED_RESULT_KEYS = new Set(['kind', 'operationId', 'publication']);
/** Exact rejected-result members. */
const REJECTED_RESULT_KEYS = new Set(['kind', 'operationId', 'code', 'label']);
/** Exact cancellation and supersession result members. */
const OPTIONAL_REASON_RESULT_KEYS = new Set(['kind', 'operationId', 'code', 'label']);
/** Exact dispatcher-context members. */
const CONTEXT_KEYS = new Set(['capabilities']);

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

/** Validate and detach one complete request envelope before application dispatch. */
export function snapshotKanbanRequest(value: unknown): KanbanRequest {
  const properties = snapshotKanbanDataProperties(value);
  validateKanbanDataKeys(properties, EXTENSION_REQUEST_KEYS);
  if (properties.kind !== 'extension') throw new KanbanInvalidSemanticValueError();
  try {
    return Object.freeze({
      kind: 'extension',
      extensionId: createKanbanExtensionId(requiredString(properties, 'extensionId')),
      operationId: createKanbanOperationId(requiredString(properties, 'operationId')),
      expected: snapshotKanbanRequestExpectedRevisions(properties.expected),
      payload: snapshotKanbanSemanticValue(properties.payload),
      signal: snapshotKanbanRequestSignal(properties.signal),
    } satisfies KanbanExtensionRequest);
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
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
      if (publication !== undefined && publication.operationId !== operationId) {
        return createKanbanRejectedResult(operationId, 'operation-mismatch');
      }
      return Object.freeze({ kind, operationId, ...(publication === undefined ? {} : { publication }) });
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
