import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey, KanbanFieldId } from '../contract/identity.js';
import type {
  KanbanEditorCoordinator,
  KanbanEditorCoordinatorOpenOptions,
  KanbanEditorFieldState,
  KanbanEditorKind,
  KanbanEditorOpenResult,
  KanbanEditorPrepareResult,
  KanbanEditorReloadPolicy,
  KanbanEditorReloadResult,
  KanbanEditorSession,
  KanbanEditorSessionSnapshot,
  KanbanEditorSetValueResult,
  KanbanEditorSubmitResult,
} from './types.js';
import { createKanbanEditorSession } from './session.js';

/** One pre-resolution identity claim shared by concurrent open attempts. */
interface KanbanEditorClaim {
  /** Opaque object that prevents an older session from releasing a replacement claim. */
  readonly marker: object;
  /** Presentation family that won the identity claim. */
  readonly editorKind: KanbanEditorKind;
  /** Resolves to the one release-aware session returned to every caller. */
  readonly session: Promise<KanbanEditorSession>;
  /** Aborts package subscription ownership while initial resolution is pending. */
  readonly controller: AbortController;
}

/**
 * Delegates session behavior while releasing one exact coordinator claim on disposal.
 *
 * The wrapper avoids adding release callbacks to the generic session contract. It also ensures a
 * stale session can never delete a newer claim for the same application identity.
 */
class CoordinatedKanbanEditorSession<TDraft> implements KanbanEditorSession<TDraft> {
  readonly #session: KanbanEditorSession<TDraft>;
  readonly #release: () => void;
  #disposed = false;

  /** Creates one release-aware view over an already resolved editor session. */
  constructor(session: KanbanEditorSession<TDraft>, release: () => void) {
    this.#session = session;
    this.#release = release;
  }

  /** Returns the underlying coherent actor snapshot. */
  snapshot(): KanbanEditorSessionSnapshot {
    return this.#session.snapshot();
  }

  /** Returns immutable state for one schema field. */
  fieldState(fieldId: KanbanFieldId): KanbanEditorFieldState {
    return this.#session.fieldState(fieldId);
  }

  /** Returns one immutable semantic field value from the underlying draft. */
  fieldValue(fieldId: KanbanFieldId) {
    return this.#session.fieldValue(fieldId);
  }

  /** Delegates stable focus identity updates without exposing coordinator ownership. */
  focusField(fieldId: KanbanFieldId): boolean {
    return this.#session.focusField(fieldId);
  }

  /** Delegates one failure-contained field mutation. */
  setValue(fieldId: KanbanFieldId, value: unknown): KanbanEditorSetValueResult {
    return this.#session.setValue(fieldId, value);
  }

  /** Delegates result-only validation without invoking authority. */
  prepare(): Promise<KanbanEditorPrepareResult<TDraft>> {
    return this.#session.prepare();
  }

  /** Delegates one validation and authority submission. */
  submit(): Promise<KanbanEditorSubmitResult> {
    return this.#session.submit();
  }

  /** Delegates one explicit stale-draft reload. */
  reload(policy: KanbanEditorReloadPolicy): Promise<KanbanEditorReloadResult> {
    return this.#session.reload(policy);
  }

  /** Subscribes to complete underlying session snapshots. */
  subscribe(listener: (snapshot: KanbanEditorSessionSnapshot) => void): () => void {
    return this.#session.subscribe(listener);
  }

  /** Releases the underlying session and its exact identity claim idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#session.dispose();
    this.#release();
  }

  /** Reports wrapper or underlying disposal. */
  disposed(): boolean {
    return this.#disposed || this.#session.disposed();
  }
}

/** Identity-keyed coordinator implementation with pre-resolution claims. */
class KanbanEditorCoordinatorActor implements KanbanEditorCoordinator {
  readonly #claims = new Map<CardKey, KanbanEditorClaim>();
  #disposed = false;

  /** Opens one session or converges on the exact existing identity claim. */
  async open<TCard, TDraft>(
    options: KanbanEditorCoordinatorOpenOptions<TCard, TDraft>,
  ): Promise<KanbanEditorOpenResult<TDraft>> {
    if (this.#disposed) return Object.freeze({ kind: 'disposed' });
    if (options.editorKind !== 'standard' && options.editorKind !== 'custom') {
      throw new TypeError('Invalid Kanban editor kind.');
    }
    const cardKey = createKanbanCardKey(options.cardKey);
    const existing = this.#claims.get(cardKey);
    if (existing !== undefined) {
      const session = await existing.session;
      if (this.#disposed) return Object.freeze({ kind: 'disposed' });
      return Object.freeze({ kind: 'already-open', editorKind: existing.editorKind, session });
    }

    const controller = new AbortController();
    const abortFromCaller = (): void => controller.abort();
    if (options.signal?.aborted === true) controller.abort();
    else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
    const marker = Object.freeze({});
    const session = createKanbanEditorSession({ ...options, signal: controller.signal }).then((resolved) => {
      const coordinated = new CoordinatedKanbanEditorSession(resolved, () => {
        controller.abort();
        if (this.#claims.get(cardKey)?.marker === marker) this.#claims.delete(cardKey);
      });
      if (this.#disposed) coordinated.dispose();
      return coordinated;
    });
    void session.finally(() => options.signal?.removeEventListener('abort', abortFromCaller)).catch(() => undefined);
    const claim = Object.freeze({ marker, editorKind: options.editorKind, session, controller });
    this.#claims.set(cardKey, claim);
    try {
      const resolved = await session;
      if (this.#disposed) return Object.freeze({ kind: 'disposed' });
      return Object.freeze({ kind: 'opened', editorKind: options.editorKind, session: resolved });
    } catch (error) {
      if (this.#claims.get(cardKey) === claim) this.#claims.delete(cardKey);
      throw error;
    }
  }

  /** Disposes resolved and pending sessions and rejects future acquisitions. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const claims = [...this.#claims.values()];
    this.#claims.clear();
    for (const claim of claims) {
      claim.controller.abort();
      void claim.session.then(
        (session) => session.dispose(),
        () => undefined,
      );
    }
  }

  /** Reports whether every identity claim has been released. */
  disposed(): boolean {
    return this.#disposed;
  }
}

/**
 * Creates one identity coordinator shared by standard dialogs, custom replacements, and inspectors.
 *
 * @example
 * ```ts
 * const coordinator = createKanbanEditorCoordinator();
 * const opened = await coordinator.open({ ...sessionOptions, editorKind: 'standard' });
 * ```
 */
export function createKanbanEditorCoordinator(): KanbanEditorCoordinator {
  return new KanbanEditorCoordinatorActor();
}
