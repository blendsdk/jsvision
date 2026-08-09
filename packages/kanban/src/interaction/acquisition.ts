import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { kanbanRevisionsEqual, snapshotKanbanRevision } from '../contract/revision.js';
import { snapshotKanbanFocusTarget } from './reconciliation.js';
import type {
  KanbanInteractionAcquisitionRequest,
  KanbanInteractionAcquisitionResult,
  KanbanInteractionFeedbackCode,
  KanbanInteractionRevisions,
} from './types.js';

/** Exact members accepted by one acquisition request. */
const REQUEST_KEYS = new Set(['kind', 'target']);
/** Exact members accepted by one source/query revision envelope. */
const REVISION_KEYS = new Set(['sessionRevision', 'queryGeneration', 'viewRevision']);
/** Exact members accepted by an available application settlement. */
const AVAILABLE_KEYS = new Set(['kind']);
/** Exact members accepted by an unavailable application settlement. */
const UNAVAILABLE_KEYS = new Set(['kind', 'retry']);

/** Inputs captured when one bounded navigation acquisition starts. */
export interface StartKanbanAcquisitionOptions {
  /** Semantic target and reveal/acquire operation being attempted. */
  readonly request: KanbanInteractionAcquisitionRequest;
  /** Source/query revisions that own the navigation decision. */
  readonly revisions: KanbanInteractionRevisions;
  /** Reads current revisions after application work settles. */
  readonly currentRevisions: () => KanbanInteractionRevisions;
  /** Executes the one application-owned bounded operation. */
  readonly execute: (options: {
    readonly signal: AbortSignal;
  }) => Promise<KanbanInteractionAcquisitionResult> | KanbanInteractionAcquisitionResult;
}

/** Generation-safe outcome from one bounded reveal or data acquisition. */
export type KanbanAcquisitionSettlement =
  | {
      readonly kind: 'available';
      readonly request: KanbanInteractionAcquisitionRequest;
    }
  | {
      readonly kind: 'unavailable';
      readonly request: KanbanInteractionAcquisitionRequest;
      readonly code: Extract<KanbanInteractionFeedbackCode, 'navigation-unavailable' | 'navigation-error'>;
      readonly retry: 'available' | 'unavailable';
    }
  | {
      readonly kind: 'stale';
      readonly reason: 'cancelled' | 'superseded' | 'revision-changed' | 'disposed';
    };

/** Stable handle returned immediately while one acquisition settles in the background. */
export interface KanbanAcquisitionHandle {
  /** Monotonic coordinator generation. */
  readonly generation: number;
  /** Detached semantic request owned by this generation. */
  readonly request: KanbanInteractionAcquisitionRequest;
  /** Payload-free asynchronous settlement. */
  readonly settlement: Promise<KanbanAcquisitionSettlement>;
  /** Cancels this generation without affecting a newer operation. */
  readonly cancel: () => void;
}

/** Mutable internal record for the coordinator's only active generation. */
interface ActiveAcquisition {
  /** Monotonic identity used to reject late work. */
  readonly generation: number;
  /** Abort signal passed to the application operation. */
  readonly controller: AbortController;
  /** Resolves the cancellation side of the settlement race immediately. */
  readonly settleCancellation: (settlement: KanbanAcquisitionSettlement) => void;
}

/** Raises a bounded contract error for malformed application acquisition evidence. */
function invalidPublication(): never {
  throw new KanbanInvalidSourcePublicationError();
}

/** Returns one validated non-negative query generation. */
function queryGeneration(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalidPublication();
  return value;
}

/** Validates and detaches the revision envelope captured around asynchronous work. */
export function snapshotKanbanInteractionRevisions(value: unknown): KanbanInteractionRevisions {
  try {
    const properties = snapshotKanbanDataProperties(value, REVISION_KEYS.size);
    validateKanbanDataKeys(properties, REVISION_KEYS);
    if (properties.sessionRevision === undefined || properties.queryGeneration === undefined) {
      return invalidPublication();
    }
    return Object.freeze({
      sessionRevision: snapshotKanbanRevision(properties.sessionRevision),
      queryGeneration: queryGeneration(properties.queryGeneration),
      ...(properties.viewRevision === undefined
        ? {}
        : { viewRevision: snapshotKanbanRevision(properties.viewRevision) }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates and detaches one reveal or acquire request. */
function snapshotRequest(value: unknown): KanbanInteractionAcquisitionRequest {
  try {
    const properties = snapshotKanbanDataProperties(value, REQUEST_KEYS.size);
    validateKanbanDataKeys(properties, REQUEST_KEYS);
    if (Object.keys(properties).length !== REQUEST_KEYS.size) return invalidPublication();
    if (properties.kind !== 'reveal' && properties.kind !== 'acquire') return invalidPublication();
    return Object.freeze({
      kind: properties.kind,
      target: snapshotKanbanFocusTarget(properties.target),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates an application settlement without retaining extra data. */
function snapshotResult(value: unknown): KanbanInteractionAcquisitionResult {
  try {
    const properties = snapshotKanbanDataProperties(value, UNAVAILABLE_KEYS.size);
    if (properties.kind === 'available') {
      validateKanbanDataKeys(properties, AVAILABLE_KEYS);
      return Object.freeze({ kind: properties.kind });
    }
    if (properties.kind === 'unavailable') {
      validateKanbanDataKeys(properties, UNAVAILABLE_KEYS);
      if (properties.retry !== 'available' && properties.retry !== 'unavailable') return invalidPublication();
      return Object.freeze({ kind: properties.kind, retry: properties.retry });
    }
    return invalidPublication();
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Returns whether current source/query evidence still owns a pending generation. */
function revisionsEqual(left: KanbanInteractionRevisions, right: KanbanInteractionRevisions): boolean {
  const viewEqual =
    left.viewRevision === undefined
      ? right.viewRevision === undefined
      : right.viewRevision !== undefined && kanbanRevisionsEqual(left.viewRevision, right.viewRevision);
  return (
    kanbanRevisionsEqual(left.sessionRevision, right.sessionRevision) &&
    left.queryGeneration === right.queryGeneration &&
    viewEqual
  );
}

/** Creates one frozen stale settlement. */
function stale(
  reason: Extract<KanbanAcquisitionSettlement, { readonly kind: 'stale' }>['reason'],
): KanbanAcquisitionSettlement {
  return Object.freeze({ kind: 'stale', reason });
}

/**
 * Owns at most one bounded navigation acquisition and rejects every stale completion.
 *
 * Cancellation races the application promise so callers settle immediately even when an application
 * ignores the supplied abort signal. The application promise remains observed, preventing a later
 * rejection from escaping as an unhandled error.
 */
export class KanbanAcquisitionCoordinator {
  #generation = 0;
  #active: ActiveAcquisition | undefined;
  #disposed = false;

  /** Returns the active generation for modeless inspection. */
  activeGeneration(): number | undefined {
    return this.#active?.generation;
  }

  /** Starts one generation and supersedes any prior pending operation. */
  start(options: StartKanbanAcquisitionOptions): KanbanAcquisitionHandle {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    const request = snapshotRequest(options.request);
    const revisions = snapshotKanbanInteractionRevisions(options.revisions);
    this.#cancelActive('superseded');
    const generation = (this.#generation += 1);
    const controller = new AbortController();
    let settleCancellation: (settlement: KanbanAcquisitionSettlement) => void = () => undefined;
    const cancellation = new Promise<KanbanAcquisitionSettlement>((resolve) => {
      settleCancellation = resolve;
    });
    const active = Object.freeze({ generation, controller, settleCancellation });
    this.#active = active;

    const application = Promise.resolve()
      .then(async (): Promise<KanbanAcquisitionSettlement> => {
        if (this.#active?.generation !== generation) return stale('superseded');
        let rawResult: KanbanInteractionAcquisitionResult;
        try {
          rawResult = await options.execute({ signal: controller.signal });
        } catch {
          if (this.#active?.generation !== generation) return stale('superseded');
          return Object.freeze({
            kind: 'unavailable',
            request,
            code: 'navigation-error',
            retry: 'available',
          });
        }
        if (this.#active?.generation !== generation) return stale('superseded');
        try {
          const current = snapshotKanbanInteractionRevisions(options.currentRevisions());
          if (!revisionsEqual(revisions, current)) return stale('revision-changed');
          const settled = snapshotResult(rawResult);
          if (settled.kind === 'available') return Object.freeze({ kind: settled.kind, request });
          return Object.freeze({
            kind: settled.kind,
            request,
            code: 'navigation-unavailable',
            retry: settled.retry,
          });
        } catch {
          return Object.freeze({
            kind: 'unavailable',
            request,
            code: 'navigation-error',
            retry: 'available',
          });
        }
      })
      .catch((): KanbanAcquisitionSettlement =>
        Object.freeze({
          kind: 'unavailable',
          request,
          code: 'navigation-error',
          retry: 'available',
        }),
      );

    const settlement = Promise.race([application, cancellation]).finally(() => {
      if (this.#active?.generation === generation) this.#active = undefined;
    });
    return Object.freeze({
      generation,
      request,
      settlement,
      cancel: () => this.#cancelGeneration(generation, 'cancelled'),
    });
  }

  /** Cancels current work and makes every later result from it inert. */
  cancel(): void {
    this.#cancelActive('cancelled');
  }

  /** Permanently cancels current work and rejects future starts. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#cancelActive('disposed');
  }

  /** Cancels a handle only while it still owns the coordinator's active generation. */
  #cancelGeneration(
    generation: number,
    reason: Extract<KanbanAcquisitionSettlement, { readonly kind: 'stale' }>['reason'],
  ): void {
    if (this.#active?.generation !== generation) return;
    this.#cancelActive(reason);
  }

  /** Settles and aborts the only active generation without waiting for application cooperation. */
  #cancelActive(reason: Extract<KanbanAcquisitionSettlement, { readonly kind: 'stale' }>['reason']): void {
    const active = this.#active;
    if (active === undefined) return;
    this.#active = undefined;
    active.settleCancellation(stale(reason));
    active.controller.abort();
  }
}
