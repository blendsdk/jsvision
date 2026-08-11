import type { Point } from '@jsvision/ui';

import type { KanbanMovedCardSnapshot } from '../contract/request.js';
import type { KanbanActionTarget } from '../layout/hit-map.js';
import type { KanbanDragGhostEvidence } from './drag-types.js';
import { snapshotKanbanSelectionEntry } from './selection.js';
import type { KanbanSelectionEntry, KanbanSelectionSnapshot } from './types.js';

/** Preserve numeric/string card identity when resolving concrete selection membership. */
function sameCard(left: string | number, right: string | number): boolean {
  return typeof left === typeof right && left === right;
}

/**
 * Resolve the deterministic concrete card set represented by one pointer-origin card.
 *
 * A selected origin preserves the application-captured source order. An unselected origin is
 * represented alone using freshly captured revision evidence. Opaque server-wide selections never
 * enter this function and therefore cannot be expanded into records by the component.
 */
export function resolveKanbanDraggedSelection(
  target: KanbanActionTarget,
  selection: KanbanSelectionSnapshot,
  snapshotCard: (target: KanbanActionTarget) => KanbanSelectionEntry | undefined,
): readonly KanbanSelectionEntry[] | undefined {
  if (target.kind !== 'card' || target.cardKey === undefined) return undefined;
  const originCardKey = target.cardKey;
  const selected = selection.entries.some(({ cardKey }) => sameCard(cardKey, originCardKey));
  try {
    if (selected) return Object.freeze(selection.entries.map(snapshotKanbanSelectionEntry));
    const origin = snapshotCard(target);
    return origin === undefined ? undefined : Object.freeze([snapshotKanbanSelectionEntry(origin)]);
  } catch {
    return undefined;
  }
}

/** Create a bounded ghost identity/count without duplicating dragged card content. */
export function createKanbanDragGhostEvidence(
  dragged: readonly KanbanMovedCardSnapshot[],
  point: Readonly<Point>,
  originCardKey?: string | number,
): KanbanDragGhostEvidence {
  const origin = dragged[0];
  if (origin === undefined) throw new RangeError('A Kanban drag ghost requires at least one card.');
  const ghost = originCardKey === undefined ? origin : dragged.find(({ cardKey }) => sameCard(cardKey, originCardKey));
  if (ghost === undefined) throw new RangeError('The Kanban drag origin must belong to the moved card set.');
  return Object.freeze({
    cardKey: ghost.cardKey,
    point: Object.freeze({ x: point.x, y: point.y }),
    count: dragged.length,
  });
}
