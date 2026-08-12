import type { Rect } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanPresentationInput } from '../card/presentation-policy.js';
import { resolveKanbanPresentation } from '../card/presentation-policy.js';
import { KanbanInvalidGeometryError } from '../contract/error.js';
import { kanbanRevisionsEqual } from '../contract/revision.js';
import { framedKanbanCardHeight } from '../layout/card-geometry.js';
import type { KanbanViewportMetrics, KanbanViewportPoint } from '../layout/metrics.js';
import { clampKanbanScroll } from '../layout/scroll-model.js';
import type { KanbanVerticalHeightProjection } from '../layout/vertical-projector.js';
import {
  resolveKanbanVerticalProjectionExtentWithGap,
  snapshotKanbanVerticalHeightProjection,
} from '../layout/vertical-projector.js';
import { KANBAN_WORKFLOW_HEADER_ROWS, KANBAN_WORKFLOW_TRAILING_BOUNDARY_COLUMNS } from '../layout/workflow-geometry.js';
import { canonicalizeKanbanCellAddress, snapshotKanbanCellAddress } from '../source/address.js';
import type { KanbanCellAddress } from '../source/types.js';
import type { KanbanViewportProjection } from './viewport-projector.js';
import type { KanbanViewportSourceSnapshot } from './viewport-source.js';

/** One semantic cell's detached sparse-height projection. */
export interface KanbanViewportCellHeightProjection {
  /** Canonical column/swimlane address that owns the sparse index. */
  readonly address: KanbanCellAddress;
  /** Revision-bearing bounded row and extent evidence. */
  readonly projection: KanbanVerticalHeightProjection;
}

/** Inputs for one detached metrics calculation. */
export interface CreateKanbanViewportMetricsOptions<TCard> {
  /** Current parent-relative assigned rectangle. */
  readonly bounds: Readonly<Rect>;
  /** Current source and width projection. */
  readonly source: KanbanViewportSourceSnapshot<TCard>;
  /** Current card projection, when one has been rendered. */
  readonly projection?: KanbanViewportProjection;
  /** Optional sparse-height evidence keyed by retained semantic cell. */
  readonly heightProjections?: readonly KanbanViewportCellHeightProjection[];
  /** Requested offsets before live-extent clamping. */
  readonly offsets: KanbanViewportPoint;
  /** Current resting card-gap policy. */
  readonly density: KanbanCardDensity;
  /** Optional resolved custom or named presentation used for exact bootstrap spacing. */
  readonly presentation?: KanbanPresentationInput;
  /** Effective finite overscan. */
  readonly overscan: KanbanViewportPoint;
  /** Locator-proven lower vertical extent used only while cursor length remains inexact. */
  readonly minimumVerticalExtent?: number;
}

/** Multiplies non-negative geometry while saturating an impractical source extent. */
function saturatedMultiply(left: number, right: number): number {
  if (left === 0 || right === 0) return 0;
  if (left > Math.floor(Number.MAX_SAFE_INTEGER / right)) return Number.MAX_SAFE_INTEGER;
  return left * right;
}

/** Returns the default row stride used before every card has a measured descriptor. */
function estimatedStride(presentation: KanbanPresentationInput): number {
  const budget = resolveKanbanPresentation(presentation);
  return framedKanbanCardHeight(Math.min(1, budget.cardRows)) + budget.cardGap;
}

/** Estimates a complete uniform card stack without inventing a trailing resting gap. */
function estimatedLengthExtent(length: number, presentation: KanbanPresentationInput): number {
  if (length === 0) return 0;
  const budget = resolveKanbanPresentation(presentation);
  const stride = estimatedStride(presentation);
  const trailingGap = budget.cardGap;
  return Math.max(0, saturatedMultiply(length, stride) - trailingGap);
}

/** Adds non-negative geometry and saturates before integer precision can be lost. */
function saturatedAdd(left: number, right: number): number {
  if (left > Number.MAX_SAFE_INTEGER - right) return Number.MAX_SAFE_INTEGER;
  return left + right;
}

/** Reads one own data property without invoking accessors. */
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

/**
 * Combines per-cell sparse evidence without treating estimates as proven bounds.
 *
 * Ungrouped cells share one vertical row, so their maximum controls scrolling. Grouped cells are
 * combined per swimlane and summed; their missing presentation chrome keeps the aggregate quality
 * unknown until the final scene geometry supplies complete evidence.
 */
function sparseVerticalContentExtent<TCard>(
  source: KanbanViewportSourceSnapshot<TCard>,
  projections: readonly KanbanViewportCellHeightProjection[],
  presentation: KanbanPresentationInput,
): { readonly value: number; readonly quality: 'exact' | 'unknown' } {
  const sourceCells = new Map(source.cells.map((cell) => [canonicalizeKanbanCellAddress(cell.address), cell]));
  const rowExtents = new Map<string, number>();
  let allExact = projections.length === source.cells.length;
  let grouped = false;
  const seen = new Set<string>();
  for (const entry of projections) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) throw new KanbanInvalidGeometryError();
    const address = snapshotKanbanCellAddress(ownValue(entry, 'address'));
    const projection = snapshotKanbanVerticalHeightProjection(ownValue(entry, 'projection'));
    const key = canonicalizeKanbanCellAddress(address);
    const cell = sourceCells.get(key);
    if (cell === undefined || seen.has(key)) throw new KanbanInvalidGeometryError();
    if (
      (source.publication.revision !== undefined &&
        !kanbanRevisionsEqual(projection.revisions.source, source.publication.revision)) ||
      !kanbanRevisionsEqual(projection.revisions.cursor, cell.cursor.revision())
    ) {
      throw new KanbanInvalidGeometryError();
    }
    seen.add(key);
    const extent = resolveKanbanVerticalProjectionExtentWithGap(
      projection,
      resolveKanbanPresentation(presentation).cardGap,
    );
    if (extent.quality !== 'exact') allExact = false;
    const rowKey = address.swimlaneId ?? '';
    if (address.swimlaneId !== undefined) grouped = true;
    rowExtents.set(rowKey, Math.max(rowExtents.get(rowKey) ?? 0, extent.value));
  }
  for (const cell of source.cells) {
    const swimlaneId = cell.address.swimlaneId;
    if (swimlaneId === undefined) continue;
    const length = cell.cursor.length();
    if (length.kind === 'unknown') continue;
    const estimate = estimatedLengthExtent(length.value, presentation);
    if (estimate > (rowExtents.get(swimlaneId) ?? 0)) {
      rowExtents.set(swimlaneId, estimate);
      allExact = false;
    }
  }
  let value = 0;
  if (grouped) {
    for (const swimlane of source.visibleSwimlanes) {
      const cards = rowExtents.get(swimlane.swimlaneId);
      if (cards === undefined && !source.collapsedSwimlaneIds.includes(swimlane.swimlaneId)) allExact = false;
      value = saturatedAdd(value, saturatedAdd(cards ?? 0, 1));
    }
  } else {
    for (const rowExtent of rowExtents.values()) value = saturatedAdd(value, rowExtent);
  }
  return Object.freeze({ value, quality: allExact ? 'exact' : 'unknown' });
}

/** Returns a bounded logical row extent without scanning cursor contents. */
function verticalContentExtent<TCard>(
  source: KanbanViewportSourceSnapshot<TCard>,
  projection: KanbanViewportProjection | undefined,
  presentation: KanbanPresentationInput,
  heightProjections: readonly KanbanViewportCellHeightProjection[] | undefined,
): { readonly value: number; readonly quality: 'exact' | 'lower-bound' | 'unknown' } {
  if (heightProjections !== undefined) return sparseVerticalContentExtent(source, heightProjections, presentation);
  const stride = estimatedStride(presentation);
  let maximum = 0;
  let allExact = source.widths.columns.length === 0 || source.cells.length === source.widths.columns.length;
  let hasBound = false;
  for (const cell of source.cells) {
    const length = cell.cursor.length();
    if (length.kind !== 'exact') allExact = false;
    if (length.kind !== 'unknown') {
      hasBound = true;
      maximum = Math.max(maximum, estimatedLengthExtent(length.value, presentation));
    }
  }
  for (const card of projection?.cards ?? []) {
    hasBound = true;
    maximum = Math.max(
      maximum,
      saturatedMultiply(card.index, stride) + framedKanbanCardHeight(card.descriptor.measuredHeight),
    );
  }
  return Object.freeze({
    value: maximum,
    quality: allExact ? 'exact' : hasBound ? 'lower-bound' : 'unknown',
  });
}

/**
 * Creates the immutable metric snapshot and re-clamps offsets against current source geometry.
 */
export function createKanbanViewportMetrics<TCard>(
  options: CreateKanbanViewportMetricsOptions<TCard>,
): KanbanViewportMetrics {
  const stickyRows = options.source.visibleColumns.length === 0 ? 0 : KANBAN_WORKFLOW_HEADER_ROWS;
  const cardViewportHeight = Math.max(0, options.bounds.height - stickyRows);
  const content = verticalContentExtent(
    options.source,
    options.projection,
    options.presentation ?? options.density,
    options.heightProjections,
  );
  const effectiveQuality =
    content.quality === 'unknown' && (options.minimumVerticalExtent ?? 0) > 0 ? 'lower-bound' : content.quality;
  const projectedVerticalExtent = Math.max(
    0,
    content.value - cardViewportHeight,
    options.projection?.geometry?.extents.y ?? 0,
  );
  const minimumSize = options.source.mode === 'minimum-size';
  const extents: KanbanViewportPoint = Object.freeze(
    minimumSize
      ? { x: 0, y: 0 }
      : {
          x: Math.max(
            0,
            options.source.widths.contentWidth + KANBAN_WORKFLOW_TRAILING_BOUNDARY_COLUMNS - options.bounds.width,
          ),
          y:
            effectiveQuality === 'exact'
              ? projectedVerticalExtent
              : Math.max(projectedVerticalExtent, options.minimumVerticalExtent ?? 0),
        },
  );
  const offsets = clampKanbanScroll({ offsets: options.offsets, extents });
  return Object.freeze({
    assignedRect: Object.freeze({ ...options.bounds }),
    mode: options.source.mode,
    offsets,
    extents,
    extentQuality: Object.freeze({ x: 'exact', y: minimumSize ? 'exact' : effectiveQuality }),
    visibleColumnIds: Object.freeze(options.source.visibleColumns.map((column) => column.columnId)),
    visibleCardRanges: Object.freeze(options.source.cells.map((cell) => cell.range)),
    stickyRows,
    overscan: Object.freeze({ ...options.overscan }),
    generation: options.source.generation,
    sourceRevision: options.source.publication.revision,
  });
}
