import { KanbanInvalidSourcePublicationError } from '../contract/error.js';
import {
  createKanbanCardKey,
  createKanbanExtensionId,
  createKanbanFieldId,
  createKanbanSwimlaneId,
} from '../contract/identity.js';
import type {
  CardKey,
  KanbanColumnId,
  KanbanExtensionId,
  KanbanFieldId,
  KanbanSwimlaneId,
} from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanResolvedLimits } from '../contract/limits.js';
import { createKanbanObservation } from '../contract/observation.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import { canonicalizeKanbanCellAddress } from './address.js';
import type {
  KanbanCellAddress,
  KanbanColumnMeta,
  KanbanDataSource,
  KanbanNumericSummary,
  KanbanQuery,
  KanbanSummaryAggregation,
  KanbanSummaryScope,
  KanbanSwimlaneMeta,
} from './types.js';
import { snapshotKanbanColumnMeta, snapshotKanbanSwimlaneMeta } from './validation.js';

/** Application grouping adapter used by the eager source. */
export interface KanbanGroupingField<TCard> {
  /** Semantic field selected by `query.groupBy`. */
  readonly id: KanbanFieldId;
  /** Returns an optional semantic swimlane identity for one card. */
  readonly swimlaneOf: (card: TCard) => KanbanSwimlaneId | undefined;
  /** Declared semantic target for missing or valid-unmapped values. */
  readonly unassignedSwimlaneId?: KanbanSwimlaneId;
  /** Declared semantic target for thrown or malformed resolver results. */
  readonly resolverFallbackSwimlaneId?: KanbanSwimlaneId;
}

/** One explicitly registered filter operation for an application field. */
export interface KanbanFilterOperator<TCard> {
  /** Application-namespaced operator selected by a query filter. */
  readonly operatorId: KanbanExtensionId;
  /** Evaluates one card against a detached semantic operand. */
  readonly matches: (card: TCard, value: KanbanSemanticValue) => boolean;
}

/** Application filter field with a finite allowlist of supported operators. */
export interface KanbanFilterField<TCard> {
  /** Semantic field selected by a query filter. */
  readonly fieldId: KanbanFieldId;
  /** Finite operator registry validated before a session opens. */
  readonly operators: readonly KanbanFilterOperator<TCard>[];
}

/** Application stable-order adapter used by the eager source. */
export interface KanbanSortField<TCard> {
  /** Semantic field selected by a sort directive. */
  readonly fieldId: KanbanFieldId;
  /** Compares two cards in ascending semantic order. */
  readonly compare: (left: TCard, right: TCard) => -1 | 0 | 1;
}

/** Application numeric summary adapter used by eager headers. */
export interface KanbanSummaryAdapter<TCard> {
  /** Semantic summary field written into the header summary map. */
  readonly summaryId: KanbanFieldId;
  /** Whether the result describes authoritative or merely resident records. */
  readonly scope: KanbanSummaryScope;
  /** Package-owned aggregation applied deterministically to supplied values. */
  readonly aggregation: KanbanSummaryAggregation;
  /** Returns one finite contribution or omits this card from the aggregate. */
  readonly valueOf: (card: TCard) => number | undefined;
}

/** Public options shared by every query session opened from one eager source. */
export interface EagerKanbanSourceOptions<TCard> {
  /** Reactive ordered workflow-column metadata getter. */
  readonly columns: () => readonly KanbanColumnMeta[];
  /** Optional reactive ordered swimlane metadata getter. */
  readonly swimlanes?: () => readonly KanbanSwimlaneMeta[];
  /** Stable application-owned card identity adapter. */
  readonly keyOf: (card: TCard) => CardKey;
  /** Workflow-column identity adapter. */
  readonly columnOf: (card: TCard) => KanbanColumnId;
  /** Optional bounded plain-text search predicate required by non-empty search queries. */
  readonly search?: (card: TCard, term: string) => boolean;
  /** Optional reactive application revision for in-place card-field changes. */
  readonly revision?: () => KanbanRevision;
  /** Optional stable source-order comparator used when no query sort is active. */
  readonly compare?: (left: TCard, right: TCard) => number;
  /** Optional semantic grouping adapters. */
  readonly groupingFields?: readonly KanbanGroupingField<TCard>[];
  /** Optional semantic filter adapters. */
  readonly filterFields?: readonly KanbanFilterField<TCard>[];
  /** Optional semantic sort adapters. */
  readonly sortFields?: readonly KanbanSortField<TCard>[];
  /** Optional numeric header-summary adapters. */
  readonly summaries?: readonly KanbanSummaryAdapter<TCard>[];
  /** Optional lower per-instance resource limits. */
  readonly limits?: import('../contract/limits.js').KanbanLimitOptions;
  /** Optional sink for already-redacted eager-source observations. */
  readonly observe?: (observation: KanbanObservation) => void;
}

/** One card's eager semantic location. */
export interface EagerKanbanCardEntry<TCard> {
  /** Original application card reference. */
  readonly card: TCard;
  /** Stable semantic key preserving number/string distinction. */
  readonly key: CardKey;
  /** Validated semantic cell address. */
  readonly address: KanbanCellAddress;
  /** Display index within that cell after stable ordering. */
  readonly index: number;
}

/** Allocation evidence proving eager indexing scales with occupied semantic cells. */
export interface EagerKanbanAllocationCounts {
  /** Canonical address records retained for occupied cells. */
  readonly addresses: number;
  /** Matching-card buckets retained for occupied cells. */
  readonly matchingCellBuckets: number;
  /** Authoritative-card buckets retained for occupied cells. */
  readonly authoritativeCellBuckets: number;
}

/** Complete immutable eager derivation for one source/query revision. */
export interface EagerKanbanIndex<TCard> {
  /** Equality-only revision of this complete derivation. */
  readonly revision: KanbanRevision;
  /** Ordered detached workflow columns. */
  readonly columns: readonly KanbanColumnMeta[];
  /** Ordered detached semantic swimlanes. */
  readonly swimlanes: readonly KanbanSwimlaneMeta[];
  /** Whether this derivation uses one registered grouping field. */
  readonly grouped: boolean;
  /** Matching original card references indexed by canonical cell address. */
  readonly cells: ReadonlyMap<string, readonly TCard[]>;
  /** Matching stable card keys in the same per-cell order. */
  readonly cellKeys: ReadonlyMap<string, readonly CardKey[]>;
  /** Authoritative pre-filter card counts indexed by canonical cell address. */
  readonly cellTotals: ReadonlyMap<string, number>;
  /** Matching card locations indexed by stable card identity. */
  readonly entries: ReadonlyMap<CardKey, EagerKanbanCardEntry<TCard>>;
  /** Every authoritative stable card identity, including records excluded by the active query. */
  readonly authoritativeKeys: ReadonlySet<CardKey>;
  /** Authoritative number of resident application records before filtering. */
  readonly total: number;
  /** Number of resident records matching the active query. */
  readonly matching: number;
  /** Honest numeric summary values by canonical cell and semantic field ID. */
  readonly summaries: ReadonlyMap<string, Readonly<Record<string, KanbanNumericSummary>>>;
  /** Honest numeric summaries projected to ordered column headers. */
  readonly columnSummaries: ReadonlyMap<KanbanColumnId, Readonly<Record<string, KanbanNumericSummary>>>;
  /** Honest numeric summaries projected to ordered swimlane headers. */
  readonly swimlaneSummaries: ReadonlyMap<KanbanSwimlaneId, Readonly<Record<string, KanbanNumericSummary>>>;
  /** Bounded internal allocation evidence exposed for scale regression tests. */
  readonly allocationCounts: EagerKanbanAllocationCounts;
}

/** Internal options required to build one eager derivation. */
export interface BuildEagerKanbanIndexOptions<TCard> {
  readonly query: KanbanQuery;
  readonly revision: KanbanRevision;
  readonly sourceOptions: EagerKanbanSourceOptions<TCard>;
  readonly limits: KanbanResolvedLimits;
}

/** Returns a stable map and rejects duplicate adapter identities atomically. */
function adapterMap<T>(entries: readonly T[] | undefined, idOf: (entry: T) => string): ReadonlyMap<string, T> {
  const result = new Map<string, T>();
  for (const entry of entries ?? []) {
    const id = idOf(entry);
    if (result.has(id)) throw new KanbanInvalidSourcePublicationError();
    result.set(id, entry);
  }
  return result;
}

/** Validates finite adapter registries and unsupported directives before opening a session. */
export function validateEagerKanbanQuerySupport<TCard>(
  query: KanbanQuery,
  options: EagerKanbanSourceOptions<TCard>,
  limits: KanbanResolvedLimits,
): void {
  const groupingFields = options.groupingFields ?? [];
  const filterFields = options.filterFields ?? [];
  const sortFields = options.sortFields ?? [];
  const summaries = options.summaries ?? [];
  if (
    groupingFields.length > limits.cardFields ||
    filterFields.length > limits.cardFields ||
    sortFields.length > limits.cardFields ||
    summaries.length > limits.summarySections
  ) {
    throw new KanbanInvalidSourcePublicationError();
  }
  const grouping = adapterMap(groupingFields, (entry) => createKanbanFieldId(entry.id));
  const filters = adapterMap(filterFields, (entry) => createKanbanFieldId(entry.fieldId));
  const sorts = adapterMap(sortFields, (entry) => createKanbanFieldId(entry.fieldId));
  adapterMap(summaries, (entry) => createKanbanFieldId(entry.summaryId));
  for (const field of filterFields) {
    if (!Array.isArray(field.operators) || field.operators.length > limits.cardFields) {
      throw new KanbanInvalidSourcePublicationError();
    }
    const operators = new Set<string>();
    for (const operator of field.operators) {
      const operatorId = createKanbanExtensionId(operator.operatorId);
      if (operators.has(operatorId) || typeof operator.matches !== 'function') {
        throw new KanbanInvalidSourcePublicationError();
      }
      operators.add(operatorId);
    }
  }
  for (const field of groupingFields) {
    if (typeof field.swimlaneOf !== 'function') throw new KanbanInvalidSourcePublicationError();
  }
  for (const field of sortFields) {
    if (typeof field.compare !== 'function') throw new KanbanInvalidSourcePublicationError();
  }
  for (const adapter of summaries) {
    if (
      (adapter.scope !== 'authoritative' && adapter.scope !== 'loaded-only') ||
      (adapter.aggregation !== 'sum' &&
        adapter.aggregation !== 'minimum' &&
        adapter.aggregation !== 'maximum' &&
        adapter.aggregation !== 'average') ||
      typeof adapter.valueOf !== 'function'
    ) {
      throw new KanbanInvalidSourcePublicationError();
    }
  }
  if (options.search !== undefined && typeof options.search !== 'function') {
    throw new KanbanInvalidSourcePublicationError();
  }
  if (query.search !== undefined && query.search.length > 0 && options.search === undefined) {
    throw new KanbanInvalidSourcePublicationError();
  }
  if (query.groupBy !== undefined && !grouping.has(query.groupBy)) {
    throw new KanbanInvalidSourcePublicationError();
  }
  for (const filter of query.filters ?? []) {
    const field = filters.get(filter.fieldId);
    if (field === undefined || !field.operators.some((operator) => operator.operatorId === filter.operatorId)) {
      throw new KanbanInvalidSourcePublicationError();
    }
  }
  for (const sort of query.sort ?? []) {
    if (!sorts.has(sort.fieldId)) throw new KanbanInvalidSourcePublicationError();
  }
}

/** Validates one card identity without stringifying number keys. */
function validateCardKey(value: CardKey): CardKey {
  try {
    return createKanbanCardKey(value);
  } catch {
    throw new KanbanInvalidSourcePublicationError();
  }
}

/** Emits one payload-free grouping failure without trusting the application observation sink. */
function observeGroupingFailure(observe: EagerKanbanSourceOptions<unknown>['observe']): void {
  if (observe === undefined) return;
  try {
    observe(createKanbanObservation({ code: 'group-resolver-failed', scope: 'source' }));
  } catch {
    // Diagnostics cannot change membership normalization or expose a caught resolver error.
  }
}

/** Resolves one grouped card into exactly one declared semantic swimlane. */
function resolveGroupedSwimlane<TCard>(
  card: TCard,
  grouping: KanbanGroupingField<TCard>,
  swimlaneIds: ReadonlySet<KanbanSwimlaneId>,
  observe: EagerKanbanSourceOptions<TCard>['observe'],
): KanbanSwimlaneId {
  const configured = (value: KanbanSwimlaneId | undefined): KanbanSwimlaneId | undefined => {
    if (value === undefined) return undefined;
    const id = createKanbanSwimlaneId(value);
    if (!swimlaneIds.has(id)) throw new KanbanInvalidSourcePublicationError();
    return id;
  };
  const unassigned = configured(grouping.unassignedSwimlaneId);
  const fallback = configured(grouping.resolverFallbackSwimlaneId);
  let candidate: unknown;
  try {
    candidate = Reflect.apply(grouping.swimlaneOf, undefined, [card]);
  } catch {
    if (fallback === undefined) throw new KanbanInvalidSourcePublicationError();
    observeGroupingFailure(observe);
    return fallback;
  }
  if (candidate === undefined) {
    if (unassigned === undefined) throw new KanbanInvalidSourcePublicationError();
    return unassigned;
  }
  let swimlaneId: KanbanSwimlaneId;
  try {
    if (typeof candidate !== 'string') throw new KanbanInvalidSourcePublicationError();
    swimlaneId = createKanbanSwimlaneId(candidate);
  } catch {
    if (fallback === undefined) throw new KanbanInvalidSourcePublicationError();
    observeGroupingFailure(observe);
    return fallback;
  }
  if (swimlaneIds.has(swimlaneId)) return swimlaneId;
  if (unassigned === undefined) throw new KanbanInvalidSourcePublicationError();
  return unassigned;
}

/** Validates comparator output before it can destabilize publication order. */
function compareCards<TCard>(
  left: { readonly card: TCard; readonly sourceIndex: number },
  right: { readonly card: TCard; readonly sourceIndex: number },
  query: KanbanQuery,
  sortFields: ReadonlyMap<string, KanbanSortField<TCard>>,
  fallback: ((left: TCard, right: TCard) => number) | undefined,
): number {
  for (const directive of query.sort ?? []) {
    const adapter = sortFields.get(directive.fieldId);
    if (adapter === undefined) throw new KanbanInvalidSourcePublicationError();
    const comparison = adapter.compare(left.card, right.card);
    if (comparison !== -1 && comparison !== 0 && comparison !== 1) {
      throw new KanbanInvalidSourcePublicationError();
    }
    if (comparison !== 0) return directive.direction === 'ascending' ? comparison : -comparison;
  }
  if ((query.sort?.length ?? 0) === 0 && fallback !== undefined) {
    const comparison = fallback(left.card, right.card);
    if (!Number.isFinite(comparison)) throw new KanbanInvalidSourcePublicationError();
    if (comparison !== 0) return comparison;
  }
  return left.sourceIndex - right.sourceIndex;
}

/** Aggregates finite optional numeric contributions without delegating an arbitrary reducer. */
function aggregateSummary<TCard>(cards: readonly TCard[], adapter: KanbanSummaryAdapter<TCard>): KanbanNumericSummary {
  let sum = 0;
  let count = 0;
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const card of cards) {
    const value = adapter.valueOf(card);
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new KanbanInvalidSourcePublicationError();
    sum += value;
    if (!Number.isFinite(sum)) throw new KanbanInvalidSourcePublicationError();
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    count += 1;
  }
  if (count === 0) return Object.freeze({ scope: adapter.scope, quality: 'unknown' });
  const value =
    adapter.aggregation === 'sum'
      ? sum
      : adapter.aggregation === 'minimum'
        ? minimum
        : adapter.aggregation === 'maximum'
          ? maximum
          : sum / count;
  return Object.freeze({ scope: adapter.scope, quality: 'exact', value });
}

/** Computes every configured honest summary over authoritative and filtered collections. */
function aggregateSummaries<TCard>(
  authoritative: readonly TCard[],
  loaded: readonly TCard[],
  adapters: ReadonlyMap<string, KanbanSummaryAdapter<TCard>>,
): Readonly<Record<string, KanbanNumericSummary>> {
  const result: Record<string, KanbanNumericSummary> = {};
  for (const adapter of adapters.values()) {
    result[adapter.summaryId] = aggregateSummary(adapter.scope === 'authoritative' ? authoritative : loaded, adapter);
  }
  return Object.freeze(result);
}

/** Builds one complete candidate eager index without mutating a prior valid publication. */
export function buildEagerKanbanIndex<TCard>(
  cards: readonly TCard[],
  columnsInput: readonly KanbanColumnMeta[],
  swimlanesInput: readonly KanbanSwimlaneMeta[],
  options: BuildEagerKanbanIndexOptions<TCard>,
): EagerKanbanIndex<TCard> {
  validateEagerKanbanQuerySupport(options.query, options.sourceOptions, options.limits);
  if (cards.length > options.limits.selectedKeys || columnsInput.length > options.limits.columns) {
    throw new KanbanInvalidSourcePublicationError();
  }
  const columns = Object.freeze(columnsInput.map(snapshotKanbanColumnMeta));
  const swimlanes = Object.freeze(swimlanesInput.map(snapshotKanbanSwimlaneMeta));
  const columnIds = new Set(columns.map((column) => column.columnId));
  const swimlaneIds = new Set(swimlanes.map((swimlane) => swimlane.swimlaneId));
  if (columnIds.size !== columns.length || swimlaneIds.size !== swimlanes.length) {
    throw new KanbanInvalidSourcePublicationError();
  }

  const groupingFields = adapterMap(options.sourceOptions.groupingFields, (entry) => entry.id);
  const filterFields = adapterMap(options.sourceOptions.filterFields, (entry) => entry.fieldId);
  const sortFields = adapterMap(options.sourceOptions.sortFields, (entry) => entry.fieldId);
  const summaryAdapters = adapterMap(options.sourceOptions.summaries, (entry) => entry.summaryId);
  const grouping = options.query.groupBy === undefined ? undefined : groupingFields.get(options.query.groupBy);
  if (options.query.groupBy !== undefined && grouping === undefined) throw new KanbanInvalidSourcePublicationError();
  for (const filter of options.query.filters ?? []) {
    const field = filterFields.get(filter.fieldId);
    if (field === undefined || !field.operators.some((operator) => operator.operatorId === filter.operatorId)) {
      throw new KanbanInvalidSourcePublicationError();
    }
  }
  for (const sort of options.query.sort ?? []) {
    if (!sortFields.has(sort.fieldId)) throw new KanbanInvalidSourcePublicationError();
  }

  type IndexedCard = { readonly card: TCard; readonly key: CardKey; readonly sourceIndex: number };
  const addresses = new Map<string, KanbanCellAddress>();
  const cells = new Map<string, IndexedCard[]>();
  const authoritativeCells = new Map<string, TCard[]>();
  const authoritativeColumns = new Map<KanbanColumnId, TCard[]>();
  const loadedColumns = new Map<KanbanColumnId, TCard[]>();
  const authoritativeSwimlanes = new Map<KanbanSwimlaneId, TCard[]>();
  const loadedSwimlanes = new Map<KanbanSwimlaneId, TCard[]>();
  for (const column of columns) {
    authoritativeColumns.set(column.columnId, []);
    loadedColumns.set(column.columnId, []);
  }
  for (const swimlane of swimlanes) {
    authoritativeSwimlanes.set(swimlane.swimlaneId, []);
    loadedSwimlanes.set(swimlane.swimlaneId, []);
  }
  const seenKeys = new Set<CardKey>();
  let matching = 0;

  for (const [sourceIndex, card] of cards.entries()) {
    const key = validateCardKey(options.sourceOptions.keyOf(card));
    if (seenKeys.has(key)) throw new KanbanInvalidSourcePublicationError();
    seenKeys.add(key);
    const columnId = options.sourceOptions.columnOf(card);
    if (!columnIds.has(columnId)) throw new KanbanInvalidSourcePublicationError();
    const swimlaneId =
      grouping === undefined
        ? undefined
        : resolveGroupedSwimlane(card, grouping, swimlaneIds, options.sourceOptions.observe);
    const address: KanbanCellAddress = Object.freeze(
      swimlaneId === undefined ? { columnId } : { columnId, swimlaneId },
    );
    const addressKey = canonicalizeKanbanCellAddress(address);
    let authoritativeCell = authoritativeCells.get(addressKey);
    if (authoritativeCell === undefined) {
      authoritativeCell = [];
      authoritativeCells.set(addressKey, authoritativeCell);
      cells.set(addressKey, []);
      addresses.set(addressKey, address);
    }
    authoritativeCell.push(card);
    authoritativeColumns.get(columnId)?.push(card);
    if (swimlaneId !== undefined) authoritativeSwimlanes.get(swimlaneId)?.push(card);
    let matchesSearch = true;
    if (options.query.search !== undefined && options.query.search.length > 0) {
      const search = options.sourceOptions.search;
      if (search === undefined) throw new KanbanInvalidSourcePublicationError();
      const result = search(card, options.query.search);
      if (typeof result !== 'boolean') throw new KanbanInvalidSourcePublicationError();
      matchesSearch = result;
    }
    const matchesFilters = (options.query.filters ?? []).every((filter) => {
      const field = filterFields.get(filter.fieldId);
      const operator = field?.operators.find((candidate) => candidate.operatorId === filter.operatorId);
      if (operator === undefined) throw new KanbanInvalidSourcePublicationError();
      const result = operator.matches(card, filter.value);
      if (typeof result !== 'boolean') throw new KanbanInvalidSourcePublicationError();
      return result;
    });
    if (!matchesSearch || !matchesFilters) continue;
    matching += 1;
    loadedColumns.get(columnId)?.push(card);
    if (swimlaneId !== undefined) loadedSwimlanes.get(swimlaneId)?.push(card);
    const cell = cells.get(addressKey);
    if (cell === undefined) throw new KanbanInvalidSourcePublicationError();
    cell.push({ card, key, sourceIndex });
  }

  const publishedCells = new Map<string, readonly TCard[]>();
  const publishedCellKeys = new Map<string, readonly CardKey[]>();
  const entries = new Map<CardKey, EagerKanbanCardEntry<TCard>>();
  const summaries = new Map<string, Readonly<Record<string, KanbanNumericSummary>>>();
  const cellTotals = new Map<string, number>();
  for (const [addressKey, authoritative] of authoritativeCells) {
    const indexedCards = cells.get(addressKey);
    if (indexedCards === undefined) throw new KanbanInvalidSourcePublicationError();
    indexedCards.sort((left, right) =>
      compareCards(left, right, options.query, sortFields, options.sourceOptions.compare),
    );
    const published = Object.freeze(indexedCards.map((entry) => entry.card));
    publishedCells.set(addressKey, published);
    publishedCellKeys.set(addressKey, Object.freeze(indexedCards.map((entry) => entry.key)));
    for (const [index, entry] of indexedCards.entries()) {
      const address = addresses.get(addressKey);
      if (address === undefined) throw new KanbanInvalidSourcePublicationError();
      entries.set(
        entry.key,
        Object.freeze({ card: entry.card, key: entry.key, address: Object.freeze(address), index }),
      );
    }
    cellTotals.set(addressKey, authoritative.length);
    summaries.set(addressKey, aggregateSummaries(authoritative, published, summaryAdapters));
  }

  const columnSummaries = new Map<KanbanColumnId, Readonly<Record<string, KanbanNumericSummary>>>();
  for (const column of columns) {
    columnSummaries.set(
      column.columnId,
      aggregateSummaries(
        authoritativeColumns.get(column.columnId) ?? [],
        loadedColumns.get(column.columnId) ?? [],
        summaryAdapters,
      ),
    );
  }
  const swimlaneSummaries = new Map<KanbanSwimlaneId, Readonly<Record<string, KanbanNumericSummary>>>();
  for (const swimlane of swimlanes) {
    swimlaneSummaries.set(
      swimlane.swimlaneId,
      aggregateSummaries(
        authoritativeSwimlanes.get(swimlane.swimlaneId) ?? [],
        loadedSwimlanes.get(swimlane.swimlaneId) ?? [],
        summaryAdapters,
      ),
    );
  }

  return Object.freeze({
    revision: options.revision,
    columns,
    swimlanes,
    grouped: grouping !== undefined,
    cells: publishedCells,
    cellKeys: publishedCellKeys,
    cellTotals,
    entries,
    authoritativeKeys: new Set(seenKeys),
    total: cards.length,
    matching,
    summaries,
    columnSummaries,
    swimlaneSummaries,
    allocationCounts: Object.freeze({
      addresses: addresses.size,
      matchingCellBuckets: cells.size,
      authoritativeCellBuckets: authoritativeCells.size,
    }),
  });
}

/** Public eager-source factory type retained here to keep generic inference discoverable. */
export type EagerKanbanDataSource<TCard> = KanbanDataSource<TCard>;

/** Conservative maximum eager card count used by the default resource class. */
export const EAGER_KANBAN_SAFE_CARD_LIMIT = KANBAN_LIMITS.selectedKeys.safe;
