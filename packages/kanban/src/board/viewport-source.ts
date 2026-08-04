import { KanbanInvalidGeometryError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import { createKanbanColumnId } from '../contract/identity.js';
import { validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanLimitOptions, KanbanResolvedLimits } from '../contract/limits.js';
import type { KanbanObservation } from '../contract/observation.js';
import type { KanbanCardAdapter } from '../card/adapter.js';
import type { KanbanViewportMode, KanbanVisibleCardRange } from '../layout/metrics.js';
import { solveKanbanColumnWidths } from '../layout/width-solver.js';
import type { KanbanColumnWidthSolution } from '../layout/width-solver.js';
import { canonicalizeKanbanCellAddress } from '../source/address.js';
import { KanbanCursorCoordinator } from '../source/cursor-coordinator.js';
import { KanbanSessionCoordinator } from '../source/session-coordinator.js';
import type { KanbanCursorRetentionOwner } from '../source/session-coordinator.js';
import type { KanbanCellState } from '../source/states.js';
import type {
  KanbanCellAddress,
  KanbanColumnMeta,
  KanbanDataSource,
  KanbanQuery,
  KanbanSessionPublication,
} from '../source/types.js';
import { snapshotKanbanQuery } from '../source/validation.js';

/** Finite projection retained around the visible terminal cells. */
export interface KanbanOverscanOptions {
  /** Extra viewport-height card window retained below and, when available, above the visible range. */
  readonly vertical?: number;
  /** Extra source-ordered columns retained on each horizontal side. */
  readonly horizontal?: number;
}

/** Exact geometry and semantic filters used to refresh one viewport source projection. */
export interface KanbanViewportSourceRequest {
  /** Current parent-assigned width in terminal cells. */
  readonly width: number;
  /** Current parent-assigned height in terminal cells. */
  readonly height: number;
  /** Current horizontal content offset. */
  readonly horizontalOffset: number;
  /** Current vertical card-content offset. */
  readonly verticalOffset: number;
  /** Preferred source column when responsive geometry enters focused mode. */
  readonly focusedColumnId?: string;
  /** Workflow columns excluded before any sparse cursor is opened. */
  readonly collapsedColumnIds?: readonly string[];
}

/** Safe retained state for one sparse source cell. */
export interface KanbanViewportSourceCell<TCard> {
  /** Canonical semantic address. */
  readonly address: KanbanCellAddress;
  /** Current validated cell lifecycle state. */
  readonly state: KanbanCellState;
  /** Bounded visible-plus-overscan range requested from the source. */
  readonly range: KanbanVisibleCardRange;
  /** Guarded reader used by later descriptor projection without exposing the application cursor. */
  readonly cursor: KanbanCursorCoordinator<TCard>;
}

/** Immutable source and width projection consumed by the mounted viewport. */
export interface KanbanViewportSourceSnapshot<TCard> {
  /** Atomic validated session publication. */
  readonly publication: KanbanSessionPublication;
  /** Active responsive presentation mode. */
  readonly mode: KanbanViewportMode;
  /** Complete width solution for the filtered source columns. */
  readonly widths: KanbanColumnWidthSolution;
  /** Columns that intersect the visible horizontal rectangle, excluding overscan-only columns. */
  readonly visibleColumns: readonly KanbanColumnMeta[];
  /** Sparse cells retained for visible and finite horizontal overscan columns. */
  readonly cells: readonly KanbanViewportSourceCell<TCard>[];
  /** Current coordinator generation used to reject stale asynchronous work. */
  readonly generation: number;
}

/** Construction input for the viewport-owned source boundary. */
export interface KanbanViewportSourceOptions<TCard> {
  /** Application-owned source. */
  readonly source: KanbanDataSource<TCard>;
  /** Initial semantic query. */
  readonly query: KanbanQuery;
  /** Stable card adapter used for identity reads after a range becomes resident. */
  readonly card: KanbanCardAdapter<TCard>;
  /** Optional lower resource limits. */
  readonly limits?: KanbanLimitOptions;
  /** Optional finite projection expansion. */
  readonly overscan?: KanbanOverscanOptions;
  /** Optional already-redacted diagnostic sink. */
  readonly observe?: (observation: KanbanObservation) => void;
  /** Called after current asynchronous acquisition settles. */
  readonly invalidate?: () => void;
}

/** One retained guarded cursor and the owner used to release it. */
interface RetainedCell<TCard> {
  readonly address: KanbanCellAddress;
  readonly owner: KanbanCursorRetentionOwner;
  readonly cursor: KanbanCursorCoordinator<TCard>;
}

/** Validates one terminal-cell count without coercion. */
function cellCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new KanbanInvalidGeometryError();
  return value;
}

/** Validates a configured overscan value against its selected resource class. */
function overscanValue(value: number | undefined, fallback: number, maximum: number): number {
  const candidate = value ?? fallback;
  if (!Number.isSafeInteger(candidate) || candidate < 0 || candidate > maximum) {
    throw new KanbanInvalidGeometryError();
  }
  return candidate;
}

/** Produces a stable comparison key from a validated query snapshot. */
function queryKey(query: KanbanQuery): string {
  return JSON.stringify(query);
}

/** Returns source columns admitted by query visibility and viewport collapse configuration. */
function filteredColumns(
  publication: KanbanSessionPublication,
  query: KanbanQuery,
  collapsedColumnIds: readonly string[] | undefined,
  limits: KanbanResolvedLimits,
): readonly KanbanColumnMeta[] {
  const queryVisible = query.visibleColumnIds === undefined ? undefined : new Set(query.visibleColumnIds);
  const collapsed = new Set<string>();
  for (const rawId of collapsedColumnIds ?? []) {
    if (collapsed.size >= limits.columns) throw new KanbanInvalidGeometryError();
    collapsed.add(createKanbanColumnId(rawId));
  }
  return Object.freeze(
    publication.columns.filter(
      (column) => (queryVisible === undefined || queryVisible.has(column.columnId)) && !collapsed.has(column.columnId),
    ),
  );
}

/** Computes visible and retained column indexes without enumerating card length. */
function retainedColumnIndexes(
  widths: KanbanColumnWidthSolution,
  offset: number,
  viewportWidth: number,
  horizontalOverscan: number,
): { readonly visible: readonly number[]; readonly retained: readonly number[] } {
  if (widths.columns.length === 0) return Object.freeze({ visible: Object.freeze([]), retained: Object.freeze([]) });
  if (widths.mode === 'focused-column') {
    return Object.freeze({ visible: Object.freeze([0]), retained: Object.freeze([0]) });
  }

  const right = Math.min(Number.MAX_SAFE_INTEGER, offset + viewportWidth);
  const visible: number[] = [];
  let x = 0;
  for (let index = 0; index < widths.columns.length; index += 1) {
    const column = widths.columns[index];
    if (column === undefined) throw new KanbanInvalidGeometryError();
    const columnRight = x + column.width;
    if (columnRight > offset && x < right) visible.push(index);
    x = columnRight + (index + 1 < widths.columns.length ? widths.separatorWidth : 0);
  }
  if (visible.length === 0) visible.push(offset >= widths.contentWidth ? widths.columns.length - 1 : 0);
  const first = visible[0];
  const last = visible.at(-1);
  if (first === undefined || last === undefined) throw new KanbanInvalidGeometryError();
  const retained: number[] = [];
  for (
    let index = Math.max(0, first - horizontalOverscan);
    index <= Math.min(widths.columns.length - 1, last + horizontalOverscan);
    index += 1
  ) {
    retained.push(index);
  }
  return Object.freeze({ visible: Object.freeze(visible), retained: Object.freeze(retained) });
}

/**
 * Owns the single query/session/cursor lifecycle of one standalone viewport.
 *
 * Query replacement increments the session generation before cancellation. Cursor acquisition is
 * derived solely from current terminal geometry and finite overscan; logical card length is never
 * scanned to discover the visible window.
 */
export class KanbanViewportSource<TCard> {
  readonly #card: KanbanCardAdapter<TCard>;
  readonly #limits: KanbanResolvedLimits;
  readonly #verticalOverscan: number;
  readonly #horizontalOverscan: number;
  readonly #observe: ((observation: KanbanObservation) => void) | undefined;
  readonly #invalidate: (() => void) | undefined;
  readonly #session: KanbanSessionCoordinator<TCard>;
  readonly #cells = new Map<string, RetainedCell<TCard>>();
  #query: KanbanQuery;
  #queryKey: string;
  #disposed = false;

  /** Validates configuration and synchronously opens exactly one initial query session. */
  constructor(options: KanbanViewportSourceOptions<TCard>) {
    this.#limits = validateKanbanLimitOptions(options.limits);
    this.#verticalOverscan = overscanValue(
      options.overscan?.vertical,
      this.#limits.verticalOverscan,
      this.#limits.verticalOverscan,
    );
    this.#horizontalOverscan = overscanValue(
      options.overscan?.horizontal,
      this.#limits.horizontalOverscan,
      this.#limits.horizontalOverscan,
    );
    this.#card = options.card;
    this.#observe = options.observe;
    this.#invalidate = options.invalidate;
    this.#query = snapshotKanbanQuery(options.query);
    this.#queryKey = queryKey(this.#query);
    this.#session = new KanbanSessionCoordinator({
      source: options.source,
      initialQuery: this.#query,
      maximumRetainedCursors: this.#limits.retainedCursors,
      observe: options.observe,
    });
  }

  /** Replaces the semantic query only when its detached value changed. */
  replaceQuery(query: KanbanQuery): void {
    const snapshot = snapshotKanbanQuery(query);
    const key = queryKey(snapshot);
    if (key === this.#queryKey) return;
    this.#releaseAllCells();
    this.#session.replaceQuery(snapshot);
    this.#query = snapshot;
    this.#queryKey = key;
  }

  /**
   * Refreshes the visible projection and starts only bounded current-generation range acquisitions.
   */
  refresh(request: KanbanViewportSourceRequest): KanbanViewportSourceSnapshot<TCard> {
    if (this.#disposed) throw new KanbanInvalidSourcePublicationError();
    const width = cellCount(request.width);
    const height = cellCount(request.height);
    const horizontalOffset = cellCount(request.horizontalOffset);
    const verticalOffset = cellCount(request.verticalOffset);
    const publication = this.#session.snapshot();
    const columns = filteredColumns(publication, this.#query, request.collapsedColumnIds, this.#limits);
    const widths = solveKanbanColumnWidths({
      availableWidth: width,
      columns: columns.map((column) => ({ columnId: column.columnId })),
      ...(request.focusedColumnId === undefined ? {} : { focusedColumnId: request.focusedColumnId }),
    });
    const indexes = retainedColumnIndexes(widths, horizontalOffset, width, this.#horizontalOverscan);
    const visibleColumns = Object.freeze(
      indexes.visible.flatMap((index) => {
        const solved = widths.columns[index];
        if (solved === undefined) return [];
        const column = columns.find((candidate) => candidate.columnId === solved.columnId);
        return column === undefined ? [] : [column];
      }),
    );
    const retainedAddresses = indexes.retained.flatMap((index) => {
      const solved = widths.columns[index];
      return solved === undefined ? [] : [Object.freeze({ columnId: solved.columnId })];
    });
    this.#reconcileCells(retainedAddresses, new Set(indexes.visible.map((index) => widths.columns[index]?.columnId)));

    const visibleRows = Math.max(1, height - 1);
    const cardsPerViewport = Math.max(1, Math.ceil(visibleRows / 3));
    const firstVisibleCard = Math.floor(verticalOffset / 3);
    const overscanCards = cardsPerViewport * this.#verticalOverscan;
    const rangeStart = Math.max(0, firstVisibleCard - overscanCards);
    const requestedCards = Math.min(this.#limits.ensureRangeCards, cardsPerViewport + overscanCards * 2);
    const generation = this.#session.generation();
    const cells: KanbanViewportSourceCell<TCard>[] = [];
    for (const address of retainedAddresses) {
      const retained = this.#cells.get(canonicalizeKanbanCellAddress(address));
      if (retained === undefined) continue;
      const knownLength = retained.cursor.length();
      const rangeEnd =
        knownLength.kind === 'exact'
          ? Math.min(knownLength.value, rangeStart + requestedCards)
          : rangeStart + requestedCards;
      const range = Object.freeze({ address, start: Math.min(rangeStart, rangeEnd), end: rangeEnd });
      const state = retained.cursor.state();
      if (state.kind !== 'error' && retained.cursor.needsRange(range.start, range.end)) {
        void retained.cursor.ensureRange(range.start, range.end).then(
          () => {
            if (this.#session.isCurrent(generation)) this.#invalidate?.();
          },
          () => {
            if (this.#session.isCurrent(generation)) this.#invalidate?.();
          },
        );
        retained.cursor.flushPending();
      }
      cells.push(Object.freeze({ address, state, range, cursor: retained.cursor }));
    }

    return Object.freeze({
      publication,
      mode: widths.mode,
      widths,
      visibleColumns,
      cells: Object.freeze(cells),
      generation,
    });
  }

  /** Delegates one bounded optional locator call to the current session generation. */
  locateCard(key: Parameters<KanbanSessionCoordinator<TCard>['locateCard']>[0], signal?: AbortSignal) {
    return this.#session.locateCard(key, signal === undefined ? undefined : { signal });
  }

  /** Invalidates pending work and releases cursors before the owned session, idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#releaseAllCells();
    this.#session.dispose();
  }

  /** Reconciles guarded cursor wrappers against the already-filtered retained address set. */
  #reconcileCells(addresses: readonly KanbanCellAddress[], visibleIds: ReadonlySet<string | undefined>): void {
    const wanted = new Map(addresses.map((address) => [canonicalizeKanbanCellAddress(address), address]));
    for (const [key, retained] of [...this.#cells]) {
      if (wanted.has(key)) continue;
      retained.cursor.dispose();
      this.#session.releaseCursor(retained.address, retained.owner);
      this.#cells.delete(key);
    }
    for (const [key, address] of wanted) {
      const owner: KanbanCursorRetentionOwner = visibleIds.has(address.columnId) ? 'visible' : 'overscan';
      const existing = this.#cells.get(key);
      if (existing !== undefined && existing.owner === owner) continue;
      if (existing !== undefined) {
        existing.cursor.dispose();
        this.#session.releaseCursor(existing.address, existing.owner);
      }
      const cursor = this.#session.retainCursor(address, owner);
      this.#cells.set(
        key,
        Object.freeze({
          address,
          owner,
          cursor: new KanbanCursorCoordinator({
            cursor,
            address,
            keyOf: (card) => this.#card.keyOf(card),
            limits: { class: 'advanced', values: this.#limits },
            observe: this.#observe,
          }),
        }),
      );
    }
  }

  /** Releases every guarded wrapper before asking the session coordinator to release raw cursors. */
  #releaseAllCells(): void {
    for (const retained of this.#cells.values()) {
      retained.cursor.dispose();
      this.#session.releaseCursor(retained.address, retained.owner);
    }
    this.#cells.clear();
  }
}
