import { KanbanDisposedResourceError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { KanbanExtensionId, KanbanOperationId } from '../contract/identity.js';
import type { KanbanRequestResult } from '../contract/request.js';
import type { KanbanActionScope } from '../layout/hit-map.js';
import { snapshotKanbanInteractionResult, snapshotKanbanInteractionSnapshot } from './controller.js';
import { KanbanIntentRouter } from './intent-router.js';
import type { KanbanIntentRequest } from './intent-router.js';
import { KanbanOperationFacade } from './operation-facade.js';
import type {
  KanbanMoveCardOptions,
  KanbanMoveDirection,
  KanbanMoveSelectedBlockOptions,
  KanbanOperationFacadeApi,
  KanbanOperationFacadeServices,
  KanbanReorderColumnOptions,
  KanbanReorderSwimlaneOptions,
} from './operation-facade.js';
import type { KanbanInteractionHandler, KanbanInteractionOrigin, KanbanScopedActionId } from './intent.js';
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
export interface KanbanInteractionFacade extends KanbanOperationFacadeApi {
  /** Returns the last valid detached immutable interaction snapshot. */
  snapshot(): KanbanInteractionSnapshot;
  /** Synchronously queues one enabled event-loop transition when a controller is available. */
  accept(command: KanbanInteractionTransition): boolean;
  /** Serializes one closed transition behind settlement-generation checks. */
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult>;
  /** Opens the current or explicit card through the serialized semantic intent boundary. */
  activate(options?: KanbanActivateOptions): Promise<boolean>;
  /** Opens application-owned context for the current or explicit closed semantic scope. */
  openContext(options?: KanbanOpenContextOptions): Promise<boolean>;
  /** Invokes one application-owned scoped action without mutating board state locally. */
  invokeScopedAction(
    actionId: KanbanScopedActionId,
    scope: KanbanActionScope,
    origin?: KanbanInteractionOrigin,
  ): Promise<boolean>;
  /** Captures current eligible ordered selection independently from later live changes. */
  snapshotEligibleSelection(): KanbanSelectionSnapshot;
  /** Subscribes to facade publications and returns an idempotent unsubscribe function. */
  subscribe(invalidate: () => void): () => void;
}

/** Options for programmatic or mounted focused-card activation. */
export interface KanbanActivateOptions {
  /** Input channel; programmatic is used when omitted. */
  readonly origin?: KanbanInteractionOrigin;
  /** Explicit card scope; omission resolves the focused card after earlier queued work settles. */
  readonly scope?: Extract<KanbanActionScope, { readonly kind: 'card' }>;
  /** Optional descriptor action responsible for activation. */
  readonly actionId?: KanbanExtensionId;
}

/** Options for programmatic or mounted context activation. */
export interface KanbanOpenContextOptions {
  /** Input channel; programmatic is used when omitted. */
  readonly origin?: KanbanInteractionOrigin;
  /** Explicit scope; omission resolves current semantic focus after earlier queued work settles. */
  readonly scope?: KanbanActionScope;
}

/** Board-owned services used by the concrete stable facade implementation. */
interface KanbanInteractionFacadeOwnerOptions {
  /** Captures current eligible selection without exposing application records. */
  readonly snapshotEligibleSelection: () => KanbanSelectionSnapshot;
  /** Schedules mounted board rendering after controller publication. */
  readonly invalidate: () => void;
  /** Optional already-redacted observation sink. */
  readonly observe?: (observation: KanbanObservation) => void;
  /** Optional synchronous application interaction handler. */
  readonly onInteraction?: KanbanInteractionHandler;
  /** Board-owned semantic operation services shared by every input origin. */
  readonly operations?: KanbanOperationFacadeServices;
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

/** Compares two validated focus targets without serializing bounded selection arrays. */
function focusTargetsEqual(
  left: KanbanInteractionSnapshot['focused'],
  right: KanbanInteractionSnapshot['focused'],
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'board-state' && right.kind === 'board-state') return true;
  if (left.kind === 'column-header' && right.kind === 'column-header') return left.columnId === right.columnId;
  if (left.kind === 'swimlane-header' && right.kind === 'swimlane-header') return left.swimlaneId === right.swimlaneId;
  return (
    left.kind === 'card' &&
    right.kind === 'card' &&
    typeof left.cardKey === typeof right.cardKey &&
    left.cardKey === right.cardKey &&
    left.address.columnId === right.address.columnId &&
    left.address.swimlaneId === right.address.swimlaneId
  );
}

/** Compares optional validated values by their bounded primitive fields. */
function optionalStateEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false;
  const leftRecord = Object.entries(left);
  const rightRecord = Object.entries(right);
  return (
    leftRecord.length === rightRecord.length &&
    leftRecord.every(
      ([key, value]) =>
        Object.prototype.hasOwnProperty.call(right, key) && optionalStateEqual(value, Reflect.get(right, key)),
    )
  );
}

/** Compares semantic snapshot state while deliberately ignoring the monotonic revision counter. */
function interactionSnapshotStateEqual(left: KanbanInteractionSnapshot, right: KanbanInteractionSnapshot): boolean {
  return (
    focusTargetsEqual(left.focused, right.focused) &&
    left.selectedCardKeys.length === right.selectedCardKeys.length &&
    left.selectedCardKeys.every(
      (key, index) => typeof key === typeof right.selectedCardKeys[index] && key === right.selectedCardKeys[index],
    ) &&
    left.preferredCenterRow === right.preferredCenterRow &&
    optionalStateEqual(left.rangeAnchor, right.rangeAnchor) &&
    optionalStateEqual(left.pendingNavigation, right.pendingNavigation) &&
    optionalStateEqual(left.feedback, right.feedback) &&
    optionalStateEqual(left.serverSelection, right.serverSelection)
  );
}

/** Compares complete validated snapshots without allocating a serialized copy. */
function interactionSnapshotsEqual(left: KanbanInteractionSnapshot, right: KanbanInteractionSnapshot): boolean {
  return left === right || (left.revision === right.revision && interactionSnapshotStateEqual(left, right));
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

/** Returns whether a controller result requires asynchronous queue ownership. */
function isPromiseLike<TResult>(value: unknown): value is PromiseLike<TResult> {
  if (!((typeof value === 'object' && value !== null) || typeof value === 'function')) return false;
  try {
    return typeof Reflect.get(value, 'then') === 'function';
  } catch {
    return false;
  }
}

/**
 * Concrete stable facade owned by one board for its complete construction-to-disposal lifetime.
 *
 * The facade exists before mount, while its controller attaches only after the viewport source and
 * scene resources are usable. Setup and transition failures retain the last valid immutable snapshot.
 */
export class KanbanInteractionFacadeOwner implements KanbanInteractionFacade {
  readonly #options: KanbanInteractionFacadeOwnerOptions;
  readonly #intentRouter: KanbanIntentRouter;
  readonly #operations: KanbanOperationFacade;
  readonly #subscribers = new Set<() => void>();
  #controller: OwnedController | undefined;
  #lastSnapshot = KANBAN_NEUTRAL_INTERACTION_SNAPSHOT;
  #lastRawSnapshot: unknown;
  #queue: Promise<void> = Promise.resolve();
  #transitionActive = false;
  #failed = false;
  #disposed = false;
  #failureObserved = false;

  /** Stores board-owned bounded services without creating an interaction controller. */
  constructor(options: KanbanInteractionFacadeOwnerOptions) {
    this.#options = options;
    this.#intentRouter = new KanbanIntentRouter({
      ...(options.onInteraction === undefined ? {} : { handler: options.onInteraction }),
      ...(options.observe === undefined ? {} : { observe: options.observe }),
    });
    this.#operations = new KanbanOperationFacade(options.operations);
  }

  /** Returns the last valid detached snapshot before, during, or after mount. */
  snapshot(): KanbanInteractionSnapshot {
    const controller = this.#controller;
    if (controller !== undefined && !this.#failed && !this.#disposed) {
      try {
        const raw = controller.snapshot();
        if (raw !== this.#lastRawSnapshot) {
          this.#publish(snapshotKanbanInteractionSnapshot(raw));
          this.#lastRawSnapshot = Object.isFrozen(raw) ? raw : undefined;
        }
      } catch {
        this.failSetup();
      }
    }
    return this.#lastSnapshot;
  }

  /** Accepts one event-loop transition synchronously while settlement remains serialized. */
  accept(command: KanbanInteractionTransition): boolean {
    if (this.#controller === undefined || this.#failed || this.#disposed) return false;
    void this.transition(command);
    return true;
  }

  /** Serializes controller transitions and converts every rejected settlement to typed unavailability. */
  transition(command: KanbanInteractionTransition): Promise<KanbanInteractionResult> {
    return this.#schedule(() => this.#executeTransition(command));
  }

  /** Delivers focused-card activation after every earlier accepted transition settles. */
  activate(options: KanbanActivateOptions = {}): Promise<boolean> {
    return this.#scheduleIntent(() => {
      const scope = options.scope ?? this.#scopeForFocus();
      if (scope?.kind !== 'card') return undefined;
      return {
        kind: 'open-card',
        origin: options.origin ?? 'programmatic',
        scope,
        ...(options.actionId === undefined ? {} : { actionId: options.actionId }),
      };
    });
  }

  /** Delivers application-owned context after every earlier accepted transition settles. */
  openContext(options: KanbanOpenContextOptions = {}): Promise<boolean> {
    return this.#scheduleIntent(() => {
      const scope = options.scope ?? this.#scopeForFocus();
      if (scope === undefined) return undefined;
      return { kind: 'open-context', origin: options.origin ?? 'programmatic', scope };
    });
  }

  /** Delivers one closed scoped action after every earlier accepted transition settles. */
  invokeScopedAction(
    actionId: KanbanScopedActionId,
    scope: KanbanActionScope,
    origin: KanbanInteractionOrigin = 'programmatic',
  ): Promise<boolean> {
    return this.#scheduleIntent(() => ({ kind: 'scoped-action', origin, actionId, scope }));
  }

  /** Moves one explicit card after earlier semantic interaction work settles. */
  moveCard(options: KanbanMoveCardOptions): Promise<KanbanRequestResult> {
    return this.#schedule(() => this.#operations.moveCard(options));
  }

  /** Moves the current bounded selection after earlier focus/selection work settles. */
  moveSelectedBlock(options: KanbanMoveSelectedBlockOptions): Promise<KanbanRequestResult> {
    return this.#schedule(() => this.#operations.moveSelectedBlock(options));
  }

  /** Reorders one workflow column through the sole board coordinator. */
  reorderColumn(options: KanbanReorderColumnOptions): Promise<KanbanRequestResult> {
    return this.#schedule(() => this.#operations.reorderColumn(options));
  }

  /** Reorders one explicit swimlane through the sole board coordinator. */
  reorderSwimlane(options: KanbanReorderSwimlaneOptions): Promise<KanbanRequestResult> {
    return this.#schedule(() => this.#operations.reorderSwimlane(options));
  }

  /** Cancels one explicit or latest cancellable operation synchronously. */
  cancel(operationId?: KanbanOperationId): boolean {
    return this.#operations.cancel(operationId);
  }

  /** Requests one fresh inverse operation. */
  undo(operationId: KanbanOperationId): Promise<KanbanRequestResult> {
    return this.#schedule(() => this.#operations.undo(operationId));
  }

  /** Requests one fresh inverse-of-inverse operation. */
  redo(operationId: KanbanOperationId): Promise<KanbanRequestResult> {
    return this.#schedule(() => this.#operations.redo(operationId));
  }

  /** Starts a keyboard move for the currently focused card without synthesizing pointer visuals. */
  acceptMoveFocused(direction: KanbanMoveDirection): boolean {
    const focused = this.snapshot().focused;
    if (!this.#available() || focused.kind !== 'card') return false;
    void this.moveCard({ cardKey: focused.cardKey, direction, origin: 'keyboard' });
    return true;
  }

  /** Synchronously accepts focused-card activation for mounted event routing. */
  acceptActivate(options: KanbanActivateOptions): boolean {
    const scope = options.scope ?? this.#scopeForFocus();
    if (!this.#available() || scope?.kind !== 'card') return false;
    void this.activate({ ...options, scope });
    return true;
  }

  /** Commits one selection transition and card activation without an intervening layout transaction. */
  acceptSelectionActivate(command: KanbanInteractionTransition, options: KanbanActivateOptions): boolean {
    const scope = options.scope ?? this.#scopeForFocus();
    if (!this.#available() || scope?.kind !== 'card') return false;
    void this.#schedule(async () => {
      let delivered = false;
      await this.#executeTransition(command, () => {
        delivered = this.#intentRouter.deliver(
          {
            kind: 'open-card',
            origin: options.origin ?? 'programmatic',
            scope,
            ...(options.actionId === undefined ? {} : { actionId: options.actionId }),
          },
          this.snapshotEligibleSelection(),
        );
      });
      await Promise.resolve();
      return delivered;
    });
    return true;
  }

  /** Synchronously accepts context activation for mounted event routing. */
  acceptOpenContext(options: KanbanOpenContextOptions): boolean {
    const scope = options.scope ?? this.#scopeForFocus();
    if (!this.#available() || scope === undefined) return false;
    void this.openContext({ ...options, scope });
    return true;
  }

  /** Synchronously accepts one scoped action for mounted event routing. */
  acceptScopedAction(
    actionId: KanbanScopedActionId,
    scope: KanbanActionScope,
    origin: KanbanInteractionOrigin,
  ): boolean {
    if (!this.#available()) return false;
    void this.invokeScopedAction(actionId, scope, origin);
    return true;
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
      const rawInitial = methods.snapshot();
      const initial = snapshotKanbanInteractionSnapshot(rawInitial);
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
      this.#lastRawSnapshot = Object.isFrozen(rawInitial) ? rawInitial : undefined;
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
    this.#intentRouter.dispose();
    this.#releaseController();
    this.#subscribers.clear();
  }

  /** Queues one operation behind the same ordering authority used by controller transitions. */
  #schedule<TResult>(operation: () => Promise<TResult> | TResult): Promise<TResult> {
    if (!this.#transitionActive) {
      try {
        const immediate = operation();
        if (!isPromiseLike<TResult>(immediate)) return Promise.resolve(immediate);
        return this.#trackAsynchronous(immediate);
      } catch (error) {
        return Promise.reject(error);
      }
    }
    return this.#trackAsynchronous(this.#queue.then(operation));
  }

  /** Tracks one genuinely asynchronous operation as the facade's serialization tail. */
  #trackAsynchronous<TResult>(operation: PromiseLike<TResult>): Promise<TResult> {
    const result = Promise.resolve(operation);
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

  /** Delivers a validated intent, then yields once for synchronous application republication effects. */
  #scheduleIntent(request: () => KanbanIntentRequest | undefined): Promise<boolean> {
    return this.#schedule(async () => {
      if (!this.#available()) return false;
      try {
        const resolved = request();
        if (resolved === undefined) return false;
        const delivered = this.#intentRouter.deliver(resolved, this.snapshotEligibleSelection());
        await Promise.resolve();
        return delivered;
      } catch {
        this.#observe('interaction-intent-failed');
        return false;
      }
    });
  }

  /** Returns whether mounted facade work may still be accepted. */
  #available(): boolean {
    return this.#controller !== undefined && !this.#failed && !this.#disposed;
  }

  /** Converts current focus to the matching closed semantic scope without source records. */
  #scopeForFocus(): KanbanActionScope | undefined {
    const focused = this.snapshot().focused;
    switch (focused.kind) {
      case 'board-state':
        return Object.freeze({ kind: 'board' });
      case 'column-header':
        return Object.freeze({ kind: 'column', columnId: focused.columnId });
      case 'swimlane-header':
        return Object.freeze({ kind: 'swimlane', swimlaneId: focused.swimlaneId });
      case 'card':
        return Object.freeze({
          kind: 'card',
          cardKey: focused.cardKey,
          address: Object.freeze({ ...focused.address }),
        });
    }
  }

  /** Invokes the controller synchronously, then validates asynchronous settlement behind the facade. */
  #executeTransition(
    command: KanbanInteractionTransition,
    afterPublish?: (result: KanbanInteractionResult) => void,
  ): Promise<KanbanInteractionResult> | KanbanInteractionResult {
    const controller = this.#controller;
    if (controller === undefined || this.#failed || this.#disposed) {
      return unavailable(this.#lastSnapshot);
    }
    const before = this.#lastSnapshot;
    let raw: unknown;
    try {
      raw = controller.transition(command);
    } catch {
      this.#observe('interaction-transition-failed');
      return unavailable(this.#lastSnapshot);
    }
    const settle = (value: unknown): KanbanInteractionResult => {
      if (this.#disposed || this.#failed || this.#controller !== controller) {
        return unavailable(this.#lastSnapshot);
      }
      try {
        const settled = snapshotKanbanInteractionResult(value);
        if (
          (settled.kind === 'unchanged' && !interactionSnapshotsEqual(settled.snapshot, before)) ||
          (settled.kind === 'changed' &&
            (settled.snapshot.revision <= before.revision || interactionSnapshotStateEqual(settled.snapshot, before)))
        ) {
          throw new KanbanInvalidSourcePublicationError();
        }
        this.#publish(settled.snapshot);
        afterPublish?.(settled);
        return settled;
      } catch {
        this.#observe('interaction-transition-failed');
        return unavailable(this.#lastSnapshot);
      }
    };
    if (!isPromiseLike(raw)) return settle(raw);
    return Promise.resolve(raw).then(settle, () => {
      if (this.#disposed || this.#failed || this.#controller !== controller) {
        return unavailable(this.#lastSnapshot);
      }
      this.#observe('interaction-transition-failed');
      return unavailable(this.#lastSnapshot);
    });
  }

  /** Refreshes facade state after an injected controller reports publication. */
  #controllerInvalidated(): void {
    const controller = this.#controller;
    if (controller === undefined || this.#failed || this.#disposed) return;
    try {
      const raw = controller.snapshot();
      if (raw === this.#lastRawSnapshot) {
        this.#notify();
        return;
      }
      this.#publish(snapshotKanbanInteractionSnapshot(raw), true);
      this.#lastRawSnapshot = Object.isFrozen(raw) ? raw : undefined;
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
    this.#lastRawSnapshot = undefined;
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
