import { snapshotKanbanDataProperties, validateKanbanDataKeys } from '../contract/data-snapshot.js';
import { KanbanInvalidSourcePublicationError } from '../contract/error.js';

/** A count whose authority and completeness are explicit. */
export type KanbanCount =
  | { readonly quality: 'unknown' }
  | {
      readonly quality: 'exact' | 'estimated' | 'truncated';
      readonly value: number;
    };

/** Board-wide counts published atomically by one query session. */
export interface KanbanBoardCounts {
  /** Authoritative cards before local query projection. */
  readonly total: KanbanCount;
  /** Cards matching the active semantic query. */
  readonly matching: KanbanCount;
  /** Matching cards currently resident in memory. */
  readonly loaded: KanbanCount;
  /** Cards currently projected into the viewport. */
  readonly visible: KanbanCount;
  /** Application-selected cards when that count is known. */
  readonly selected: KanbanCount;
  /** Authoritative work-in-progress count when supplied by the application. */
  readonly wip: KanbanCount;
}

/** Counts scoped to one column/swimlane cell cursor. */
export interface KanbanCellCounts {
  /** Authoritative cards assigned to the cell before local filtering. */
  readonly total: KanbanCount;
  /** Cards in the cell that match the active query. */
  readonly matching: KanbanCount;
  /** Matching cards from the cell that are currently resident. */
  readonly loaded: KanbanCount;
}

/** Exact accepted members of a single count value. */
const COUNT_KEYS = new Set(['quality', 'value']);
/** Exact accepted members of a board count publication. */
const BOARD_COUNT_KEYS = new Set(['total', 'matching', 'loaded', 'visible', 'selected', 'wip']);
/** Exact accepted members of a cell count publication. */
const CELL_COUNT_KEYS = new Set(['total', 'matching', 'loaded']);

/** Converts any unsafe boundary failure to the public source-publication error. */
function invalidPublication(): never {
  throw new KanbanInvalidSourcePublicationError();
}

/** Returns true for a finite non-negative safe integer count. */
function isKnownCountValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Validates, detaches, and freezes one count without converting unknown authority to zero.
 *
 * @example
 * ```ts
 * const total = snapshotKanbanCount({ quality: 'unknown' });
 * ```
 */
export function snapshotKanbanCount(value: unknown): KanbanCount {
  try {
    const properties = snapshotKanbanDataProperties(value, COUNT_KEYS.size);
    validateKanbanDataKeys(properties, COUNT_KEYS);
    const quality = properties.quality;
    if (quality === 'unknown') {
      if (Object.keys(properties).length !== 1) return invalidPublication();
      return Object.freeze({ quality });
    }
    if (
      (quality !== 'exact' && quality !== 'estimated' && quality !== 'truncated') ||
      Object.keys(properties).length !== 2 ||
      !isKnownCountValue(properties.value)
    ) {
      return invalidPublication();
    }
    return Object.freeze({ quality, value: properties.value });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates and freezes a complete board-count publication atomically. */
export function snapshotKanbanBoardCounts(value: unknown): KanbanBoardCounts {
  try {
    const properties = snapshotKanbanDataProperties(value, BOARD_COUNT_KEYS.size);
    validateKanbanDataKeys(properties, BOARD_COUNT_KEYS);
    if (Object.keys(properties).length !== BOARD_COUNT_KEYS.size) return invalidPublication();
    return Object.freeze({
      total: snapshotKanbanCount(properties.total),
      matching: snapshotKanbanCount(properties.matching),
      loaded: snapshotKanbanCount(properties.loaded),
      visible: snapshotKanbanCount(properties.visible),
      selected: snapshotKanbanCount(properties.selected),
      wip: snapshotKanbanCount(properties.wip),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}

/** Validates and freezes a complete cell-count publication atomically. */
export function snapshotKanbanCellCounts(value: unknown): KanbanCellCounts {
  try {
    const properties = snapshotKanbanDataProperties(value, CELL_COUNT_KEYS.size);
    validateKanbanDataKeys(properties, CELL_COUNT_KEYS);
    if (Object.keys(properties).length !== CELL_COUNT_KEYS.size) return invalidPublication();
    return Object.freeze({
      total: snapshotKanbanCount(properties.total),
      matching: snapshotKanbanCount(properties.matching),
      loaded: snapshotKanbanCount(properties.loaded),
    });
  } catch (error) {
    if (error instanceof KanbanInvalidSourcePublicationError) throw error;
    return invalidPublication();
  }
}
