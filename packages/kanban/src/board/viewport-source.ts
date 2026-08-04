import { KanbanInvalidGeometryError, KanbanInvalidSourcePublicationError } from '../contract/error.js';
import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { createKanbanColumnId } from '../contract/identity.js';
import { KANBAN_LIMITS, validateKanbanLimitOptions } from '../contract/limits.js';
import type { KanbanLimitOptions, KanbanResolvedLimits } from '../contract/limits.js';
import type { KanbanObservation } from '../contract/observation.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
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

/** Preliminary row-axis aggregate used without opening preceding semantic cells. */
export interface KanbanSceneWindowLayoutRow {
  /** First included semantic swimlane index covered by this aggregate. */
  readonly start: number;
  /** First excluded semantic swimlane index covered by this aggregate. */
  readonly end: number;
  /** Aggregate terminal rows occupied by the covered semantic range. */
  readonly extent: number;
  /** Honest completeness of the aggregate row extent. */
  readonly quality: 'exact' | 'lower-bound' | 'unknown';
}

/** Revision-bound aggregate hint used by preliminary scene-window projection. */
export interface KanbanSceneWindowLayoutHint {
  /** Query generation that owns the hint. */
  readonly queryGeneration: number;
  /** Query-session revision that owns the hint. */
  readonly sessionRevision: KanbanRevision;
  /** Source-ordered bounded aggregate row spans. */
  readonly rows: readonly KanbanSceneWindowLayoutRow[];
}

/** Preliminary column plus logical swimlane-index coordinate. */
export interface KanbanSceneWindowCell {
  /** Stable visible workflow-column identity. */
  readonly columnId: string;
  /** Source-ordered semantic swimlane index resolved to identity by the owning publication. */
  readonly swimlaneIndex: number;
}

/** Inputs for bounded preliminary visible/overscan cell selection. */
export interface ResolveKanbanSceneWindowOptions {
  /** Active query generation. */
  readonly queryGeneration: number;
  /** Active query-session revision. */
  readonly sessionRevision: KanbanRevision;
  /** Requested half-open semantic swimlane range. */
  readonly requestedSwimlaneRange: { readonly start: number; readonly end: number };
  /** Source-ordered workflow columns intersecting the horizontal projection. */
  readonly visibleColumnIds: readonly string[];
  /** Finite semantic row/column overscan. */
  readonly overscan: { readonly rows: number; readonly columns: number };
  /** Optional compatible aggregate row-layout evidence. */
  readonly layoutHint?: KanbanSceneWindowLayoutHint;
  /** Called once for each completed preliminary cell selection. */
  readonly openCell: (cell: KanbanSceneWindowCell) => void;
}

/** Honest preliminary row projection outcome. */
export type KanbanSceneWindowResult =
  | {
      readonly kind: 'available';
      readonly requestedCells: readonly KanbanSceneWindowCell[];
      readonly range: { readonly start: number; readonly end: number };
      readonly quality: 'known' | 'hinted';
    }
  | {
      readonly kind: 'unavailable';
      readonly code: 'distant-layout-unknown' | 'retention-limit' | 'cell-open-failed';
      readonly retryable: boolean;
    };

/** Exact accepted top-level preliminary scene-window members. */
const SCENE_WINDOW_KEYS = new Set([
  'queryGeneration',
  'sessionRevision',
  'requestedSwimlaneRange',
  'visibleColumnIds',
  'overscan',
  'layoutHint',
  'openCell',
]);
/** Exact half-open range members. */
const SCENE_WINDOW_RANGE_KEYS = new Set(['start', 'end']);
/** Exact overscan members. */
const SCENE_WINDOW_OVERSCAN_KEYS = new Set(['rows', 'columns']);
/** Exact aggregate hint members. */
const SCENE_WINDOW_HINT_KEYS = new Set(['queryGeneration', 'sessionRevision', 'rows']);
/** Exact aggregate row members. */
const SCENE_WINDOW_ROW_KEYS = new Set(['start', 'end', 'extent', 'quality']);

/** Validates one non-negative safe scene-window integer. */
function sceneWindowInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Snapshots one exact half-open scene-window range. */
function sceneWindowRange(value: unknown): { readonly start: number; readonly end: number } {
  const properties = snapshotKanbanDataProperties(value, SCENE_WINDOW_RANGE_KEYS.size);
  validateKanbanDataKeys(properties, SCENE_WINDOW_RANGE_KEYS);
  if (Object.keys(properties).length !== SCENE_WINDOW_RANGE_KEYS.size) throw new KanbanInvalidGeometryError();
  const start = sceneWindowInteger(properties.start);
  const end = sceneWindowInteger(properties.end);
  if (end < start || end - start > KANBAN_LIMITS.swimlanes.safe) throw new KanbanInvalidGeometryError();
  return Object.freeze({ start, end });
}

/** Snapshots and validates one optional aggregate row-layout hint. */
function sceneWindowHint(value: unknown): KanbanSceneWindowLayoutHint {
  const properties = snapshotKanbanDataProperties(value, SCENE_WINDOW_HINT_KEYS.size);
  validateKanbanDataKeys(properties, SCENE_WINDOW_HINT_KEYS);
  if (Object.keys(properties).length !== SCENE_WINDOW_HINT_KEYS.size) throw new KanbanInvalidGeometryError();
  const rows = snapshotKanbanDataArray(properties.rows, KANBAN_LIMITS.swimlanes.safe).map((row) => {
    const rowProperties = snapshotKanbanDataProperties(row, SCENE_WINDOW_ROW_KEYS.size);
    validateKanbanDataKeys(rowProperties, SCENE_WINDOW_ROW_KEYS);
    if (Object.keys(rowProperties).length !== SCENE_WINDOW_ROW_KEYS.size) throw new KanbanInvalidGeometryError();
    const start = sceneWindowInteger(rowProperties.start);
    const end = sceneWindowInteger(rowProperties.end);
    const extent = sceneWindowInteger(rowProperties.extent);
    if (
      end <= start ||
      (rowProperties.quality !== 'exact' &&
        rowProperties.quality !== 'lower-bound' &&
        rowProperties.quality !== 'unknown')
    ) {
      throw new KanbanInvalidGeometryError();
    }
    return Object.freeze({ start, end, extent, quality: rowProperties.quality });
  });
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index - 1]!.end > rows[index]!.start) throw new KanbanInvalidGeometryError();
  }
  return Object.freeze({
    queryGeneration: sceneWindowInteger(properties.queryGeneration),
    sessionRevision: snapshotKanbanRevision(properties.sessionRevision),
    rows: Object.freeze(rows),
  });
}

/** Returns whether aggregate hint spans cover a requested semantic row window. */
function hintCovers(
  rows: readonly KanbanSceneWindowLayoutRow[],
  range: { readonly start: number; readonly end: number },
): boolean {
  let coveredUntil = range.start;
  for (const row of rows) {
    if (row.end <= coveredUntil) continue;
    if (row.start > coveredUntil) return false;
    coveredUntil = Math.max(coveredUntil, row.end);
    if (coveredUntil >= range.end) return true;
  }
  return coveredUntil >= range.end;
}

/**
 * Resolves a bounded preliminary semantic cell window without enumerating preceding rows.
 *
 * A request beginning at row zero is locally known. Distant requests require revision-compatible
 * aggregate hint coverage; otherwise the caller receives an explicit retryable unavailable result.
 *
 * @example
 * ```ts
 * const result = resolveKanbanSceneWindow({
 *   queryGeneration: 1,
 *   sessionRevision: 'session-v1',
 *   requestedSwimlaneRange: { start: 0, end: 2 },
 *   visibleColumnIds: ['ready'],
 *   overscan: { rows: 1, columns: 0 },
 *   openCell: () => {},
 * });
 * ```
 */
export function resolveKanbanSceneWindow(options: ResolveKanbanSceneWindowOptions): KanbanSceneWindowResult {
  try {
    const properties = snapshotKanbanDataProperties(options, SCENE_WINDOW_KEYS.size);
    validateKanbanDataKeys(properties, SCENE_WINDOW_KEYS);
    if (Object.keys(properties).length < SCENE_WINDOW_KEYS.size - 1 || typeof properties.openCell !== 'function') {
      throw new KanbanInvalidGeometryError();
    }
    const queryGeneration = sceneWindowInteger(properties.queryGeneration);
    const sessionRevision = snapshotKanbanRevision(properties.sessionRevision);
    const requested = sceneWindowRange(properties.requestedSwimlaneRange);
    const overscanProperties = snapshotKanbanDataProperties(properties.overscan, SCENE_WINDOW_OVERSCAN_KEYS.size);
    validateKanbanDataKeys(overscanProperties, SCENE_WINDOW_OVERSCAN_KEYS);
    if (Object.keys(overscanProperties).length !== SCENE_WINDOW_OVERSCAN_KEYS.size) {
      throw new KanbanInvalidGeometryError();
    }
    const overscanRows = sceneWindowInteger(overscanProperties.rows, KANBAN_LIMITS.verticalOverscan.absolute);
    sceneWindowInteger(overscanProperties.columns, KANBAN_LIMITS.horizontalOverscan.absolute);
    const visibleColumnIds = Object.freeze(
      snapshotKanbanDataArray(properties.visibleColumnIds, KANBAN_LIMITS.columns.safe).map((value) => {
        if (typeof value !== 'string') throw new KanbanInvalidGeometryError();
        return createKanbanColumnId(value);
      }),
    );
    if (new Set(visibleColumnIds).size !== visibleColumnIds.length) throw new KanbanInvalidGeometryError();
    const range = Object.freeze({
      start: Math.max(0, requested.start - overscanRows),
      end: Math.min(Number.MAX_SAFE_INTEGER, requested.end + overscanRows),
    });
    const hint = properties.layoutHint === undefined ? undefined : sceneWindowHint(properties.layoutHint);
    const compatibleHint =
      hint !== undefined &&
      hint.queryGeneration === queryGeneration &&
      hint.sessionRevision === sessionRevision &&
      hintCovers(hint.rows, range);
    if (range.start > 0 && !compatibleHint) {
      return Object.freeze({ kind: 'unavailable', code: 'distant-layout-unknown', retryable: true });
    }
    const demand = (range.end - range.start) * visibleColumnIds.length;
    if (!Number.isSafeInteger(demand) || demand > KANBAN_LIMITS.retainedCursors.safe) {
      return Object.freeze({ kind: 'unavailable', code: 'retention-limit', retryable: false });
    }
    const cells: KanbanSceneWindowCell[] = [];
    for (let swimlaneIndex = range.start; swimlaneIndex < range.end; swimlaneIndex += 1) {
      for (const columnId of visibleColumnIds) cells.push(Object.freeze({ columnId, swimlaneIndex }));
    }
    try {
      for (const cell of cells) properties.openCell(cell);
    } catch {
      return Object.freeze({ kind: 'unavailable', code: 'cell-open-failed', retryable: true });
    }
    return Object.freeze({
      kind: 'available',
      requestedCells: Object.freeze(cells),
      range,
      quality: compatibleHint ? 'hinted' : 'known',
    });
  } catch (error) {
    if (error instanceof KanbanInvalidGeometryError) throw error;
    throw new KanbanInvalidGeometryError();
  }
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
  /** Conservative terminal-row stride used to translate offsets into bounded source ranges. */
  readonly cardStride: number;
  /** Preferred source column when responsive geometry enters focused mode. */
  readonly focusedColumnId?: string;
  /** Workflow columns excluded before any sparse cursor is opened. */
  readonly collapsedColumnIds?: readonly string[];
  /** Optional revision-bound aggregate row evidence for a grouped distant projection. */
  readonly sceneWindowLayoutHint?: KanbanSceneWindowLayoutHint;
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
  /** Honest grouped row-window availability; omitted for an ungrouped query. */
  readonly sceneWindow?: KanbanSceneWindowResult;
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
  /** Disposes address-owned descriptor scopes before the corresponding source cursor. */
  readonly beforeCursorDispose?: (address: KanbanCellAddress) => void;
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
  readonly #beforeCursorDispose: ((address: KanbanCellAddress) => void) | undefined;
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
    this.#beforeCursorDispose = options.beforeCursorDispose;
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
    this.#session.cancelPendingWork();
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
    const cardStride = cellCount(request.cardStride);
    if (cardStride === 0) throw new KanbanInvalidGeometryError();
    const publication = this.#session.snapshot();
    const columns = filteredColumns(publication, this.#query, request.collapsedColumnIds, this.#limits);
    const focusedColumnId = columns.some((column) => column.columnId === request.focusedColumnId)
      ? request.focusedColumnId
      : undefined;
    const widths = solveKanbanColumnWidths({
      availableWidth: width,
      columns: columns.map((column) => ({ columnId: column.columnId })),
      ...(focusedColumnId === undefined ? {} : { focusedColumnId }),
    });
    if (width < 18 || height < 4) {
      this.#reconcileCells([], new Set());
      return Object.freeze({
        publication,
        mode: 'minimum-size',
        widths,
        visibleColumns: Object.freeze([]),
        cells: Object.freeze([]),
        generation: this.#session.generation(),
      });
    }
    const indexes = retainedColumnIndexes(widths, horizontalOffset, width, this.#horizontalOverscan);
    const visibleColumns = Object.freeze(
      indexes.visible.flatMap((index) => {
        const solved = widths.columns[index];
        if (solved === undefined) return [];
        const column = columns.find((candidate) => candidate.columnId === solved.columnId);
        return column === undefined ? [] : [column];
      }),
    );
    const retainedColumnIds = indexes.retained.flatMap((index) => {
      const solved = widths.columns[index];
      return solved === undefined ? [] : [solved.columnId];
    });
    let sceneWindow: KanbanSceneWindowResult | undefined;
    let retainedAddresses: readonly KanbanCellAddress[];
    if (this.#query.groupBy === undefined || publication.swimlanes.length === 0) {
      retainedAddresses = Object.freeze(retainedColumnIds.map((columnId) => Object.freeze({ columnId })));
    } else {
      const firstRequestedRow = Math.min(publication.swimlanes.length, Math.floor(verticalOffset / cardStride));
      const requestedRows = Math.max(1, Math.ceil(Math.max(1, height - 1) / cardStride));
      const lastRequestedRow = Math.min(publication.swimlanes.length, firstRequestedRow + requestedRows);
      const addresses: KanbanCellAddress[] = [];
      sceneWindow = resolveKanbanSceneWindow({
        queryGeneration: this.#session.generation(),
        sessionRevision: publication.revision,
        requestedSwimlaneRange: { start: firstRequestedRow, end: lastRequestedRow },
        visibleColumnIds: retainedColumnIds,
        overscan: { rows: this.#verticalOverscan, columns: this.#horizontalOverscan },
        ...(request.sceneWindowLayoutHint === undefined ? {} : { layoutHint: request.sceneWindowLayoutHint }),
        openCell: ({ columnId, swimlaneIndex }) => {
          const swimlane = publication.swimlanes[swimlaneIndex];
          if (swimlane !== undefined) {
            addresses.push(Object.freeze({ columnId, swimlaneId: swimlane.swimlaneId }));
          }
        },
      });
      retainedAddresses = Object.freeze(addresses);
    }
    this.#reconcileCells(retainedAddresses, new Set(indexes.visible.map((index) => widths.columns[index]?.columnId)));

    const visibleRows = Math.max(1, height - 1);
    const cardsPerViewport = Math.max(1, Math.ceil(visibleRows / cardStride));
    const firstVisibleCard = this.#query.groupBy === undefined ? Math.floor(verticalOffset / cardStride) : 0;
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
      ...(sceneWindow === undefined ? {} : { sceneWindow }),
    });
  }

  /** Delegates one bounded optional locator call to the current session generation. */
  locateCard(key: Parameters<KanbanSessionCoordinator<TCard>['locateCard']>[0], signal?: AbortSignal) {
    return this.#session.locateCard(key, signal === undefined ? undefined : { signal });
  }

  /** Invalidates source generations and aborts pending work before viewport-wide ordered release. */
  cancelPendingWork(): void {
    if (this.#disposed) return;
    this.#session.cancelPendingWork();
  }

  /** Invalidates pending work and releases cursors before the owned session, idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#session.cancelPendingWork();
    this.#releaseAllCells();
    this.#session.dispose();
  }

  /** Reconciles guarded cursor wrappers against the already-filtered retained address set. */
  #reconcileCells(addresses: readonly KanbanCellAddress[], visibleIds: ReadonlySet<string | undefined>): void {
    const wanted = new Map(addresses.map((address) => [canonicalizeKanbanCellAddress(address), address]));
    for (const [key, retained] of [...this.#cells]) {
      if (wanted.has(key)) continue;
      this.#session.releaseCursor(retained.address, retained.owner);
      this.#cells.delete(key);
    }
    for (const [key, address] of wanted) {
      const owner: KanbanCursorRetentionOwner = visibleIds.has(address.columnId) ? 'visible' : 'overscan';
      const existing = this.#cells.get(key);
      if (existing !== undefined && existing.owner === owner) continue;
      if (existing !== undefined) {
        this.#session.releaseCursor(existing.address, existing.owner);
      }
      const cursor = this.#session.retainCursor(address, owner);
      const guarded = new KanbanCursorCoordinator({
        cursor,
        address,
        keyOf: (card) => this.#card.keyOf(card),
        limits: { class: 'advanced', values: this.#limits },
        observe: this.#observe,
        ownsCursor: false,
      });
      if (this.#beforeCursorDispose !== undefined) {
        this.#session.registerCursorScope(address, () => this.#beforeCursorDispose?.(address));
      }
      this.#session.registerCursorScope(address, () => guarded.dispose());
      this.#cells.set(
        key,
        Object.freeze({
          address,
          owner,
          cursor: guarded,
        }),
      );
    }
  }

  /** Releases every cell through session-owned scope-before-cursor disposal. */
  #releaseAllCells(): void {
    for (const retained of this.#cells.values()) {
      this.#session.releaseCursor(retained.address, retained.owner);
    }
    this.#cells.clear();
  }
}
