import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS, KanbanInvalidLimitError } from '../contract/limits.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { kanbanRevisionsEqual, snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from './address.js';
import type {
  KanbanCardLocation,
  KanbanCellAddress,
  KanbanCellCursor,
  KanbanDataSource,
  KanbanQuery,
  KanbanQuerySession,
  KanbanSessionPublication,
} from './types.js';
import { snapshotKanbanCardLocation, snapshotKanbanQuery, snapshotKanbanSessionPublication } from './validation.js';

/** Explicit reason that keeps one sparse cursor alive. */
export type KanbanCursorRetentionOwner = 'visible' | 'overscan' | 'prefetch';

/** One cursor plus every resource that must be released before it. */
interface RetainedCursor<TCard> {
  readonly address: KanbanCellAddress;
  readonly cursor: KanbanCellCursor<TCard>;
  readonly owners: Set<KanbanCursorRetentionOwner>;
  readonly scopes: Set<() => void>;
}

/** Construction options for the private session lifecycle coordinator. */
export interface KanbanSessionCoordinatorOptions<TCard> {
  /** Application-owned source whose session lifecycle is coordinated. */
  readonly source: KanbanDataSource<TCard>;
  /** Initial immutable semantic query. */
  readonly initialQuery: KanbanQuery;
  /** Maximum sparse cursors retained by the read projection. */
  readonly maximumRetainedCursors?: number;
  /** Optional sink for already-redacted lifecycle observations. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/**
 * Owns one active query generation, its session, and its sparse retained cursor set.
 *
 * This class is package-internal: public components and testing helpers expose only observable
 * behavior. Generation invalidation always precedes cancellation and resource disposal.
 */
export class KanbanSessionCoordinator<TCard> {
  readonly #source: KanbanDataSource<TCard>;
  readonly #maximumRetainedCursors: number;
  readonly #observe: ((observation: KanbanObservation) => void) | undefined;
  readonly #entries = new Map<string, RetainedCursor<TCard>>();
  readonly #locatorControllers = new Set<AbortController>();
  #query: KanbanQuery;
  #session: KanbanQuerySession<TCard>;
  #sessionController: AbortController;
  #generation = 0;
  #disposed = false;
  #lastPublication: KanbanSessionPublication | undefined;

  /** Validates the initial query and synchronously takes ownership of its session. */
  constructor(options: KanbanSessionCoordinatorOptions<TCard>) {
    const maximum = options.maximumRetainedCursors ?? KANBAN_LIMITS.retainedCursors.safe;
    if (!Number.isSafeInteger(maximum) || maximum < 0 || maximum > KANBAN_LIMITS.retainedCursors.absolute) {
      throw new KanbanInvalidLimitError();
    }
    this.#source = options.source;
    this.#maximumRetainedCursors = maximum;
    this.#observe = options.observe;
    this.#query = snapshotKanbanQuery(options.initialQuery);
    this.#sessionController = new AbortController();
    this.#session = this.#source.openQuery(this.#query, { signal: this.#sessionController.signal });
  }

  /** Returns the current detached semantic query. */
  query(): KanbanQuery {
    this.#assertActive();
    return this.#query;
  }

  /** Returns the current generation for equality checks in private asynchronous continuations. */
  generation(): number {
    return this.#generation;
  }

  /** Returns true only while a captured generation still owns the active session. */
  isCurrent(generation: number): boolean {
    return !this.#disposed && generation === this.#generation;
  }

  /**
   * Reads and validates one complete session snapshot, retaining the last valid publication on error.
   */
  snapshot(): KanbanSessionPublication {
    this.#assertActive();
    try {
      const openingRevision = this.#session.revision();
      const candidate = snapshotKanbanSessionPublication({
        revision: openingRevision,
        state: this.#session.state(),
        columns: this.#session.columns(),
        swimlanes: this.#session.swimlanes(),
        counts: this.#session.counts(),
        headers: this.#session.headers(),
        identityChanges: this.#session.identityChanges(),
      });
      if (!kanbanRevisionsEqual(this.#session.revision(), openingRevision)) {
        throw new KanbanInvalidSourcePublicationError();
      }
      this.#lastPublication = candidate;
      return candidate;
    } catch (error) {
      this.#emit('source-publication-invalid');
      if (this.#lastPublication !== undefined) return this.#lastPublication;
      if (error instanceof KanbanInvalidSourcePublicationError) throw error;
      throw new KanbanInvalidSourcePublicationError();
    }
  }

  /**
   * Replaces the active query after validating it, invalidating the old generation before teardown.
   */
  replaceQuery(query: KanbanQuery): void {
    this.#assertActive();
    const nextQuery = snapshotKanbanQuery(query);
    this.#invalidateActiveSession();
    this.#query = nextQuery;
    this.#sessionController = new AbortController();
    this.#session = this.#source.openQuery(nextQuery, { signal: this.#sessionController.signal });
    this.#lastPublication = undefined;
  }

  /** Retains and returns one sparse cursor for an explicit projection owner. */
  retainCursor(address: KanbanCellAddress, owner: KanbanCursorRetentionOwner): KanbanCellCursor<TCard> {
    this.#assertActive();
    const snapshot = snapshotKanbanCellAddress(address);
    const key = canonicalizeKanbanCellAddress(snapshot);
    const existing = this.#entries.get(key);
    if (existing !== undefined) {
      existing.owners.add(owner);
      return existing.cursor;
    }
    if (this.#entries.size >= this.#maximumRetainedCursors) throw new KanbanInvalidLimitError();
    const entry: RetainedCursor<TCard> = {
      address: snapshot,
      cursor: this.#session.cell(snapshot),
      owners: new Set([owner]),
      scopes: new Set(),
    };
    this.#entries.set(key, entry);
    return entry.cursor;
  }

  /** Registers a descriptor or reactive cleanup that must run before the retained cursor is disposed. */
  registerCursorScope(address: KanbanCellAddress, dispose: () => void): void {
    this.#assertActive();
    const entry = this.#entries.get(canonicalizeKanbanCellAddress(address));
    if (entry === undefined) throw new KanbanInvalidSourcePublicationError();
    entry.scopes.add(dispose);
  }

  /** Releases one explicit owner and disposes the entry after its final owner disappears. */
  releaseCursor(address: KanbanCellAddress, owner: KanbanCursorRetentionOwner): void {
    if (this.#disposed) return;
    const key = canonicalizeKanbanCellAddress(address);
    const entry = this.#entries.get(key);
    if (entry === undefined) return;
    entry.owners.delete(owner);
    if (entry.owners.size === 0) this.#disposeEntry(key, entry);
  }

  /** Reconciles every address retained by one owner without touching other retention reasons. */
  reconcileCursors(owner: KanbanCursorRetentionOwner, addresses: readonly KanbanCellAddress[]): void {
    this.#assertActive();
    const wanted = new Map<string, KanbanCellAddress>();
    for (const address of addresses) {
      const snapshot = snapshotKanbanCellAddress(address);
      wanted.set(canonicalizeKanbanCellAddress(snapshot), snapshot);
    }
    for (const [key, entry] of this.#entries) {
      if (entry.owners.has(owner) && !wanted.has(key)) this.releaseCursor(entry.address, owner);
    }
    for (const [key, address] of wanted) {
      const entry = this.#entries.get(key);
      if (entry === undefined || !entry.owners.has(owner)) this.retainCursor(address, owner);
    }
  }

  /** Performs one bounded, cancellable identity lookup through the active session. */
  async locateCard(key: CardKey, options?: { readonly signal?: AbortSignal }): Promise<KanbanCardLocation> {
    this.#assertActive();
    const capturedGeneration = this.#generation;
    const capturedRevision = snapshotKanbanRevision(this.#session.revision());
    const locate = this.#session.locateCard;
    if (locate === undefined) return Object.freeze({ kind: 'unsupported', sessionRevision: capturedRevision });

    const callerSignal = options?.signal;
    const controller = new AbortController();
    const abortFromCaller = (): void => controller.abort();
    if (callerSignal?.aborted === true) controller.abort();
    else callerSignal?.addEventListener('abort', abortFromCaller, { once: true });
    this.#locatorControllers.add(controller);
    let settleAbort: (() => void) | undefined;
    try {
      const applicationResult = Promise.resolve(locate.call(this.#session, key, { signal: controller.signal }));
      const aborted = new Promise<undefined>((resolve) => {
        settleAbort = (): void => resolve(undefined);
        controller.signal.addEventListener('abort', settleAbort, { once: true });
        if (controller.signal.aborted) resolve(undefined);
      });
      const result = await Promise.race([applicationResult, aborted]);
      if (result === undefined) return this.#staleLocation(capturedRevision);
      if (!this.isCurrent(capturedGeneration)) return this.#staleLocation(capturedRevision);
      const snapshot = snapshotKanbanCardLocation(result);
      if (!kanbanRevisionsEqual(snapshot.sessionRevision, capturedRevision)) {
        throw new KanbanInvalidSourcePublicationError();
      }
      return snapshot;
    } catch {
      if (this.isCurrent(capturedGeneration)) this.#emit('source-locate-failed');
      return this.#staleLocation(capturedRevision);
    } finally {
      callerSignal?.removeEventListener('abort', abortFromCaller);
      if (settleAbort !== undefined) controller.signal.removeEventListener('abort', settleAbort);
      this.#locatorControllers.delete(controller);
    }
  }

  /** Invalidates and releases the complete generation idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#invalidateActiveSession();
  }

  /** Returns a safe unknown result bound to the currently observable session revision. */
  #staleLocation(capturedRevision: KanbanRevision): KanbanCardLocation {
    return Object.freeze({ kind: 'unknown', sessionRevision: capturedRevision });
  }

  /** Invalidates first, then aborts work, scopes, cursors, and finally the session. */
  #invalidateActiveSession(): void {
    this.#generation += 1;
    this.#sessionController.abort();
    for (const controller of this.#locatorControllers) controller.abort();
    this.#locatorControllers.clear();
    for (const [key, entry] of [...this.#entries]) this.#disposeEntry(key, entry);
    this.#session.dispose();
  }

  /** Disposes scopes before one cursor and removes all retained application references. */
  #disposeEntry(key: string, entry: RetainedCursor<TCard>): void {
    this.#entries.delete(key);
    for (const dispose of entry.scopes) {
      try {
        dispose();
      } catch {
        this.#emit('cursor-scope-dispose-failed');
      }
    }
    entry.scopes.clear();
    entry.cursor.dispose();
  }

  /** Emits one safe source-scoped observation and isolates a throwing application sink. */
  #emit(code: string): void {
    try {
      this.#observe?.(createKanbanObservation({ code, scope: 'source' }));
    } catch {
      // Observation sinks are diagnostic only and cannot break source lifecycle cleanup.
    }
  }

  /** Rejects every operation attempted after coordinator disposal. */
  #assertActive(): void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
  }
}
