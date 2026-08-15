import type { KeyEvent } from '@jsvision/core';

import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import type { KanbanActionScope } from '../layout/hit-map.js';
import type {
  KanbanCardMoveProposal,
  KanbanColumnReorderProposal,
  KanbanSwimlaneReorderProposal,
} from '../contract/request.js';
import { snapshotKanbanEligibility } from '../operation/eligibility.js';
import type { KanbanEligibility } from '../operation/eligibility.js';
import { snapshotKanbanInteractionSnapshot } from '../interaction/controller.js';
import type { KanbanActivateOptions, KanbanOpenContextOptions } from '../interaction/facade.js';
import type { KanbanInteractionOrigin, KanbanScopedActionId } from '../interaction/intent.js';
import type { KanbanMoveDirection } from '../interaction/operation-facade.js';
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
 * may therefore drive a read-only mirror without transferring controller or input authority;
 * application code still sends transitions through the facade that owns the original board
 * environment.
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
}

/** Board-owned facade methods required for mounted keyboard and pointer input. */
export interface KanbanViewportInputAdapter {
  /** Optional shared action-key route; undefined preserves the legacy keyboard fallback. */
  readonly routeKey?: (event: KeyEvent) => boolean | undefined;
  /** Synchronously queues one controller transition. */
  readonly accept: (command: KanbanInteractionTransition) => boolean;
  /** Commits selection and activation in one ordered facade operation when supported. */
  readonly acceptSelectionActivate?: (command: KanbanInteractionTransition, options: KanbanActivateOptions) => boolean;
  /** Synchronously queues card activation. */
  readonly acceptActivate: (options: KanbanActivateOptions) => boolean;
  /** Synchronously queues context activation. */
  readonly acceptOpenContext: (options: KanbanOpenContextOptions) => boolean;
  /** Synchronously queues one scoped action. */
  readonly acceptScopedAction: (
    actionId: KanbanScopedActionId,
    scope: KanbanActionScope,
    origin: KanbanInteractionOrigin,
  ) => boolean;
  /** Optional board-only mutation admission; standalone viewports deliberately omit it. */
  readonly commitCardMove?: (proposal: KanbanCardMoveProposal) => boolean;
  /** Optional board-only structural reorder admission through the same coordinator. */
  readonly commitStructureReorder?: (proposal: KanbanColumnReorderProposal | KanbanSwimlaneReorderProposal) => boolean;
  /** Optional board-only pure policy preview used to classify the current semantic drop target. */
  readonly evaluateCardMove?: (proposal: KanbanCardMoveProposal) => KanbanEligibility;
  /** Optional board-only semantic keyboard move for the focused card. */
  readonly moveFocused?: (direction: KanbanMoveDirection) => boolean;
  /** Optional board-only cancellation of the most recent operation layer. */
  readonly cancelTransient?: () => boolean;
  /** Optional capability gate checked only when a card press crosses the drag threshold. */
  readonly canStartCardDrag?: (scope: Extract<KanbanActionScope, { readonly kind: 'card' }>) => boolean;
  /** Optional capability gate checked only when a structural press crosses the drag threshold. */
  readonly canStartStructureDrag?: (
    scope: Extract<KanbanActionScope, { readonly kind: 'column' | 'swimlane' }>,
  ) => boolean;
}

/** Captured input methods that cannot be replaced after board construction. */
type CapturedKanbanViewportInputAdapter = KanbanViewportInputAdapter;

/** Validates and captures the explicit board-owned input surface. */
function captureInputAdapter(adapter: KanbanViewportInputAdapter): CapturedKanbanViewportInputAdapter {
  try {
    const accept = Reflect.get(adapter, 'accept');
    const acceptSelectionActivate = Reflect.get(adapter, 'acceptSelectionActivate');
    const acceptActivate = Reflect.get(adapter, 'acceptActivate');
    const acceptOpenContext = Reflect.get(adapter, 'acceptOpenContext');
    const acceptScopedAction = Reflect.get(adapter, 'acceptScopedAction');
    const commitCardMove = Reflect.get(adapter, 'commitCardMove');
    const commitStructureReorder = Reflect.get(adapter, 'commitStructureReorder');
    const evaluateCardMove = Reflect.get(adapter, 'evaluateCardMove');
    const moveFocused = Reflect.get(adapter, 'moveFocused');
    const cancelTransient = Reflect.get(adapter, 'cancelTransient');
    const routeKey = Reflect.get(adapter, 'routeKey');
    const canStartCardDrag = Reflect.get(adapter, 'canStartCardDrag');
    const canStartStructureDrag = Reflect.get(adapter, 'canStartStructureDrag');
    if (
      typeof accept !== 'function' ||
      typeof acceptActivate !== 'function' ||
      typeof acceptOpenContext !== 'function' ||
      typeof acceptScopedAction !== 'function'
    ) {
      throw new KanbanInvalidSourcePublicationError();
    }
    return Object.freeze({
      ...(typeof routeKey === 'function'
        ? {
            routeKey: (event: KeyEvent) => {
              const result: unknown = Reflect.apply(routeKey, adapter, [event]);
              return typeof result === 'boolean' ? result : undefined;
            },
          }
        : {}),
      accept: (command: KanbanInteractionTransition) => Reflect.apply(accept, adapter, [command]) === true,
      ...(typeof acceptSelectionActivate === 'function'
        ? {
            acceptSelectionActivate: (command: KanbanInteractionTransition, options: KanbanActivateOptions) =>
              Reflect.apply(acceptSelectionActivate, adapter, [command, options]) === true,
          }
        : {}),
      acceptActivate: (options: KanbanActivateOptions) => Reflect.apply(acceptActivate, adapter, [options]) === true,
      acceptOpenContext: (options: KanbanOpenContextOptions) =>
        Reflect.apply(acceptOpenContext, adapter, [options]) === true,
      acceptScopedAction: (actionId: KanbanScopedActionId, scope: KanbanActionScope, origin: KanbanInteractionOrigin) =>
        Reflect.apply(acceptScopedAction, adapter, [actionId, scope, origin]) === true,
      ...(typeof commitCardMove === 'function'
        ? {
            commitCardMove: (proposal: KanbanCardMoveProposal) =>
              Reflect.apply(commitCardMove, adapter, [proposal]) === true,
          }
        : {}),
      ...(typeof commitStructureReorder === 'function'
        ? {
            commitStructureReorder: (proposal: KanbanColumnReorderProposal | KanbanSwimlaneReorderProposal) =>
              Reflect.apply(commitStructureReorder, adapter, [proposal]) === true,
          }
        : {}),
      ...(typeof evaluateCardMove === 'function'
        ? {
            evaluateCardMove: (proposal: KanbanCardMoveProposal) =>
              snapshotKanbanEligibility(Reflect.apply(evaluateCardMove, adapter, [proposal])),
          }
        : {}),
      ...(typeof moveFocused === 'function'
        ? {
            moveFocused: (direction: KanbanMoveDirection) => Reflect.apply(moveFocused, adapter, [direction]) === true,
          }
        : {}),
      ...(typeof cancelTransient === 'function'
        ? { cancelTransient: () => Reflect.apply(cancelTransient, adapter, []) === true }
        : {}),
      ...(typeof canStartCardDrag === 'function'
        ? {
            canStartCardDrag: (scope: Extract<KanbanActionScope, { readonly kind: 'card' }>) =>
              Reflect.apply(canStartCardDrag, adapter, [scope]) === true,
          }
        : {}),
      ...(typeof canStartStructureDrag === 'function'
        ? {
            canStartStructureDrag: (scope: Extract<KanbanActionScope, { readonly kind: 'column' | 'swimlane' }>) =>
              Reflect.apply(canStartStructureDrag, adapter, [scope]) === true,
          }
        : {}),
    });
  } catch {
    throw new KanbanInvalidSourcePublicationError();
  }
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
    return Object.freeze({
      snapshot: () => Reflect.apply(snapshot, adapter, []),
      subscribe: (invalidate: () => void) => Reflect.apply(subscribe, adapter, [invalidate]),
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
  #input: CapturedKanbanViewportInputAdapter | undefined;
  #snapshot = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT;
  #unsubscribe: (() => void) | undefined;
  #mounted = false;
  #inputEnabled = false;
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

  /** Returns mounted synchronous input seams only for the explicitly attached owning board. */
  input(): CapturedKanbanViewportInputAdapter | undefined {
    return this.#mounted && this.#inputEnabled && !this.#disposed ? this.#input : undefined;
  }

  /** Attaches explicit board-owned input authority before the viewport mounts. */
  attachInput(adapter: KanbanViewportInputAdapter): void {
    if (this.#mounted || this.#disposed || this.#input !== undefined) throw new KanbanDisposedResourceError();
    this.#input = captureInputAdapter(adapter);
  }

  /** Enables mounted input only after the owning mount transaction has completed. */
  enableInput(): void {
    if (this.#mounted && !this.#disposed) this.#inputEnabled = true;
  }

  /** Rejects new mounted input immediately without releasing the state subscription yet. */
  disableInput(): void {
    this.#inputEnabled = false;
  }

  /** Releases only the viewport's subscription and never disposes the supplied adapter. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.disableInput();
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
