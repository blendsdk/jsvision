import { KanbanDisposedResourceError, KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';

/** Construction values for one retained semantic cell's sparse height index. */
export interface KanbanSparseHeightIndexOptions {
  /** Logical cards reported by the owning cursor without requiring materialization. */
  readonly logicalLength: number;
  /** Estimated occupied rows for each card whose exact height is not retained. */
  readonly estimatedHeight: number;
  /** Maximum exact card anchors retained by this index. */
  readonly maximumAnchors: number;
  /** Maximum contiguous measured run summaries retained by this index. */
  readonly maximumRuns: number;
  /** Source revision that owns the measurements. */
  readonly sourceRevision: KanbanRevision;
  /** Cursor revision that owns the logical indexes. */
  readonly cursorRevision: KanbanRevision;
  /** Presentation revision that owns the measured heights. */
  readonly presentationRevision: KanbanRevision;
}

/** One exact resident height supplied after descriptor measurement. */
export interface KanbanSparseHeightMeasurement {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Zero-based logical position in the owning cursor. */
  readonly logicalIndex: number;
  /** Exact occupied rows for this card under the active presentation revision. */
  readonly height: number;
  /** Optional stable visible anchor that must retain its viewport-relative row. */
  readonly anchor?: KanbanSparseHeightAnchor;
}

/** Stable card position used while exact measurements correct estimated geometry. */
export interface KanbanSparseHeightAnchor {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Zero-based logical position in the owning cursor. */
  readonly logicalIndex: number;
  /** Preferred row relative to the card-content viewport. */
  readonly viewportRow: number;
}

/** Retained exact or estimated evidence for one stable card anchor. */
export interface KanbanSparseHeightRetainedAnchor extends KanbanSparseHeightAnchor {
  /** Exact measured or fallback estimated occupied rows. */
  readonly height: number;
  /** Whether the retained height remains compatible with current revisions. */
  readonly quality: 'exact' | 'estimated';
}

/** Result of applying one resident measurement. */
export type KanbanSparseHeightMeasurementResult =
  | { readonly kind: 'measured'; readonly cardKey: CardKey; readonly logicalIndex: number }
  | {
      readonly kind: 'corrected';
      readonly cardKey: CardKey;
      readonly logicalIndex: number;
      readonly viewportRow: number;
      readonly passes: 1;
    };

/** Authoritative source reconciliation for one retained interaction identity. */
export type KanbanSparseHeightReconciliation =
  | {
      readonly kind: 'reorder';
      readonly cardKey: CardKey;
      readonly logicalIndex: number;
      readonly sourceRevision: KanbanRevision;
    }
  | { readonly kind: 'delete'; readonly cardKey: CardKey; readonly sourceRevision: KanbanRevision };

/** Complete active revision tuple used to prune incompatible exact measurements. */
export interface KanbanSparseHeightRevisionInput {
  /** Current source publication revision. */
  readonly sourceRevision: KanbanRevision;
  /** Current owning cursor revision. */
  readonly cursorRevision: KanbanRevision;
  /** Current presentation revision for height measurement. */
  readonly presentationRevision: KanbanRevision;
}

/** Estimated or exact conversion between logical positions and terminal rows. */
export interface KanbanSparseHeightPosition {
  /** Saturated non-negative terminal row. */
  readonly value: number;
  /** Whether the conversion crossed any estimated card span. */
  readonly quality: 'exact' | 'estimated';
}

/** Result of converting a terminal row back to one logical card position. */
export interface KanbanSparseHeightLookup {
  /** Nearest zero-based logical card position at or before the requested row. */
  readonly logicalIndex: number;
  /** Saturated terminal row at which that logical position starts. */
  readonly row: number;
  /** Whether every preceding occupied height was measured. */
  readonly quality: 'exact' | 'estimated';
}

/** Counter-only immutable evidence for scale tests and support diagnostics. */
export interface KanbanSparseHeightSnapshot {
  /** Logical cards represented without a logical-length-sized allocation. */
  readonly logicalLength: number;
  /** Current estimate used for unmeasured spans. */
  readonly estimatedHeight: number;
  /** Number of exact resident anchors. */
  readonly retainedAnchors: number;
  /** Number of contiguous measured run summaries. */
  readonly retainedRuns: number;
  /** Total bounded records held by the sparse index. */
  readonly allocatedEntries: number;
  /** Revisions that determine measurement compatibility. */
  readonly revisions: {
    readonly source: KanbanRevision;
    readonly cursor: KanbanRevision;
    readonly presentation: KanbanRevision;
  };
}

/** Internal exact measurement retained in insertion order for deterministic eviction. */
interface RetainedMeasurement {
  readonly cardKey: CardKey;
  readonly logicalIndex: number;
  readonly height: number;
}

/** Bounded interaction identity retained independently from an unloaded measurement. */
type RetainedIdentity = KanbanSparseHeightAnchor;

/** Compact contiguous interval derived from retained exact measurements. */
interface HeightRun {
  readonly start: number;
  readonly end: number;
}

/** Largest terminal-cell coordinate accepted by JavaScript's exact integer arithmetic. */
const MAXIMUM_CELL = Number.MAX_SAFE_INTEGER;
/** Exact construction members accepted at the untrusted public boundary. */
const OPTION_KEYS = new Set([
  'logicalLength',
  'estimatedHeight',
  'maximumAnchors',
  'maximumRuns',
  'sourceRevision',
  'cursorRevision',
  'presentationRevision',
]);
/** Exact measurement members accepted at the untrusted public boundary. */
const MEASUREMENT_KEYS = new Set(['cardKey', 'logicalIndex', 'height']);
/** Optional anchor expands the otherwise exact measurement envelope by one member. */
const MEASUREMENT_WITH_ANCHOR_KEYS = new Set([...MEASUREMENT_KEYS, 'anchor']);
/** Exact stable-anchor members. */
const ANCHOR_KEYS = new Set(['cardKey', 'logicalIndex', 'viewportRow']);
/** Exact reconciliation members selected by the discriminator. */
const REORDER_KEYS = new Set(['kind', 'cardKey', 'logicalIndex', 'sourceRevision']);
const DELETE_KEYS = new Set(['kind', 'cardKey', 'sourceRevision']);
/** Exact revision-invalidation members. */
const REVISION_KEYS = new Set(['sourceRevision', 'cursorRevision', 'presentationRevision']);

/** Returns one non-negative safe integer no larger than a caller-selected ceiling. */
function boundedInteger(value: unknown, maximum = MAXIMUM_CELL, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > maximum) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Multiplies non-negative cell counts and saturates before precision can be lost. */
function saturatedMultiply(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  if (left > Math.floor(MAXIMUM_CELL / right)) return MAXIMUM_CELL;
  return left * right;
}

/** Applies one signed measured-height correction while retaining a safe cell coordinate. */
function saturatedCorrection(value: number, correction: number): number {
  if (correction >= 0) return correction > MAXIMUM_CELL - value ? MAXIMUM_CELL : value + correction;
  return Math.max(0, value + correction);
}

/** Converts retained sorted logical indexes to compact inclusive-exclusive intervals. */
function heightRuns(measurements: Iterable<RetainedMeasurement>): readonly HeightRun[] {
  const indexes = [...measurements].map(({ logicalIndex }) => logicalIndex).sort((left, right) => left - right);
  const runs: HeightRun[] = [];
  for (const logicalIndex of indexes) {
    const previous = runs.at(-1);
    if (previous !== undefined && previous.end === logicalIndex) {
      runs[runs.length - 1] = Object.freeze({ start: previous.start, end: logicalIndex + 1 });
    } else {
      runs.push(Object.freeze({ start: logicalIndex, end: logicalIndex + 1 }));
    }
  }
  return Object.freeze(runs);
}

/**
 * Bounded sparse prefix-height index for one retained semantic cell.
 *
 * Unmeasured logical spans remain arithmetic estimates. Only resident exact measurements allocate
 * records, so conversion work and storage never scale with the cursor's logical length.
 */
export class KanbanSparseHeightIndex {
  readonly #logicalLength: number;
  readonly #estimatedHeight: number;
  readonly #maximumAnchors: number;
  readonly #maximumRuns: number;
  #revisions: KanbanSparseHeightSnapshot['revisions'];
  readonly #measurements = new Map<CardKey, RetainedMeasurement>();
  readonly #identities = new Map<CardKey, RetainedIdentity>();
  #disposed = false;

  /** Creates an index after validating all allocation and revision inputs. */
  constructor(options: KanbanSparseHeightIndexOptions) {
    try {
      const properties = snapshotKanbanDataProperties(options, OPTION_KEYS.size);
      validateKanbanDataKeys(properties, OPTION_KEYS);
      if (Object.keys(properties).length !== OPTION_KEYS.size) throw new KanbanInvalidGeometryError();
      this.#logicalLength = boundedInteger(properties.logicalLength);
      this.#estimatedHeight = boundedInteger(properties.estimatedHeight, KANBAN_LIMITS.descriptorRows.absolute, true);
      this.#maximumAnchors = boundedInteger(properties.maximumAnchors, KANBAN_LIMITS.retainedDescriptors.absolute);
      this.#maximumRuns = boundedInteger(properties.maximumRuns, KANBAN_LIMITS.retainedDescriptors.absolute);
      this.#revisions = Object.freeze({
        source: snapshotKanbanRevision(properties.sourceRevision),
        cursor: snapshotKanbanRevision(properties.cursorRevision),
        presentation: snapshotKanbanRevision(properties.presentationRevision),
      });
    } catch {
      throw new KanbanInvalidGeometryError();
    }
  }

  /**
   * Retains one exact resident measurement and evicts oldest anchors until both budgets are met.
   *
   * Re-measuring the same typed card key replaces its earlier logical position without growing the
   * index. Eviction affects only measurement precision; unmeasured spans continue to use estimates.
   */
  measure(input: KanbanSparseHeightMeasurement): KanbanSparseHeightMeasurementResult {
    this.#active();
    let cardKey: CardKey;
    let properties: Readonly<Record<string, unknown>>;
    try {
      properties = snapshotKanbanDataProperties(input, MEASUREMENT_WITH_ANCHOR_KEYS.size);
      validateKanbanDataKeys(properties, MEASUREMENT_WITH_ANCHOR_KEYS);
      if (Object.keys(properties).length < MEASUREMENT_KEYS.size) throw new KanbanInvalidGeometryError();
      if (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') {
        throw new KanbanInvalidGeometryError();
      }
      cardKey = createKanbanCardKey(properties.cardKey);
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    const logicalIndex = boundedInteger(properties.logicalIndex);
    if (logicalIndex >= this.#logicalLength) throw new KanbanInvalidGeometryError();
    const height = boundedInteger(properties.height, KANBAN_LIMITS.descriptorRows.absolute, true);
    const stableAnchor = properties.anchor === undefined ? undefined : this.#snapshotAnchor(properties.anchor);
    if (
      stableAnchor !== undefined &&
      (stableAnchor.cardKey !== cardKey || stableAnchor.logicalIndex !== logicalIndex)
    ) {
      throw new KanbanInvalidGeometryError();
    }
    this.#measurements.delete(cardKey);
    for (const [retainedKey, measurement] of this.#measurements) {
      if (measurement.logicalIndex === logicalIndex) this.#measurements.delete(retainedKey);
    }
    this.#measurements.set(cardKey, Object.freeze({ cardKey, logicalIndex, height }));
    this.#retainIdentity(
      stableAnchor ??
        Object.freeze({
          cardKey,
          logicalIndex,
          viewportRow: this.#identities.get(cardKey)?.viewportRow ?? 0,
        }),
    );
    this.#evictToBounds();
    return stableAnchor === undefined
      ? Object.freeze({ kind: 'measured', cardKey, logicalIndex })
      : Object.freeze({
          kind: 'corrected',
          cardKey,
          logicalIndex,
          viewportRow: stableAnchor.viewportRow,
          passes: 1,
        });
  }

  /** Captures one stable viewport-relative anchor before a measurement correction pass. */
  anchor(anchor: KanbanSparseHeightAnchor): KanbanSparseHeightAnchor {
    this.#active();
    const snapshot = this.#snapshotAnchor(anchor);
    this.#retainIdentity(snapshot);
    return snapshot;
  }

  /** Returns current exact or estimated evidence for one retained typed card key. */
  anchorFor(cardKey: CardKey): KanbanSparseHeightRetainedAnchor | undefined {
    this.#active();
    let key: CardKey;
    try {
      key = createKanbanCardKey(cardKey);
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    const identity = this.#identities.get(key);
    if (identity === undefined) return undefined;
    const measurement = this.#measurements.get(key);
    return Object.freeze({
      ...identity,
      height: measurement?.height ?? this.#estimatedHeight,
      quality: measurement === undefined ? 'estimated' : 'exact',
    });
  }

  /** Drops one unloaded exact measurement while retaining bounded interaction identity. */
  unload(cardKey: CardKey): void {
    this.#active();
    let key: CardKey;
    try {
      key = createKanbanCardKey(cardKey);
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    this.#measurements.delete(key);
  }

  /** Returns detached typed identity and last known logical position for unloaded interaction state. */
  interactionIdentity(cardKey: CardKey): Readonly<{ cardKey: CardKey; logicalIndex: number }> | undefined {
    this.#active();
    let key: CardKey;
    try {
      key = createKanbanCardKey(cardKey);
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    const identity = this.#identities.get(key);
    return identity === undefined
      ? undefined
      : Object.freeze({ cardKey: identity.cardKey, logicalIndex: identity.logicalIndex });
  }

  /** Applies an authoritative reorder or deletion without retaining caller-owned state. */
  reconcile(input: KanbanSparseHeightReconciliation): void {
    this.#active();
    let properties: Readonly<Record<string, unknown>>;
    try {
      properties = snapshotKanbanDataProperties(input, REORDER_KEYS.size);
      if (properties.kind !== 'reorder' && properties.kind !== 'delete') throw new KanbanInvalidGeometryError();
      const keys = properties.kind === 'reorder' ? REORDER_KEYS : DELETE_KEYS;
      validateKanbanDataKeys(properties, keys);
      if (Object.keys(properties).length !== keys.size) throw new KanbanInvalidGeometryError();
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    let cardKey: CardKey;
    let sourceRevision: KanbanRevision;
    try {
      if (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') {
        throw new KanbanInvalidGeometryError();
      }
      cardKey = createKanbanCardKey(properties.cardKey);
      sourceRevision = snapshotKanbanRevision(properties.sourceRevision);
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    this.#revisions = Object.freeze({ ...this.#revisions, source: sourceRevision });
    this.#measurements.delete(cardKey);
    if (properties.kind === 'delete') {
      this.#identities.delete(cardKey);
      return;
    }
    const logicalIndex = boundedInteger(properties.logicalIndex);
    if (logicalIndex >= this.#logicalLength) throw new KanbanInvalidGeometryError();
    this.#retainIdentity(
      Object.freeze({
        cardKey,
        logicalIndex,
        viewportRow: this.#identities.get(cardKey)?.viewportRow ?? 0,
      }),
    );
  }

  /** Invalidates exact heights when any source, cursor, or presentation revision changes. */
  invalidateRevisions(input: KanbanSparseHeightRevisionInput): number {
    this.#active();
    let properties: Readonly<Record<string, unknown>>;
    try {
      properties = snapshotKanbanDataProperties(input, REVISION_KEYS.size);
      validateKanbanDataKeys(properties, REVISION_KEYS);
      if (Object.keys(properties).length !== REVISION_KEYS.size) throw new KanbanInvalidGeometryError();
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    let revisions: KanbanSparseHeightSnapshot['revisions'];
    try {
      revisions = Object.freeze({
        source: snapshotKanbanRevision(properties.sourceRevision),
        cursor: snapshotKanbanRevision(properties.cursorRevision),
        presentation: snapshotKanbanRevision(properties.presentationRevision),
      });
    } catch {
      throw new KanbanInvalidGeometryError();
    }
    if (
      revisions.source === this.#revisions.source &&
      revisions.cursor === this.#revisions.cursor &&
      revisions.presentation === this.#revisions.presentation
    ) {
      return 0;
    }
    const removed = this.#measurements.size;
    this.#measurements.clear();
    this.#revisions = revisions;
    return removed;
  }

  /** Converts a logical boundary to its saturated estimated terminal row. */
  rowAt(logicalIndex: number): KanbanSparseHeightPosition {
    this.#active();
    const index = boundedInteger(logicalIndex);
    if (index > this.#logicalLength) throw new KanbanInvalidGeometryError();
    let row = saturatedMultiply(index, this.#estimatedHeight);
    let measuredBefore = 0;
    for (const measurement of this.#measurements.values()) {
      if (measurement.logicalIndex >= index) continue;
      measuredBefore += 1;
      row = saturatedCorrection(row, measurement.height - this.#estimatedHeight);
    }
    return Object.freeze({
      value: row,
      quality: measuredBefore === index ? 'exact' : 'estimated',
    });
  }

  /** Converts a terminal row to the nearest logical position without scanning logical cards. */
  indexAt(row: number): KanbanSparseHeightLookup {
    this.#active();
    const requestedRow = boundedInteger(row);
    if (this.#logicalLength === 0) return Object.freeze({ logicalIndex: 0, row: 0, quality: 'exact' });
    let low = 0;
    let high = this.#logicalLength;
    while (low < high) {
      const middle = low + Math.ceil((high - low) / 2);
      if (this.rowAt(middle).value <= requestedRow) low = middle;
      else high = middle - 1;
    }
    const logicalIndex = Math.min(low, this.#logicalLength - 1);
    const position = this.rowAt(logicalIndex);
    return Object.freeze({ logicalIndex, row: position.value, quality: position.quality });
  }

  /** Returns frozen counter-only evidence without exposing card identities or heights. */
  snapshot(): KanbanSparseHeightSnapshot {
    this.#active();
    const retainedRuns = heightRuns(this.#measurements.values()).length;
    return Object.freeze({
      logicalLength: this.#logicalLength,
      estimatedHeight: this.#estimatedHeight,
      retainedAnchors: this.#measurements.size,
      retainedRuns,
      allocatedEntries: this.#measurements.size + this.#identities.size + retainedRuns,
      revisions: this.#revisions,
    });
  }

  /** Releases all retained measurements and makes further access fail deterministically. */
  dispose(): void {
    if (this.#disposed) return;
    this.#measurements.clear();
    this.#identities.clear();
    this.#disposed = true;
  }

  /** Removes oldest exact anchors until both configured storage budgets are satisfied. */
  #evictToBounds(): void {
    while (
      this.#measurements.size > this.#maximumAnchors ||
      heightRuns(this.#measurements.values()).length > this.#maximumRuns
    ) {
      const oldest = this.#measurements.keys().next().value;
      if (oldest === undefined) return;
      this.#measurements.delete(oldest);
    }
  }

  /** Snapshots one exact stable anchor without invoking accessors or retaining caller data. */
  #snapshotAnchor(value: unknown): KanbanSparseHeightAnchor {
    let properties: Readonly<Record<string, unknown>>;
    try {
      properties = snapshotKanbanDataProperties(value, ANCHOR_KEYS.size);
      validateKanbanDataKeys(properties, ANCHOR_KEYS);
      if (Object.keys(properties).length !== ANCHOR_KEYS.size) throw new KanbanInvalidGeometryError();
      if (typeof properties.cardKey !== 'string' && typeof properties.cardKey !== 'number') {
        throw new KanbanInvalidGeometryError();
      }
      const cardKey = createKanbanCardKey(properties.cardKey);
      const logicalIndex = boundedInteger(properties.logicalIndex);
      if (logicalIndex >= this.#logicalLength) throw new KanbanInvalidGeometryError();
      return Object.freeze({
        cardKey,
        logicalIndex,
        viewportRow: boundedInteger(properties.viewportRow),
      });
    } catch {
      throw new KanbanInvalidGeometryError();
    }
  }

  /** Retains one interaction identity under the same bounded anchor budget. */
  #retainIdentity(identity: RetainedIdentity): void {
    this.#identities.delete(identity.cardKey);
    this.#identities.set(identity.cardKey, identity);
    while (this.#identities.size > this.#maximumAnchors) {
      const oldest = this.#identities.keys().next().value;
      if (oldest === undefined) return;
      this.#identities.delete(oldest);
      this.#measurements.delete(oldest);
    }
  }

  /** Rejects reads and mutations after disposal. */
  #active(): void {
    if (this.#disposed) throw new KanbanDisposedResourceError();
  }
}

/**
 * Creates one bounded sparse height index for a retained semantic cell.
 *
 * @example
 * ```ts
 * const heights = createKanbanSparseHeightIndex({
 *   logicalLength: 100_000,
 *   estimatedHeight: 3,
 *   maximumAnchors: 256,
 *   maximumRuns: 256,
 *   sourceRevision: 'source-v1',
 *   cursorRevision: 'cursor-v1',
 *   presentationRevision: 'cards-v1',
 * });
 * ```
 */
export function createKanbanSparseHeightIndex(options: KanbanSparseHeightIndexOptions): KanbanSparseHeightIndex {
  return new KanbanSparseHeightIndex(options);
}
