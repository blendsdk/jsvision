import type { Point, Rect } from '@jsvision/ui';

import { KanbanInvalidGeometryError } from '../contract/error.js';
import { canonicalizeKanbanCellAddress } from '../source/address.js';
import type { KanbanCellAddress } from '../source/types.js';

/** Minimal immutable geometry needed to stabilize one semantic drop target. */
export interface KanbanDropHysteresisTarget {
  /** Stable semantic slot identity. */
  readonly slotId: string;
  /** Cell owning the semantic slot. */
  readonly address: KanbanCellAddress;
  /** Current viewport-local target rectangle. */
  readonly rect?: Readonly<Rect>;
  /** Geometry generation that owns the rectangle. */
  readonly geometryGeneration: number;
}

/** Inputs for one pure one-cell hysteresis decision. */
export interface SelectKanbanDropTargetWithHysteresisInput<
  TCurrent extends KanbanDropHysteresisTarget,
  TCandidate extends KanbanDropHysteresisTarget,
> {
  /** Previously active target, if any. */
  readonly current?: TCurrent;
  /** Highest-priority target under the current point, if any. */
  readonly candidate?: TCandidate;
  /** Current viewport-local pointer coordinate. */
  readonly point: Readonly<Point>;
  /** Current post-layout geometry generation. */
  readonly geometryGeneration: number;
}

/** Validates one safe integer coordinate or generation. */
function integer(value: unknown, minimum = Number.MIN_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Tests a point against a target expanded by exactly one terminal cell on every side. */
function insideOneCellBand(rect: Readonly<Rect>, point: Readonly<Point>): boolean {
  const x = integer(rect.x);
  const y = integer(rect.y);
  const width = integer(rect.width, 1);
  const height = integer(rect.height, 1);
  const pointX = integer(point.x);
  const pointY = integer(point.y);
  return pointX >= x - 1 && pointX <= x + width && pointY >= y - 1 && pointY <= y + height;
}

/** Returns whether two targets belong to the same semantic board cell. */
function sameCell(left: KanbanDropHysteresisTarget, right: KanbanDropHysteresisTarget): boolean {
  return canonicalizeKanbanCellAddress(left.address) === canonicalizeKanbanCellAddress(right.address);
}

/**
 * Stabilizes adjacent targets without retaining stale geometry or crossing semantic cell ownership.
 *
 * A different cell always wins immediately. Within one cell, the current target remains active for
 * one extra terminal cell around its rectangle, which prevents card-half and gutter boundaries from
 * oscillating when projection moves by a row.
 *
 * @example
 * ```ts
 * const target = selectKanbanDropTargetWithHysteresis({
 *   current,
 *   candidate,
 *   point: { x: 12, y: 8 },
 *   geometryGeneration: 4,
 * });
 * ```
 */
export function selectKanbanDropTargetWithHysteresis<
  TCurrent extends KanbanDropHysteresisTarget,
  TCandidate extends KanbanDropHysteresisTarget,
>(input: SelectKanbanDropTargetWithHysteresisInput<TCurrent, TCandidate>): TCurrent | TCandidate | undefined {
  const generation = integer(input.geometryGeneration, 1);
  const current = input.current;
  const candidate = input.candidate;
  const currentValid = current !== undefined && integer(current.geometryGeneration, 1) === generation;
  const candidateValid = candidate !== undefined && integer(candidate.geometryGeneration, 1) === generation;

  if (!currentValid) return candidateValid ? candidate : undefined;
  if (candidateValid && candidate !== undefined && current !== undefined && !sameCell(current, candidate)) {
    return candidate;
  }
  if (current?.rect !== undefined && insideOneCellBand(current.rect, input.point)) return current;
  return candidateValid ? candidate : undefined;
}
