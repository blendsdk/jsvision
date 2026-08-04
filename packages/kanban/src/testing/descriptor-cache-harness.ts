import { KanbanInvalidDescriptorError, KanbanInvalidGeometryError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { KanbanDescriptorCache } from '../board/descriptor-cache.js';
import type { KanbanDescriptorCacheKey, KanbanDescriptorInvalidation } from '../board/descriptor-cache.js';
import type { KanbanCardDescriptor } from '../card/descriptor.js';

export type { KanbanDescriptorCacheKey, KanbanDescriptorInvalidation } from '../board/descriptor-cache.js';

/** Frozen lifecycle counters exposed by the descriptor-cache testing seam. */
export interface KanbanDescriptorCacheTestSnapshot {
  /** Currently retained descriptors. */
  readonly retained: number;
  /** Initial descriptor computations created for previously unseen semantic keys. */
  readonly created: number;
  /** Descriptor computations recreated or reactively republished after invalidation. */
  readonly rebuilt: number;
  /** Computation scopes disposed by retain, invalidation, eviction, or harness disposal. */
  readonly disposed: number;
  /** Targeted or reactive invalidation notifications. */
  readonly invalidations: number;
  /** Currently owned reactive computations. */
  readonly activeComputations: number;
}

/** Counter-only testing seam over the real bounded descriptor cache. */
export interface KanbanDescriptorCacheTestHarness {
  /** Returns an existing descriptor or creates it through the real owned computation. */
  readonly getOrCreate: (key: KanbanDescriptorCacheKey, factory: () => KanbanCardDescriptor) => KanbanCardDescriptor;
  /** Retains only the supplied semantic keys. */
  readonly retain: (keys: readonly KanbanDescriptorCacheKey[]) => void;
  /** Invalidates matching semantic keys. */
  readonly invalidate: (selector?: KanbanDescriptorInvalidation) => number;
  /** Returns detached frozen lifecycle counters. */
  readonly snapshot: () => KanbanDescriptorCacheTestSnapshot;
  /** Disposes every computation and closes the harness. */
  readonly dispose: () => void;
}

/** Options for one bounded descriptor-cache harness. */
export interface KanbanDescriptorCacheTestHarnessOptions {
  /** Maximum retained computation count. */
  readonly maximumEntries: number;
  /** Optional detached invalidation-key observer. */
  readonly onDescriptorInvalidated?: (key: Readonly<KanbanDescriptorCacheKey>) => void;
}

/**
 * Creates counter-only instrumentation over the production descriptor cache.
 *
 * The seam exposes no cache maps, owners, records, or scheduler controls. Keys delivered to the
 * observer are detached and frozen by the production boundary.
 *
 * @example
 * ```ts
 * const harness = createKanbanDescriptorCacheTestHarness({ maximumEntries: 8 });
 * ```
 */
export function createKanbanDescriptorCacheTestHarness(
  options: KanbanDescriptorCacheTestHarnessOptions,
): KanbanDescriptorCacheTestHarness {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new KanbanInvalidGeometryError();
  }
  let descriptors: PropertyDescriptorMap;
  try {
    descriptors = Object.getOwnPropertyDescriptors(options);
  } catch {
    throw new KanbanInvalidDescriptorError();
  }
  if (
    Object.keys(descriptors).some((key) => key !== 'maximumEntries' && key !== 'onDescriptorInvalidated') ||
    Object.values(descriptors).some((descriptor) => descriptor.get !== undefined || descriptor.set !== undefined)
  ) {
    throw new KanbanInvalidDescriptorError();
  }
  const maximumEntries: unknown = descriptors.maximumEntries?.value;
  if (
    typeof maximumEntries !== 'number' ||
    !Number.isSafeInteger(maximumEntries) ||
    maximumEntries <= 0 ||
    maximumEntries > KANBAN_LIMITS.retainedDescriptors.absolute
  ) {
    throw new KanbanInvalidGeometryError();
  }
  const onDescriptorInvalidated: unknown = descriptors.onDescriptorInvalidated?.value;
  if (onDescriptorInvalidated !== undefined && typeof onDescriptorInvalidated !== 'function') {
    throw new KanbanInvalidDescriptorError();
  }
  let created = 0;
  let rebuilt = 0;
  let disposed = 0;
  let invalidations = 0;
  let closed = false;
  const invalidatedKeys = new Set<string>();
  const canonical = (key: KanbanDescriptorCacheKey): string => JSON.stringify(key);
  const cache = new KanbanDescriptorCache(maximumEntries, {
    onCreated: (key) => {
      const identity = canonical(key);
      if (invalidatedKeys.delete(identity)) rebuilt += 1;
      else created += 1;
    },
    onRebuilt: () => {
      rebuilt += 1;
    },
    onInvalidated: (key) => {
      invalidations += 1;
      invalidatedKeys.add(canonical(key));
      onDescriptorInvalidated?.(key);
    },
    onReactiveInvalidated: (key) => {
      invalidations += 1;
      onDescriptorInvalidated?.(key);
    },
    onDisposed: () => {
      disposed += 1;
    },
  });
  const assertOpen = (): void => {
    if (closed) throw new KanbanInvalidDescriptorError();
  };
  return Object.freeze({
    getOrCreate: (key: KanbanDescriptorCacheKey, factory: () => KanbanCardDescriptor) => {
      assertOpen();
      return cache.getOrCreate(key, factory);
    },
    retain: (keys: readonly KanbanDescriptorCacheKey[]) => {
      assertOpen();
      cache.retain(keys);
    },
    invalidate: (selector: KanbanDescriptorInvalidation = {}) => {
      assertOpen();
      return cache.invalidate(selector);
    },
    snapshot: () =>
      Object.freeze({
        retained: cache.size,
        created,
        rebuilt,
        disposed,
        invalidations,
        activeComputations: cache.size,
      }),
    dispose: () => {
      if (closed) return;
      closed = true;
      cache.dispose();
    },
  });
}
