import { dispatchKanbanRequestImmediate } from '../contract/authority.js';
import { snapshotKanbanCapabilities } from '../contract/capability.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import { createKanbanOperationId } from '../contract/identity.js';
import type { KanbanOperationId } from '../contract/identity.js';
import { KanbanInvalidLimitError, validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanLimitOptions, KanbanResolvedLimits } from '../contract/limits.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import type {
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
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
  snapshotKanbanRequest,
} from '../contract/request-validation.js';
import { fingerprintKanbanSemanticValue } from '../contract/semantic-query.js';
import { createKanbanInverseRequestContext, settleKanbanConfirmation } from './confirmation.js';
import type { KanbanConfirmationCallback } from './confirmation.js';
import { classifyKanbanRequestConfirmation, snapshotKanbanEligibility } from './eligibility.js';
import type { KanbanEligibility } from './eligibility.js';
import { createKanbanOperationIdRegistry } from './operation-id.js';
import type { KanbanOperationIdFactory, KanbanOperationIdLease, KanbanOperationIdRegistry } from './operation-id.js';
import { settleKanbanPublication } from './publication.js';
import {
  kanbanDurationBucket,
  kanbanExpectedRevisionsEqual,
  snapshotKanbanOperationAuthoritySnapshot,
} from './lifecycle-policy.js';
import type { KanbanOperationAuthoritySnapshot } from './lifecycle-policy.js';
import {
  KanbanCommittedUndoRegistry,
  KanbanOperationGenerationClock,
  KanbanOperationSnapshotRegistry,
} from './registries.js';
import type { KanbanOperationUnsubscribe } from './registries.js';
import { createKanbanOperationSubjectRegistry, deriveKanbanOperationSubjects } from './subjects.js';
import type { KanbanOperationSubjectLease, KanbanOperationSubjectRegistry } from './subjects.js';
import { settleKanbanInverseRequest } from './undo.js';
import {
  acceptKanbanPendingProjection,
  createKanbanPendingProjection,
  snapshotKanbanOperationSnapshot,
} from './types.js';
import type {
  KanbanInverseRequestBuilder,
  KanbanOperationSnapshot,
  KanbanOperationState,
  KanbanOperationSubject,
  KanbanOperationSubscriber,
  KanbanPendingProjection,
  KanbanUndoDescriptor,
} from './types.js';

/** Internal dispatcher ingestion type whose untrusted output is validated after invocation. */
export type KanbanCoordinatorDispatcher = (...parameters: Parameters<KanbanRequestDispatcher>) => unknown;

export {
  KanbanCommittedUndoRegistry,
  KanbanOperationGenerationClock,
  KanbanOperationSnapshotRegistry,
} from './registries.js';
export type { KanbanOperationUnsubscribe } from './registries.js';

/** Construction options for one board-owned semantic operation coordinator. */
export interface KanbanOperationCoordinatorOptions {
  /** Single application-owned mutation dispatcher. */
  readonly dispatcher: KanbanCoordinatorDispatcher;
  /** Live presentation capabilities captured immediately before dispatch. */
  readonly capabilities?: () => unknown;
  /** Optional application operation-ID factory; every returned value is validated. */
  readonly operationId?: KanbanOperationIdFactory;
  /** Optional application confirmation callback for warnings and destructive proposals. */
  readonly confirm?: KanbanConfirmationCallback;
  /** Optional application callback that resolves an opaque undo token into one fresh proposal. */
  readonly resolveUndo?: KanbanInverseRequestBuilder;
  /** Package integration seam that recomputes current eligibility after confirmation callbacks. */
  readonly revalidate?: KanbanOperationRevalidator;
  /** Optional lower resource ceilings for this coordinator. */
  readonly limits?: KanbanLimitOptions;
  /** Optional payload-free lifecycle observation sink. */
  readonly observe?: (observation: KanbanObservation) => void;
  /** Monotonic millisecond clock used only to produce coarse lifecycle duration bands. */
  readonly now?: () => number;
}

/** Recompute current eligibility and revision currency without exposing source records. */
export type KanbanOperationRevalidator = (
  proposal: KanbanRequestProposal,
  expected: KanbanRequestExpectedRevisions,
) => KanbanOperationAuthoritySnapshot;

export type { KanbanOperationAuthoritySnapshot } from './lifecycle-policy.js';

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
  readonly projection: KanbanPendingProjection;
  readonly startedAt: number;
  readonly applicationConfirmed: boolean;
  state: 'proposed' | 'pending' | 'accepted';
  publication?: KanbanPublicationExpectation;
  undo?: KanbanUndoDescriptor;
  releaseExternalSignal?: () => void;
}

/** Whole committed entry retained for a future application-authorized inverse operation. */
interface CommittedKanbanUndo {
  readonly prior: KanbanOperationSnapshot;
  readonly undo: KanbanUndoDescriptor;
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
  readonly #dispatcher: KanbanCoordinatorDispatcher;
  readonly #capabilities: (() => unknown) | undefined;
  readonly #confirm: KanbanConfirmationCallback | undefined;
  readonly #resolveUndo: KanbanInverseRequestBuilder | undefined;
  readonly #revalidate: KanbanOperationRevalidator | undefined;
  readonly #observe: ((observation: KanbanObservation) => void) | undefined;
  readonly #now: () => number;
  readonly #limits: KanbanResolvedLimits;
  readonly #ids: KanbanOperationIdRegistry;
  readonly #subjects: KanbanOperationSubjectRegistry;
  readonly #snapshots: KanbanOperationSnapshotRegistry;
  readonly #undo: KanbanCommittedUndoRegistry<CommittedKanbanUndo>;
  readonly #generation = new KanbanOperationGenerationClock();
  readonly #operations = new Map<KanbanOperationId, ActiveKanbanOperation>();
  readonly #startedAt = new Map<KanbanOperationId, number>();
  readonly #inverseControllers = new Set<AbortController>();
  readonly #inverseClaims = new Set<KanbanOperationId>();
  #disposed = false;

  /** Validates resource options before allocating coordinator-owned registries. */
  constructor(options: KanbanOperationCoordinatorOptions) {
    this.#limits = validateKanbanLimitOptions(options.limits);
    this.#dispatcher = options.dispatcher;
    this.#capabilities = options.capabilities;
    this.#confirm = options.confirm;
    this.#resolveUndo = options.resolveUndo;
    this.#revalidate = options.revalidate;
    this.#observe = options.observe;
    this.#now = options.now ?? (() => performance.now());
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
    this.#undo = new KanbanCommittedUndoRegistry(this.#limits.retainedUndoDescriptors);
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
    return this.#admit(snapshotKanbanRequestProposal(value), expected, eligibility);
  }

  /** Adopt one compatibility envelope while preserving identity and bridging caller cancellation. */
  request(
    value: KanbanRequest,
    eligibility: KanbanEligibility = Object.freeze({ kind: 'allowed' }),
  ): KanbanOperationSubmission {
    const request = snapshotKanbanRequest(value);
    const { operationId: _operationId, expected: _expected, signal: _signal, ...proposalValue } = request;
    const proposal = snapshotKanbanRequestProposal(proposalValue);
    return this.#admit(
      proposal,
      request.expected,
      eligibility,
      request,
      request.kind === 'extension' ? Object.freeze([]) : undefined,
      request.kind === 'extension',
    );
  }

  /** Reserve all operation resources before exposing proposed state or application callbacks. */
  #admit(
    proposal: KanbanRequestProposal,
    expected: KanbanRequestExpectedRevisions,
    eligibility: KanbanEligibility,
    adoptedRequest?: KanbanRequest,
    affectedOverride?: readonly KanbanOperationSubject[],
    applicationConfirmed = false,
  ): KanbanOperationSubmission {
    if (this.#disposed || this.#operations.size >= this.#limits.pendingOperations) {
      throw new KanbanInvalidLimitError();
    }
    const capturedExpected = snapshotKanbanRequestExpectedRevisions(expected);
    const capturedEligibility = snapshotKanbanEligibility(eligibility);
    const id = adoptedRequest === undefined ? this.#ids.acquire() : this.#ids.adopt(adoptedRequest.operationId);
    let subjects: KanbanOperationSubjectLease | undefined;
    let operation: ActiveKanbanOperation | undefined;
    try {
      if (this.#undo.get(id.operationId) !== undefined) throw new KanbanInvalidLimitError();
      subjects = this.#subjects.reserve(id.operationId, affectedOverride ?? deriveKanbanOperationSubjects(proposal));
      const controller = new AbortController();
      const request = createKanbanRequestEnvelope(proposal, {
        operationId: id.operationId,
        expected: capturedExpected,
        signal: controller.signal,
      });
      const projection = createKanbanPendingProjection(proposal);
      const coordinatorGeneration = this.#generation.capture();
      operation = {
        request,
        id,
        subjects,
        controller,
        coordinatorGeneration,
        projection,
        startedAt: this.#readClock(),
        applicationConfirmed,
        state: 'proposed',
      };
      this.#operations.set(id.operationId, operation);
      this.#startedAt.set(id.operationId, operation.startedAt);
      this.#publishSnapshot(
        Object.freeze({
          operationId: id.operationId,
          kind: request.kind,
          state: 'proposed',
          affected: subjects.affected,
        }),
      );
      if (adoptedRequest !== undefined) {
        const cancelFromSignal = (): void => {
          this.cancel(id.operationId);
        };
        adoptedRequest.signal.addEventListener('abort', cancelFromSignal, { once: true });
        operation.releaseExternalSignal = (): void => {
          adoptedRequest.signal.removeEventListener('abort', cancelFromSignal);
        };
        if (adoptedRequest.signal.aborted) cancelFromSignal();
      }
      if (!this.#isCurrent(operation)) {
        return Object.freeze({
          operationId: id.operationId,
          completion: Promise.resolve(
            Object.freeze({ kind: 'cancelled', operationId: id.operationId, code: 'operation-cancelled' }),
          ),
        });
      }
      const completion = this.#confirmAndDispatch(operation, proposal, capturedExpected, capturedEligibility);
      return Object.freeze({ operationId: id.operationId, completion: Promise.resolve(completion) });
    } catch (error) {
      if (operation !== undefined) this.#operations.delete(id.operationId);
      this.#startedAt.delete(id.operationId);
      operation?.releaseExternalSignal?.();
      operation?.controller.abort();
      subjects?.release();
      id.release();
      throw error;
    }
  }

  /** Confirm when required, revalidate current ownership, then expose pending state before dispatch. */
  #confirmAndDispatch(
    operation: ActiveKanbanOperation,
    proposal: KanbanRequestProposal,
    expected: KanbanRequestExpectedRevisions,
    eligibility: KanbanEligibility,
  ): Promise<KanbanRequestResult> | KanbanRequestResult {
    if (eligibility.kind === 'blocked' || eligibility.kind === 'unavailable') {
      return this.#finishBeforeDispatch(operation, {
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: eligibility.code,
      });
    }
    const classification = classifyKanbanRequestConfirmation(proposal, eligibility);
    if (classification.kind !== 'not-required') {
      if (operation.applicationConfirmed) return this.#dispatch(operation);
      return this.#confirmBeforeDispatch(operation, proposal, expected, eligibility, classification);
    }
    return this.#dispatch(operation);
  }

  /** Settles the deliberately asynchronous confirmation path before dispatch. */
  async #confirmBeforeDispatch(
    operation: ActiveKanbanOperation,
    proposal: KanbanRequestProposal,
    expected: KanbanRequestExpectedRevisions,
    eligibility: KanbanEligibility,
    classification: Exclude<ReturnType<typeof classifyKanbanRequestConfirmation>, { readonly kind: 'not-required' }>,
  ): Promise<KanbanRequestResult> {
    const settlement = await settleKanbanConfirmation(this.#confirm, {
      operationId: operation.id.operationId,
      proposal,
      affected: operation.subjects.affected,
      expected,
      eligibility: classification,
      signal: operation.request.signal,
    });
    if (settlement !== 'approved') {
      return this.#finishBeforeDispatch(operation, {
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: settlement === 'declined' ? 'confirmation-declined' : 'confirmation-invalid',
      });
    }
    if (this.#revalidate === undefined) {
      return this.#finishBeforeDispatch(operation, {
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: 'confirmation-stale',
      });
    }
    let current: KanbanEligibility;
    try {
      const authority = snapshotKanbanOperationAuthoritySnapshot(this.#revalidate(proposal, expected));
      if (!kanbanExpectedRevisionsEqual(expected, authority.expected)) {
        return this.#finishBeforeDispatch(operation, {
          kind: 'cancelled',
          operationId: operation.id.operationId,
          code: 'confirmation-stale',
        });
      }
      current = authority.eligibility;
    } catch {
      return this.#finishBeforeDispatch(operation, {
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: 'confirmation-stale',
      });
    }
    if (!confirmationStillApplies(eligibility, current)) {
      return this.#finishBeforeDispatch(operation, {
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: current.kind === 'blocked' || current.kind === 'unavailable' ? current.code : 'confirmation-stale',
      });
    }
    return this.#dispatch(operation);
  }

  /** Expose pending state, then recheck reentrant cancellation before application dispatch. */
  #dispatch(operation: ActiveKanbanOperation): Promise<KanbanRequestResult> | KanbanRequestResult {
    if (!this.#isCurrent(operation)) {
      return Object.freeze({
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: 'operation-cancelled',
      });
    }
    operation.state = 'pending';
    this.#publishSnapshot(
      Object.freeze({
        operationId: operation.id.operationId,
        kind: operation.request.kind,
        state: 'pending',
        affected: operation.subjects.affected,
        projection: operation.projection,
      }),
    );
    if (!this.#isCurrent(operation)) {
      return Object.freeze({
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: 'operation-cancelled',
      });
    }
    const result = dispatchKanbanRequestImmediate(operation.request, this.#dispatcher, {
      capabilities: currentCapabilities(this.#capabilities),
    });
    return result instanceof Promise
      ? result.then((settled) => this.#settleDispatcher(operation, settled))
      : this.#settleDispatcher(operation, result);
  }

  /** Release a current reservation and publish one pre-dispatch cancellation. */
  #finishBeforeDispatch(
    operation: ActiveKanbanOperation,
    result: Extract<KanbanRequestResult, { readonly kind: 'cancelled' }>,
  ): KanbanRequestResult {
    if (!this.#isCurrent(operation)) {
      return Object.freeze({
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: 'operation-cancelled',
      });
    }
    this.#finishLifecycle(operation, result.kind, result.code);
    return Object.freeze(result);
  }

  /** Apply one exact dispatcher result only while its operation generation remains current. */
  #settleDispatcher(operation: ActiveKanbanOperation, result: KanbanRequestResult): KanbanRequestResult {
    if (!this.#isCurrent(operation)) {
      // Disposal has already published cancellation and released every resource. Returning the
      // validated application result preserves historical in-flight request completion without
      // allowing that late result to mutate lifecycle state. Explicit per-operation cancellation
      // still reports cancellation to its caller.
      if (this.#disposed) return result;
      return Object.freeze({
        kind: 'cancelled',
        operationId: operation.id.operationId,
        code: 'operation-cancelled',
      });
    }
    if (result.kind === 'accepted') {
      operation.state = 'accepted';
      operation.publication = result.publication;
      operation.undo = result.undo;
      this.#publishSnapshot(
        Object.freeze({
          operationId: operation.id.operationId,
          kind: operation.request.kind,
          state: 'accepted',
          affected: operation.subjects.affected,
          projection: acceptKanbanPendingProjection(operation.projection),
        }),
      );
      return result;
    }
    this.#finishLifecycle(operation, result.kind, result.code);
    return result;
  }

  /** Release all live resources before notifying subscribers of one terminal transition. */
  #finishLifecycle(
    operation: ActiveKanbanOperation,
    state: Extract<KanbanOperationState, 'committed' | 'rejected' | 'cancelled' | 'superseded'>,
    code: string | undefined,
  ): void {
    const terminal = Object.freeze({
      operationId: operation.id.operationId,
      kind: operation.request.kind,
      state,
      affected: operation.subjects.affected,
      ...(code === undefined ? {} : { code }),
    });
    this.#operations.delete(operation.id.operationId);
    operation.releaseExternalSignal?.();
    operation.controller.abort();
    operation.subjects.release();
    operation.id.retain();
    if (state === 'committed' && operation.undo !== undefined) {
      this.#undo.retain(
        operation.id.operationId,
        Object.freeze({ prior: snapshotKanbanOperationSnapshot(terminal), undo: operation.undo }),
      );
    }
    this.#publishSnapshot(terminal);
    this.#startedAt.delete(operation.id.operationId);
  }

  /** Reconcile one exact operation-correlated authoritative publication. */
  reconcilePublication(value: KanbanPublicationNotice): void {
    const reconciliation = settleKanbanPublication(undefined, value);
    if (this.#disposed) return;
    const operation = this.#operations.get(reconciliation.notice.operationId);
    if (operation === undefined || operation.state !== 'accepted' || !this.#isCurrent(operation)) return;
    const current = settleKanbanPublication(operation.publication, reconciliation.notice);
    if (current.settlement === 'committed') {
      this.#finishLifecycle(operation, 'committed', undefined);
    } else if (current.settlement === 'superseded') {
      this.#finishLifecycle(
        operation,
        'superseded',
        current.notice.kind === 'deleted' ? 'publication-deleted' : 'publication-contradictory',
      );
    }
  }

  /** Cancel one active operation synchronously; unknown and terminal identities are inert. */
  cancel(operationId: KanbanOperationId): boolean {
    if (this.#disposed) return false;
    const identity = createKanbanOperationId(operationId);
    const operation = this.#operations.get(identity);
    if (operation === undefined || !this.#isCurrent(operation)) return false;
    this.#finishLifecycle(operation, 'cancelled', 'operation-cancelled');
    return true;
  }

  /**
   * Turn one committed descriptor into a completely fresh application-authorized operation.
   *
   * Current equality revisions and eligibility are supplied by the board integration because the
   * coordinator deliberately owns no application records or source cursor. The inverse output is
   * untrusted and re-enters `commitProposal`, including exact validation and confirmation.
   */
  async undo(
    operationId: KanbanOperationId,
    expected: KanbanRequestExpectedRevisions = {},
    eligibility: KanbanEligibility = Object.freeze({ kind: 'allowed' }),
  ): Promise<KanbanRequestResult> {
    const identity = createKanbanOperationId(operationId);
    const unavailable = (code: string): KanbanRequestResult =>
      Object.freeze({ kind: 'rejected', operationId: identity, code });
    if (this.#disposed) return unavailable('undo-unavailable');
    const committed = this.#undo.get(identity);
    if (committed === undefined) return unavailable('undo-unavailable');
    const capturedExpected = snapshotKanbanRequestExpectedRevisions(expected);
    const capturedEligibility = snapshotKanbanEligibility(eligibility);
    const builder = committed.undo.kind === 'inverse-builder' ? committed.undo.build : this.#resolveUndo;
    if (builder === undefined) return unavailable('undo-unavailable');
    if (this.#inverseClaims.has(identity) || this.#inverseClaims.size >= this.#limits.pendingOperations) {
      return unavailable('undo-unavailable');
    }
    this.#inverseClaims.add(identity);
    const controller = new AbortController();
    const generation = this.#generation.capture();
    this.#inverseControllers.add(controller);
    try {
      const context = createKanbanInverseRequestContext(
        committed.prior,
        committed.undo,
        capturedExpected,
        currentCapabilities(this.#capabilities),
        controller.signal,
      );
      const settlement = await settleKanbanInverseRequest(builder, context);
      if (
        this.#disposed ||
        controller.signal.aborted ||
        !this.#generation.isCurrent(generation) ||
        this.#undo.get(identity) !== committed
      ) {
        return Object.freeze({ kind: 'cancelled', operationId: identity, code: 'operation-cancelled' });
      }
      if (settlement.kind === 'invalid') return unavailable('undo-invalid');
      try {
        const proposal = snapshotKanbanRequestProposal(settlement.proposal);
        let currentEligibility = capturedEligibility;
        if (this.#revalidate !== undefined) {
          const authority = snapshotKanbanOperationAuthoritySnapshot(this.#revalidate(proposal, capturedExpected));
          if (!kanbanExpectedRevisionsEqual(capturedExpected, authority.expected)) {
            return unavailable('undo-stale');
          }
          currentEligibility = authority.eligibility;
        }
        return await this.commitProposal(proposal, capturedExpected, currentEligibility).completion;
      } catch {
        return unavailable('undo-invalid');
      }
    } finally {
      controller.abort();
      this.#inverseControllers.delete(controller);
      this.#inverseClaims.delete(identity);
    }
  }

  /** Check coordinator, operation, subject, and cancellation generations before continuation. */
  #isCurrent(operation: ActiveKanbanOperation): boolean {
    return (
      !this.#disposed &&
      this.#generation.isCurrent(operation.coordinatorGeneration) &&
      this.#operations.get(operation.id.operationId) === operation &&
      this.#subjects.isCurrent(operation.subjects) &&
      !operation.controller.signal.aborted &&
      !operation.request.signal.aborted
    );
  }

  /** Returns validated publication expectations for accepted operations in admission order. */
  pendingPublications(): readonly KanbanPublicationExpectation[] {
    return Object.freeze(
      [...this.#operations.values()].flatMap((operation) =>
        operation.state === 'accepted' && operation.publication !== undefined ? [operation.publication] : [],
      ),
    );
  }

  /** Returns detached active operation projections in admission order. */
  snapshot(): readonly KanbanOperationSnapshot[] {
    return this.#snapshots.snapshot();
  }

  /** Publish one normalized transition and isolate its payload-free observation callback. */
  #publishSnapshot(value: KanbanOperationSnapshot): void {
    const snapshot = snapshotKanbanOperationSnapshot(value);
    const observe =
      this.#observe === undefined
        ? undefined
        : (): void => {
            this.#observe?.(
              createKanbanObservation({
                scope: 'request',
                operationId: snapshot.operationId,
                kind: snapshot.kind,
                state: snapshot.state,
                duration: kanbanDurationBucket(this.#elapsedFor(snapshot.operationId)),
                code: snapshot.code ?? `operation-${snapshot.state}`,
                counts: { affected: snapshot.affected.length },
              }),
            );
          };
    this.#snapshots.publish(snapshot, observe);
  }

  /** Read a finite monotonic clock value, degrading hostile clocks to zero. */
  #readClock(): number {
    try {
      const value = this.#now();
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  /** Return a non-negative elapsed value for one live operation. */
  #elapsedFor(operationId: KanbanOperationId): number {
    const startedAt = this.#startedAt.get(operationId) ?? this.#readClock();
    return Math.max(0, this.#readClock() - startedAt);
  }

  /** Subscribes to immutable payload-free lifecycle transitions. */
  subscribe(subscriber: KanbanOperationSubscriber): KanbanOperationUnsubscribe {
    return this.#snapshots.subscribe(subscriber);
  }

  /** Invalidates, cancels, and aborts retained admissions before releasing subscribers. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#generation.dispose();
    for (const controller of this.#inverseControllers) controller.abort();
    this.#inverseControllers.clear();
    this.#inverseClaims.clear();
    for (const operation of [...this.#operations.values()]) {
      this.#operations.delete(operation.id.operationId);
      operation.releaseExternalSignal?.();
      operation.controller.abort();
      operation.subjects.release();
      operation.id.retain();
      this.#publishSnapshot(
        Object.freeze({
          operationId: operation.id.operationId,
          kind: operation.request.kind,
          state: 'cancelled',
          affected: operation.subjects.affected,
          code: 'operation-cancelled',
        }),
      );
      this.#startedAt.delete(operation.id.operationId);
    }
    this.#snapshots.dispose();
    this.#undo.dispose();
    this.#subjects.dispose();
    this.#ids.dispose();
    this.#startedAt.clear();
  }
}
