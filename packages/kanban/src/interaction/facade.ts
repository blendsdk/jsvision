import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import { snapshotKanbanInteractionResult, snapshotKanbanInteractionSnapshot } from './controller.js';
import type {
  KanbanInteractionEnvironment,
  KanbanInteractionResult,
  KanbanInteractionSnapshot,
  KanbanInteractionTransition,
  KanbanSelectionSnapshot,
} from './types.js';
import { KANBAN_NEUTRAL_INTERACTION_SNAPSHOT } from './types.js';

/** Controllers that have already transferred ownership to a board facade. */
const CLAIMED_CONTROLLERS = new WeakSet<object>();

/** Empty immutable eligible selection returned before mount or after setup failure. */
const EMPTY_SELECTION: KanbanSelectionSnapshot = Object.freeze({
  entries: Object.freeze([]),
  sessionRevision: 0,
  queryGeneration: 0,
});

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

/** Board-owned services used by the concrete stable facade implementation. */
interface KanbanInteractionFacadeOwnerOptions {
  /** Captures current eligible selection without exposing application records. */
  readonly snapshotEligibleSelection: () => KanbanSelectionSnapshot;
  /** Schedules mounted board rendering after controller publication. */
  readonly invalidate: () => void;
  /** Optional already-redacted observation sink. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** Captured methods from one claimed controller, immune to later property replacement. */
interface OwnedController {
  /** Reads current controller state. */
  readonly snapshot: () => unknown;
  /** Applies a serialized transition. */
  readonly transition: (command: KanbanInteractionTransition) => unknown;
  /** Releases the controller subscription. */
  readonly unsubscribe: () => void;
  /** Releases controller-owned resources. */
  readonly dispose: () => void;
}

/** Returns a payload-free unavailable result over the last valid facade state. */
function unavailable(snapshot: KanbanInteractionSnapshot): KanbanInteractionResult {
  return Object.freeze({ kind: 'unavailable', code: 'interaction-unavailable', snapshot, retry: 'unavailable' });
}

/**
 * Compares canonical detached snapshots after validation has normalized key order and optional fields.
 *
 * JSON is safe here because the closed interaction contract contains only bounded JSON primitives,
 * arrays, and objects; card identity deliberately remains either a number or a string.
 */
function interactionSnapshotsEqual(left: KanbanInteractionSnapshot, right: KanbanInteractionSnapshot): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

/** Validates the callable shape of a factory-owned controller without invoking property getters twice. */
function controllerMethods(controller: unknown): {
  readonly owner: object;
  readonly snapshot: () => unknown;
  readonly transition: (command: KanbanInteractionTransition) => unknown;
  readonly subscribe: (invalidate: () => void) => unknown;
  readonly dispose: () => unknown;
} {
  if (typeof controller !== 'object' || controller === null) throw new KanbanInvalidSourcePublicationError();
  const snapshot = Reflect.get(controller, 'snapshot');
  const transition = Reflect.get(controller, 'transition');
  const subscribe = Reflect.get(controller, 'subscribe');
  const dispose = Reflect.get(controller, 'dispose');
  if (
    typeof snapshot !== 'function' ||
    typeof transition !== 'function' ||
    typeof subscribe !== 'function' ||
    typeof dispose !== 'function'
  ) {
    throw new KanbanInvalidSourcePublicationError();
  }
  return Object.freeze({
    owner: controller,
    snapshot: () => Reflect.apply(snapshot, controller, []),
    transition: (command) => Reflect.apply(transition, controller, [command]),
    subscribe: (invalidate) => Reflect.apply(subscribe, controller, [invalidate]),
    dispose: () => Reflect.apply(dispose, controller, []),
  });
}

/**
 * Concrete stable facade owned by one board for its complete construction-to-disposal lifetime.
 *
 * The facade exists before mount, while its controller attaches only after the viewport source and
 * scene resources are usable. Setup and transition failures retain the last valid immutable snapshot.
 */
export class KanbanInteractionFacadeOwner implements KanbanInteractionFacade {
  readonly #options: KanbanInteractionFacadeOwnerOptions;
  readonly #subscribers = new Set<() => void>();
  #controller: OwnedController | undefined;
  #lastSnapshot = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT;
  #queue: Promise<void> = Promise.resolve();
  #transitionActive = false;
  #failed = false;
  #disposed = false;
  #failureObserved = false;

  /** Stores board-owned bounded services without creating an interaction controller. */
  constructor(options: KanbanInteractionFacadeOwnerOptions) {
    this.#options = options;
  }

  /** Returns the last valid detached snapshot before, during, or after mount. */
  snapshot(): KanbanInteractionSnapshot {
    const controller = this.#controller;
    if (controller !== undefined && !this.#failed && !this.#disposed) {
      try {
        this.#publish(snapshotKanbanInteractionSnapshot(controller.snapshot()));
      } catch {
        this.failSetup();
      }
    }
    return this.#lastSnapshot;
  }

  /** Serializes controller transitions and converts every rejected settlement to typed unavailability. */
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult> {
    const result = this.#transitionActive
      ? this.#queue.then(() => this.#executeTransition(command))
      : this.#executeTransition(command);
    this.#transitionActive = true;
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.#queue = tail;
    void tail.then(() => {
      if (this.#queue === tail) this.#transitionActive = false;
    });
    return result;
  }

  /** Captures current eligible selection or a frozen empty fallback when unavailable. */
  snapshotEligibleSelection(): KanbanSelectionSnapshot {
    if (this.#failed || this.#disposed) return EMPTY_SELECTION;
    try {
      return this.#options.snapshotEligibleSelection();
    } catch {
      this.#observe('interaction-selection-snapshot-failed');
      return EMPTY_SELECTION;
    }
  }

  /** Registers one facade listener independently from controller mount timing. */
  subscribe(invalidate: () => void): () => void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    this.#subscribers.add(invalidate);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.#subscribers.delete(invalidate);
    };
  }

  /** Claims, validates, snapshots, and subscribes one factory controller atomically. */
  attach(controller: KanbanInteractionController): void {
    if (this.#disposed || this.#failed || this.#controller !== undefined) {
      throw new KanbanDisposedResourceError();
    }
    let methods: ReturnType<typeof controllerMethods> | undefined;
    let claimed = false;
    try {
      methods = controllerMethods(controller);
      if (CLAIMED_CONTROLLERS.has(methods.owner)) throw new KanbanInvalidSourcePublicationError();
      CLAIMED_CONTROLLERS.add(methods.owner);
      claimed = true;
      const initial = snapshotKanbanInteractionSnapshot(methods.snapshot());
      const rawUnsubscribe = methods.subscribe(() => this.#controllerInvalidated());
      if (typeof rawUnsubscribe !== 'function') throw new KanbanInvalidSourcePublicationError();
      const captured = methods;
      const unsubscribe = (): void => {
        Reflect.apply(rawUnsubscribe, undefined, []);
      };
      this.#controller = Object.freeze({
        snapshot: captured.snapshot,
        transition: captured.transition,
        unsubscribe,
        dispose: captured.dispose,
      });
      this.#lastSnapshot = initial;
      this.#notify();
    } catch (error) {
      if (claimed && methods !== undefined) {
        try {
          methods.dispose();
        } catch {
          // Setup failure remains represented by one payload-free observation.
        }
      }
      this.failSetup();
      throw error;
    }
  }

  /** Permanently marks mount setup unavailable and emits at most one safe observation. */
  failSetup(): void {
    if (this.#failed) return;
    this.#failed = true;
    this.#releaseController();
    this.#observeSetupFailure();
    this.#notify();
  }

  /** Releases the claimed controller and facade subscribers idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#releaseController();
    this.#subscribers.clear();
  }

  /** Invokes the controller synchronously, then validates asynchronous settlement behind the facade. */
  #executeTransition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult> {
    const controller = this.#controller;
    if (controller === undefined || this.#failed || this.#disposed) {
      return Promise.resolve(unavailable(this.#lastSnapshot));
    }
    let raw: unknown;
    try {
      raw = controller.transition(command);
    } catch {
      this.#observe('interaction-transition-failed');
      return Promise.resolve(unavailable(this.#lastSnapshot));
    }
    return Promise.resolve(raw).then(
      (value) => {
        if (this.#disposed || this.#failed || this.#controller !== controller) {
          return unavailable(this.#lastSnapshot);
        }
        try {
          const settled = snapshotKanbanInteractionResult(value);
          this.#publish(settled.snapshot);
          return settled;
        } catch {
          this.#observe('interaction-transition-failed');
          return unavailable(this.#lastSnapshot);
        }
      },
      () => {
        if (this.#disposed || this.#failed || this.#controller !== controller) {
          return unavailable(this.#lastSnapshot);
        }
        this.#observe('interaction-transition-failed');
        return unavailable(this.#lastSnapshot);
      },
    );
  }

  /** Refreshes facade state after an injected controller reports publication. */
  #controllerInvalidated(): void {
    const controller = this.#controller;
    if (controller === undefined || this.#failed || this.#disposed) return;
    try {
      this.#publish(snapshotKanbanInteractionSnapshot(controller.snapshot()), true);
    } catch {
      this.failSetup();
    }
  }

  /** Publishes only monotonic evidence while optionally forwarding an explicit controller notification. */
  #publish(snapshot: KanbanInteractionSnapshot, notifyDuplicate = false): void {
    if (snapshot.revision < this.#lastSnapshot.revision) throw new KanbanInvalidSourcePublicationError();
    if (snapshot.revision === this.#lastSnapshot.revision) {
      if (interactionSnapshotsEqual(snapshot, this.#lastSnapshot)) {
        if (notifyDuplicate) this.#notify();
        return;
      }
      throw new KanbanInvalidSourcePublicationError();
    }
    this.#lastSnapshot = snapshot;
    this.#notify();
  }

  /** Isolates subscribers and schedules one board invalidation. */
  #notify(): void {
    for (const subscriber of [...this.#subscribers]) {
      try {
        subscriber();
      } catch {
        // One subscriber cannot prevent other consumers from observing committed state.
      }
    }
    try {
      this.#options.invalidate();
    } catch {
      // Host invalidation failure does not corrupt the semantic state boundary.
    }
  }

  /** Releases subscription before the controller and contains application cleanup failures. */
  #releaseController(): void {
    const controller = this.#controller;
    this.#controller = undefined;
    if (controller === undefined) return;
    try {
      controller.unsubscribe();
    } catch {
      // Cleanup continues so the controller cannot retain board resources.
    }
    try {
      controller.dispose();
    } catch {
      // Disposal failure is contained at the application injection boundary.
    }
  }

  /** Emits the one setup failure observation required by fail-closed mount rollback. */
  #observeSetupFailure(): void {
    if (this.#failureObserved) return;
    this.#failureObserved = true;
    this.#observe('interaction-setup-failed');
  }

  /** Delivers a redacted observation while isolating an application sink failure. */
  #observe(code: string): void {
    try {
      this.#options.observe?.(createKanbanObservation({ code, scope: 'board' }));
    } catch {
      // Observation sinks are diagnostic-only and never participate in controller state.
    }
  }
}
