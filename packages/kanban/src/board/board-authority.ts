import { dispatchKanbanRequest, reconcileKanbanPublication } from '../contract/authority.js';
import { snapshotKanbanCapabilities } from '../contract/capability.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type {
  KanbanPublicationExpectation,
  KanbanPublicationNotice,
  KanbanRequest,
  KanbanRequestDispatcher,
  KanbanRequestResult,
} from '../contract/request.js';

/** Application-independent fallback used when a board has no mutation dispatcher. */
const UNAVAILABLE_DISPATCHER: KanbanRequestDispatcher = (request) =>
  Object.freeze({ kind: 'rejected', operationId: request.operationId, code: 'dispatcher-unavailable' });

/** Captures only Kanban UX capabilities when a shared host getter returns another profile shape. */
function capabilitiesFrom(value: unknown): KanbanCapabilities {
  try {
    return snapshotKanbanCapabilities(value);
  } catch {
    return Object.freeze({});
  }
}

/**
 * Owns board-level request metadata without reading or modifying application card records.
 */
export class KanbanBoardAuthority {
  readonly #dispatcher: KanbanRequestDispatcher;
  readonly #capabilities: () => unknown;
  #pending: readonly KanbanPublicationExpectation[] = Object.freeze([]);
  #cleared: KanbanPublicationNotice | undefined;
  #disposed = false;

  /** Stores application callbacks while keeping read projection in the viewport's sole coordinator. */
  constructor(dispatcher: KanbanRequestDispatcher | undefined, capabilities: (() => unknown) | undefined) {
    this.#dispatcher = dispatcher ?? UNAVAILABLE_DISPATCHER;
    this.#capabilities = capabilities ?? (() => Object.freeze({}));
  }

  /** Validates and dispatches one request, retaining only bounded publication metadata. */
  async request(request: KanbanRequest): Promise<KanbanRequestResult> {
    const result = await dispatchKanbanRequest(request, this.#dispatcher, {
      capabilities: capabilitiesFrom(this.#capabilities()),
    });
    if (!this.#disposed && result.kind === 'accepted' && result.publication !== undefined) {
      const withoutSameOperation = this.#pending.filter(
        (expectation) => expectation.operationId !== result.publication?.operationId,
      );
      this.#pending = Object.freeze(
        [...withoutSameOperation, result.publication].slice(-KANBAN_LIMITS.pendingOperations.safe),
      );
    }
    return result;
  }

  /** Clears matching or contradictory metadata after authoritative application publication. */
  reconcilePublication(notice: KanbanPublicationNotice): void {
    if (this.#disposed) return;
    const reconciliation = reconcileKanbanPublication(this.#pending, notice);
    this.#pending = reconciliation.pending;
    if (reconciliation.cleared !== undefined) this.#cleared = reconciliation.cleared;
  }

  /** Returns detached bounded operations still awaiting authoritative publication. */
  pendingOperations(): readonly KanbanPublicationExpectation[] {
    return this.#pending;
  }

  /** Returns the most recent notice that cleared known pending metadata. */
  clearedPublication(): KanbanPublicationNotice | undefined {
    return this.#cleared;
  }

  /** Releases board-only metadata idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#pending = Object.freeze([]);
    this.#cleared = undefined;
  }
}
