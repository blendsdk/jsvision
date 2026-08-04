import type { Rect } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanViewportMetrics, KanbanViewportPoint } from '../layout/metrics.js';
import { clampKanbanScroll } from '../layout/scroll-model.js';
import type { KanbanViewportProjection } from './viewport-projector.js';
import type { KanbanViewportSourceSnapshot } from './viewport-source.js';

/** Inputs for one detached metrics calculation. */
export interface CreateKanbanViewportMetricsOptions<TCard> {
  /** Current parent-relative assigned rectangle. */
  readonly bounds: Readonly<Rect>;
  /** Current source and width projection. */
  readonly source: KanbanViewportSourceSnapshot<TCard>;
  /** Current card projection, when one has been rendered. */
  readonly projection?: KanbanViewportProjection;
  /** Requested offsets before live-extent clamping. */
  readonly offsets: KanbanViewportPoint;
  /** Current resting card-gap policy. */
  readonly density: KanbanCardDensity;
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
function estimatedStride(density: KanbanCardDensity): number {
  return density === 'compact' ? 2 : 3;
}

/** Estimates a complete uniform card stack without inventing a trailing resting gap. */
function estimatedLengthExtent(length: number, density: KanbanCardDensity): number {
  if (length === 0) return 0;
  const stride = estimatedStride(density);
  const trailingGap = density === 'compact' ? 0 : 1;
  return Math.max(0, saturatedMultiply(length, stride) - trailingGap);
}

/** Returns a bounded logical row extent without scanning cursor contents. */
function verticalContentExtent<TCard>(
  source: KanbanViewportSourceSnapshot<TCard>,
  projection: KanbanViewportProjection | undefined,
  density: KanbanCardDensity,
): { readonly value: number; readonly quality: 'exact' | 'lower-bound' | 'unknown' } {
  const stride = estimatedStride(density);
  let maximum = 0;
  let allExact = source.widths.columns.length === 0 || source.cells.length === source.widths.columns.length;
  let hasBound = false;
  for (const cell of source.cells) {
    const length = cell.cursor.length();
    if (length.kind !== 'exact') allExact = false;
    if (length.kind !== 'unknown') {
      hasBound = true;
      maximum = Math.max(maximum, estimatedLengthExtent(length.value, density));
    }
  }
  for (const card of projection?.cards ?? []) {
    hasBound = true;
    maximum = Math.max(maximum, saturatedMultiply(card.index, stride) + card.descriptor.measuredHeight);
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
  const stickyRows = options.source.visibleColumns.length === 0 ? 0 : 1;
  const cardViewportHeight = Math.max(0, options.bounds.height - stickyRows);
  const content = verticalContentExtent(options.source, options.projection, options.density);
  const effectiveQuality =
    content.quality === 'unknown' && (options.minimumVerticalExtent ?? 0) > 0 ? 'lower-bound' : content.quality;
  const projectedVerticalExtent = Math.max(0, content.value - cardViewportHeight);
  const minimumSize = options.source.mode === 'minimum-size';
  const extents: KanbanViewportPoint = Object.freeze(
    minimumSize
      ? { x: 0, y: 0 }
      : {
          x: Math.max(0, options.source.widths.contentWidth - options.bounds.width),
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
