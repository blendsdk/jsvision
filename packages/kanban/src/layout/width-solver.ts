import { KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanColumnId } from '../contract/identity.js';
import { KANBAN_LIMITS } from '../contract/limits.js';

/** Default minimum width of one Kanban column surface, excluding its separator. */
export const KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH = 18;

/** Default preferred width of one Kanban column surface, excluding its separator. */
export const KANBAN_DEFAULT_COLUMN_PREFERRED_WIDTH = 24;

/** Default maximum width of one Kanban column surface, excluding its separator. */
export const KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH = 32;

/** Width constraints supplied for one source-ordered workflow column. */
export interface KanbanColumnWidthInput {
  /** Stable application-owned column identity. */
  readonly columnId: string;
  /** Smallest configured surface width; defaults to 18 cells. */
  readonly minimumWidth?: number;
  /** Preferred surface width; defaults to 24 cells. */
  readonly preferredWidth?: number;
  /** Largest configured surface width; defaults to 32 cells. */
  readonly maximumWidth?: number;
  /** Minimum cells required for mandatory non-color chrome. */
  readonly chromeMinimumWidth?: number;
  /** Optional untrusted renderer measurement hint. Invalid hints are ignored. */
  readonly rendererMinimumHint?: number;
}

/** Final width assigned to one source-ordered column. */
export interface KanbanSolvedColumnWidth {
  /** Stable column identity. */
  readonly columnId: string;
  /** Assigned surface width, excluding the separator. */
  readonly width: number;
  /** Validated effective minimum used by the solver. */
  readonly minimumWidth: number;
  /** Validated preferred width used by the solver. */
  readonly preferredWidth: number;
  /** Validated maximum width used by the solver. */
  readonly maximumWidth: number;
}

/** One-row navigation metadata shown only in focused-column mode. */
export interface KanbanFocusedColumnNavigator {
  /** Fixed compact navigator height. */
  readonly rowCount: 1;
  /** Active source column. */
  readonly columnId: string;
  /** One-based position in the complete visible-column sequence. */
  readonly position: number;
  /** Complete number of visible columns. */
  readonly total: number;
  /** Whether a previous source-ordered column exists. */
  readonly previousEnabled: boolean;
  /** Whether a next source-ordered column exists. */
  readonly nextEnabled: boolean;
}

/** Immutable result of one pure responsive width solve. */
export interface KanbanColumnWidthSolution {
  /** Responsive presentation selected for the available cells. */
  readonly mode: 'multi-column' | 'focused-column';
  /** Validated width offered by the parent. */
  readonly availableWidth: number;
  /** Total column and separator width; it may exceed availability to represent horizontal overflow. */
  readonly contentWidth: number;
  /** Cells reserved between adjacent columns. */
  readonly separatorWidth: number;
  /** Source-ordered solved columns, or the single active column in focused mode. */
  readonly columns: readonly KanbanSolvedColumnWidth[];
  /** Columns that may participate in Phase A inspection and later interaction. */
  readonly interactiveColumnIds: readonly string[];
  /** Compact navigation state present only in focused-column mode. */
  readonly navigator?: KanbanFocusedColumnNavigator;
}

/** Inputs for the pure deterministic column-width solver. */
export interface SolveKanbanColumnWidthsOptions {
  /** Parent-assigned width in terminal cells. */
  readonly availableWidth: number;
  /** Source-ordered visible columns. */
  readonly columns: readonly KanbanColumnWidthInput[];
  /** Preferred active column when narrow geometry permits only one. */
  readonly focusedColumnId?: string;
  /** Cells between adjacent column surfaces; defaults to one. */
  readonly separatorWidth?: number;
}

/** Private validated mutable allocation used only during a single pure solve. */
interface MutableColumnWidth {
  readonly columnId: string;
  readonly minimumWidth: number;
  readonly preferredWidth: number;
  readonly maximumWidth: number;
  width: number;
}

/** Throws a payload-free geometry error when a value is not a non-negative safe cell count. */
function requireCellCount(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) throw new KanbanInvalidGeometryError();
}

/** Adds non-negative safe counts without allowing integer overflow. */
function addCells(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < left) throw new KanbanInvalidGeometryError();
  return result;
}

/** Reads one own data property without invoking a caller-owned accessor. */
function ownValue(record: object, key: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(record, key);
  } catch {
    throw new KanbanInvalidGeometryError();
  }
  if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new KanbanInvalidGeometryError();
  return descriptor?.value;
}

/** Resolves one optional numeric cell constraint to a validated number. */
function cellOption(value: unknown, fallback: number): number {
  const candidate = value ?? fallback;
  if (typeof candidate !== 'number') throw new KanbanInvalidGeometryError();
  requireCellCount(candidate);
  return candidate;
}

/** Copies and validates one caller-owned column constraint record exactly once. */
function snapshotColumn(value: unknown): MutableColumnWidth {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch {
    throw new KanbanInvalidGeometryError();
  }
  if (prototype !== Object.prototype && prototype !== null) throw new KanbanInvalidGeometryError();

  const rawId = ownValue(value, 'columnId');
  if (typeof rawId !== 'string') throw new KanbanInvalidGeometryError();
  let columnId: string;
  try {
    columnId = createKanbanColumnId(rawId);
  } catch {
    throw new KanbanInvalidGeometryError();
  }

  const minimum = cellOption(ownValue(value, 'minimumWidth'), KANBAN_DEFAULT_COLUMN_MINIMUM_WIDTH);
  const preferred = cellOption(ownValue(value, 'preferredWidth'), KANBAN_DEFAULT_COLUMN_PREFERRED_WIDTH);
  const maximum = cellOption(ownValue(value, 'maximumWidth'), KANBAN_DEFAULT_COLUMN_MAXIMUM_WIDTH);
  const chrome = cellOption(ownValue(value, 'chromeMinimumWidth'), 0);
  if (minimum === 0 || minimum > preferred || preferred > maximum || chrome > maximum) {
    throw new KanbanInvalidGeometryError();
  }

  const rawHint = ownValue(value, 'rendererMinimumHint');
  const hint =
    typeof rawHint === 'number' && Number.isSafeInteger(rawHint) && rawHint >= 0 && rawHint <= maximum ? rawHint : 0;
  const effectiveMinimum = Math.max(minimum, chrome, hint);
  return {
    columnId,
    minimumWidth: effectiveMinimum,
    preferredWidth: Math.max(preferred, effectiveMinimum),
    maximumWidth: maximum,
    width: effectiveMinimum,
  };
}

/** Returns the lowest normalized tier fulfillment, preserving source order on exact ties. */
function nextTierCandidate(columns: readonly MutableColumnWidth[], upper: (column: MutableColumnWidth) => number) {
  let selected = -1;
  for (let index = 0; index < columns.length; index += 1) {
    const candidate = columns[index];
    if (candidate === undefined || candidate.width >= upper(candidate)) continue;
    if (selected < 0) {
      selected = index;
      continue;
    }
    const current = columns[selected];
    if (current === undefined) throw new KanbanInvalidGeometryError();
    const candidateSpan = upper(candidate) - candidate.minimumWidth;
    const currentSpan = upper(current) - current.minimumWidth;
    const candidateProgress = candidate.width - candidate.minimumWidth;
    const currentProgress = current.width - current.minimumWidth;
    if (BigInt(candidateProgress) * BigInt(currentSpan) < BigInt(currentProgress) * BigInt(candidateSpan)) {
      selected = index;
    }
  }
  return selected;
}

/** Allocates one progressive tier without ever reducing an earlier assignment. */
function distributeTier(
  columns: readonly MutableColumnWidth[],
  availableCells: number,
  upper: (column: MutableColumnWidth) => number,
): number {
  let remaining = availableCells;
  while (remaining > 0) {
    const selected = nextTierCandidate(columns, upper);
    if (selected < 0) break;
    const column = columns[selected];
    if (column === undefined) throw new KanbanInvalidGeometryError();
    column.width += 1;
    remaining -= 1;
  }
  return remaining;
}

/** Freezes one detached solved column. */
function freezeColumn(column: MutableColumnWidth): KanbanSolvedColumnWidth {
  return Object.freeze({
    columnId: column.columnId,
    width: column.width,
    minimumWidth: column.minimumWidth,
    preferredWidth: column.preferredWidth,
    maximumWidth: column.maximumWidth,
  });
}

/**
 * Solves bounded workflow-column widths using deterministic monotone progressive water filling.
 *
 * The solver never mutates caller data. It preserves effective minima as horizontal overflow, fills
 * minimum-to-preferred before preferred-to-maximum, and enters one-column mode only when two effective
 * minima plus a separator cannot fit.
 */
export function solveKanbanColumnWidths(options: SolveKanbanColumnWidthsOptions): KanbanColumnWidthSolution {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new KanbanInvalidGeometryError();
  }
  const availableWidth = ownValue(options, 'availableWidth');
  const rawColumns = ownValue(options, 'columns');
  const rawFocused = ownValue(options, 'focusedColumnId');
  const rawSeparator = ownValue(options, 'separatorWidth');
  if (typeof availableWidth !== 'number') throw new KanbanInvalidGeometryError();
  requireCellCount(availableWidth);
  const separatorWidth = rawSeparator === undefined ? 1 : rawSeparator;
  if (typeof separatorWidth !== 'number') throw new KanbanInvalidGeometryError();
  requireCellCount(separatorWidth);
  if (!Array.isArray(rawColumns)) {
    throw new KanbanInvalidGeometryError();
  }
  const rawLength = ownValue(rawColumns, 'length');
  if (typeof rawLength !== 'number' || !Number.isSafeInteger(rawLength) || rawLength < 0) {
    throw new KanbanInvalidGeometryError();
  }
  if (rawLength > KANBAN_LIMITS.columns.absolute) throw new KanbanInvalidGeometryError();

  const columns: MutableColumnWidth[] = [];
  const ids = new Set<string>();
  const capturedLength = rawLength;
  for (let index = 0; index < capturedLength; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(rawColumns, index)) throw new KanbanInvalidGeometryError();
    const column = snapshotColumn(ownValue(rawColumns, String(index)));
    if (ids.has(column.columnId)) throw new KanbanInvalidGeometryError();
    ids.add(column.columnId);
    columns.push(column);
  }

  if (rawFocused !== undefined && typeof rawFocused !== 'string') throw new KanbanInvalidGeometryError();
  const focusedIndex = rawFocused === undefined ? -1 : columns.findIndex((column) => column.columnId === rawFocused);
  if (rawFocused !== undefined && focusedIndex < 0) throw new KanbanInvalidGeometryError();

  const sortedMinima = columns.map((column) => column.minimumWidth).sort((left, right) => left - right);
  const twoColumnMinimum =
    sortedMinima.length < 2 ? 0 : addCells(addCells(sortedMinima[0] ?? 0, sortedMinima[1] ?? 0), separatorWidth);
  if (columns.length >= 2 && availableWidth < twoColumnMinimum) {
    const activeIndex = focusedIndex >= 0 ? focusedIndex : 0;
    const active = columns[activeIndex];
    if (active === undefined) throw new KanbanInvalidGeometryError();
    active.width = Math.min(active.maximumWidth, Math.max(active.minimumWidth, availableWidth));
    const solved = Object.freeze([freezeColumn(active)]);
    const interactiveColumnIds = Object.freeze([active.columnId]);
    const navigator: KanbanFocusedColumnNavigator = Object.freeze({
      rowCount: 1,
      columnId: active.columnId,
      position: activeIndex + 1,
      total: columns.length,
      previousEnabled: activeIndex > 0,
      nextEnabled: activeIndex < columns.length - 1,
    });
    return Object.freeze({
      mode: 'focused-column',
      availableWidth,
      contentWidth: active.width,
      separatorWidth,
      columns: solved,
      interactiveColumnIds,
      navigator,
    });
  }

  let minimumContentWidth = 0;
  for (const column of columns) minimumContentWidth = addCells(minimumContentWidth, column.minimumWidth);
  const separators = columns.length < 2 ? 0 : separatorWidth * (columns.length - 1);
  if (!Number.isSafeInteger(separators)) throw new KanbanInvalidGeometryError();
  minimumContentWidth = addCells(minimumContentWidth, separators);
  let remaining = Math.max(0, availableWidth - minimumContentWidth);
  remaining = distributeTier(columns, remaining, (column) => column.preferredWidth);
  distributeTier(columns, remaining, (column) => column.maximumWidth);

  let contentWidth = separators;
  for (const column of columns) contentWidth = addCells(contentWidth, column.width);
  const solved = Object.freeze(columns.map(freezeColumn));
  return Object.freeze({
    mode: 'multi-column',
    availableWidth,
    contentWidth,
    separatorWidth,
    columns: solved,
    interactiveColumnIds: Object.freeze(solved.map((column) => column.columnId)),
  });
}
