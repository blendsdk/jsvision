import type { Rect } from '@jsvision/ui';

import type { KanbanDamageRegion } from '../layout/hit-map.js';
import type { KanbanViewportPoint } from '../layout/metrics.js';
import type { KanbanProjectedCard, KanbanViewportProjection } from './viewport-projector.js';

/** Maximum detached rectangles retained from one projection comparison. */
const MAXIMUM_DAMAGE_REGIONS = 256;

/** Inputs for one bounded visible-projection damage comparison. */
export interface CalculateKanbanViewportDamageOptions {
  /** Previous completed projection, absent on first paint. */
  readonly previous?: KanbanViewportProjection;
  /** Current completed projection. */
  readonly current: KanbanViewportProjection;
  /** Viewport-local clipping rectangle. */
  readonly bounds: Readonly<Rect>;
  /** Previous clamped offsets. */
  readonly previousOffsets: KanbanViewportPoint;
  /** Current clamped offsets. */
  readonly currentOffsets: KanbanViewportPoint;
}

/** Returns one detached clipped damage rectangle, or no value when it is empty. */
function clip(
  rect: Readonly<Rect>,
  bounds: Readonly<Rect>,
  kind: KanbanDamageRegion['kind'],
): KanbanDamageRegion | undefined {
  const x = Math.max(bounds.x, rect.x);
  const y = Math.max(bounds.y, rect.y);
  const right = Math.min(bounds.x + bounds.width, rect.x + rect.width);
  const bottom = Math.min(bounds.y + bounds.height, rect.y + rect.height);
  if (right <= x || bottom <= y) return undefined;
  return Object.freeze({ kind, x, y, width: right - x, height: bottom - y });
}

/** Returns a collision-safe identity for one visible card. */
function cardIdentity(card: KanbanProjectedCard): string {
  return JSON.stringify(['card', card.columnId, typeof card.descriptor.cardKey, card.descriptor.cardKey]);
}

/** Returns a deterministic descriptor presentation fingerprint. */
function cardFingerprint(card: KanbanProjectedCard): string {
  return JSON.stringify([
    card.rect,
    card.descriptor.presentationRevision ?? null,
    card.descriptor.surfaceRole,
    card.descriptor.borderRole,
    card.descriptor.marker,
    card.descriptor.rows,
  ]);
}

/** Pushes a clipped rectangle and falls back to whole-viewport damage at the finite ceiling. */
function pushDamage(
  target: KanbanDamageRegion[],
  rect: Readonly<Rect>,
  bounds: Readonly<Rect>,
  kind: KanbanDamageRegion['kind'],
): boolean {
  const clipped = clip(rect, bounds, kind);
  if (clipped === undefined) return true;
  target.push(clipped);
  return target.length <= MAXIMUM_DAMAGE_REGIONS;
}

/** Returns one whole-viewport damage record. */
function whole(bounds: Readonly<Rect>): readonly KanbanDamageRegion[] {
  const region = clip(bounds, bounds, 'whole-viewport');
  return region === undefined ? Object.freeze([]) : Object.freeze([region]);
}

/**
 * Computes bounded detached damage evidence without exposing an actionable pointer map.
 */
export function calculateKanbanViewportDamage(
  options: CalculateKanbanViewportDamageOptions,
): readonly KanbanDamageRegion[] {
  const previous = options.previous;
  if (previous === undefined) return whole(options.bounds);
  if (
    options.previousOffsets.x !== options.currentOffsets.x ||
    options.previousOffsets.y !== options.currentOffsets.y
  ) {
    const region = clip(options.bounds, options.bounds, 'scroll-exposed');
    return region === undefined ? Object.freeze([]) : Object.freeze([region]);
  }

  const damage: KanbanDamageRegion[] = [];
  const previousCards = new Map(previous.cards.map((card) => [cardIdentity(card), card]));
  const currentCards = new Map(options.current.cards.map((card) => [cardIdentity(card), card]));
  for (const [identity, card] of previousCards) {
    const current = currentCards.get(identity);
    if (current !== undefined && cardFingerprint(card) === cardFingerprint(current)) continue;
    if (!pushDamage(damage, card.rect, options.bounds, 'descriptor')) return whole(options.bounds);
  }
  for (const [identity, card] of currentCards) {
    const previousCard = previousCards.get(identity);
    if (previousCard !== undefined && cardFingerprint(previousCard) === cardFingerprint(card)) continue;
    if (!pushDamage(damage, card.rect, options.bounds, 'descriptor')) return whole(options.bounds);
  }

  const previousColumns = new Map(previous.columns.map((column) => [column.columnId, column]));
  const currentColumns = new Map(options.current.columns.map((column) => [column.columnId, column]));
  for (const column of [...previous.columns, ...options.current.columns]) {
    const before = previousColumns.get(column.columnId);
    const after = currentColumns.get(column.columnId);
    if (
      before !== undefined &&
      after !== undefined &&
      before.label === after.label &&
      JSON.stringify(before.rect) === JSON.stringify(after.rect)
    ) {
      continue;
    }
    if (!pushDamage(damage, { ...column.rect, height: Math.min(1, column.rect.height) }, options.bounds, 'sticky')) {
      return whole(options.bounds);
    }
  }

  if (JSON.stringify(previous.states) !== JSON.stringify(options.current.states)) {
    for (const region of [...previous.regions, ...options.current.regions]) {
      if (region.kind !== 'state' && region.kind !== 'minimum-size') continue;
      if (!pushDamage(damage, region, options.bounds, 'state')) return whole(options.bounds);
    }
  }
  return Object.freeze(damage);
}
