import { createKanbanOperationId } from '../contract/identity.js';
import type { KanbanOperationId } from '../contract/identity.js';
import { validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanLimitOptions } from '../contract/limits.js';
import type { KanbanObservation } from '../contract/observation.js';
import type {
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
  KanbanRequest,
  KanbanRequestExpectedRevisions,
  KanbanRequestProposal,
  KanbanRequestResult,
} from '../contract/request.js';
import {
  createKanbanRejectedResult,
  snapshotKanbanRequest,
  snapshotKanbanRequestExpectedRevisions,
  snapshotKanbanRequestProposal,
} from '../contract/request-validation.js';
import { KanbanOperationCoordinator } from '../operation/coordinator.js';
import type { KanbanCoordinatorDispatcher } from '../operation/coordinator.js';
import type { KanbanConfirmationCallback } from '../operation/confirmation.js';
import type { KanbanOperationIdFactory } from '../operation/operation-id.js';
import type { KanbanEligibility } from '../operation/eligibility.js';
import { snapshotKanbanEligibility } from '../operation/eligibility.js';
import type {
  KanbanInverseRequestBuilder,
  KanbanOperationSnapshot,
  KanbanOperationSubscriber,
} from '../operation/types.js';

/** Stable unavailable identity used only when a disposed authority receives a lifecycle-free proposal. */
const UNAVAILABLE_OPERATION_ID = createKanbanOperationId('kanban-unavailable');
/** Shared immutable allowed result for proposal paths without a board-specific policy evaluator. */
const ALLOWED: KanbanEligibility = Object.freeze({ kind: 'allowed' });

/** Application-independent fallback used when a board has no mutation dispatcher. */
const UNAVAILABLE_DISPATCHER: KanbanCoordinatorDispatcher = (request) =>
  Object.freeze({ kind: 'rejected', operationId: request.operationId, code: 'dispatcher-unavailable' });

/** Optional board integration callbacks used to capture current record-independent request authority. */
export interface KanbanBoardAuthorityOptions {
  /** Current equality-only board/source/query revisions captured for standard proposals and undo. */
  readonly expected?: () => unknown;
  /** Current pure policy result for one standard proposal. */
  readonly eligibility?: (proposal: KanbanRequestProposal) => unknown;
  /** Optional application confirmation callback for warning and destructive proposals. */
  readonly confirm?: KanbanConfirmationCallback;
  /** Optional application callback that resolves an opaque undo token into a fresh proposal. */
  readonly resolveUndo?: KanbanInverseRequestBuilder;
  /** Optional application operation-ID factory for lifecycle-free proposals. */
  readonly operationId?: KanbanOperationIdFactory;
  /** Recompute current eligibility after asynchronous application callbacks. */
  readonly revalidate?: (
    proposal: KanbanRequestProposal,
    expected: KanbanRequestExpectedRevisions,
  ) => KanbanEligibility;
  /** Optional lower coordinator resource ceilings. */
  readonly limits?: KanbanLimitOptions;
  /** Optional payload-free lifecycle observation sink, wired by the observation layer. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Safely capture current equality revisions without retaining a throwing application value. */
function currentExpected(getter: (() => unknown) | undefined): KanbanRequestExpectedRevisions {
  try {
    return snapshotKanbanRequestExpectedRevisions(getter?.() ?? {});
  } catch {
    return Object.freeze({});
  }
}

/** Safely capture one current pure eligibility result, failing closed on malformed policy output. */
function currentEligibility(
  getter: ((proposal: KanbanRequestProposal) => unknown) | undefined,
  proposal: KanbanRequestProposal,
): KanbanEligibility {
  if (getter === undefined) return ALLOWED;
  try {
    return snapshotKanbanEligibility(getter(proposal));
  } catch {
    return Object.freeze({ kind: 'unavailable', code: 'eligibility-unavailable' });
  }
}

/** Return a complete validated envelope when the input carries caller-owned lifecycle fields. */
function completeRequest(value: unknown): KanbanRequest | undefined {
  try {
    return snapshotKanbanRequest(value);
  } catch {
    return undefined;
  }
}

/**
 * Owns one board-level semantic operation coordinator without reading application card records.
 *
 * Standard proposals receive coordinator-owned lifecycle fields. Existing complete request envelopes
 * keep their validated operation ID, expected revisions, and live signal for backward compatibility.
 */
export class KanbanBoardAuthority {
  readonly #coordinator: KanbanOperationCoordinator;
  readonly #expected: (() => unknown) | undefined;
  readonly #eligibility: ((proposal: KanbanRequestProposal) => unknown) | undefined;
  readonly #pendingLimit: number;
  #cleared: KanbanPublicationNotice | undefined;
  #disposed = false;

  /** Creates one coordinator-backed authority while preserving the historical constructor shape. */
  constructor(
    dispatcher: KanbanCoordinatorDispatcher | undefined,
    capabilities: (() => unknown) | undefined,
    options: KanbanBoardAuthorityOptions = {},
  ) {
    this.#expected = options.expected;
    this.#eligibility = options.eligibility;
    this.#pendingLimit = validateKanbanLimitOptions(options.limits).pendingOperations;
    this.#coordinator = new KanbanOperationCoordinator({
      dispatcher: dispatcher ?? UNAVAILABLE_DISPATCHER,
      ...(capabilities === undefined ? {} : { capabilities }),
      ...(options.confirm === undefined ? {} : { confirm: options.confirm }),
      ...(options.resolveUndo === undefined ? {} : { resolveUndo: options.resolveUndo }),
      ...(options.operationId === undefined ? {} : { operationId: options.operationId }),
      ...(options.revalidate === undefined ? {} : { revalidate: options.revalidate }),
      ...(options.limits === undefined ? {} : { limits: options.limits }),
      ...(options.observe === undefined ? {} : { observe: options.observe }),
    });
  }

  /**
   * Validate and dispatch one complete compatibility envelope or lifecycle-free standard proposal.
   *
   * Complete envelopes preserve their caller identity and signal. Proposals receive a fresh package
   * identity and current board revision/policy snapshots before entering the same coordinator.
   */
  async request(value: KanbanRequest | KanbanRequestProposal): Promise<KanbanRequestResult> {
    const adopted = completeRequest(value);
    if (this.#disposed) {
      return createKanbanRejectedResult(adopted?.operationId ?? UNAVAILABLE_OPERATION_ID, 'dispatcher-unavailable');
    }
    if (adopted !== undefined) {
      try {
        return await this.#coordinator.request(adopted).completion;
      } catch {
        const code =
          this.#coordinator.snapshot().length >= this.#pendingLimit ? 'pending-limit-exceeded' : 'operation-conflict';
        return createKanbanRejectedResult(adopted.operationId, code);
      }
    }
    const proposal = snapshotKanbanRequestProposal(value);
    try {
      return await this.#coordinator.commitProposal(
        proposal,
        currentExpected(this.#expected),
        currentEligibility(this.#eligibility, proposal),
      ).completion;
    } catch {
      return createKanbanRejectedResult(UNAVAILABLE_OPERATION_ID, 'operation-unavailable');
    }
  }

  /** Reconcile exact authoritative publication while retaining the historical cleared-notice view. */
  reconcilePublication(notice: KanbanPublicationNotice): void {
    if (this.#disposed) return;
    const wasActive = this.#coordinator.snapshot().some(({ operationId }) => operationId === notice.operationId);
    this.#coordinator.reconcilePublication(notice);
    const remainsActive = this.#coordinator.snapshot().some(({ operationId }) => operationId === notice.operationId);
    if (wasActive && !remainsActive) this.#cleared = notice;
  }

  /** Returns detached accepted publication expectations in admission order. */
  pendingOperations(): readonly KanbanPublicationExpectation[] {
    return this.#coordinator.pendingPublications();
  }

  /** Returns the most recent notice that settled one known operation. */
  clearedPublication(): KanbanPublicationNotice | undefined {
    return this.#cleared;
  }

  /** Returns detached active operation projections in admission order. */
  snapshot(): readonly KanbanOperationSnapshot[] {
    return this.#coordinator.snapshot();
  }

  /** Subscribes to immutable payload-free lifecycle transitions. */
  subscribe(subscriber: KanbanOperationSubscriber): () => void {
    return this.#coordinator.subscribe(subscriber);
  }

  /** Cancels one active operation; unknown and terminal identities are inert. */
  cancel(operationId: KanbanOperationId): boolean {
    return this.#coordinator.cancel(operationId);
  }

  /** Turns one committed descriptor into a fresh request using current board revisions. */
  undo(operationId: KanbanOperationId): Promise<KanbanRequestResult> {
    return this.#coordinator.undo(operationId, currentExpected(this.#expected), ALLOWED);
  }

  /** Releases operation state, callbacks, retained undo descriptors, and compatibility metadata. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#coordinator.dispose();
    this.#cleared = undefined;
  }
}
