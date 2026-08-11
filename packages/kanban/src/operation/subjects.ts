import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanOperationId } from '../contract/identity.js';
import type { KanbanOperationId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
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
