import { KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanViewportPoint } from '../layout/metrics.js';
import { clampKanbanScroll } from '../layout/scroll-model.js';
import type { KanbanCardLocation } from '../source/types.js';

/** Partial two-axis terminal-cell target accepted by imperative scrolling. */
export interface KanbanScrollTarget {
  /** Optional horizontal cell offset. */
  readonly x?: number;
  /** Optional vertical cell offset. */
  readonly y?: number;
}

/** Placement preference for an imperative card reveal. */
export type KanbanRevealAlignment = 'nearest' | 'start' | 'center' | 'end';

/** Public result of a bounded identity reveal. */
export interface KanbanRevealResult {
  /** Locator outcome; unsupported and unknown remain explicit. */
  readonly location: KanbanCardLocation;
  /** Whether the viewport offsets changed. */
  readonly scrolled: boolean;
}

/** Inputs for aligning one measured or estimated card row within the card-content viewport. */
export interface ResolveKanbanRevealOffsetOptions {
  /** Logical card top in the complete unscrolled cell stack. */
  readonly cardTop: number;
  /** Measured or estimated occupied card rows. */
  readonly cardHeight: number;
  /** Current vertical content offset. */
  readonly currentOffset: number;
  /** Positive card-content viewport height. */
  readonly viewportHeight: number;
  /** Requested stable alignment policy. */
  readonly alignment: KanbanRevealAlignment;
}

/**
 * Resolves the unclamped vertical offset that reveals one bounded card extent.
 *
 * @example
 * ```ts
 * resolveKanbanRevealOffset({
 *   cardTop: 40, cardHeight: 6, currentOffset: 0, viewportHeight: 20, alignment: 'center',
 * });
 * ```
 */
export function resolveKanbanRevealOffset(options: ResolveKanbanRevealOffsetOptions): number {
  const { cardTop, cardHeight, currentOffset, viewportHeight, alignment } = options;
  if (
    ![cardTop, cardHeight, currentOffset, viewportHeight].every((value) => Number.isSafeInteger(value) && value >= 0) ||
    cardHeight === 0 ||
    viewportHeight === 0
  ) {
    throw new KanbanInvalidGeometryError();
  }
  if (alignment === 'start') return cardTop;
  if (alignment === 'center') return Math.max(0, cardTop - Math.floor((viewportHeight - cardHeight) / 2));
  if (alignment === 'end') return Math.max(0, cardTop - viewportHeight + cardHeight);
  if (alignment !== 'nearest') throw new KanbanInvalidGeometryError();
  if (cardTop < currentOffset) return cardTop;
  if (cardTop + cardHeight > currentOffset + viewportHeight) {
    return Math.max(0, cardTop - viewportHeight + cardHeight);
  }
  return currentOffset;
}

/** Reads one optional signed safe integer without invoking accessors. */
function coordinate(target: KanbanScrollTarget, key: 'x' | 'y'): number | undefined {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(target, key);
  } catch {
    throw new KanbanInvalidGeometryError();
  }
  if (descriptor?.get !== undefined || descriptor?.set !== undefined) throw new KanbanInvalidGeometryError();
  const value = descriptor?.value;
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new KanbanInvalidGeometryError();
  return value;
}

/** Validates one plain partial coordinate object. */
function snapshotTarget(target: KanbanScrollTarget): { readonly x?: number; readonly y?: number } {
  if (typeof target !== 'object' || target === null || Array.isArray(target)) throw new KanbanInvalidGeometryError();
  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(target);
  } catch {
    throw new KanbanInvalidGeometryError();
  }
  if (prototype !== Object.prototype && prototype !== null) throw new KanbanInvalidGeometryError();
  let keys: readonly string[];
  try {
    keys = Object.keys(target);
  } catch {
    throw new KanbanInvalidGeometryError();
  }
  if (keys.some((key) => key !== 'x' && key !== 'y')) throw new KanbanInvalidGeometryError();
  const x = coordinate(target, 'x');
  const y = coordinate(target, 'y');
  return Object.freeze({ ...(x === undefined ? {} : { x }), ...(y === undefined ? {} : { y }) });
}

/** Adds one signed safe delta with exact saturation before JavaScript integer precision is lost. */
function addDelta(current: number, delta: number): number {
  if (delta >= 0) return delta > Number.MAX_SAFE_INTEGER - current ? Number.MAX_SAFE_INTEGER : current + delta;
  return -delta > current ? 0 : current + delta;
}

/** Resolves and clamps an absolute partial target. */
export function resolveKanbanScrollTo(
  current: KanbanViewportPoint,
  extents: KanbanViewportPoint,
  target: KanbanScrollTarget,
): KanbanViewportPoint {
  const snapshot = snapshotTarget(target);
  return clampKanbanScroll({
    offsets: {
      x: Math.max(0, snapshot.x ?? current.x),
      y: Math.max(0, snapshot.y ?? current.y),
    },
    extents,
  });
}

/** Resolves and clamps a signed partial delta. */
export function resolveKanbanScrollBy(
  current: KanbanViewportPoint,
  extents: KanbanViewportPoint,
  delta: KanbanScrollTarget,
): KanbanViewportPoint {
  const snapshot = snapshotTarget(delta);
  const x = addDelta(current.x, snapshot.x ?? 0);
  const y = addDelta(current.y, snapshot.y ?? 0);
  return clampKanbanScroll({ offsets: { x, y }, extents });
}

/** Validates a reveal alignment without accepting application-defined strings. */
export function snapshotKanbanRevealAlignment(value: KanbanRevealAlignment | undefined): KanbanRevealAlignment {
  const alignment = value ?? 'nearest';
  if (alignment !== 'nearest' && alignment !== 'start' && alignment !== 'center' && alignment !== 'end') {
    throw new KanbanInvalidGeometryError();
  }
  return alignment;
}

/** Validates a public reveal identity before it reaches an application locator. */
export function snapshotKanbanRevealKey(value: CardKey): CardKey {
  return createKanbanCardKey(value);
}
