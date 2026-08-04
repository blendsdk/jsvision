import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import {
  KanbanDisposedResourceError,
  KanbanInvalidQueryError,
  KanbanInvalidSourcePublicationError,
} from '../contract/error.js';
import type { CardKey } from '../contract/identity.js';
import { validateKanbanLimitOptions } from '../contract/limits.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanRevision } from '../contract/revision.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from './address.js';
import type { KanbanBoardCounts, KanbanCellCounts, KanbanCount } from './counts.js';
import { buildEagerKanbanIndex, validateEagerKanbanQuerySupport } from './eager-index.js';
import type { EagerKanbanIndex, EagerKanbanSourceOptions } from './eager-index.js';
import { snapshotKanbanRange } from './range-set.js';
import type { KanbanCellState, KanbanKnownLength, KanbanSourceState } from './states.js';
import type {
  KanbanCardLocation,
  KanbanCellAddress,
  KanbanCellCursor,
  KanbanDataSource,
  KanbanHeaderBatch,
  KanbanIdentityChange,
  KanbanIdentityChangeBatch,
  KanbanPlacement,
  KanbanQuery,
  KanbanQuerySession,
} from './types.js';
import { snapshotKanbanQuery } from './validation.js';

/** Complete eager derivation plus authoritative deletion facts from its predecessor. */
interface EagerDerivation<TCard> {
  readonly index: EagerKanbanIndex<TCard>;
  readonly identityChanges: readonly KanbanIdentityChange[];
}

/** Maximum members accepted when reading the factory's exact options envelope. */
const EAGER_OPTION_MEMBERS = 12;
/** Exact option keys accepted by the eager factory boundary. */
const EAGER_OPTION_KEYS = new Set([
  'columns',
  'swimlanes',
  'keyOf',
  'columnOf',
  'compare',
  'groupingFields',
  'filterFields',
  'sortFields',
  'summaries',
  'limits',
  'observe',
]);
/** Stable empty swimlane collection avoids invalidating an ungrouped eager derivation on every read. */
const EMPTY_SWIMLANES = Object.freeze([]);

/** Creates one exact known count. */
function exact(value: number): KanbanCount {
  return Object.freeze({ quality: 'exact', value });
}

/** Creates an explicit unknown count. */
function unknown(): KanbanCount {
  return Object.freeze({ quality: 'unknown' });
}

/** Narrows one descriptor from a statically typed array to its matching data value. */
function isTypedDataDescriptor<T>(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { readonly value: T } {
  return (
    descriptor !== undefined &&
    descriptor.enumerable === true &&
    descriptor.get === undefined &&
    descriptor.set === undefined &&
    Object.prototype.hasOwnProperty.call(descriptor, 'value')
  );
}

/** Copies a dense ordinary typed array without invoking element accessors. */
function snapshotTypedArray<T>(value: readonly T[], maximumEntries: number): readonly T[] {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximumEntries) {
      throw new KanbanInvalidSourcePublicationError();
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || keys.some((key) => typeof key !== 'string')) {
      throw new KanbanInvalidSourcePublicationError();
    }
    const result: T[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!isTypedDataDescriptor<T>(descriptor)) {
        throw new KanbanInvalidSourcePublicationError();
      }
      result.push(descriptor.value);
    }
    return Object.freeze(result);
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    throw new KanbanInvalidSourcePublicationError();
  }
}

/** Returns deletion facts between two complete valid eager indexes. */
function deriveIdentityChanges<TCard>(
  previous: EagerKanbanIndex<TCard> | undefined,
  next: EagerKanbanIndex<TCard>,
): readonly KanbanIdentityChange[] {
  if (previous === undefined) return Object.freeze([]);
  const changes: KanbanIdentityChange[] = [];
  for (const key of previous.entries.keys()) {
    if (!next.entries.has(key)) changes.push(Object.freeze({ kind: 'deleted-card', cardKey: key }));
  }
  const nextColumns = new Set(next.columns.map((column) => column.columnId));
  for (const column of previous.columns) {
    if (!nextColumns.has(column.columnId)) {
      changes.push(Object.freeze({ kind: 'deleted-column', columnId: column.columnId }));
    }
  }
  const nextSwimlanes = new Set(next.swimlanes.map((swimlane) => swimlane.swimlaneId));
  for (const swimlane of previous.swimlanes) {
    if (!nextSwimlanes.has(swimlane.swimlaneId)) {
      changes.push(Object.freeze({ kind: 'deleted-swimlane', swimlaneId: swimlane.swimlaneId }));
    }
  }
  return Object.freeze(changes);
}

/** Cursor backed by one live eager-session derivation and original application card references. */
class EagerKanbanCursor<TCard> implements KanbanCellCursor<TCard> {
  readonly #read: () => EagerDerivation<TCard>;
  readonly #addressKey: string;
  readonly #maximumRange: number;
  readonly #onDispose: (cursor: EagerKanbanCursor<TCard>) => void;
  #disposed = false;

  /** Captures only the semantic address; every getter observes the current valid derivation. */
  constructor(
    read: () => EagerDerivation<TCard>,
    address: KanbanCellAddress,
    maximumRange: number,
    onDispose: (cursor: EagerKanbanCursor<TCard>) => void,
  ) {
    this.#read = read;
    this.#addressKey = canonicalizeKanbanCellAddress(address);
    this.#maximumRange = maximumRange;
    this.#onDispose = onDispose;
  }

  /** Returns ready or structurally empty state for this exact eager cell. */
  state(): KanbanCellState {
    return Object.freeze({ kind: this.#cards().length === 0 ? 'empty' : 'ready' });
  }

  /** Returns exact authoritative, matching, and resident counts for the cell. */
  counts(): KanbanCellCounts {
    const derivation = this.#active();
    const loaded = derivation.index.cells.get(this.#addressKey)?.length ?? 0;
    return Object.freeze({
      total: exact(derivation.index.cellTotals.get(this.#addressKey) ?? 0),
      matching: exact(loaded),
      loaded: exact(loaded),
    });
  }

  /** Returns an authoritative eager length. */
  length(): KanbanKnownLength {
    return Object.freeze({ kind: 'exact', value: this.#cards().length });
  }

  /** Returns one original application card reference synchronously. */
  cardAt(index: number): TCard | undefined {
    if (!Number.isSafeInteger(index) || index < 0) return undefined;
    return this.#cards()[index];
  }

  /** Validates one bounded range and resolves without asynchronous loading. */
  ensureRange(start: number, end: number, options?: { readonly signal?: AbortSignal }): Promise<void> {
    this.#active();
    snapshotKanbanRange(start, end, this.#maximumRange);
    return options?.signal?.aborted === true
      ? Promise.reject(new DOMException('The Kanban eager range was aborted.', 'AbortError'))
      : Promise.resolve();
  }

  /** Returns the current eager derivation revision. */
  revision(): KanbanRevision {
    return this.#active().index.revision;
  }

  /** Returns an authoritative revision-bound placement for one logical slot. */
  placementAt(slot: number): KanbanPlacement {
    const derivation = this.#active();
    const keys = derivation.index.cellKeys.get(this.#addressKey) ?? [];
    const cursorRevision = derivation.index.revision;
    if (!Number.isSafeInteger(slot) || slot < 0 || slot > keys.length) {
      return Object.freeze({ kind: 'unavailable', code: 'slot-out-of-range', cursorRevision });
    }
    if (slot === 0) return Object.freeze({ kind: 'start', cursorRevision });
    if (slot === keys.length) return Object.freeze({ kind: 'end', cursorRevision });
    return Object.freeze({
      kind: 'between',
      beforeCardKey: keys[slot - 1] ?? null,
      afterCardKey: keys[slot] ?? null,
      cursorRevision,
    });
  }

  /** Eager cursors have no asynchronous error to retry. */
  retry(): void {
    this.#active();
  }

  /** Releases this cursor idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#onDispose(this);
  }

  /** Returns the current cell array after enforcing cursor lifetime. */
  #cards(): readonly TCard[] {
    return this.#active().index.cells.get(this.#addressKey) ?? [];
  }

  /** Returns the current eager derivation or rejects use after disposal. */
  #active(): EagerDerivation<TCard> {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    return this.#read();
  }
}

/** Independently disposable live query session over one eager source. */
class EagerKanbanSession<TCard> implements KanbanQuerySession<TCard> {
  readonly #query: KanbanQuery;
  readonly #cards: () => readonly TCard[];
  readonly #options: EagerKanbanSourceOptions<TCard>;
  readonly #limits: ReturnType<typeof validateKanbanLimitOptions>;
  readonly #cursors = new Set<EagerKanbanCursor<TCard>>();
  #revision = 0;
  #last: EagerDerivation<TCard> | undefined;
  #attemptedCards: readonly TCard[] | undefined;
  #attemptedColumns: readonly import('./types.js').KanbanColumnMeta[] | undefined;
  #attemptedSwimlanes: readonly import('./types.js').KanbanSwimlaneMeta[] | undefined;
  #failed = false;
  #hasValidPublication = false;
  #disposed = false;

  /** Stores source callbacks without deriving until the first reactive getter read. */
  constructor(cards: () => readonly TCard[], query: KanbanQuery, options: EagerKanbanSourceOptions<TCard>) {
    this.#cards = cards;
    this.#query = query;
    this.#options = options;
    this.#limits = validateKanbanLimitOptions(options.limits);
  }

  /** Returns ready, empty, or first-publication error state. */
  state(): KanbanSourceState {
    const derivation = this.#read();
    if (this.#failed && !this.#hasValidPublication) {
      return Object.freeze({ kind: 'error', code: 'source-publication-invalid' });
    }
    return Object.freeze({ kind: derivation.index.matching === 0 ? 'empty' : 'ready' });
  }

  /** Returns the current complete eager derivation revision. */
  revision(): KanbanRevision {
    return this.#read().index.revision;
  }

  /** Returns ordered detached column metadata. */
  columns(): readonly import('./types.js').KanbanColumnMeta[] {
    return this.#read().index.columns;
  }

  /** Returns ordered detached swimlane metadata. */
  swimlanes(): readonly import('./types.js').KanbanSwimlaneMeta[] {
    return this.#read().index.swimlanes;
  }

  /** Returns exact eager total, matching, and loaded counts with explicit unknown projection counts. */
  counts(): KanbanBoardCounts {
    const index = this.#read().index;
    return Object.freeze({
      total: exact(index.total),
      matching: exact(index.matching),
      loaded: exact(index.matching),
      visible: exact(index.matching),
      selected: unknown(),
      wip: unknown(),
    });
  }

  /** Returns same-revision column/swimlane labels and honest numeric summaries. */
  headers(): KanbanHeaderBatch {
    const index = this.#read().index;
    return Object.freeze({
      revision: index.revision,
      columns: Object.freeze(
        index.columns.map((column) => {
          const summaries = index.columnSummaries.get(column.columnId);
          return Object.freeze({
            columnId: column.columnId,
            label: column.label,
            ...(summaries === undefined || Object.keys(summaries).length === 0 ? {} : { summaries }),
          });
        }),
      ),
      swimlanes: Object.freeze(
        index.swimlanes.map((swimlane) => {
          const summaries = index.swimlaneSummaries.get(swimlane.swimlaneId);
          return Object.freeze({
            swimlaneId: swimlane.swimlaneId,
            label: swimlane.label,
            ...(summaries === undefined || Object.keys(summaries).length === 0 ? {} : { summaries }),
          });
        }),
      ),
    });
  }

  /** Returns same-revision authoritative identity deletion facts. */
  identityChanges(): KanbanIdentityChangeBatch {
    const derivation = this.#read();
    return Object.freeze({ revision: derivation.index.revision, changes: derivation.identityChanges });
  }

  /** Opens one synchronous eager cursor after validating its declared structural address. */
  cell(address: KanbanCellAddress): KanbanCellCursor<TCard> {
    const snapshot = snapshotKanbanCellAddress(address);
    const derivation = this.#read();
    if (!derivation.index.cells.has(canonicalizeKanbanCellAddress(snapshot))) {
      throw new KanbanInvalidSourcePublicationError();
    }
    const cursor = new EagerKanbanCursor(
      () => this.#read(),
      snapshot,
      this.#limits.ensureRangeCards,
      (disposed) => this.#cursors.delete(disposed),
    );
    this.#cursors.add(cursor);
    return cursor;
  }

  /** Resolves a stable key directly from the eager key index without scanning cursor contents. */
  locateCard(key: CardKey): KanbanCardLocation {
    const index = this.#read().index;
    const entry = index.entries.get(key);
    if (entry === undefined) return Object.freeze({ kind: 'unknown', sessionRevision: index.revision });
    return Object.freeze({
      kind: 'found',
      address: entry.address,
      index: entry.index,
      sessionRevision: index.revision,
    });
  }

  /** Disposes every child cursor and the session idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const cursor of [...this.#cursors]) cursor.dispose();
    this.#cursors.clear();
  }

  /** Reads reactive inputs once and publishes only a complete valid candidate. */
  #read(): EagerDerivation<TCard> {
    if (this.#disposed) throw new KanbanDisposedResourceError();
    try {
      const cardsInput = this.#cards();
      const columnsInput = this.#options.columns();
      const swimlanesInput = this.#options.swimlanes?.() ?? EMPTY_SWIMLANES;
      if (
        this.#last !== undefined &&
        cardsInput === this.#attemptedCards &&
        columnsInput === this.#attemptedColumns &&
        swimlanesInput === this.#attemptedSwimlanes
      ) {
        return this.#last;
      }
      this.#attemptedCards = cardsInput;
      this.#attemptedColumns = columnsInput;
      this.#attemptedSwimlanes = swimlanesInput;
      const cards = snapshotTypedArray(cardsInput, this.#limits.selectedKeys);
      const columns = snapshotTypedArray(columnsInput, this.#limits.columns);
      const swimlanes = snapshotTypedArray(swimlanesInput, this.#limits.swimlanes);
      const index = buildEagerKanbanIndex(cards, columns, swimlanes, {
        query: this.#query,
        revision: (this.#revision += 1),
        sourceOptions: this.#options,
        limits: this.#limits,
      });
      const next = Object.freeze({ index, identityChanges: deriveIdentityChanges(this.#last?.index, index) });
      this.#last = next;
      this.#failed = false;
      this.#hasValidPublication = true;
      return next;
    } catch {
      if (!this.#failed) this.#emit('source-publication-invalid');
      this.#failed = true;
      if (this.#last !== undefined) return this.#last;
      const index: EagerKanbanIndex<TCard> = Object.freeze({
        revision: (this.#revision += 1),
        columns: Object.freeze([]),
        swimlanes: Object.freeze([]),
        cells: new Map(),
        cellKeys: new Map(),
        cellTotals: new Map(),
        entries: new Map(),
        total: 0,
        matching: 0,
        summaries: new Map(),
        columnSummaries: new Map(),
        swimlaneSummaries: new Map(),
      });
      this.#last = Object.freeze({ index, identityChanges: Object.freeze([]) });
      return this.#last;
    }
  }

  /** Emits one already-redacted observation and isolates a throwing diagnostic sink. */
  #emit(code: string): void {
    try {
      this.#options.observe?.(createKanbanObservation({ code, scope: 'source' }));
    } catch {
      // Diagnostics cannot corrupt or replace the last valid eager publication.
    }
  }
}

/**
 * Creates a reactive eager Kanban source that preserves original application card references.
 *
 * Every session derives a complete candidate index off to the side and retains its last valid
 * publication when application metadata or adapter callbacks fail.
 *
 * @example
 * ```ts
 * const source = createEagerKanbanDataSource(() => cards, {
 *   columns: () => columns,
 *   keyOf: (card) => card.id,
 *   columnOf: (card) => card.columnId,
 * });
 * ```
 */
export function createEagerKanbanDataSource<TCard>(
  cards: () => readonly TCard[],
  options: EagerKanbanSourceOptions<TCard>,
): KanbanDataSource<TCard> {
  if (typeof cards !== 'function') throw new KanbanInvalidSourcePublicationError();
  try {
    const properties = snapshotKanbanDataProperties(options, EAGER_OPTION_MEMBERS);
    validateKanbanDataKeys(properties, EAGER_OPTION_KEYS);
  } catch {
    throw new KanbanInvalidSourcePublicationError();
  }
  if (
    typeof options.columns !== 'function' ||
    typeof options.keyOf !== 'function' ||
    typeof options.columnOf !== 'function'
  ) {
    throw new KanbanInvalidSourcePublicationError();
  }
  const limits = validateKanbanLimitOptions(options.limits);
  return Object.freeze({
    openQuery(query: KanbanQuery, openOptions?: { readonly signal?: AbortSignal }): KanbanQuerySession<TCard> {
      if (openOptions?.signal?.aborted === true) {
        throw new DOMException('The Kanban eager session was aborted.', 'AbortError');
      }
      let snapshot: KanbanQuery;
      try {
        snapshot = snapshotKanbanQuery(query);
        validateEagerKanbanQuerySupport(snapshot, options, limits);
      } catch {
        throw new KanbanInvalidQueryError();
      }
      return new EagerKanbanSession(cards, snapshot, options);
    },
  });
}
