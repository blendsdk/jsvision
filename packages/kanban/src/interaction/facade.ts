import type {
  KanbanInteractionEnvironment,
  KanbanInteractionResult,
  KanbanInteractionSnapshot,
  KanbanInteractionTransition,
  KanbanSelectionSnapshot,
} from './types.js';

/**
 * Complete mount-owned state controller used behind the stable board facade.
 *
 * Controllers own semantic interaction state only. They receive bounded environment services from
 * the factory and never application card records, terminal host objects, or interaction handlers.
 *
 * @example
 * ```ts
 * const controller: KanbanInteractionController = createKanbanInteractionController(environment);
 * const snapshot = controller.snapshot();
 * ```
 */
export interface KanbanInteractionController {
  /** Returns the current detached immutable semantic state. */
  snapshot(): KanbanInteractionSnapshot;
  /** Applies one closed transition synchronously or through bounded asynchronous acquisition. */
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult> | KanbanInteractionResult;
  /** Subscribes to semantic publications and returns an idempotent unsubscribe function. */
  subscribe(invalidate: () => void): () => void;
  /** Releases subscriptions, cancellation, and other controller-owned resources idempotently. */
  dispose(): void;
}

/**
 * Sole injection seam for replacing the default interaction controller.
 *
 * Ownership of the returned controller transfers to one mounted board. Reusing the same controller
 * instance across boards is invalid.
 *
 * @example
 * ```ts
 * const factory: KanbanInteractionControllerFactory = (environment) =>
 *   createKanbanInteractionController(environment);
 * ```
 */
export type KanbanInteractionControllerFactory = (
  environment: KanbanInteractionEnvironment,
) => KanbanInteractionController;

/**
 * Stable board-owned programmatic interaction surface available before and after mount.
 *
 * The facade serializes transitions and converts controller failures to typed unavailable results.
 * It never exposes the owned controller instance.
 *
 * @example
 * ```ts
 * await board.interaction().transition({ kind: 'navigate', direction: 'down' });
 * const focused = board.interaction().snapshot().focused;
 * ```
 */
export interface KanbanInteractionFacade {
  /** Returns the last valid detached immutable interaction snapshot. */
  snapshot(): KanbanInteractionSnapshot;
  /** Serializes one closed transition behind settlement-generation checks. */
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult>;
  /** Captures current eligible ordered selection independently from later live changes. */
  snapshotEligibleSelection(): KanbanSelectionSnapshot;
  /** Subscribes to facade publications and returns an idempotent unsubscribe function. */
  subscribe(invalidate: () => void): () => void;
}
