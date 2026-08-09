import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import type { KanbanExtensionId } from '../contract/identity.js';
import type { KanbanActionScope } from '../layout/hit-map.js';
import { snapshotKanbanInteractionSnapshot } from '../interaction/controller.js';
import type { KanbanActivateOptions, KanbanOpenContextOptions } from '../interaction/facade.js';
import type { KanbanInteractionOrigin } from '../interaction/intent.js';
import type {
  KanbanInteractionResult,
  KanbanInteractionSnapshot,
  KanbanInteractionTransition,
} from '../interaction/types.js';
import { KANBAN_NEUTRAL_INTERACTION_SNAPSHOT } from '../interaction/types.js';

/**
 * Non-owning state and transition adapter accepted by a standalone Kanban viewport.
 *
 * The viewport subscribes while mounted but never disposes or transitions the adapter. A board facade
 * may therefore drive a read-only mirror without transferring controller ownership; application code
 * still sends transitions through the facade that owns the original board environment.
 *
 * @example
 * ```ts
 * const mirror = new KanbanViewport({ ...options, interaction: board.interaction() });
 * ```
 */
export interface KanbanViewportInteractionAdapter {
  /** Returns the latest detached immutable interaction publication. */
  snapshot(): KanbanInteractionSnapshot;
  /** Applies one closed semantic transition through the adapter's existing owner. */
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult> | KanbanInteractionResult;
  /** Subscribes to semantic publications and returns an idempotent unsubscribe function. */
  subscribe(invalidate: () => void): () => void;
}

/** Captured adapter methods that cannot be replaced after viewport construction. */
interface CapturedKanbanViewportInteractionAdapter {
  readonly snapshot: () => unknown;
  readonly subscribe: (invalidate: () => void) => unknown;
  readonly input?: CapturedKanbanViewportInputAdapter;
}

/** Optional board-facade methods required for mounted keyboard and pointer input. */
export interface CapturedKanbanViewportInputAdapter {
  /** Synchronously queues one controller transition. */
  readonly accept: (command: KanbanInteractionTransition) => boolean;
  /** Synchronously queues card activation. */
  readonly acceptActivate: (options: KanbanActivateOptions) => boolean;
  /** Synchronously queues context activation. */
  readonly acceptOpenContext: (options: KanbanOpenContextOptions) => boolean;
  /** Synchronously queues one scoped action. */
  readonly acceptScopedAction: (
    actionId: KanbanExtensionId,
    scope: KanbanActionScope,
    origin: KanbanInteractionOrigin,
  ) => boolean;
}

/** Validates and captures one non-owning adapter without depending on its mutable properties later. */
function captureAdapter(adapter: KanbanViewportInteractionAdapter): CapturedKanbanViewportInteractionAdapter {
  try {
    if (typeof adapter !== 'object' || adapter === null || Array.isArray(adapter)) {
      throw new KanbanInvalidSourcePublicationError();
    }
    const snapshot = Reflect.get(adapter, 'snapshot');
    const transition = Reflect.get(adapter, 'transition');
    const subscribe = Reflect.get(adapter, 'subscribe');
    if (typeof snapshot !== 'function' || typeof transition !== 'function' || typeof subscribe !== 'function') {
      throw new KanbanInvalidSourcePublicationError();
    }
    const accept = Reflect.get(adapter, 'accept');
    const acceptActivate = Reflect.get(adapter, 'acceptActivate');
    const acceptOpenContext = Reflect.get(adapter, 'acceptOpenContext');
    const acceptScopedAction = Reflect.get(adapter, 'acceptScopedAction');
    const inputAvailable =
      typeof accept === 'function' &&
      typeof acceptActivate === 'function' &&
      typeof acceptOpenContext === 'function' &&
      typeof acceptScopedAction === 'function';
    return Object.freeze({
      snapshot: () => Reflect.apply(snapshot, adapter, []),
      subscribe: (invalidate: () => void) => Reflect.apply(subscribe, adapter, [invalidate]),
      ...(inputAvailable
        ? {
            input: Object.freeze({
              accept: (command: KanbanInteractionTransition) => Reflect.apply(accept, adapter, [command]) === true,
              acceptActivate: (options: KanbanActivateOptions) =>
                Reflect.apply(acceptActivate, adapter, [options]) === true,
              acceptOpenContext: (options: KanbanOpenContextOptions) =>
                Reflect.apply(acceptOpenContext, adapter, [options]) === true,
              acceptScopedAction: (
                actionId: KanbanExtensionId,
                scope: KanbanActionScope,
                origin: KanbanInteractionOrigin,
              ) => Reflect.apply(acceptScopedAction, adapter, [actionId, scope, origin]) === true,
            }),
          }
        : {}),
    });
  } catch {
    throw new KanbanInvalidSourcePublicationError();
  }
}

/**
 * Mount-scoped subscription wrapper that retains the last valid publication and no adapter ownership.
 *
 * Initial validation or subscription failure rejects mount atomically. A later malformed publication is
 * ignored so already-painted safe state remains available until the adapter recovers.
 */
export class KanbanViewportInteractionBinding {
  readonly #adapter: CapturedKanbanViewportInteractionAdapter | undefined;
  #snapshot = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT;
  #unsubscribe: (() => void) | undefined;
  #mounted = false;
  #disposed = false;

  /** Captures the optional adapter method surface without subscribing before mount. */
  constructor(adapter: KanbanViewportInteractionAdapter | undefined) {
    this.#adapter = adapter === undefined ? undefined : captureAdapter(adapter);
  }

  /** Validates the initial publication and subscribes for the mounted viewport lifetime. */
  mount(invalidate: () => void): void {
    if (this.#disposed || this.#mounted) throw new KanbanDisposedResourceError();
    this.#mounted = true;
    const adapter = this.#adapter;
    if (adapter === undefined) return;
    try {
      this.#snapshot = snapshotKanbanInteractionSnapshot(adapter.snapshot());
      const unsubscribe = adapter.subscribe(() => {
        this.#refresh();
        invalidate();
      });
      if (typeof unsubscribe !== 'function') throw new KanbanInvalidSourcePublicationError();
      let active = true;
      this.#unsubscribe = () => {
        if (!active) return;
        active = false;
        Reflect.apply(unsubscribe, undefined, []);
      };
    } catch {
      this.dispose();
      throw new KanbanInvalidSourcePublicationError();
    }
  }

  /**
   * Refreshes and returns the latest valid detached publication.
   *
   * Reading at the projection boundary also covers owners that attach after the viewport's mount
   * callback. Invalid adapter output cannot replace the last safe cached publication.
   */
  snapshot(): KanbanInteractionSnapshot {
    if (this.#mounted) this.#refresh();
    return this.#snapshot;
  }

  /** Returns mounted synchronous input seams only when the supplied adapter provides the complete set. */
  input(): CapturedKanbanViewportInputAdapter | undefined {
    return this.#mounted && !this.#disposed ? this.#adapter?.input : undefined;
  }

  /** Releases only the viewport's subscription and never disposes the supplied adapter. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    try {
      this.#unsubscribe?.();
    } catch {
      // Adapter cleanup is isolated because the viewport still owns source and cache cleanup.
    }
    this.#unsubscribe = undefined;
  }

  /** Retains the last valid publication when a later application adapter snapshot is malformed. */
  #refresh(): void {
    const adapter = this.#adapter;
    if (adapter === undefined || this.#disposed) return;
    try {
      this.#snapshot = snapshotKanbanInteractionSnapshot(adapter.snapshot());
    } catch {
      // The last safe detached state remains authoritative until a later valid publication arrives.
    }
  }
}
