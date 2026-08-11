import { dispatchKanbanRequest } from '../contract/authority.js';
import { snapshotKanbanCapabilities } from '../contract/capability.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import { createKanbanOperationId } from '../contract/identity.js';
import type { KanbanOperationId } from '../contract/identity.js';
import { KanbanInvalidLimitError, KANBAN_LIMITS, validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanLimitOptions, KanbanResolvedLimits } from '../contract/limits.js';
import type {
  KanbanRequest,
  KanbanRequestDispatcher,
  KanbanRequestExpectedRevisions,
  KanbanRequestProposal,
  KanbanRequestResult,
} from '../contract/request.js';
import {
  createKanbanRequestEnvelope,
  snapshotKanbanRequestExpectedRevisions,
  snapshotKanbanRequestProposal,
} from '../contract/request-validation.js';
import { fingerprintKanbanSemanticValue } from '../contract/semantic-query.js';
import { settleKanbanConfirmation } from './confirmation.js';
import { classifyKanbanRequestConfirmation, snapshotKanbanEligibility } from './eligibility.js';
import type { KanbanEligibility } from './eligibility.js';
import { createKanbanOperationIdRegistry } from './operation-id.js';
import type { KanbanOperationIdFactory, KanbanOperationIdLease, KanbanOperationIdRegistry } from './operation-id.js';
import { createKanbanOperationSubjectRegistry, deriveKanbanOperationSubjects } from './subjects.js';
import type { KanbanOperationSubjectLease, KanbanOperationSubjectRegistry } from './subjects.js';
import { createKanbanPendingProjection, snapshotKanbanOperationSnapshot } from './types.js';
import type { KanbanConfirmer, KanbanOperationSnapshot, KanbanOperationSubscriber } from './types.js';

/** Unsubscribe function returned by payload-free operation-state subscriptions. */
export type KanbanOperationUnsubscribe = () => void;

/** Construction options for one board-owned semantic operation coordinator. */
export interface KanbanOperationCoordinatorOptions {
  /** Single application-owned mutation dispatcher. */
  readonly dispatcher: KanbanRequestDispatcher;
  /** Live presentation capabilities captured immediately before dispatch. */
  readonly capabilities?: () => unknown;
  /** Optional application operation-ID factory; every returned value is validated. */
  readonly operationId?: KanbanOperationIdFactory;
  /** Optional application confirmation callback for warnings and destructive proposals. */
  readonly confirm?: KanbanConfirmer;
  /** Package integration seam that recomputes current eligibility after confirmation callbacks. */
  readonly revalidate?: KanbanOperationRevalidator;
  /** Optional lower resource ceilings for this coordinator. */
  readonly limits?: KanbanLimitOptions;
}

/** Recompute current eligibility and revision currency without exposing source records. */
export type KanbanOperationRevalidator = (
  proposal: KanbanRequestProposal,
  expected: KanbanRequestExpectedRevisions,
) => KanbanEligibility;

/** Atomic handoff returned after pending state is visible and dispatch has started. */
export interface KanbanOperationSubmission {
  /** Coordinator-owned stable operation identity. */
  readonly operationId: KanbanOperationId;
  /** Exact application result settlement, completed by later lifecycle processing. */
  readonly completion: Promise<KanbanRequestResult>;
}

/** Coordinator-owned resources retained for one admitted application dispatch. */
interface ActiveKanbanOperation {
  readonly request: KanbanRequest;
  readonly id: KanbanOperationIdLease;
  readonly subjects: KanbanOperationSubjectLease;
  readonly controller: AbortController;
  readonly coordinatorGeneration: number;
}

/** Validate a caller-supplied finite capacity before allocating its registry. */
function registryCapacity(value: number, absolute: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > absolute) throw new KanbanInvalidLimitError();
  return value;
}

/**
 * Monotonic coordinator generation used by asynchronous continuations to detect stale ownership.
 *
 * Exhaustion fails before mutation because wrapping could make arbitrarily old work appear current.
 */
export class KanbanOperationGenerationClock {
  #generation = 1;
  #disposed = false;

  /** Returns the current generation for capture before asynchronous application work. */
  capture(): number {
    return this.#generation;
  }

  /** Returns true only while the captured generation still belongs to a live coordinator. */
  isCurrent(generation: number): boolean {
    return !this.#disposed && generation === this.#generation;
  }

  /** Invalidates every earlier capture and returns the newly current generation. */
  advance(): number {
    if (this.#disposed) return this.#generation;
    if (this.#generation >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Kanban operation coordinator generation exhausted.');
    }
    this.#generation += 1;
    return this.#generation;
  }

  /** Permanently invalidates the clock without wrapping its visible generation. */
  dispose(): void {
    if (this.#disposed) return;
    this.advance();
    this.#disposed = true;
  }
}

/**
 * Bounded FIFO store for whole committed undo descriptors.
 *
 * Values are retained and evicted as opaque entries. The registry never inspects, invokes, or
 * partially copies a token or callback-bearing descriptor.
 */
export class KanbanCommittedUndoRegistry<TDescriptor> {
  readonly #capacity: number;
  readonly #entries = new Map<KanbanOperationId, TDescriptor>();
  #disposed = false;

  /** Creates an empty registry with a validated independent descriptor capacity. */
  constructor(capacity = KANBAN_LIMITS.retainedUndoDescriptors.safe) {
    this.#capacity = registryCapacity(capacity, KANBAN_LIMITS.retainedUndoDescriptors.absolute);
  }

  /** Retains one whole committed descriptor and evicts the oldest whole entry when necessary. */
  retain(operationId: KanbanOperationId, descriptor: TDescriptor): void {
    if (this.#disposed) return;
    const identity = createKanbanOperationId(operationId);
    if (this.#capacity === 0) return;
    this.#entries.delete(identity);
    this.#entries.set(identity, descriptor);
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
  }

  /** Returns the retained descriptor without changing FIFO order. */
  get(operationId: KanbanOperationId): TDescriptor | undefined {
    return this.#disposed ? undefined : this.#entries.get(createKanbanOperationId(operationId));
  }

  /** Drops one whole descriptor without inspecting or invoking it. */
  delete(operationId: KanbanOperationId): boolean {
    return !this.#disposed && this.#entries.delete(createKanbanOperationId(operationId));
  }

  /** Returns the retained operation identities in deterministic oldest-first order. */
  operationIds(): readonly KanbanOperationId[] {
    return Object.freeze([...this.#entries.keys()]);
  }

  /** Releases every retained descriptor and makes later writes inert. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#entries.clear();
  }
}

/**
 * Bounded active-operation state and subscription registry used by the semantic coordinator.
 *
 * Notifications are queued so subscriber reentrancy cannot reorder one transition ahead of the
 * transition currently being delivered. Each callback sees an immutable payload-free snapshot;
 * callback failure is isolated from coordinator state and other subscribers.
 */
export class KanbanOperationSnapshotRegistry {
  readonly #activeCapacity: number;
  readonly #subscriberCapacity: number;
  readonly #active = new Map<KanbanOperationId, KanbanOperationSnapshot>();
  readonly #subscribers = new Set<KanbanOperationSubscriber>();
  readonly #notifications: KanbanOperationSnapshot[] = [];
  #notifying = false;
  #disposed = false;

  /** Creates an empty registry with validated active-operation and subscriber ceilings. */
  constructor(
    activeCapacity = KANBAN_LIMITS.pendingOperations.safe,
    subscriberCapacity = KANBAN_LIMITS.retainedObservations.safe,
  ) {
    this.#activeCapacity = registryCapacity(activeCapacity, KANBAN_LIMITS.pendingOperations.absolute);
    this.#subscriberCapacity = registryCapacity(subscriberCapacity, KANBAN_LIMITS.retainedObservations.absolute);
  }

  /** Publishes one lifecycle transition after updating the bounded active snapshot set. */
  publish(value: KanbanOperationSnapshot): void {
    if (this.#disposed) return;
    const snapshot = snapshotKanbanOperationSnapshot(value);
    const active = snapshot.state === 'proposed' || snapshot.state === 'pending' || snapshot.state === 'accepted';
    if (active && !this.#active.has(snapshot.operationId) && this.#active.size >= this.#activeCapacity) {
      throw new KanbanInvalidLimitError();
    }
    if (active) this.#active.set(snapshot.operationId, snapshot);
    else this.#active.delete(snapshot.operationId);
    this.#notifications.push(snapshot);
    this.#flushNotifications();
  }

  /** Returns an immutable oldest-admitted-first view of active payload-free snapshots. */
  snapshot(): readonly KanbanOperationSnapshot[] {
    return Object.freeze([...this.#active.values()]);
  }

  /** Registers one lifecycle callback and returns an idempotent unsubscriber. */
  subscribe(subscriber: KanbanOperationSubscriber): KanbanOperationUnsubscribe {
    if (this.#disposed) return () => undefined;
    if (typeof subscriber !== 'function' || this.#subscribers.size >= this.#subscriberCapacity) {
      throw new KanbanInvalidLimitError();
    }
    this.#subscribers.add(subscriber);
    let active = true;
    return (): void => {
      if (!active) return;
      active = false;
      this.#subscribers.delete(subscriber);
    };
  }

  /** Clears snapshots, queued notifications, and subscribers idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#active.clear();
    this.#notifications.length = 0;
    this.#subscribers.clear();
  }

  /** Drain lifecycle callbacks in publication order while isolating callback failures. */
  #flushNotifications(): void {
    if (this.#notifying) return;
    this.#notifying = true;
    try {
      while (!this.#disposed && this.#notifications.length > 0) {
        const snapshot = this.#notifications.shift();
        if (snapshot === undefined) continue;
        for (const subscriber of [...this.#subscribers]) {
          try {
            subscriber(snapshot);
          } catch {
            // Lifecycle observers cannot roll back an already-published coordinator transition.
          }
        }
      }
    } finally {
      this.#notifying = false;
      if (this.#disposed) this.#notifications.length = 0;
    }
  }
}

/** Snapshot live capabilities without allowing a throwing application getter to escape. */
function currentCapabilities(getter: (() => unknown) | undefined): KanbanCapabilities {
  try {
    return snapshotKanbanCapabilities(getter?.() ?? {});
  } catch {
    return Object.freeze({});
  }
}

/** Ensure an approved warning did not change meaning while application confirmation was open. */
function confirmationStillApplies(previous: KanbanEligibility, current: KanbanEligibility): boolean {
  if (current.kind === 'allowed') return true;
  if (previous.kind !== 'warning' || current.kind !== 'warning' || previous.code !== current.code) return false;
  const previousParams = previous.params === undefined ? false : fingerprintKanbanSemanticValue(previous.params);
  const currentParams = current.params === undefined ? false : fingerprintKanbanSemanticValue(current.params);
  return previousParams === currentParams;
}

/**
 * Owns atomic proposal admission and the board's payload-free semantic operation projection.
 *
 * `commitProposal` publishes proposed and pending snapshots synchronously before invoking the
 * dispatcher. Exact settlement, confirmation, publication, cancellation, and undo policies build
 * on the retained operation resources without introducing another authority path.
 *
 * @example
 * ```ts
 * const coordinator = new KanbanOperationCoordinator({ dispatcher });
 * const submission = coordinator.commitProposal({ kind: 'card-archive', cardKey: 42 });
 * console.log(submission.operationId, coordinator.snapshot()[0]?.state); // pending
 * ```
 */
export class KanbanOperationCoordinator {
  readonly #dispatcher: KanbanRequestDispatcher;
  readonly #capabilities: (() => unknown) | undefined;
  readonly #confirm: KanbanConfirmer | undefined;
  readonly #revalidate: KanbanOperationRevalidator | undefined;
  readonly #limits: KanbanResolvedLimits;
  readonly #ids: KanbanOperationIdRegistry;
  readonly #subjects: KanbanOperationSubjectRegistry;
  readonly #snapshots: KanbanOperationSnapshotRegistry;
  readonly #generation = new KanbanOperationGenerationClock();
  readonly #operations = new Map<KanbanOperationId, ActiveKanbanOperation>();
  #disposed = false;

  /** Validates resource options before allocating coordinator-owned registries. */
  constructor(options: KanbanOperationCoordinatorOptions) {
    this.#limits = validateKanbanLimitOptions(options.limits);
    this.#dispatcher = options.dispatcher;
    this.#capabilities = options.capabilities;
    this.#confirm = options.confirm;
    this.#revalidate = options.revalidate;
    this.#ids = createKanbanOperationIdRegistry({
      ...(options.operationId === undefined ? {} : { factory: options.operationId }),
      activeLimit: this.#limits.pendingOperations,
      retainedLimit: this.#limits.retainedOperationIds,
    });
    this.#subjects = createKanbanOperationSubjectRegistry(this.#limits.pendingOperations);
    this.#snapshots = new KanbanOperationSnapshotRegistry(
      this.#limits.pendingOperations,
      this.#limits.retainedObservations,
    );
  }

  /**
   * Atomically admit one standard proposal and start dispatch after pending state is observable.
   *
   * The caller supplies already-captured equality revisions because the coordinator deliberately
   * does not read application records or source sessions.
   */
  commitProposal(
    value: KanbanRequestProposal,
    expected: KanbanRequestExpectedRevisions = {},
    eligibility: KanbanEligibility = Object.freeze({ kind: 'allowed' }),
  ): KanbanOperationSubmission {
    if (this.#disposed || this.#operations.size >= this.#limits.pendingOperations) {
      throw new KanbanInvalidLimitError();
    }
    const proposal = snapshotKanbanRequestProposal(value);
    const capturedExpected = snapshotKanbanRequestExpectedRevisions(expected);
    const capturedEligibility = snapshotKanbanEligibility(eligibility);
    const id = this.#ids.acquire();
    let subjects: KanbanOperationSubjectLease | undefined;
    try {
      subjects = this.#subjects.reserve(id.operationId, deriveKanbanOperationSubjects(proposal));
      const controller = new AbortController();
      const request = createKanbanRequestEnvelope(proposal, {
        operationId: id.operationId,
        expected: capturedExpected,
        signal: controller.signal,
      });
      const coordinatorGeneration = this.#generation.capture();
      const operation: ActiveKanbanOperation = {
        request,
        id,
        subjects,
        controller,
        coordinatorGeneration,
      };
      this.#operations.set(id.operationId, operation);
      this.#snapshots.publish(
        Object.freeze({
          operationId: id.operationId,
          kind: request.kind,
          state: 'proposed',
          affected: subjects.affected,
        }),
      );
      const completion = this.#confirmAndDispatch(operation, proposal, capturedExpected, capturedEligibility);
      return Object.freeze({ operationId: id.operationId, completion });
    } catch (error) {
      subjects?.release();
      id.release();
      throw error;
    }
  }

  /** Confirm when required, revalidate current ownership, then expose pending state before dispatch. */
  async #confirmAndDispatch(
    operation: ActiveKanbanOperation,
    proposal: KanbanRequestProposal,
    expected: KanbanRequestExpectedRevisions,
    eligibility: KanbanEligibility,
  ): Promise<KanbanRequestResult> {
    const classification = classifyKanbanRequestConfirmation(proposal, eligibility);
    if (classification.kind !== 'not-required') {
      const settlement = await settleKanbanConfirmation(this.#confirm, {
        operationId: operation.id.operationId,
        proposal,
        affected: operation.subjects.affected,
        expected,
        eligibility: classification,
        signal: operation.controller.signal,
      });
      if (settlement !== 'approved') {
        return Object.freeze({
          kind: 'cancelled',
          operationId: operation.id.operationId,
          code: settlement === 'declined' ? 'confirmation-declined' : 'confirmation-invalid',
        });
      }
      if (this.#revalidate === undefined) {
        return Object.freeze({
          kind: 'cancelled',
          operationId: operation.id.operationId,
          code: 'confirmation-stale',
        });
      }
      let current: KanbanEligibility;
      try {
        current = snapshotKanbanEligibility(this.#revalidate(proposal, expected));
      } catch {
        return Object.freeze({
          kind: 'cancelled',
          operationId: operation.id.operationId,
          code: 'confirmation-stale',
        });
      }
      if (!confirmationStillApplies(eligibility, current)) {
        return Object.freeze({
          kind: 'cancelled',
          operationId: operation.id.operationId,
          code: current.kind === 'blocked' || current.kind === 'unavailable' ? current.code : 'confirmation-stale',
        });
      }
    }
    if (!this.#isCurrent(operation)) {
      return Object.freeze({
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: 'operation-cancelled',
      });
    }
    this.#snapshots.publish(
      Object.freeze({
        operationId: operation.id.operationId,
        kind: operation.request.kind,
        state: 'pending',
        affected: operation.subjects.affected,
        projection: createKanbanPendingProjection(proposal),
      }),
    );
    return dispatchKanbanRequest(operation.request, this.#dispatcher, {
      capabilities: currentCapabilities(this.#capabilities),
    });
  }

  /** Check coordinator, operation, subject, and cancellation generations before continuation. */
  #isCurrent(operation: ActiveKanbanOperation): boolean {
    return (
      !this.#disposed &&
      this.#generation.isCurrent(operation.coordinatorGeneration) &&
      this.#operations.get(operation.id.operationId) === operation &&
      this.#subjects.isCurrent(operation.subjects) &&
      !operation.controller.signal.aborted
    );
  }

  /** Returns detached active operation projections in admission order. */
  snapshot(): readonly KanbanOperationSnapshot[] {
    return this.#snapshots.snapshot();
  }

  /** Subscribes to immutable payload-free lifecycle transitions. */
  subscribe(subscriber: KanbanOperationSubscriber): KanbanOperationUnsubscribe {
    return this.#snapshots.subscribe(subscriber);
  }

  /** Invalidates and aborts retained admissions; later asynchronous settlement becomes unusable. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation.dispose();
    for (const operation of this.#operations.values()) {
      operation.controller.abort();
      operation.subjects.release();
      operation.id.retain();
    }
    this.#operations.clear();
    this.#snapshots.dispose();
    this.#subjects.dispose();
    this.#ids.dispose();
  }
}
