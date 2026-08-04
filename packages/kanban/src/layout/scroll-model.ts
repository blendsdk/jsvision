import { KanbanInvalidGeometryError } from '../contract/error.js';
import { createKanbanCardKey, createKanbanColumnId } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanViewportPoint } from './metrics.js';

/** Stable semantic anchor used to restore a containing column and relative card row. */
export interface KanbanScrollAnchor {
  /** Containing workflow column identity. */
  readonly columnId: string;
  /** Stable card identity when a visible card can be anchored. */
  readonly cardKey?: CardKey;
  /** Preferred card row relative to the scrolling viewport. */
  readonly relativeRow: number;
  /** Horizontal offset retained inside the containing column. */
  readonly columnOffset: number;
}

/** Inputs for clamping a two-axis scroll position to live extents. */
export interface ClampKanbanScrollOptions {
  /** Requested offsets in terminal cells. */
  readonly offsets: KanbanViewportPoint;
  /** Greatest live offsets in terminal cells. */
  readonly extents: KanbanViewportPoint;
}

/** Validates one non-negative safe terminal-cell value. */
function cellCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Reads one own data property without invoking caller accessors. */
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

/** Reads a plain coordinate once and returns a detached immutable value. */
function snapshotPoint(value: unknown): KanbanViewportPoint {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new KanbanInvalidGeometryError();
  return Object.freeze({ x: cellCount(ownValue(value, 'x')), y: cellCount(ownValue(value, 'y')) });
}

/** Clamps requested offsets to current live extents without retaining caller objects. */
export function clampKanbanScroll(options: ClampKanbanScrollOptions): KanbanViewportPoint {
  if (typeof options !== 'object' || options === null || Array.isArray(options)) {
    throw new KanbanInvalidGeometryError();
  }
  const offsets = snapshotPoint(ownValue(options, 'offsets'));
  const extents = snapshotPoint(ownValue(options, 'extents'));
  return Object.freeze({ x: Math.min(offsets.x, extents.x), y: Math.min(offsets.y, extents.y) });
}

/** Creates one detached immutable semantic scroll anchor. */
export function createKanbanScrollAnchor(anchor: KanbanScrollAnchor): KanbanScrollAnchor {
  if (typeof anchor !== 'object' || anchor === null || Array.isArray(anchor)) throw new KanbanInvalidGeometryError();
  const rawColumnId = ownValue(anchor, 'columnId');
  const rawCardKey = ownValue(anchor, 'cardKey');
  const relativeRow = cellCount(ownValue(anchor, 'relativeRow'));
  const columnOffset = cellCount(ownValue(anchor, 'columnOffset'));
  let columnId: string;
  let cardKey: CardKey | undefined;
  try {
    if (typeof rawColumnId !== 'string') throw new KanbanInvalidGeometryError();
    columnId = createKanbanColumnId(rawColumnId);
    if (rawCardKey !== undefined) {
      if (typeof rawCardKey !== 'string' && typeof rawCardKey !== 'number') throw new KanbanInvalidGeometryError();
      cardKey = createKanbanCardKey(rawCardKey);
    }
  } catch {
    throw new KanbanInvalidGeometryError();
  }
  return Object.freeze({
    columnId,
    ...(cardKey === undefined ? {} : { cardKey }),
    relativeRow,
    columnOffset,
  });
}
