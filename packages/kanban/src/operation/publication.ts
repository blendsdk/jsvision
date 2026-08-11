import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanOperationId } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import type {
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
  KanbanPublicationSubject,
  KanbanSubjectPublicationNotice,
} from '../contract/request.js';
import {
  snapshotKanbanPublicationExpectation,
  snapshotKanbanPublicationSubjects,
} from '../contract/request-validation.js';
import { fingerprintKanbanSemanticValue } from '../contract/semantic-query.js';

/** Exact members accepted by any publication notice before discriminator narrowing. */
const NOTICE_KEYS = new Set(['kind', 'operationId', 'subjects']);
/** Exact operation-only confirmation members. */
const CONFIRMED_KEYS = new Set(['kind', 'operationId']);
/** Exact subject-bearing publication members. */
const SUBJECT_NOTICE_KEYS = new Set(['kind', 'operationId', 'subjects']);

/** Coordinator transition selected by one exact publication notice. */
export type KanbanPublicationSettlement = 'committed' | 'superseded' | 'none';

/** Preserve numeric/string card identity when comparing publication subjects. */
function cardIdentity(cardKey: CardKey): string {
  return typeof cardKey === 'number' ? `number:${cardKey}` : `string:${cardKey.length}:${cardKey}`;
}

/** Create one stable type-preserving subject identity and revision fingerprint. */
function publicationFingerprint(subject: KanbanPublicationSubject): string {
  const identity =
    subject.kind === 'card'
      ? cardIdentity(subject.cardKey)
      : subject.kind === 'column'
        ? `${subject.columnId.length}:${subject.columnId}`
        : `${subject.swimlaneId.length}:${subject.swimlaneId}`;
  return [
    subject.kind,
    identity,
    fingerprintKanbanSemanticValue(subject.baselineRevision),
    fingerprintKanbanSemanticValue(subject.expectedRevision),
  ].join('|');
}

/**
 * Validate, detach, and freeze one operation-correlated publication notice.
 *
 * `confirmed` intentionally carries no subjects: it is the explicit application escape hatch for
 * accepted operations whose application-owned semantics cannot be inferred by the component.
 */
export function snapshotKanbanPublicationNotice(value: unknown): KanbanPublicationNotice {
  const properties = snapshotKanbanDataProperties(value, NOTICE_KEYS.size);
  validateKanbanDataKeys(properties, NOTICE_KEYS);
  if (typeof properties.operationId !== 'string') throw new KanbanInvalidSemanticValueError();
  const operationId = createKanbanOperationId(properties.operationId);
  if (properties.kind === 'confirmed') {
    validateKanbanDataKeys(properties, CONFIRMED_KEYS);
    return Object.freeze({ kind: properties.kind, operationId });
  }
  if (properties.kind !== 'matching' && properties.kind !== 'contradictory' && properties.kind !== 'deleted') {
    throw new KanbanInvalidSemanticValueError();
  }
  validateKanbanDataKeys(properties, SUBJECT_NOTICE_KEYS);
  return Object.freeze({
    kind: properties.kind,
    operationId,
    subjects: snapshotKanbanPublicationSubjects(properties.subjects),
  });
}

/** Return true only when subject identity and both revisions match as an order-independent set. */
function matchesExpectation(
  expectation: KanbanPublicationExpectation,
  notice: KanbanSubjectPublicationNotice,
): boolean {
  const expected = snapshotKanbanPublicationExpectation(expectation);
  if (expected.operationId !== notice.operationId || expected.subjects.length !== notice.subjects.length) return false;
  const expectedSubjects = expected.subjects.map(publicationFingerprint).sort();
  const publishedSubjects = notice.subjects.map(publicationFingerprint).sort();
  return expectedSubjects.every((subject, index) => subject === publishedSubjects[index]);
}

/**
 * Select a lifecycle transition without deriving a universal matcher from application-owned data.
 *
 * Matching notices commit only against an exact retained expectation. Explicit confirmation commits
 * without an expectation. Contradiction and deletion are authoritative operation-correlated
 * supersession notices. An unrelated or matching-looking notice remains inert.
 */
export function settleKanbanPublication(
  expectation: KanbanPublicationExpectation | undefined,
  value: unknown,
): Readonly<{ readonly notice: KanbanPublicationNotice; readonly settlement: KanbanPublicationSettlement }> {
  const notice = snapshotKanbanPublicationNotice(value);
  let settlement: KanbanPublicationSettlement = 'none';
  if (notice.kind === 'confirmed') settlement = 'committed';
  else if (notice.kind === 'matching') {
    if (expectation !== undefined && matchesExpectation(expectation, notice)) settlement = 'committed';
  } else {
    settlement = 'superseded';
  }
  return Object.freeze({ notice, settlement });
}
