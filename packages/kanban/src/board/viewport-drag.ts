import type { Point, Rect } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanCardMoveProposal, KanbanMovePosition, KanbanMovedCardSnapshot } from '../contract/request.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import { kanbanRevisionsEqual } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import { snapshotKanbanEligibility } from '../operation/eligibility.js';
import { createKanbanDragAutoscrollController } from '../interaction/drag-autoscroll.js';
import type { KanbanDragAutoscrollController } from '../interaction/drag-autoscroll.js';
import { createKanbanCardDragController } from '../interaction/drag-controller.js';
import type { KanbanCardDragController, KanbanCardDragControllerSnapshot } from '../interaction/drag-controller.js';
import { createKanbanDragPrefetchController } from '../interaction/drag-prefetch.js';
import type { KanbanDragPrefetchController } from '../interaction/drag-prefetch.js';
import type { KanbanCardDropTarget, KanbanDragCancellationReason } from '../interaction/drag-types.js';
import { selectKanbanDropTargetWithHysteresis } from '../interaction/drop-hysteresis.js';
import { projectKanbanCardDropMap } from '../interaction/drop-map.js';
import type { KanbanDropCellInput, KanbanUnknownDropEdgeInput } from '../interaction/drop-map.js';
import type { KanbanPointerDragStart } from '../interaction/pointer-router.js';
import type { KanbanActionTarget } from '../layout/hit-map.js';
import type { KanbanSceneGeometry, KanbanSceneCardGeometry } from '../layout/swimlane-geometry.js';
import type { KanbanPlacement } from '../source/types.js';
import { createKanbanCollapsedHoverController } from '../structure/collapsed-hover.js';
import type { KanbanCollapsedHoverController } from '../structure/collapsed-hover.js';
import type { KanbanScene } from './scene-model.js';
import type { KanbanViewportSourceCell, KanbanViewportSourceSnapshot } from './viewport-source.js';

/** Current post-layout scene read by one viewport-local drag decision. */
export interface KanbanViewportDragScene<TCard> {
  /** Canonical semantic scene. */
  readonly scene: KanbanScene;
  /** Current exact-cell geometry. */
  readonly geometry: KanbanSceneGeometry;
  /** Current retained source/cursor snapshot. */
  readonly source: KanbanViewportSourceSnapshot<TCard>;
  /** Current named card density. */
  readonly density: KanbanCardDensity;
  /** Revision owning current action and semantic target geometry. */
  readonly sceneRevision: KanbanRevision;
  /** Monotonic viewport geometry generation. */
  readonly geometryGeneration: number;
  /** Scrollable region below sticky chrome. */
  readonly viewport: Readonly<Rect>;
}

/** Viewport seams required by one mounted card-drag lifetime. */
export interface KanbanViewportDragControllerOptions<TCard> {
  /** Returns current scene evidence, or absence before first projection. */
  readonly readScene: () => KanbanViewportDragScene<TCard> | undefined;
  /** Admits one board-owned card move; standalone viewports return false. */
  readonly commitProposal: (proposal: KanbanCardMoveProposal) => boolean;
  /** Evaluates current board policy for one detached move without admitting it. */
  readonly evaluateProposal: (proposal: KanbanCardMoveProposal) => unknown;
  /** Applies one bounded scroll step and returns actual clamped movement. */
  readonly scroll: (step: Readonly<Point>) => Readonly<Point>;
  /** Requests projection/drawing after controller evidence changes. */
  readonly invalidate: () => void;
}

/** Compares application card identities without numeric/string coercion. */
function sameCard(left: CardKey, right: CardKey): boolean {
  return typeof left === typeof right && left === right;
}

/** Compares complete semantic cell addresses. */
function sameAddress(
  left: Readonly<{ readonly columnId: string; readonly swimlaneId?: string }>,
  right: Readonly<{ readonly columnId: string; readonly swimlaneId?: string }>,
): boolean {
  return left.columnId === right.columnId && left.swimlaneId === right.swimlaneId;
}

/** Compares semantic placement ownership while allowing a refreshed cursor revision/token. */
function samePosition(left: KanbanMovePosition, right: KanbanMovePosition): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'start' || left.kind === 'end') return true;
  if (left.kind === 'between' && right.kind === 'between') {
    return (
      typeof left.beforeCardKey === typeof right.beforeCardKey &&
      left.beforeCardKey === right.beforeCardKey &&
      typeof left.afterCardKey === typeof right.afterCardKey &&
      left.afterCardKey === right.afterCardKey
    );
  }
  return (
    left.kind === 'window-edge' &&
    right.kind === 'window-edge' &&
    left.edge === right.edge &&
    typeof left.neighborCardKey === typeof right.neighborCardKey &&
    left.neighborCardKey === right.neighborCardKey
  );
}

/** Compares renderer-relevant target evidence without depending on object identity. */
function sameTarget(left: KanbanCardDropTarget | undefined, right: KanbanCardDropTarget | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.rect === undefined || right.rect === undefined)
    return left.rect === right.rect && left.slotId === right.slotId;
  return (
    left.slotId === right.slotId &&
    left.geometryGeneration === right.geometryGeneration &&
    left.eligibility.kind === right.eligibility.kind &&
    left.rect.x === right.rect.x &&
    left.rect.y === right.rect.y &&
    left.rect.width === right.rect.width &&
    left.rect.height === right.rect.height
  );
}

/** Converts a source placement into a dispatchable move position without inventing authority. */
function movePosition(value: KanbanPlacement): KanbanMovePosition | undefined {
  if (value.kind === 'start' || value.kind === 'end' || value.kind === 'between') return value;
  if (value.kind !== 'window-edge' || value.token === undefined) return undefined;
  return Object.freeze({
    kind: 'window-edge',
    edge: value.edge,
    neighborCardKey: value.neighborCardKey,
    token: value.token,
    cursorRevision: value.cursorRevision,
  });
}

/** Finds one retained source cell for a semantic address. */
function sourceCell<TCard>(
  source: KanbanViewportSourceSnapshot<TCard>,
  address: Readonly<{ readonly columnId: string; readonly swimlaneId?: string }>,
): KanbanViewportSourceCell<TCard> | undefined {
  return source.cells.find((cell) => sameAddress(cell.address, address));
}

/** Resolves the complete ordered moved set from current source-owned placement evidence. */
function movedCards<TCard>(
  start: KanbanPointerDragStart,
  current: KanbanViewportDragScene<TCard>,
): readonly KanbanMovedCardSnapshot[] | undefined {
  try {
    const selected = new Set(start.dragged.map(({ cardKey }) => JSON.stringify([typeof cardKey, cardKey])));
    const ordered = current.scene.cards.filter((card) =>
      selected.has(JSON.stringify([typeof card.cardKey, card.cardKey])),
    );
    if (ordered.length !== start.dragged.length) throw new Error('stale-card-set');
    const moved = ordered.map((card): KanbanMovedCardSnapshot => {
      const entry = start.dragged.find(({ cardKey }) => sameCard(cardKey, card.cardKey));
      if (entry === undefined) throw new Error('stale-card');
      if (card === undefined || !sameAddress(card.address, entry.address)) throw new Error('stale-card');
      const cell = sourceCell(current.source, card.address);
      if (cell === undefined) throw new Error('stale-cell');
      const sourcePlacement = movePosition(cell.cursor.placementAt(card.logicalIndex));
      if (sourcePlacement === undefined) throw new Error('placement-unavailable');
      return Object.freeze({
        cardKey: card.cardKey,
        source: card.address,
        sourcePlacement,
        sourceRevision: cell.cursor.revision(),
        entityRevision: card.entityRevision,
      });
    });
    return Object.freeze(moved);
  } catch {
    return undefined;
  }
}

/** Returns a positive clipped edge rectangle inside one cell. */
function edgeRect(rect: Readonly<Rect>, edge: 'leading' | 'trailing'): Readonly<Rect> {
  const height = Math.min(2, rect.height);
  return Object.freeze({
    x: rect.x,
    y: edge === 'leading' ? rect.y : rect.y + rect.height - height,
    width: rect.width,
    height,
  });
}

/** Creates bounded prefetch evidence for one token-backed loaded-window edge. */
function unknownEdge<TCard>(
  cell: KanbanViewportSourceCell<TCard>,
  placement: KanbanPlacement,
  rect: Readonly<Rect>,
  edge: 'leading' | 'trailing',
): KanbanUnknownDropEdgeInput | undefined {
  const position = movePosition(placement);
  if (position?.kind !== 'window-edge') return undefined;
  const count = 16;
  const start = edge === 'leading' ? Math.max(0, cell.range.start - count) : cell.range.end;
  return Object.freeze({
    rect,
    position,
    prefetch: Object.freeze({ address: cell.address, start, count, revision: position.cursorRevision }),
  });
}

/** Builds card-half inputs that have complete current before/after placement authority. */
function dropCards<TCard>(
  scene: KanbanScene,
  cards: readonly KanbanSceneCardGeometry[],
  cell: KanbanViewportSourceCell<TCard>,
): KanbanDropCellInput['cards'] {
  return Object.freeze(
    cards.flatMap((geometry) => {
      const card = scene.cards.find(
        (candidate) => sameCard(candidate.cardKey, geometry.cardKey) && sameAddress(candidate.address, cell.address),
      );
      if (card === undefined) return [];
      const before = movePosition(cell.cursor.placementAt(card.logicalIndex));
      const after = movePosition(cell.cursor.placementAt(card.logicalIndex + 1));
      return before === undefined || after === undefined
        ? []
        : [Object.freeze({ cardKey: card.cardKey, rect: geometry, before, after })];
    }),
  );
}

/** Projects one visible cell into semantic target geometry using only current cursor placements. */
function dropCell<TCard>(
  current: KanbanViewportDragScene<TCard>,
  geometry: KanbanSceneGeometry['cells'][number],
): KanbanDropCellInput | undefined {
  const scene = current.scene.cells.find((cell) => sameAddress(cell.address, geometry.address));
  const source = sourceCell(current.source, geometry.address);
  if (scene === undefined || source === undefined) return undefined;
  try {
    const cards = current.geometry.cards
      .filter((card) => sameAddress(card.address, geometry.address))
      .sort((left, right) => left.logicalIndex - right.logicalIndex);
    const firstSlot = cards[0]?.logicalIndex ?? 0;
    const lastSlot = cards.length === 0 ? 0 : cards[cards.length - 1]!.logicalIndex + 1;
    const leadingPlacement = source.cursor.placementAt(firstSlot);
    const trailingPlacement = source.cursor.placementAt(lastSlot);
    const leading = movePosition(leadingPlacement);
    const trailing = movePosition(trailingPlacement);
    const length = source.cursor.length();
    const leadingComplete = leading?.kind === 'start';
    const trailingComplete = trailing?.kind === 'end';
    const empty = length.kind === 'exact' && length.value === 0;
    const gutters = cards.slice(1).flatMap((card) => {
      const position = movePosition(source.cursor.placementAt(card.logicalIndex));
      if (position === undefined) return [];
      return [
        Object.freeze({
          rect: Object.freeze({ x: geometry.x, y: Math.max(geometry.y, card.y - 1), width: geometry.width, height: 1 }),
          position,
        }),
      ];
    });
    const postHeaderPosition = leading ?? movePosition(source.cursor.placementAt(0));
    return Object.freeze({
      address: geometry.address,
      content: geometry,
      header: Object.freeze({ x: geometry.x, y: Math.max(0, geometry.y - 1), width: geometry.width, height: 1 }),
      ...(postHeaderPosition === undefined
        ? {}
        : {
            postHeader: Object.freeze({
              rect: Object.freeze({ x: geometry.x, y: geometry.y, width: geometry.width, height: 1 }),
              position: postHeaderPosition,
            }),
          }),
      ...(leadingComplete && leading !== undefined
        ? { leading: Object.freeze({ rect: edgeRect(geometry, 'leading'), position: leading }) }
        : {}),
      ...(trailingComplete && trailing !== undefined
        ? { trailing: Object.freeze({ rect: edgeRect(geometry, 'trailing'), position: trailing }) }
        : {}),
      cards: dropCards(current.scene, cards, source),
      gutters: Object.freeze(gutters),
      complete: Object.freeze({ leading: leadingComplete, trailing: trailingComplete, empty }),
      ...(!leadingComplete
        ? { unknownLeading: unknownEdge(source, leadingPlacement, edgeRect(geometry, 'leading'), 'leading') }
        : {}),
      ...(!trailingComplete
        ? { unknownTrailing: unknownEdge(source, trailingPlacement, edgeRect(geometry, 'trailing'), 'trailing') }
        : {}),
    });
  } catch {
    return undefined;
  }
}

/** Purely projects the current scene into one target map. */
function dropMap<TCard>(
  current: KanbanViewportDragScene<TCard>,
  active: KanbanCardDropTarget | undefined,
  activeIndicator?: Readonly<Rect>,
) {
  const cells = current.geometry.cells.flatMap((geometry) => {
    const cell = dropCell(current, geometry);
    return cell === undefined ? [] : [cell];
  });
  return projectKanbanCardDropMap({
    density: current.density,
    cells,
    geometryGeneration: current.geometryGeneration,
    bounds: Object.freeze({
      x: 0,
      y: 0,
      width: current.viewport.x + current.viewport.width,
      height: current.viewport.y + current.viewport.height,
    }),
    ...(current.density !== 'compact' || active === undefined || activeIndicator === undefined
      ? {}
      : {
          activeGap: Object.freeze({
            address: active.address,
            rect: activeIndicator,
            position: active.position,
            eligibility: active.eligibility,
          }),
        }),
  });
}

/**
 * Projects one generous drop hit region onto the actual one-row insertion boundary it represents.
 *
 * Card halves remain easy mouse targets, but their visible cue belongs immediately before or after
 * the complete card. This separation prevents a pointer over the middle of a card from painting a
 * misleading insertion line through its content.
 */
export function projectKanbanDropIndicatorRect(
  target: KanbanCardDropTarget,
  geometry: Pick<KanbanSceneGeometry, 'cells' | 'cards'>,
): Readonly<Rect> | undefined {
  const cell = geometry.cells.find((candidate) => sameAddress(candidate.address, target.address));
  if (cell === undefined) return undefined;
  const cellCards = geometry.cards
    .filter((candidate) => sameAddress(candidate.address, target.address))
    .sort((left, right) => left.logicalIndex - right.logicalIndex);
  const targetCardKey = target.cardKey;
  const card =
    targetCardKey === undefined
      ? undefined
      : cellCards.find(
          (candidate) => sameCard(candidate.cardKey, targetCardKey) && sameAddress(candidate.address, target.address),
        );
  const targetRect = target.rect;
  const position = target.position;
  const afterCardKey = position.kind === 'between' ? position.afterCardKey : null;
  const beforeCardKey = position.kind === 'between' ? position.beforeCardKey : null;
  const beforeCard =
    afterCardKey !== null
      ? cellCards.find((candidate) => sameCard(candidate.cardKey, afterCardKey))
      : position.kind === 'window-edge' && position.edge === 'before'
        ? cellCards.find((candidate) => sameCard(candidate.cardKey, position.neighborCardKey))
        : position.kind === 'start'
          ? cellCards[0]
          : target.kind === 'card-before'
            ? card
            : undefined;
  const afterCard =
    beforeCardKey !== null
      ? cellCards.find((candidate) => sameCard(candidate.cardKey, beforeCardKey))
      : position.kind === 'window-edge' && position.edge === 'after'
        ? cellCards.find((candidate) => sameCard(candidate.cardKey, position.neighborCardKey))
        : position.kind === 'end'
          ? cellCards[cellCards.length - 1]
          : target.kind === 'card-after'
            ? card
            : undefined;
  const anchor = beforeCard ?? afterCard;
  if (anchor !== undefined) {
    const boundary = beforeCard !== undefined ? anchor.y - 1 : anchor.y + anchor.height;
    return Object.freeze({
      x: anchor.x,
      y: Math.min(Math.max(cell.y, boundary), cell.y + cell.height - 1),
      width: anchor.width,
      height: 1,
    });
  }
  if (targetRect === undefined) return undefined;
  return Object.freeze({ x: targetRect.x, y: targetRect.y, width: targetRect.width, height: 1 });
}

/** Owns all render-neutral mounted card-drag resources for one viewport. */
export class KanbanViewportDragController<TCard> {
  readonly #options: KanbanViewportDragControllerOptions<TCard>;
  readonly #drag: KanbanCardDragController;
  readonly #autoscroll: KanbanDragAutoscrollController;
  readonly #prefetch: KanbanDragPrefetchController;
  readonly #hover: KanbanCollapsedHoverController;
  #generation: number | undefined;
  #point: Readonly<Point> | undefined;
  #actionTarget: KanbanActionTarget | undefined;
  #moved: readonly KanbanMovedCardSnapshot[] | undefined;
  #viewRevision: KanbanRevision | undefined;
  #target: KanbanCardDropTarget | undefined;
  #disposed = false;

  /** Captures viewport seams without opening source work before a drag starts. */
  constructor(options: KanbanViewportDragControllerOptions<TCard>) {
    this.#options = options;
    this.#drag = createKanbanCardDragController({
      commitProposal: (proposal) => options.commitProposal(proposal),
      invalidate: options.invalidate,
    });
    this.#autoscroll = createKanbanDragAutoscrollController({
      scroll: (step) => options.scroll(step),
      recompute: () => options.invalidate(),
    });
    this.#prefetch = createKanbanDragPrefetchController({
      ensureRange: (hint, signal) => {
        const current = options.readScene();
        const cell = current === undefined ? undefined : sourceCell(current.source, hint.address);
        return cell === undefined
          ? Promise.reject(new Error('Kanban drag source cell is unavailable.'))
          : cell.cursor.ensureRange(hint.start, hint.start + hint.count, { signal });
      },
      publishEvidence: () => options.invalidate(),
    });
    this.#hover = createKanbanCollapsedHoverController({ onChanged: options.invalidate });
  }

  /** Begins one captured card drag from current source placement evidence. */
  begin(start: KanbanPointerDragStart): boolean {
    if (this.#disposed || this.#generation !== undefined || start.originPoint === undefined) return false;
    const current = this.#options.readScene();
    if (current === undefined) return false;
    const moved = movedCards(start, current);
    if (moved === undefined) return false;
    const accepted = this.#drag.begin({
      generation: start.generation,
      capture: start.capture,
      dragged: moved,
      originPoint: start.originPoint,
      sceneRevision: current.sceneRevision,
      geometryGeneration: current.geometryGeneration,
      ...(start.target.cardKey === undefined ? {} : { originCardKey: start.target.cardKey }),
      ...(start.priorSelection.viewRevision === undefined ? {} : { viewRevision: start.priorSelection.viewRevision }),
    });
    if (!accepted) return false;
    this.#generation = start.generation;
    this.#point = start.point;
    this.#moved = moved;
    this.#viewRevision = start.priorSelection.viewRevision;
    this.update(start.generation, start.point);
    return true;
  }

  /** Recomputes target, prefetch, and autoscroll ownership for one current move report. */
  update(generation: number, point: Readonly<Point>, actionTarget?: KanbanActionTarget): boolean {
    if (this.#disposed || generation !== this.#generation) return false;
    const current = this.#options.readScene();
    if (current === undefined) return false;
    const previousPoint = this.#point;
    this.#point = Object.freeze({ x: point.x, y: point.y });
    this.#actionTarget = actionTarget;
    const activeIndicator =
      this.#target === undefined ? undefined : projectKanbanDropIndicatorRect(this.#target, current.geometry);
    const candidate = dropMap(current, this.#target, activeIndicator).targetAt(point);
    const previousTarget = this.#target;
    const selected = selectKanbanDropTargetWithHysteresis({
      current: this.#target,
      candidate,
      point,
      geometryGeneration: current.geometryGeneration,
    });
    this.#target = this.#evaluateTarget(selected);
    const gapRect =
      this.#target === undefined ? undefined : projectKanbanDropIndicatorRect(this.#target, current.geometry);
    this.#drag.propose({
      generation,
      point,
      target: this.#target,
      gapRect,
      sceneRevision: current.sceneRevision,
      geometryGeneration: current.geometryGeneration,
    });
    this.#prefetch.update(this.#target, generation);
    this.#autoscroll.update({ point, viewport: current.viewport, generation });
    if (actionTarget?.kind === 'swimlane-header' && actionTarget.swimlaneId !== undefined) {
      const hover = this.#hover.snapshot();
      const ownsTemporaryExpansion = hover.kind === 'expanded' && hover.swimlaneId === actionTarget.swimlaneId;
      this.#hover.begin({
        swimlaneId: actionTarget.swimlaneId,
        visible: current.source.visibleSwimlanes.some(({ swimlaneId }) => swimlaneId === actionTarget.swimlaneId),
        collapsed: ownsTemporaryExpansion || current.source.collapsedSwimlaneIds.includes(actionTarget.swimlaneId),
      });
    } else {
      this.#hover.cancel();
    }
    if (
      previousPoint?.x !== this.#point.x ||
      previousPoint.y !== this.#point.y ||
      !sameTarget(previousTarget, this.#target)
    ) {
      this.#options.invalidate();
    }
    return true;
  }

  /** Re-evaluates the retained point after a projection or drag-owned scroll changes geometry. */
  reproject(): void {
    if (this.#generation === undefined || this.#point === undefined) return;
    this.update(this.#generation, this.#point, this.#actionTarget);
  }

  /** Returns whether a source publication invalidated dragged or current destination evidence. */
  sourceChangeRelevant(): boolean {
    const current = this.#options.readScene();
    const moved = this.#moved;
    if (this.#generation === undefined || current === undefined || moved === undefined) return false;
    try {
      const refreshed: KanbanMovedCardSnapshot[] = [];
      for (const entry of moved) {
        const card = current.scene.cards.find((candidate) => sameCard(candidate.cardKey, entry.cardKey));
        if (
          card === undefined ||
          !sameAddress(card.address, entry.source) ||
          !kanbanRevisionsEqual(card.entityRevision, entry.entityRevision)
        ) {
          return true;
        }
        const cell = sourceCell(current.source, entry.source);
        if (cell === undefined) return true;
        const placement = movePosition(cell.cursor.placementAt(card.logicalIndex));
        if (placement === undefined || !samePosition(placement, entry.sourcePlacement)) return true;
        refreshed.push(
          Object.freeze({
            cardKey: card.cardKey,
            source: card.address,
            sourcePlacement: placement,
            sourceRevision: cell.cursor.revision(),
            entityRevision: card.entityRevision,
          }),
        );
      }
      if (this.#target !== undefined && this.#target.kind !== 'unknown-edge') {
        const target = this.#target;
        if (
          !dropMap(current, target, projectKanbanDropIndicatorRect(target, current.geometry)).targets.some(
            (candidate) =>
              candidate.kind === target.kind &&
              sameAddress(candidate.address, target.address) &&
              samePosition(candidate.position, target.position),
          )
        ) {
          return true;
        }
      }
      const next = Object.freeze(refreshed);
      if (
        !this.#drag.refreshSource({
          generation: this.#generation,
          dragged: next,
          sceneRevision: current.sceneRevision,
        })
      ) {
        return true;
      }
      this.#moved = next;
      return false;
    } catch {
      return true;
    }
  }

  /** Releases through the current semantic target and clears all discovery work first. */
  release(generation: number): boolean {
    if (generation !== this.#generation) return false;
    const current = this.#options.readScene();
    this.#clearDiscovery();
    return current === undefined
      ? this.#drag.cancel('source-change') && false
      : this.#drag.release({
          generation,
          sceneRevision: current.sceneRevision,
          geometryGeneration: current.geometryGeneration,
        });
  }

  /** Cancels one matching generation without dispatching. */
  cancel(generation: number | undefined, reason: KanbanDragCancellationReason): boolean {
    if (generation !== undefined && generation !== this.#generation) return false;
    this.#clearDiscovery();
    return this.#drag.cancel(reason);
  }

  /** Returns render-neutral overlay evidence for later projection. */
  snapshot(): KanbanCardDragControllerSnapshot {
    return this.#drag.snapshot();
  }

  /** Returns the sole temporarily expanded swimlane without changing application policy. */
  temporaryExpandedSwimlaneId(): string | undefined {
    const hover = this.#hover.snapshot();
    return hover.kind === 'expanded' ? hover.swimlaneId : undefined;
  }

  /** Cancels current work and rejects future input. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancel(undefined, 'dispose');
    this.#prefetch.dispose();
    this.#hover.dispose();
  }

  /** Clears timer, request, point, and semantic-target ownership synchronously. */
  #clearDiscovery(): void {
    this.#generation = undefined;
    this.#point = undefined;
    this.#actionTarget = undefined;
    this.#moved = undefined;
    this.#viewRevision = undefined;
    this.#target = undefined;
    this.#autoscroll.cancel();
    this.#prefetch.cancel();
    this.#hover.cancel();
  }

  /** Classifies one current geometric target through the owning board's pure policy boundary. */
  #evaluateTarget(target: KanbanCardDropTarget | undefined): KanbanCardDropTarget | undefined {
    const moved = this.#moved;
    if (target === undefined || moved === undefined || target.kind === 'unknown-edge') return target;
    try {
      const proposal = snapshotKanbanRequestProposal({
        kind: 'card-move',
        moved,
        target: target.address,
        position: target.position,
        ...(this.#viewRevision === undefined ? {} : { viewRevision: this.#viewRevision }),
      });
      if (proposal.kind !== 'card-move') return undefined;
      return Object.freeze({
        ...target,
        eligibility: snapshotKanbanEligibility(this.#options.evaluateProposal(proposal)),
      });
    } catch {
      return Object.freeze({
        ...target,
        eligibility: Object.freeze({ kind: 'unavailable', code: 'eligibility-unavailable' }),
      });
    }
  }
}
