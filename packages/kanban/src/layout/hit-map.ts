import type { Rect } from '@jsvision/ui';

import { KanbanInvalidGeometryError } from '../contract/error.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import type { CardKey, KanbanColumnId, KanbanSwimlaneId } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanScene, KanbanSceneCard } from '../board/scene-model.js';
import type { KanbanSceneCardGeometry, KanbanSceneGeometry } from './swimlane-geometry.js';
import type { KanbanCellState } from '../source/states.js';
import type { KanbanCellAddress } from '../source/types.js';
import type { KanbanStructureStateCode } from '../structure/model.js';

/** Semantic rectangle emitted by pure layout projection for inspection or future interaction. */
export interface KanbanLayoutRegion extends Readonly<Rect> {
  /** Region meaning; Phase A keeps every emitted region non-actionable. */
  readonly kind:
    'workflow-header' | 'swimlane-header' | 'insertion-gutter' | 'card' | 'card-gap' | 'state' | 'minimum-size';
  /** Whether current input may target this region. */
  readonly actionable: boolean;
  /** Stable card identity for card rectangles. */
  readonly cardKey?: CardKey;
}

/** Closed semantic owner carried by one bounded pointer target. */
export type KanbanActionScope =
  | { readonly kind: 'board' }
  | { readonly kind: 'column'; readonly columnId: KanbanColumnId }
  | { readonly kind: 'swimlane'; readonly swimlaneId: KanbanSwimlaneId }
  | { readonly kind: 'cell'; readonly address: KanbanCellAddress }
  | { readonly kind: 'card'; readonly cardKey: CardKey; readonly address: KanbanCellAddress }
  | {
      readonly kind: 'state';
      readonly state: KanbanStructureStateCode;
      readonly address?: KanbanCellAddress;
    };

/** Bounded actionable entry recomputed from the final clipped scene geometry. */
export interface KanbanActionTarget extends Readonly<Rect> {
  /** Stable allowlisted target kind. */
  readonly kind: 'card-action' | 'card' | 'workflow-header' | 'swimlane-header' | 'state-action' | 'retry';
  /** Closed semantic owner containing no application record. */
  readonly scope: KanbanActionScope;
  /** Deterministic overlap priority; larger values win. */
  readonly zIndex: number;
  /** Source cell that owns a card, state, or retry action. */
  readonly address?: KanbanCellAddress;
  /** Stable card identity for whole-card and descriptor-action targets. */
  readonly cardKey?: CardKey;
  /** Stable column identity for workflow-header targets. */
  readonly columnId?: KanbanColumnId;
  /** Stable swimlane identity for swimlane-header targets. */
  readonly swimlaneId?: KanbanSwimlaneId;
  /** Global source position for a resident card target. */
  readonly logicalIndex?: number;
  /** Bounded semantic action identity for descriptor and scoped action targets. */
  readonly actionId?: string;
  /** Descriptor-local region identity for a card action. */
  readonly regionId?: string;
  /** Structural state code for state and retry targets. */
  readonly state?: KanbanStructureStateCode;
}

/** Options for one bounded scene hit projection. */
export interface ProjectKanbanSceneHitsOptions {
  /** Maximum highest-priority targets retained in the immutable result. */
  readonly maximumTargets: number;
}

/** Immutable clipped target list tied to one scene revision. */
export interface KanbanSceneHitProjection {
  /** Scene revision represented by every target. */
  readonly revision: KanbanRevision;
  /** Highest-priority-first bounded target list. */
  readonly targets: readonly KanbanActionTarget[];
}

/** Fixed z-order keeps overlaps deterministic and reviewable. */
const TARGET_Z_INDEX = Object.freeze({
  retry: 100,
  stateAction: 200,
  header: 300,
  card: 400,
  cardAction: 500,
});

/** Returns whether a semantic snapshot is a record rather than an array or primitive. */
function semanticRecord(value: KanbanSemanticValue): value is Readonly<Record<string, KanbanSemanticValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns one finite non-negative integer or rejects the complete hit projection. */
function coordinate(value: KanbanSemanticValue | undefined, positive = false): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Accepts one bounded control-free local or application-namespaced action identifier. */
function actionIdentifier(value: KanbanSemanticValue | undefined): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 256 ||
    !/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/u.test(value)
  ) {
    throw new KanbanInvalidGeometryError();
  }
  return value;
}

/** Clips one candidate rectangle to a positive-area containing rectangle. */
function clip(value: Readonly<Rect>, bounds: Readonly<Rect>): Readonly<Rect> | undefined {
  const x = Math.max(value.x, bounds.x);
  const y = Math.max(value.y, bounds.y);
  const right = Math.min(value.x + value.width, bounds.x + bounds.width);
  const bottom = Math.min(value.y + value.height, bounds.y + bounds.height);
  if (right <= x || bottom <= y) return undefined;
  return Object.freeze({ x, y, width: right - x, height: bottom - y });
}

/** Finds one semantic card using type-preserving key equality. */
function sceneCardFor(scene: KanbanScene, geometry: KanbanSceneCardGeometry): KanbanSceneCard {
  const card = scene.cards.find(
    (candidate) =>
      candidate.cardKey === geometry.cardKey &&
      candidate.address.columnId === geometry.address.columnId &&
      candidate.address.swimlaneId === geometry.address.swimlaneId &&
      candidate.logicalIndex === geometry.logicalIndex,
  );
  if (card === undefined) throw new KanbanInvalidGeometryError();
  return card;
}

/** Creates one frozen target with detached scope and rectangle values. */
function target(
  kind: KanbanActionTarget['kind'],
  geometry: Readonly<Rect>,
  scope: KanbanActionScope,
  zIndex: number,
  identity: Omit<KanbanActionTarget, keyof Rect | 'kind' | 'scope' | 'zIndex'> = {},
): KanbanActionTarget {
  return Object.freeze({
    kind,
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    scope: Object.freeze(scope),
    zIndex,
    ...identity,
  });
}

/** Projects validated descriptor-local action regions into one clipped card rectangle. */
function cardActionTargets(card: KanbanSceneCard, geometry: KanbanSceneCardGeometry): readonly KanbanActionTarget[] {
  if (!semanticRecord(card.descriptor.value)) throw new KanbanInvalidGeometryError();
  const rawRegions = card.descriptor.value.regions;
  if (rawRegions === undefined) return Object.freeze([]);
  if (!Array.isArray(rawRegions) || rawRegions.length > KANBAN_LIMITS.cardFields.absolute) {
    throw new KanbanInvalidGeometryError();
  }
  const targets: KanbanActionTarget[] = [];
  for (const rawRegion of rawRegions) {
    if (!semanticRecord(rawRegion) || rawRegion.actionId === undefined) continue;
    const actionId = actionIdentifier(rawRegion.actionId);
    const regionId = actionIdentifier(rawRegion.regionId);
    const x = coordinate(rawRegion.x);
    const y = coordinate(rawRegion.y);
    const width = coordinate(rawRegion.width, true);
    const height = coordinate(rawRegion.height, true);
    const clipped = clip(
      {
        x: geometry.x + x - geometry.descriptorColumnOffset,
        y: geometry.y + y - geometry.descriptorRowOffset,
        width,
        height,
      },
      geometry,
    );
    if (clipped === undefined) continue;
    targets.push(
      target(
        'card-action',
        clipped,
        { kind: 'card', cardKey: card.cardKey, address: card.address },
        TARGET_Z_INDEX.cardAction,
        {
          cardKey: card.cardKey,
          address: card.address,
          logicalIndex: card.logicalIndex,
          actionId,
          regionId,
        },
      ),
    );
  }
  return Object.freeze(targets);
}

/**
 * Projects a bounded highest-priority-first hit map from final clipped scene geometry.
 *
 * Card gaps, separators, insertion positions, drag ghosts, drop targets, and drag-hover surfaces are
 * deliberately absent. Source retry remains distinct from application-owned scoped actions.
 *
 * @example
 * ```ts
 * const hits = projectKanbanSceneHits(scene, geometry, { maximumTargets: 256 });
 * ```
 */
export function projectKanbanSceneHits(
  scene: KanbanScene,
  geometry: KanbanSceneGeometry,
  options: ProjectKanbanSceneHitsOptions,
): KanbanSceneHitProjection {
  if (
    typeof scene !== 'object' ||
    scene === null ||
    typeof geometry !== 'object' ||
    geometry === null ||
    typeof options !== 'object' ||
    options === null ||
    scene.revision !== geometry.revision ||
    !Number.isSafeInteger(options.maximumTargets) ||
    options.maximumTargets < 0 ||
    options.maximumTargets > KANBAN_LIMITS.retainedDescriptors.absolute
  ) {
    throw new KanbanInvalidGeometryError();
  }
  const candidates: KanbanActionTarget[] = [];
  for (const cardGeometry of geometry.cards) {
    const card = sceneCardFor(scene, cardGeometry);
    candidates.push(...cardActionTargets(card, cardGeometry));
    candidates.push(
      target(
        'card',
        cardGeometry,
        { kind: 'card', cardKey: card.cardKey, address: card.address },
        TARGET_Z_INDEX.card,
        { cardKey: card.cardKey, address: card.address, logicalIndex: card.logicalIndex },
      ),
    );
  }
  for (const header of geometry.workflowHeaders) {
    candidates.push(
      target('workflow-header', header, { kind: 'column', columnId: header.columnId }, TARGET_Z_INDEX.header, {
        columnId: header.columnId,
      }),
    );
  }
  for (const header of geometry.swimlaneChrome) {
    candidates.push(
      target('swimlane-header', header, { kind: 'swimlane', swimlaneId: header.swimlaneId }, TARGET_Z_INDEX.header, {
        swimlaneId: header.swimlaneId,
      }),
    );
  }
  for (const cell of scene.cells) {
    if (cell.state.kind !== 'error' || cell.state.retry !== 'available') continue;
    const cellGeometry = geometry.cells.find(
      ({ address }) => address.columnId === cell.address.columnId && address.swimlaneId === cell.address.swimlaneId,
    );
    if (cellGeometry === undefined) continue;
    candidates.push(
      target('retry', cellGeometry, { kind: 'state', state: 'error', address: cell.address }, TARGET_Z_INDEX.retry, {
        address: cell.address,
        state: 'error',
      }),
    );
  }
  candidates.sort((left, right) => right.zIndex - left.zIndex);
  return Object.freeze({
    revision: scene.revision,
    targets: Object.freeze(candidates.slice(0, options.maximumTargets)),
  });
}

/** Bounded changed rectangle returned by viewport damage calculation. */
export interface KanbanDamageRegion extends Readonly<Rect> {
  /** Stable source of the damage request. */
  readonly kind: 'descriptor' | 'sticky' | 'state' | 'scroll-exposed' | 'whole-viewport';
}

/** Detached inspection state for one retained source cell. */
export interface KanbanInspectedCell {
  /** Canonical source coordinate. */
  readonly address: KanbanCellAddress;
  /** Safe source state with no application record payload. */
  readonly state: KanbanCellState;
}

/** Detached visible-card evidence suitable for tests and modeless inspectors. */
export interface KanbanInspectedCard {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Containing workflow column identity. */
  readonly columnId: string;
  /** Sanitized visible title projection. */
  readonly title: string;
  /** Non-color marker projected with the visible descriptor. */
  readonly marker: { readonly cues: readonly string[] };
}

/** Detached visible-column evidence with the complete sanitized semantic label. */
export interface KanbanInspectedColumn {
  /** Stable workflow-column identity. */
  readonly columnId: string;
  /** Complete bounded sanitized label before visual ellipsis. */
  readonly label: string;
}
