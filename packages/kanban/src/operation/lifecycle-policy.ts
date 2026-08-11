import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import type { KanbanExpectedEntityRevision, KanbanRequestExpectedRevisions } from '../contract/request.js';
import { snapshotKanbanRequestExpectedRevisions } from '../contract/request-validation.js';
import type { KanbanObservationDurationBucket } from '../contract/observation.js';
import { snapshotKanbanEligibility } from './eligibility.js';
import type { KanbanEligibility } from './eligibility.js';

/** Fresh authority evidence returned after an asynchronous application callback. */
export interface KanbanOperationAuthoritySnapshot {
  /** Current equality-only revisions captured from the board and source. */
  readonly expected: KanbanRequestExpectedRevisions;
  /** Current policy result for the proposal. */
  readonly eligibility: KanbanEligibility;
}

/** Exact members accepted from an untrusted revalidation callback. */
const AUTHORITY_KEYS = new Set(['expected', 'eligibility']);

/** Validate and detach one fresh authority snapshot. */
export function snapshotKanbanOperationAuthoritySnapshot(value: unknown): KanbanOperationAuthoritySnapshot {
  const properties = snapshotKanbanDataProperties(value, AUTHORITY_KEYS.size);
  validateKanbanDataKeys(properties, AUTHORITY_KEYS);
  return Object.freeze({
    expected: snapshotKanbanRequestExpectedRevisions(properties.expected),
    eligibility: snapshotKanbanEligibility(properties.eligibility),
  });
}

/** Create a stable type-preserving identity for one expected entity. */
function entityIdentity(entity: KanbanExpectedEntityRevision): string {
  if (entity.kind === 'card') {
    return typeof entity.cardKey === 'number'
      ? `card:number:${entity.cardKey}`
      : `card:string:${entity.cardKey.length}:${entity.cardKey}`;
  }
  return entity.kind === 'column'
    ? `column:${entity.columnId.length}:${entity.columnId}`
    : `swimlane:${entity.swimlaneId.length}:${entity.swimlaneId}`;
}

/** Compare captured and current equality authority without ordering or coercion. */
export function kanbanExpectedRevisionsEqual(
  captured: KanbanRequestExpectedRevisions,
  current: KanbanRequestExpectedRevisions,
): boolean {
  if (captured.board !== current.board || captured.source !== current.source || captured.query !== current.query) {
    return false;
  }
  const left = captured.entities ?? [];
  const right = current.entities ?? [];
  if (left.length !== right.length) return false;
  const currentByIdentity = new Map(right.map((entity) => [entityIdentity(entity), entity.revision]));
  return left.every((entity) => currentByIdentity.get(entityIdentity(entity)) === entity.revision);
}

/** Convert a monotonic elapsed duration to a coarse non-sensitive observation band. */
export function kanbanDurationBucket(elapsedMilliseconds: number): KanbanObservationDurationBucket {
  if (elapsedMilliseconds < 10) return 'under-10ms';
  if (elapsedMilliseconds < 100) return 'under-100ms';
  if (elapsedMilliseconds < 1_000) return 'under-1s';
  if (elapsedMilliseconds < 10_000) return 'under-10s';
  return '10s-or-more';
}
