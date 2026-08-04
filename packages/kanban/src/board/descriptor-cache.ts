import { createRoot } from '@jsvision/ui';

import type { KanbanCardDensity, KanbanCardDescriptor } from '../card/descriptor.js';
import { KanbanInvalidDescriptorError, KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import type { KanbanCellAddress } from '../source/types.js';

/** Complete semantic identity of one viewport-local descriptor projection. */
export interface KanbanDescriptorCacheKey {
  /** Viewport read-generation owner. */
  readonly generation: number;
  /** Source cell containing the card. */
  readonly address: KanbanCellAddress;
  /** Equality-only cell cursor revision. */
  readonly cursorRevision: KanbanRevision;
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Equality-only custom-renderer/configuration revision. */
  readonly rendererRevision: KanbanRevision;
  /** Optional application presentation revision for this card. */
  readonly presentationRevision?: KanbanRevision;
  /** Exact descriptor width in terminal cells. */
  readonly width: number;
  /** Maximum descriptor rows. */
  readonly rowBudget: number;
  /** Requested vertical density. */
  readonly density: KanbanCardDensity;
  /** Equality-only resolved-theme revision. */
  readonly themeRevision: KanbanRevision;
  /** Equality-only terminal-capability revision. */
  readonly capabilityRevision: KanbanRevision;
  /** Equality-only focus/selection/operation-state revision. */
  readonly interactionRevision: KanbanRevision;
}

/** Narrow targeted-invalidation selector; omitted fields match every value. */
export interface KanbanDescriptorInvalidation {
  /** Match one read generation. */
  readonly generation?: number;
  /** Match one source cell. */
  readonly address?: KanbanCellAddress;
  /** Match one stable card identity. */
  readonly cardKey?: CardKey;
  /** Match one renderer revision. */
  readonly rendererRevision?: KanbanRevision;
  /** Match one theme revision. */
  readonly themeRevision?: KanbanRevision;
  /** Match one capability revision. */
  readonly capabilityRevision?: KanbanRevision;
  /** Match one interaction-state revision. */
  readonly interactionRevision?: KanbanRevision;
}

/** Internal detached key with a collision-safe canonical representation. */
interface SnapshotKey extends KanbanDescriptorCacheKey {
  readonly canonical: string;
}

/** One descriptor and its independently disposable reactive projection scope. */
interface CacheEntry {
  readonly key: SnapshotKey;
  readonly descriptor: KanbanCardDescriptor;
  readonly disposeScope: () => void;
  lastUsed: number;
}

/** Validates one positive safe terminal-cell value. */
function positiveCellCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Reads one own data property without invoking a caller accessor. */
function ownValue(record: object, key: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, key);
  } catch {
    throw new KanbanInvalidDescriptorError();
  }
  if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new KanbanInvalidDescriptorError();
  return descriptor?.value;
}

/** Produces a type-tagged primitive suitable for an unambiguous JSON tuple. */
function tagged(value: CardKey | KanbanRevision): readonly ['number' | 'string', number | string] {
  return Object.freeze(typeof value === 'number' ? ['number', value] : ['string', value]);
}

/** Snapshots and validates every semantic key member exactly once. */
function snapshotKey(value: KanbanDescriptorCacheKey): SnapshotKey {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidDescriptorError();
  const generation = ownValue(value, 'generation');
  if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 0) {
    throw new KanbanInvalidDescriptorError();
  }
  let address: KanbanCellAddress;
  let cursorRevision: KanbanRevision;
  let cardKey: CardKey;
  let rendererRevision: KanbanRevision;
  let presentationRevision: KanbanRevision | undefined;
  let themeRevision: KanbanRevision;
  let capabilityRevision: KanbanRevision;
  let interactionRevision: KanbanRevision;
  try {
    address = snapshotKanbanCellAddress(ownValue(value, 'address'));
    cursorRevision = snapshotKanbanRevision(ownValue(value, 'cursorRevision'));
    const rawCardKey = ownValue(value, 'cardKey');
    if (typeof rawCardKey !== 'string' && typeof rawCardKey !== 'number') throw new KanbanInvalidDescriptorError();
    cardKey = createKanbanCardKey(rawCardKey);
    rendererRevision = snapshotKanbanRevision(ownValue(value, 'rendererRevision'));
    const rawPresentationRevision = ownValue(value, 'presentationRevision');
    presentationRevision =
      rawPresentationRevision === undefined ? undefined : snapshotKanbanRevision(rawPresentationRevision);
    themeRevision = snapshotKanbanRevision(ownValue(value, 'themeRevision'));
    capabilityRevision = snapshotKanbanRevision(ownValue(value, 'capabilityRevision'));
    interactionRevision = snapshotKanbanRevision(ownValue(value, 'interactionRevision'));
  } catch {
    throw new KanbanInvalidDescriptorError();
  }
  const width = positiveCellCount(ownValue(value, 'width'));
  const rowBudget = positiveCellCount(ownValue(value, 'rowBudget'));
  if (rowBudget > KANBAN_LIMITS.descriptorRows.absolute) throw new KanbanInvalidDescriptorError();
  const density = ownValue(value, 'density');
  if (density !== 'compact' && density !== 'comfortable' && density !== 'spacious') {
    throw new KanbanInvalidDescriptorError();
  }
  const canonical = JSON.stringify([
    'kanban-descriptor',
    generation,
    canonicalizeKanbanCellAddress(address),
    tagged(cursorRevision),
    tagged(cardKey),
    tagged(rendererRevision),
    presentationRevision === undefined ? null : tagged(presentationRevision),
    width,
    rowBudget,
    density,
    tagged(themeRevision),
    tagged(capabilityRevision),
    tagged(interactionRevision),
  ]);
  return Object.freeze({
    generation,
    address,
    cursorRevision,
    cardKey,
    rendererRevision,
    ...(presentationRevision === undefined ? {} : { presentationRevision }),
    width,
    rowBudget,
    density,
    themeRevision,
    capabilityRevision,
    interactionRevision,
    canonical,
  });
}

/** Creates and scopes one descriptor, disposing partial reactive work when creation fails. */
function createScopedDescriptor(factory: () => KanbanCardDescriptor): {
  readonly descriptor: KanbanCardDescriptor;
  readonly disposeScope: () => void;
} {
  return createRoot((disposeScope) => {
    try {
      const descriptor = factory();
      if (typeof descriptor !== 'object' || descriptor === null || !Object.isFrozen(descriptor)) {
        throw new KanbanInvalidDescriptorError();
      }
      return Object.freeze({ descriptor, disposeScope });
    } catch (error) {
      disposeScope();
      throw error;
    }
  });
}

/** Returns whether a key matches a validated targeted-invalidation selector. */
function matches(key: SnapshotKey, selector: Readonly<Record<string, unknown>>): boolean {
  return (
    (selector.generation === undefined || key.generation === selector.generation) &&
    (selector.address === undefined ||
      canonicalizeKanbanCellAddress(key.address) ===
        canonicalizeKanbanCellAddress(selector.address as KanbanCellAddress)) &&
    (selector.cardKey === undefined || key.cardKey === selector.cardKey) &&
    (selector.rendererRevision === undefined || key.rendererRevision === selector.rendererRevision) &&
    (selector.themeRevision === undefined || key.themeRevision === selector.themeRevision) &&
    (selector.capabilityRevision === undefined || key.capabilityRevision === selector.capabilityRevision) &&
    (selector.interactionRevision === undefined || key.interactionRevision === selector.interactionRevision)
  );
}

/**
 * Bounded viewport-local cache for immutable card descriptors and their reactive scopes.
 *
 * A viewport calls {@link retain} with its current visible/overscan key set before releasing source
 * cursors. Eviction always disposes the descriptor scope synchronously, making disposal order explicit.
 */
export class KanbanDescriptorCache {
  readonly #maximumEntries: number;
  readonly #entries = new Map<string, CacheEntry>();
  #clock = 0;
  #disposed = false;

  /** Creates a cache with a finite visible/overscan-derived capacity. */
  constructor(maximumEntries: number) {
    if (
      !Number.isSafeInteger(maximumEntries) ||
      maximumEntries <= 0 ||
      maximumEntries > KANBAN_LIMITS.ensureRangeCards.absolute
    ) {
      throw new KanbanInvalidGeometryError();
    }
    this.#maximumEntries = maximumEntries;
  }

  /** Number of currently retained descriptors. */
  get size(): number {
    return this.#entries.size;
  }

  /** Returns an existing descriptor or creates one under a dedicated owned reactive scope. */
  getOrCreate(key: KanbanDescriptorCacheKey, factory: () => KanbanCardDescriptor): KanbanCardDescriptor {
    if (this.#disposed || typeof factory !== 'function') throw new KanbanInvalidDescriptorError();
    const snapshot = snapshotKey(key);
    const current = this.#entries.get(snapshot.canonical);
    if (current !== undefined) {
      current.lastUsed = this.#tick();
      return current.descriptor;
    }
    const created = createScopedDescriptor(factory);
    const entry: CacheEntry = {
      key: snapshot,
      descriptor: created.descriptor,
      disposeScope: created.disposeScope,
      lastUsed: this.#tick(),
    };
    this.#entries.set(snapshot.canonical, entry);
    this.#evictOverflow();
    return entry.descriptor;
  }

  /**
   * Retains only the supplied visible/overscan semantic keys and disposes every other scope.
   */
  retain(keys: readonly KanbanDescriptorCacheKey[]): void {
    if (this.#disposed || !Array.isArray(keys) || keys.length > this.#maximumEntries) {
      throw new KanbanInvalidDescriptorError();
    }
    const retained = new Set<string>();
    const length = keys.length;
    for (let index = 0; index < length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(keys, index)) throw new KanbanInvalidDescriptorError();
      retained.add(snapshotKey(ownValue(keys, String(index)) as KanbanDescriptorCacheKey).canonical);
    }
    for (const [canonical, entry] of this.#entries) {
      if (retained.has(canonical)) continue;
      this.#entries.delete(canonical);
      entry.disposeScope();
    }
  }

  /** Invalidates and disposes entries matching the supplied semantic dimensions. */
  invalidate(selector: KanbanDescriptorInvalidation = {}): number {
    if (this.#disposed || typeof selector !== 'object' || selector === null || Array.isArray(selector)) {
      throw new KanbanInvalidDescriptorError();
    }
    let source: PropertyDescriptorMap;
    try {
      source = Object.getOwnPropertyDescriptors(selector);
    } catch {
      throw new KanbanInvalidDescriptorError();
    }
    if (Object.values(source).some((descriptor) => descriptor.get !== undefined || descriptor.set !== undefined)) {
      throw new KanbanInvalidDescriptorError();
    }
    const allowed = new Set([
      'generation',
      'address',
      'cardKey',
      'rendererRevision',
      'themeRevision',
      'capabilityRevision',
      'interactionRevision',
    ]);
    if (Object.keys(source).some((key) => !allowed.has(key))) throw new KanbanInvalidDescriptorError();
    const snapshot: Record<string, unknown> = {};
    if (source.generation !== undefined) {
      const generation = source.generation.value;
      if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 0) {
        throw new KanbanInvalidDescriptorError();
      }
      snapshot.generation = generation;
    }
    try {
      if (source.address !== undefined) snapshot.address = snapshotKanbanCellAddress(source.address.value);
      if (source.cardKey !== undefined) {
        const value = source.cardKey.value;
        if (typeof value !== 'string' && typeof value !== 'number') throw new KanbanInvalidDescriptorError();
        snapshot.cardKey = createKanbanCardKey(value);
      }
      for (const field of ['rendererRevision', 'themeRevision', 'capabilityRevision', 'interactionRevision'] as const) {
        const descriptor = source[field];
        if (descriptor !== undefined) snapshot[field] = snapshotKanbanRevision(descriptor.value);
      }
    } catch {
      throw new KanbanInvalidDescriptorError();
    }
    let removed = 0;
    for (const [canonical, entry] of this.#entries) {
      if (!matches(entry.key, snapshot)) continue;
      this.#entries.delete(canonical);
      entry.disposeScope();
      removed += 1;
    }
    return removed;
  }

  /** Disposes every retained scope exactly once and permanently closes the cache. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const entry of this.#entries.values()) entry.disposeScope();
    this.#entries.clear();
  }

  /** Advances bounded recency state and periodically renormalizes without changing order. */
  #tick(): number {
    if (this.#clock === Number.MAX_SAFE_INTEGER) {
      const ordered = [...this.#entries.values()].sort((left, right) => left.lastUsed - right.lastUsed);
      for (let index = 0; index < ordered.length; index += 1) {
        const entry = ordered[index];
        if (entry !== undefined) entry.lastUsed = index;
      }
      this.#clock = ordered.length;
    }
    this.#clock += 1;
    return this.#clock;
  }

  /** Disposes least-recently-used entries until the configured bound is restored. */
  #evictOverflow(): void {
    while (this.#entries.size > this.#maximumEntries) {
      let oldest: CacheEntry | undefined;
      for (const entry of this.#entries.values()) {
        if (oldest === undefined || entry.lastUsed < oldest.lastUsed) oldest = entry;
      }
      if (oldest === undefined) throw new KanbanInvalidDescriptorError();
      this.#entries.delete(oldest.key.canonical);
      oldest.disposeScope();
    }
  }
}
