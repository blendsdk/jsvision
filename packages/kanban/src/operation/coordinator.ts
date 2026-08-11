import { KanbanInvalidLimitError } from '../contract/limits.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { createKanbanOperationId } from '../contract/identity.js';
import type { KanbanOperationId } from '../contract/identity.js';
import { snapshotKanbanOperationSnapshot } from './types.js';
import type { KanbanOperationSnapshot, KanbanOperationSubscriber } from './types.js';

/** Unsubscribe function returned by payload-free operation-state subscriptions. */
export type KanbanOperationUnsubscribe = () => void;

/** Validate a caller-supplied finite capacity before allocating its registry. */
function registryCapacity(value: number, absolute: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > absolute) throw new KanbanInvalidLimitError();
  return value;
}

/**
 * Monotonic coordinator generation used by asynchronous continuations to detect stale ownership.
 *
 * Exhaustion fails before mutation because wrapping could make arbitrarily old work appear current.
 */
export class KanbanOperationGenerationClock {
  #generation = 1;
  #disposed = false;

  /** Returns the current generation for capture before asynchronous application work. */
  capture(): number {
    return this.#generation;
  }

  /** Returns true only while the captured generation still belongs to a live coordinator. */
  isCurrent(generation: number): boolean {
    return !this.#disposed && generation === this.#generation;
  }

  /** Invalidates every earlier capture and returns the newly current generation. */
  advance(): number {
    if (this.#disposed) return this.#generation;
    if (this.#generation >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Kanban operation coordinator generation exhausted.');
    }
    this.#generation += 1;
    return this.#generation;
  }

  /** Permanently invalidates the clock without wrapping its visible generation. */
  dispose(): void {
    if (this.#disposed) return;
    this.advance();
    this.#disposed = true;
  }
}

/**
 * Bounded FIFO store for whole committed undo descriptors.
 *
 * Values are retained and evicted as opaque entries. The registry never inspects, invokes, or
 * partially copies a token or callback-bearing descriptor.
 */
export class KanbanCommittedUndoRegistry<TDescriptor> {
  readonly #capacity: number;
  readonly #entries = new Map<KanbanOperationId, TDescriptor>();
  #disposed = false;

  /** Creates an empty registry with a validated independent descriptor capacity. */
  constructor(capacity = KANBAN_LIMITS.retainedUndoDescriptors.safe) {
    this.#capacity = registryCapacity(capacity, KANBAN_LIMITS.retainedUndoDescriptors.absolute);
  }

  /** Retains one whole committed descriptor and evicts the oldest whole entry when necessary. */
  retain(operationId: KanbanOperationId, descriptor: TDescriptor): void {
    if (this.#disposed) return;
    const identity = createKanbanOperationId(operationId);
    if (this.#capacity === 0) return;
    this.#entries.delete(identity);
    this.#entries.set(identity, descriptor);
    while (this.#entries.size > this.#capacity) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) this.#entries.delete(oldest.value);
    }
  }

  /** Returns the retained descriptor without changing FIFO order. */
  get(operationId: KanbanOperationId): TDescriptor | undefined {
    return this.#disposed ? undefined : this.#entries.get(createKanbanOperationId(operationId));
  }

  /** Drops one whole descriptor without inspecting or invoking it. */
  delete(operationId: KanbanOperationId): boolean {
    return !this.#disposed && this.#entries.delete(createKanbanOperationId(operationId));
  }

  /** Returns the retained operation identities in deterministic oldest-first order. */
  operationIds(): readonly KanbanOperationId[] {
    return Object.freeze([...this.#entries.keys()]);
  }

  /** Releases every retained descriptor and makes later writes inert. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#entries.clear();
  }
}

/**
 * Bounded active-operation state and subscription registry used by the semantic coordinator.
 *
 * Notifications are queued so subscriber reentrancy cannot reorder one transition ahead of the
 * transition currently being delivered. Each callback sees an immutable payload-free snapshot;
 * callback failure is isolated from coordinator state and other subscribers.
 */
export class KanbanOperationSnapshotRegistry {
  readonly #activeCapacity: number;
  readonly #subscriberCapacity: number;
  readonly #active = new Map<KanbanOperationId, KanbanOperationSnapshot>();
  readonly #subscribers = new Set<KanbanOperationSubscriber>();
  readonly #notifications: KanbanOperationSnapshot[] = [];
  #notifying = false;
  #disposed = false;

  /** Creates an empty registry with validated active-operation and subscriber ceilings. */
  constructor(
    activeCapacity = KANBAN_LIMITS.pendingOperations.safe,
    subscriberCapacity = KANBAN_LIMITS.retainedObservations.safe,
  ) {
    this.#activeCapacity = registryCapacity(activeCapacity, KANBAN_LIMITS.pendingOperations.absolute);
    this.#subscriberCapacity = registryCapacity(subscriberCapacity, KANBAN_LIMITS.retainedObservations.absolute);
  }

  /** Publishes one lifecycle transition after updating the bounded active snapshot set. */
  publish(value: KanbanOperationSnapshot): void {
    if (this.#disposed) return;
    const snapshot = snapshotKanbanOperationSnapshot(value);
    const active = snapshot.state === 'proposed' || snapshot.state === 'pending' || snapshot.state === 'accepted';
    if (active && !this.#active.has(snapshot.operationId) && this.#active.size >= this.#activeCapacity) {
      throw new KanbanInvalidLimitError();
    }
    if (active) this.#active.set(snapshot.operationId, snapshot);
    else this.#active.delete(snapshot.operationId);
    this.#notifications.push(snapshot);
    this.#flushNotifications();
  }

  /** Returns an immutable oldest-admitted-first view of active payload-free snapshots. */
  snapshot(): readonly KanbanOperationSnapshot[] {
    return Object.freeze([...this.#active.values()]);
  }

  /** Registers one lifecycle callback and returns an idempotent unsubscriber. */
  subscribe(subscriber: KanbanOperationSubscriber): KanbanOperationUnsubscribe {
    if (this.#disposed) return () => undefined;
    if (typeof subscriber !== 'function' || this.#subscribers.size >= this.#subscriberCapacity) {
      throw new KanbanInvalidLimitError();
    }
    this.#subscribers.add(subscriber);
    let active = true;
    return (): void => {
      if (!active) return;
      active = false;
      this.#subscribers.delete(subscriber);
    };
  }

  /** Clears snapshots, queued notifications, and subscribers idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#active.clear();
    this.#notifications.length = 0;
    this.#subscribers.clear();
  }

  /** Drain lifecycle callbacks in publication order while isolating callback failures. */
  #flushNotifications(): void {
    if (this.#notifying) return;
    this.#notifying = true;
    try {
      while (!this.#disposed && this.#notifications.length > 0) {
        const snapshot = this.#notifications.shift();
        if (snapshot === undefined) continue;
        for (const subscriber of [...this.#subscribers]) {
          try {
            subscriber(snapshot);
          } catch {
            // Lifecycle observers cannot roll back an already-published coordinator transition.
          }
        }
      }
    } finally {
      this.#notifying = false;
      if (this.#disposed) this.#notifications.length = 0;
    }
  }
}
