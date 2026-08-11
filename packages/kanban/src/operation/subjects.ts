import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanOperationId } from '../contract/identity.js';
import type { CardKey, KanbanOperationId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanRequestProposal } from '../contract/request.js';
import type { KanbanCellAddress } from '../source/types.js';
import { canonicalizeKanbanOperationSubject, snapshotKanbanOperationSubjects } from './types.js';
import type { KanbanOperationSubject } from './types.js';

/** One generation-bound ownership claim over an operation's affected semantic subjects. */
export interface KanbanOperationSubjectLease {
  /** Operation that owns every subject in this lease. */
  readonly operationId: KanbanOperationId;
  /** Monotonic generation that distinguishes this lease from stale continuations. */
  readonly generation: number;
  /** Detached, sorted, type-preserving subject identities owned by the operation. */
  readonly affected: readonly KanbanOperationSubject[];
  /** Returns true only while this exact generation owns all of its subjects. */
  active(): boolean;
  /** Releases the whole subject set once; stale releases are inert. */
  release(): void;
}

/** Bounded affected-subject ownership used to reject overlapping active operations. */
export interface KanbanOperationSubjectRegistry {
  /** Atomically reserve a complete affected-subject set or reject without partial ownership. */
  reserve(operationId: KanbanOperationId, affected: readonly KanbanOperationSubject[]): KanbanOperationSubjectLease;
  /** Returns true only while the supplied lease is the current owner of its complete set. */
  isCurrent(lease: KanbanOperationSubjectLease): boolean;
  /** Releases all ownership and invalidates every outstanding lease. */
  dispose(): void;
}

/** Internal owner record shared by every subject in one atomic lease. */
interface SubjectOwner {
  readonly operationId: KanbanOperationId;
  readonly generation: number;
  active: boolean;
}

/** Validate one positive registry capacity against the package ceiling. */
function subjectCapacity(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > KANBAN_LIMITS.pendingOperations.absolute) {
    throw new KanbanInvalidSemanticValueError();
  }
  return value;
}

/** Advance a monotonic generation without ever allowing stale-generation reuse. */
function nextGeneration(current: number): number {
  if (current >= Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Kanban operation subject generation exhausted.');
  }
  return current + 1;
}

/**
 * Create one atomic subject-lock registry for a board operation coordinator.
 *
 * Subject identity remains type-preserving, so numeric card key `1`, string card key `"1"`,
 * column `"1"`, and swimlane `"1"` never collide. Empty sets are valid for extension requests
 * whose affected application entities are intentionally opaque to the component.
 */
export function createKanbanOperationSubjectRegistry(
  maximumActiveOperations = KANBAN_LIMITS.pendingOperations.safe,
): KanbanOperationSubjectRegistry {
  const capacity = subjectCapacity(maximumActiveOperations);
  const operations = new Map<KanbanOperationId, SubjectOwner>();
  const subjects = new Map<string, SubjectOwner>();
  let generation = 0;
  let disposed = false;

  return Object.freeze({
    reserve(operationId: KanbanOperationId, affected: readonly KanbanOperationSubject[]): KanbanOperationSubjectLease {
      let identity: KanbanOperationId;
      try {
        identity = createKanbanOperationId(operationId);
      } catch {
        throw new KanbanInvalidSemanticValueError();
      }
      if (disposed || operations.size >= capacity || operations.has(identity)) {
        throw new KanbanInvalidSemanticValueError();
      }
      const snapshot = snapshotKanbanOperationSubjects(affected);
      const keys = snapshot.map(canonicalizeKanbanOperationSubject);
      if (keys.some((key) => subjects.has(key))) throw new KanbanInvalidSemanticValueError();

      generation = nextGeneration(generation);
      const owner: SubjectOwner = { operationId: identity, generation, active: true };
      operations.set(identity, owner);
      for (const key of keys) subjects.set(key, owner);

      const release = (): void => {
        if (!owner.active) return;
        owner.active = false;
        operations.delete(identity);
        for (const key of keys) {
          if (subjects.get(key) === owner) subjects.delete(key);
        }
      };
      return Object.freeze({
        operationId: identity,
        generation: owner.generation,
        affected: snapshot,
        active: (): boolean => owner.active && operations.get(identity) === owner,
        release,
      });
    },
    isCurrent(lease: KanbanOperationSubjectLease): boolean {
      if (disposed || !lease.active()) return false;
      const owner = operations.get(lease.operationId);
      return owner?.generation === lease.generation;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const owner of operations.values()) owner.active = false;
      operations.clear();
      subjects.clear();
    },
  });
}

/** Card placement variants that may reserve neighboring card anchors. */
type CardPlacementProposal = Extract<KanbanRequestProposal, { readonly kind: 'card-move' | 'card-duplicate' }>;

/** Create one frozen card subject without retaining an application record. */
function cardSubject(cardKey: CardKey): KanbanOperationSubject {
  return Object.freeze({ kind: 'card', cardKey });
}

/** Add the structural identities represented by one semantic cell address. */
function appendCellSubjects(subjects: KanbanOperationSubject[], address: KanbanCellAddress): void {
  subjects.push(Object.freeze({ kind: 'column', columnId: address.columnId }));
  if (address.swimlaneId !== undefined) {
    subjects.push(Object.freeze({ kind: 'swimlane', swimlaneId: address.swimlaneId }));
  }
}

/** Add stable card anchors referenced by one semantic card placement. */
function appendCardPlacementSubjects(
  subjects: KanbanOperationSubject[],
  position: CardPlacementProposal['position'],
): void {
  if (position.kind === 'between') {
    if (position.beforeCardKey !== null) subjects.push(cardSubject(position.beforeCardKey));
    if (position.afterCardKey !== null) subjects.push(cardSubject(position.afterCardKey));
  } else if (position.kind === 'window-edge') {
    subjects.push(cardSubject(position.neighborCardKey));
  }
}

/** Add neighboring column identities used by one structural interval. */
function appendColumnPlacementSubjects(
  subjects: KanbanOperationSubject[],
  position: Extract<KanbanRequestProposal, { readonly kind: 'column-add' | 'column-reorder' }>['position'],
): void {
  if (position.kind !== 'between') return;
  if (position.beforeColumnId !== null) {
    subjects.push(Object.freeze({ kind: 'column', columnId: position.beforeColumnId }));
  }
  if (position.afterColumnId !== null) {
    subjects.push(Object.freeze({ kind: 'column', columnId: position.afterColumnId }));
  }
}

/** Add a referenced swimlane neighbor when the placement is not an absolute edge. */
function appendSwimlanePlacementSubject(
  subjects: KanbanOperationSubject[],
  position: Extract<KanbanRequestProposal, { readonly kind: 'swimlane-add' | 'swimlane-reorder' }>['position'],
): void {
  if (position.kind === 'before' || position.kind === 'after') {
    subjects.push(Object.freeze({ kind: 'swimlane', swimlaneId: position.swimlaneId }));
  }
}

/** Derive the smallest safe sorted conflict set carried by one validated proposal. */
export function deriveKanbanOperationSubjects(proposal: KanbanRequestProposal): readonly KanbanOperationSubject[] {
  const affected: KanbanOperationSubject[] = [];
  switch (proposal.kind) {
    case 'card-create':
      appendCellSubjects(affected, proposal.target);
      break;
    case 'card-update':
    case 'card-archive':
    case 'card-delete':
      affected.push(cardSubject(proposal.cardKey));
      break;
    case 'card-duplicate':
      affected.push(cardSubject(proposal.cardKey));
      appendCellSubjects(affected, proposal.target);
      appendCardPlacementSubjects(affected, proposal.position);
      break;
    case 'card-move':
      for (const moved of proposal.moved) affected.push(cardSubject(moved.cardKey));
      appendCellSubjects(affected, proposal.target);
      appendCardPlacementSubjects(affected, proposal.position);
      break;
    case 'column-add':
      affected.push(Object.freeze({ kind: 'column', columnId: proposal.draft.columnId }));
      appendColumnPlacementSubjects(affected, proposal.position);
      break;
    case 'column-update':
      affected.push(Object.freeze({ kind: 'column', columnId: proposal.columnId }));
      break;
    case 'column-reorder':
      affected.push(Object.freeze({ kind: 'column', columnId: proposal.columnId }));
      appendColumnPlacementSubjects(affected, proposal.position);
      break;
    case 'column-delete':
      affected.push(Object.freeze({ kind: 'column', columnId: proposal.columnId }));
      if (proposal.reassignTo !== undefined) {
        affected.push(Object.freeze({ kind: 'column', columnId: proposal.reassignTo }));
      }
      break;
    case 'swimlane-add':
      affected.push(Object.freeze({ kind: 'swimlane', swimlaneId: proposal.draft.swimlaneId }));
      appendSwimlanePlacementSubject(affected, proposal.position);
      break;
    case 'swimlane-update':
      affected.push(Object.freeze({ kind: 'swimlane', swimlaneId: proposal.swimlaneId }));
      break;
    case 'swimlane-reorder':
      affected.push(Object.freeze({ kind: 'swimlane', swimlaneId: proposal.swimlaneId }));
      appendSwimlanePlacementSubject(affected, proposal.position);
      break;
    case 'swimlane-delete':
      affected.push(Object.freeze({ kind: 'swimlane', swimlaneId: proposal.swimlaneId }));
      if (proposal.reassignTo !== undefined) {
        affected.push(Object.freeze({ kind: 'swimlane', swimlaneId: proposal.reassignTo }));
      }
      break;
    case 'saved-view-save':
    case 'saved-view-rename':
    case 'saved-view-delete':
    case 'extension':
      break;
  }
  const unique = new Map(affected.map((subject) => [canonicalizeKanbanOperationSubject(subject), subject]));
  const ordered = [...unique.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, subject]) => subject);
  return snapshotKanbanOperationSubjects(ordered);
}
