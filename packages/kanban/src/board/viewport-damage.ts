import type { Rect } from '@jsvision/ui';

import type { KanbanDamageRegion } from '../layout/hit-map.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanScene } from './scene-model.js';
import type { KanbanSceneGeometry } from '../layout/swimlane-geometry.js';
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
    card.descriptorColumnOffset,
    card.descriptorRowOffset,
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

/** Returns every exact rectangle participating in one transient overlay frame. */
function overlayRects(projection: KanbanViewportProjection): readonly Readonly<Rect>[] {
  const overlay = projection.overlay;
  if (overlay === undefined) return Object.freeze([]);
  return Object.freeze([
    ...overlay.placeholders.map(({ rect }) => rect),
    ...(overlay.gap === undefined ? [] : [overlay.gap.rect]),
    ...(overlay.ghost === undefined ? [] : [overlay.ghost.rect]),
    ...overlay.pending.map(({ rect }) => rect),
    ...overlay.feedback.map(({ rect }) => rect),
    ...overlay.affectedStacks.map(({ rect }) => rect),
  ]);
}

/** Returns only old/new overlay rectangles whose semantic member changed between frames. */
function changedOverlayRects(
  previous: KanbanViewportProjection,
  current: KanbanViewportProjection,
): readonly Readonly<Rect>[] {
  const before = previous.overlay;
  const after = current.overlay;
  if (before === undefined || after === undefined)
    return Object.freeze([...overlayRects(previous), ...overlayRects(current)]);
  const changed: Readonly<Rect>[] = [];
  const retain = <T extends { readonly rect: Readonly<Rect> }>(left: readonly T[], right: readonly T[]): void => {
    if (JSON.stringify(left) !== JSON.stringify(right))
      changed.push(...left.map(({ rect }) => rect), ...right.map(({ rect }) => rect));
  };
  retain(before.placeholders, after.placeholders);
  retain(before.pending, after.pending);
  retain(before.feedback, after.feedback);
  retain(before.affectedStacks, after.affectedStacks);
  if (JSON.stringify(before.gap) !== JSON.stringify(after.gap)) {
    if (before.gap !== undefined) changed.push(before.gap.rect);
    if (after.gap !== undefined) changed.push(after.gap.rect);
  }
  if (JSON.stringify(before.ghost) !== JSON.stringify(after.ghost)) {
    if (before.ghost !== undefined) changed.push(before.ghost.rect);
    if (after.ghost !== undefined) changed.push(after.ghost.rect);
  }
  return Object.freeze(changed);
}

/** Inputs for one bounded canonical-scene damage comparison. */
export interface CalculateKanbanSceneDamageOptions {
  /** Previous immutable semantic scene. */
  readonly previousScene: KanbanScene;
  /** Current immutable semantic scene. */
  readonly currentScene: KanbanScene;
  /** Previous exact scene geometry. */
  readonly previousGeometry: KanbanSceneGeometry;
  /** Current exact scene geometry. */
  readonly currentGeometry: KanbanSceneGeometry;
  /** Viewport-local clipping rectangle. */
  readonly bounds: Readonly<Rect>;
  /** Finite retained region ceiling. */
  readonly maximumRegions: number;
}

/** Returns a collision-safe type-preserving card identity. */
function sceneCardIdentity(cardKey: CardKey): string {
  return JSON.stringify([typeof cardKey, cardKey]);
}

/** Returns one card's visible rectangle from a scene geometry snapshot. */
function sceneCardRect(geometry: KanbanSceneGeometry, cardKey: CardKey): Readonly<Rect> | undefined {
  return geometry.cards.find((card) => card.cardKey === cardKey);
}

/**
 * Computes bounded semantic-scene damage and preserves card-local descriptor invalidation.
 *
 * Structural projectors may supply exact changed rectangles. Once that evidence exceeds the caller's
 * finite ceiling, whole-viewport damage is safer than retaining or silently truncating rectangles.
 *
 * @example
 * ```ts
 * const damage = calculateKanbanSceneDamage({
 *   previousScene, currentScene, previousGeometry, currentGeometry,
 *   bounds: { x: 0, y: 0, width: 80, height: 24 }, maximumRegions: 256,
 * });
 * ```
 */
export function calculateKanbanSceneDamage(options: CalculateKanbanSceneDamageOptions): readonly KanbanDamageRegion[] {
  if (!Number.isSafeInteger(options.maximumRegions) || options.maximumRegions <= 0) return whole(options.bounds);
  if (options.currentGeometry.changedRegions.length > options.maximumRegions) return whole(options.bounds);

  const previous = new Map(options.previousScene.cards.map((card) => [sceneCardIdentity(card.cardKey), card] as const));
  const current = new Map(options.currentScene.cards.map((card) => [sceneCardIdentity(card.cardKey), card] as const));
  const damage: KanbanDamageRegion[] = [];
  for (const identity of new Set([...previous.keys(), ...current.keys()])) {
    const before = previous.get(identity);
    const after = current.get(identity);
    const cardKey = after?.cardKey ?? before?.cardKey;
    if (cardKey === undefined) continue;
    const previousRect = sceneCardRect(options.previousGeometry, cardKey);
    const currentRect = sceneCardRect(options.currentGeometry, cardKey);
    const geometryUnchanged =
      previousRect !== undefined &&
      currentRect !== undefined &&
      previousRect.x === currentRect.x &&
      previousRect.y === currentRect.y &&
      previousRect.width === currentRect.width &&
      previousRect.height === currentRect.height;
    if (
      before !== undefined &&
      after !== undefined &&
      JSON.stringify(before.descriptor.value) === JSON.stringify(after.descriptor.value) &&
      geometryUnchanged
    ) {
      continue;
    }
    if (
      previousRect !== undefined &&
      currentRect !== undefined &&
      (previousRect.x !== currentRect.x ||
        previousRect.y !== currentRect.y ||
        previousRect.width !== currentRect.width ||
        previousRect.height !== currentRect.height)
    ) {
      return whole(options.bounds);
    }
    const rect = currentRect ?? previousRect;
    if (rect === undefined) continue;
    const clipped = clip(rect, options.bounds, 'descriptor');
    if (clipped !== undefined) damage.push(Object.freeze({ ...clipped, cardKey }));
    if (damage.length > options.maximumRegions) return whole(options.bounds);
  }
  if (damage.length > 0) return Object.freeze(damage);

  if (
    options.previousScene.revision !== options.currentScene.revision ||
    options.previousGeometry.revision !== options.currentGeometry.revision
  ) {
    const structural: KanbanDamageRegion[] = [];
    for (const changed of options.currentGeometry.changedRegions) {
      const clipped = clip(changed, options.bounds, 'sticky');
      if (clipped !== undefined) structural.push(clipped);
      if (structural.length > options.maximumRegions) return whole(options.bounds);
    }
    return structural.length === 0 ? whole(options.bounds) : Object.freeze(structural);
  }
  return Object.freeze([]);
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
  if (JSON.stringify(previous.overlay) !== JSON.stringify(options.current.overlay)) {
    for (const rect of changedOverlayRects(previous, options.current)) {
      if (!pushDamage(damage, rect, options.bounds, 'overlay')) return whole(options.bounds);
    }
  }

  if (
    previous.scene !== undefined &&
    previous.geometry !== undefined &&
    options.current.scene !== undefined &&
    options.current.geometry !== undefined
  ) {
    const sceneDamage = calculateKanbanSceneDamage({
      previousScene: previous.scene,
      currentScene: options.current.scene,
      previousGeometry: previous.geometry,
      currentGeometry: options.current.geometry,
      bounds: options.bounds,
      maximumRegions: MAXIMUM_DAMAGE_REGIONS,
    });
    if (sceneDamage.some(({ kind }) => kind === 'whole-viewport')) return sceneDamage;
    if (damage.length + sceneDamage.length > MAXIMUM_DAMAGE_REGIONS) return whole(options.bounds);
    return Object.freeze([...damage, ...sceneDamage]);
  }

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
