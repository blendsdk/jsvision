import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { createKanbanOperationId } from '../contract/identity.js';
import type { KanbanOperationId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';

/** Exact configurable operation-ID registry members. */
const OPTIONS_KEYS = new Set(['factory', 'activeLimit', 'retainedLimit']);

/** Trusted synchronous factory used to propose one operation identity. */
export type KanbanOperationIdFactory = () => string;

/** Options for one bounded operation-ID registry. */
export interface KanbanOperationIdRegistryOptions {
  /** Optional application factory; the package validates every returned identity. */
  readonly factory?: KanbanOperationIdFactory;
  /** Maximum active identities before a new acquisition fails closed. */
  readonly activeLimit?: number;
  /** Number of completed identities retained to prevent delayed-result collision. */
  readonly retainedLimit?: number;
}

/** Generation-bound active operation identity owned by one coordinator admission. */
export interface KanbanOperationIdLease {
  /** Validated identity reserved by this lease. */
  readonly operationId: KanbanOperationId;
  /** Whether this exact lease still owns an active reservation. */
  active(): boolean;
  /** Complete the reservation and retain its identity in bounded collision history. */
  retain(): void;
  /** Abandon an undispatched reservation without retaining its identity. */
  release(): void;
}

/** Active and retained collision protection for one board operation coordinator. */
export interface KanbanOperationIdRegistry {
  /** Allocate a factory identity and reserve it as active. */
  acquire(): KanbanOperationIdLease;
  /** Adopt a validated legacy caller identity and reserve it as active. */
  adopt(operationId: KanbanOperationId): KanbanOperationIdLease;
  /** Release every active and retained identity; idempotent. */
  dispose(): void;
}

/** Mutable ownership link detached from the registry when one lease becomes stale. */
interface LeaseState {
  complete: ((retain: boolean) => void) | null;
}

/** Public lease implementation that retains only its small detached state cell after completion. */
class OperationIdLease implements KanbanOperationIdLease {
  readonly #state: LeaseState;

  constructor(
    readonly operationId: KanbanOperationId,
    state: LeaseState,
  ) {
    this.#state = state;
  }

  active(): boolean {
    return this.#state.complete !== null;
  }

  retain(): void {
    this.#state.complete?.(true);
  }

  release(): void {
    this.#state.complete?.(false);
  }
}

/** Process-local board sequence used only for collision-free fallback identity construction. */
let nextRegistrySequence = 1;

/** Validate one configurable integer limit against its package absolute ceiling. */
function limit(value: number | undefined, fallback: number, absolute: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > absolute) {
    throw new KanbanInvalidSemanticValueError();
  }
  return resolved;
}

/** Allocate one process-local registry identity without wrap or reuse. */
function allocateRegistrySequence(): number {
  if (nextRegistrySequence > Number.MAX_SAFE_INTEGER) throw new RangeError('Kanban operation ID sequence exhausted.');
  const sequence = nextRegistrySequence;
  nextRegistrySequence += 1;
  return sequence;
}

/** Validate one factory call without retaining its thrown value or assimilating thenables. */
function factoryOperationId(factory: KanbanOperationIdFactory): KanbanOperationId {
  let value: unknown;
  try {
    value = factory();
  } catch {
    throw new KanbanInvalidSemanticValueError();
  }
  if (typeof value !== 'string') throw new KanbanInvalidSemanticValueError();
  try {
    return createKanbanOperationId(value);
  } catch {
    throw new KanbanInvalidSemanticValueError();
  }
}

/** Snapshot registry options without invoking accessors or retaining a hostile options object. */
function registryOptions(value: unknown): KanbanOperationIdRegistryOptions {
  try {
    const properties = snapshotKanbanDataProperties(value, OPTIONS_KEYS.size);
    validateKanbanDataKeys(properties, OPTIONS_KEYS);
    const factory = properties.factory;
    if (factory !== undefined && typeof factory !== 'function') throw new KanbanInvalidSemanticValueError();
    const capturedFactory =
      typeof factory === 'function'
        ? (): string => {
            const result: unknown = Reflect.apply(factory, undefined, []);
            if (typeof result !== 'string') throw new KanbanInvalidSemanticValueError();
            return result;
          }
        : undefined;
    const activeLimit = properties.activeLimit;
    const retainedLimit = properties.retainedLimit;
    if (activeLimit !== undefined && typeof activeLimit !== 'number') throw new KanbanInvalidSemanticValueError();
    if (retainedLimit !== undefined && typeof retainedLimit !== 'number') throw new KanbanInvalidSemanticValueError();
    return Object.freeze({
      ...(capturedFactory === undefined ? {} : { factory: capturedFactory }),
      ...(activeLimit === undefined ? {} : { activeLimit }),
      ...(retainedLimit === undefined ? {} : { retainedLimit }),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSemanticValueError) throw error;
    throw new KanbanInvalidSemanticValueError();
  }
}

/**
 * Create a bounded registry that rejects active and recently completed operation-ID collisions.
 *
 * The package fallback is predictable by design and is not an authorization token. Applications
 * may inject a factory when IDs must correlate with their own diagnostics.
 *
 * @example
 * ```ts
 * const ids = createKanbanOperationIdRegistry();
 * const lease = ids.acquire();
 * try {
 *   await dispatch(lease.operationId);
 *   lease.retain();
 * } catch {
 *   lease.release();
 * }
 * ```
 */
export function createKanbanOperationIdRegistry(
  options: KanbanOperationIdRegistryOptions = {},
): KanbanOperationIdRegistry {
  const capturedOptions = registryOptions(options);
  const registrySequence = allocateRegistrySequence();
  let operationSequence = 0;
  let disposed = false;
  const activeLimit = limit(
    capturedOptions.activeLimit,
    KANBAN_LIMITS.pendingOperations.safe,
    KANBAN_LIMITS.pendingOperations.absolute,
  );
  const retainedLimit = limit(
    capturedOptions.retainedLimit,
    KANBAN_LIMITS.retainedOperationIds.safe,
    KANBAN_LIMITS.retainedOperationIds.absolute,
  );
  const fallbackFactory = (): string => {
    if (operationSequence >= Number.MAX_SAFE_INTEGER) {
      throw new RangeError('Kanban operation ID sequence exhausted.');
    }
    operationSequence += 1;
    return `kanban-${registrySequence}-${operationSequence}`;
  };
  const factory = capturedOptions.factory ?? fallbackFactory;
  const active = new Map<KanbanOperationId, LeaseState>();
  const retained = new Set<KanbanOperationId>();
  const retainedOrder: KanbanOperationId[] = [];

  const reserve = (operationId: KanbanOperationId): KanbanOperationIdLease => {
    if (disposed || active.size >= activeLimit || active.has(operationId) || retained.has(operationId)) {
      throw new KanbanInvalidSemanticValueError();
    }
    const state: LeaseState = { complete: null };
    active.set(operationId, state);
    state.complete = (shouldRetain): void => {
      if (state.complete === null) return;
      state.complete = null;
      if (!active.delete(operationId) || !shouldRetain || disposed) return;
      retained.add(operationId);
      retainedOrder.push(operationId);
      while (retainedOrder.length > retainedLimit) {
        const oldest = retainedOrder.shift();
        if (oldest !== undefined) retained.delete(oldest);
      }
    };
    return new OperationIdLease(operationId, state);
  };

  return Object.freeze({
    acquire(): KanbanOperationIdLease {
      if (disposed || active.size >= activeLimit) throw new KanbanInvalidSemanticValueError();
      return reserve(factoryOperationId(factory));
    },
    adopt(operationId: KanbanOperationId): KanbanOperationIdLease {
      if (disposed) throw new KanbanInvalidSemanticValueError();
      try {
        return reserve(createKanbanOperationId(operationId));
      } catch (error) {
        if (error instanceof KanbanInvalidSemanticValueError) throw error;
        throw new KanbanInvalidSemanticValueError();
      }
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const state of active.values()) state.complete = null;
      active.clear();
      retained.clear();
      retainedOrder.length = 0;
    },
  });
}
