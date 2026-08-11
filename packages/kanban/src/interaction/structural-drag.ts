import type { Point, PointerCaptureLease, Rect } from '@jsvision/ui';

import type { KanbanColumnReorderProposal, KanbanSwimlaneReorderProposal } from '../contract/request.js';
import type { KanbanRevision } from '../contract/revision.js';
import { createKanbanDragAutoscrollController } from './drag-autoscroll.js';
import type { KanbanDragAutoscrollController } from './drag-autoscroll.js';
import type { KanbanPointerDragCancellationReason, KanbanPointerStructureDragStart } from './pointer-router.js';

/** Structural identity shared by source placeholders and insertion resolution. */
export type KanbanStructuralDragIdentity =
  { readonly kind: 'column'; readonly columnId: string } | { readonly kind: 'swimlane'; readonly swimlaneId: string };

/** One visible structural sibling and its exact current header rectangle. */
export interface KanbanStructuralDragSibling extends Readonly<Rect> {
  /** Stable sibling identity. */
  readonly id: string;
}

/** Current renderer-independent structure and geometry evidence. */
export interface KanbanStructuralDragScene {
  /** Revision owning current structure and target geometry. */
  readonly sceneRevision: KanbanRevision;
  /** Monotonic geometry generation. */
  readonly geometryGeneration: number;
  /** Current scrollable viewport used by shared autoscroll. */
  readonly viewport: Readonly<Rect>;
  /** Complete source-ordered column identities. */
  readonly columnOrder: readonly string[];
  /** Visible workflow-header geometry. */
  readonly columns: readonly KanbanStructuralDragSibling[];
  /** Explicit application-owned swimlane order, absent for derived grouping. */
  readonly swimlaneOrder?: readonly string[];
  /** Visible explicit swimlane-header geometry. */
  readonly swimlanes: readonly KanbanStructuralDragSibling[];
}

/** Renderer-neutral structural ghost, source placeholder, and sibling marker evidence. */
export interface KanbanStructuralDragOverlayEvidence {
  /** Active gesture identity. */
  readonly generation: number;
  /** Geometry generation owning the rectangles. */
  readonly geometryGeneration: number;
  /** Stable structural identity being moved. */
  readonly structure: KanbanStructuralDragIdentity;
  /** Current pointer anchor for the bounded header ghost. */
  readonly point: Readonly<Point>;
  /** Exact current source header rectangle. */
  readonly sourceRect: Readonly<Rect>;
  /** Current one-cell sibling insertion marker. */
  readonly markerRect?: Readonly<Rect>;
}

/** Detached structural controller state used by overlay projection and inspection. */
export type KanbanStructuralDragSnapshot =
  { readonly kind: 'idle' } | { readonly kind: 'dragging'; readonly overlay: KanbanStructuralDragOverlayEvidence };

/** Viewport-owned seams required by structural drag without source-record access. */
export interface KanbanStructuralDragControllerOptions {
  /** Reads current structure and exact geometry. */
  readonly readScene: () => KanbanStructuralDragScene | undefined;
  /** Admits one complete structural proposal through the board coordinator. */
  readonly commitProposal: (proposal: KanbanColumnReorderProposal | KanbanSwimlaneReorderProposal) => boolean;
  /** Applies one bounded shared autoscroll step. */
  readonly scroll: (step: Readonly<Point>) => Readonly<Point>;
  /** Schedules repaint after structural evidence changes. */
  readonly invalidate: () => void;
}

/** Internal target combines semantic request placement and its non-color marker. */
interface KanbanStructuralTarget {
  readonly proposal: KanbanColumnReorderProposal | KanbanSwimlaneReorderProposal;
  readonly markerRect: Readonly<Rect>;
}

/** Internal ownership retained for exactly one capture generation. */
interface ActiveKanbanStructuralDrag {
  readonly generation: number;
  readonly capture: PointerCaptureLease;
  readonly structure: KanbanStructuralDragIdentity;
  readonly sourceRect: Readonly<Rect>;
  point: Readonly<Point>;
  sceneRevision: KanbanRevision;
  geometryGeneration: number;
  target?: KanbanStructuralTarget;
}

const IDLE: KanbanStructuralDragSnapshot = Object.freeze({ kind: 'idle' });

/** Returns whether a point remains inside a one-cell hysteresis halo. */
function insideHalo(point: Readonly<Point>, rect: Readonly<Rect>): boolean {
  return (
    point.x >= rect.x - 1 &&
    point.x < rect.x + rect.width + 1 &&
    point.y >= rect.y - 1 &&
    point.y < rect.y + rect.height + 1
  );
}

/** Resolves the nearest visible sibling along one structural axis. */
function nearestSibling(
  siblings: readonly KanbanStructuralDragSibling[],
  point: Readonly<Point>,
  axis: 'x' | 'y',
): KanbanStructuralDragSibling | undefined {
  return siblings.reduce<KanbanStructuralDragSibling | undefined>((nearest, sibling) => {
    const coordinate = axis === 'x' ? point.x : point.y;
    const center = axis === 'x' ? sibling.x + sibling.width / 2 : sibling.y + sibling.height / 2;
    if (nearest === undefined) return sibling;
    const nearestCenter = axis === 'x' ? nearest.x + nearest.width / 2 : nearest.y + nearest.height / 2;
    return Math.abs(coordinate - center) < Math.abs(coordinate - nearestCenter) ? sibling : nearest;
  }, undefined);
}

/** Resolves a column insertion among siblings after removing the source identity. */
function columnTarget(
  structure: Extract<KanbanStructuralDragIdentity, { readonly kind: 'column' }>,
  scene: KanbanStructuralDragScene,
  point: Readonly<Point>,
): KanbanStructuralTarget | undefined {
  const sibling = nearestSibling(scene.columns, point, 'x');
  if (sibling === undefined) return undefined;
  const order = scene.columnOrder.filter((id) => id !== structure.columnId);
  const siblingIndex = order.indexOf(sibling.id);
  if (siblingIndex < 0) return undefined;
  const insertion = point.x <= sibling.x + sibling.width / 2 ? siblingIndex : siblingIndex + 1;
  const currentWithoutSource = scene.columnOrder.filter((id) => id !== structure.columnId);
  const currentIndex = scene.columnOrder.indexOf(structure.columnId);
  const normalizedCurrent = Math.min(currentIndex, currentWithoutSource.length);
  if (insertion === normalizedCurrent) return undefined;
  const beforeColumnId = order[insertion - 1] ?? null;
  const afterColumnId = order[insertion] ?? null;
  const position =
    beforeColumnId === null
      ? ({ kind: 'start' } as const)
      : afterColumnId === null
        ? ({ kind: 'end' } as const)
        : ({ kind: 'between', beforeColumnId, afterColumnId } as const);
  const markerX = point.x <= sibling.x + sibling.width / 2 ? sibling.x : sibling.x + sibling.width - 1;
  return Object.freeze({
    proposal: Object.freeze({ kind: 'column-reorder', columnId: structure.columnId, position }),
    markerRect: Object.freeze({ x: markerX, y: sibling.y, width: 1, height: sibling.height }),
  });
}

/** Resolves an explicit swimlane insertion among application-ordered siblings. */
function swimlaneTarget(
  structure: Extract<KanbanStructuralDragIdentity, { readonly kind: 'swimlane' }>,
  scene: KanbanStructuralDragScene,
  point: Readonly<Point>,
): KanbanStructuralTarget | undefined {
  const sourceOrder = scene.swimlaneOrder;
  const sibling = nearestSibling(scene.swimlanes, point, 'y');
  if (sourceOrder === undefined || sibling === undefined) return undefined;
  const order = sourceOrder.filter((id) => id !== structure.swimlaneId);
  const siblingIndex = order.indexOf(sibling.id);
  if (siblingIndex < 0) return undefined;
  const before = point.y <= sibling.y + sibling.height / 2;
  const insertion = before ? siblingIndex : siblingIndex + 1;
  const currentIndex = sourceOrder.indexOf(structure.swimlaneId);
  if (insertion === Math.min(currentIndex, order.length)) return undefined;
  const position =
    insertion === 0
      ? ({ kind: 'start' } as const)
      : insertion === order.length
        ? ({ kind: 'end' } as const)
        : before
          ? ({ kind: 'before', swimlaneId: sibling.id } as const)
          : ({ kind: 'after', swimlaneId: sibling.id } as const);
  const markerY = before ? sibling.y : sibling.y + sibling.height - 1;
  return Object.freeze({
    proposal: Object.freeze({ kind: 'swimlane-reorder', swimlaneId: structure.swimlaneId, position }),
    markerRect: Object.freeze({ x: sibling.x, y: markerY, width: sibling.width, height: 1 }),
  });
}

/** Owns one captured column or explicit-swimlane reorder and its shared autoscroll lifetime. */
export class KanbanStructuralDragController {
  readonly #options: KanbanStructuralDragControllerOptions;
  readonly #autoscroll: KanbanDragAutoscrollController;
  #active: ActiveKanbanStructuralDrag | undefined;
  #disposed = false;

  /** Captures viewport services without opening timers before a gesture starts. */
  constructor(options: KanbanStructuralDragControllerOptions) {
    this.#options = options;
    this.#autoscroll = createKanbanDragAutoscrollController({
      scroll: options.scroll,
      recompute: options.invalidate,
    });
  }

  /** Adopts one eligible header capture using current exact geometry. */
  begin(start: KanbanPointerStructureDragStart): boolean {
    if (this.#disposed || this.#active !== undefined || start.originPoint === undefined || !start.capture.active()) {
      return false;
    }
    const scene = this.#options.readScene();
    if (scene === undefined) return false;
    const siblings = start.structure.kind === 'column' ? scene.columns : scene.swimlanes;
    const id = start.structure.kind === 'column' ? start.structure.columnId : start.structure.swimlaneId;
    if (start.structure.kind === 'swimlane' && scene.swimlaneOrder === undefined) return false;
    const source = siblings.find((candidate) => candidate.id === id);
    if (source === undefined) return false;
    this.#active = {
      generation: start.generation,
      capture: start.capture,
      structure: Object.freeze({ ...start.structure }),
      sourceRect: Object.freeze({ x: source.x, y: source.y, width: source.width, height: source.height }),
      point: Object.freeze({ ...start.point }),
      sceneRevision: scene.sceneRevision,
      geometryGeneration: scene.geometryGeneration,
    };
    this.update(start.generation, start.point);
    return true;
  }

  /** Recomputes the sibling-only insertion target for one matching generation. */
  update(generation: number, point: Readonly<Point>): boolean {
    const active = this.#active;
    const scene = this.#options.readScene();
    if (this.#disposed || active === undefined || active.generation !== generation || scene === undefined) return false;
    active.point = Object.freeze({ ...point });
    active.sceneRevision = scene.sceneRevision;
    active.geometryGeneration = scene.geometryGeneration;
    if (active.target === undefined || !insideHalo(point, active.target.markerRect)) {
      active.target =
        active.structure.kind === 'column'
          ? columnTarget(active.structure, scene, point)
          : swimlaneTarget(active.structure, scene, point);
    }
    this.#autoscroll.update({ point, viewport: scene.viewport, generation });
    this.#options.invalidate();
    return true;
  }

  /** Reprojects a retained pointer after scroll or layout changes. */
  reproject(): void {
    const active = this.#active;
    if (active !== undefined) this.update(active.generation, active.point);
  }

  /** Commits exactly one current structural request and clears capture ownership first. */
  release(generation: number): boolean {
    const active = this.#active;
    const scene = this.#options.readScene();
    if (
      active === undefined ||
      active.generation !== generation ||
      scene === undefined ||
      active.sceneRevision !== scene.sceneRevision ||
      active.geometryGeneration !== scene.geometryGeneration
    ) {
      this.cancel(generation, 'source-change');
      return false;
    }
    const proposal = active.target?.proposal;
    this.#finish(active);
    if (proposal === undefined) return false;
    try {
      return this.#options.commitProposal(proposal);
    } catch {
      return false;
    }
  }

  /** Cancels one matching capture generation without dispatching. */
  cancel(generation: number | undefined, _reason: KanbanPointerDragCancellationReason): boolean {
    const active = this.#active;
    if (active === undefined || (generation !== undefined && generation !== active.generation)) return false;
    this.#finish(active);
    return true;
  }

  /** Returns immutable bounded visual evidence for the current structure gesture. */
  snapshot(): KanbanStructuralDragSnapshot {
    const active = this.#active;
    if (active === undefined) return IDLE;
    return Object.freeze({
      kind: 'dragging',
      overlay: Object.freeze({
        generation: active.generation,
        geometryGeneration: active.geometryGeneration,
        structure: Object.freeze({ ...active.structure }),
        point: Object.freeze({ ...active.point }),
        sourceRect: Object.freeze({ ...active.sourceRect }),
        ...(active.target === undefined ? {} : { markerRect: Object.freeze({ ...active.target.markerRect }) }),
      }),
    });
  }

  /** Cancels current work and rejects future structural input. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancel(undefined, 'disposed');
  }

  /** Invalidates ownership before releasing capture so synchronous callbacks are stale. */
  #finish(active: ActiveKanbanStructuralDrag): void {
    if (this.#active !== active) return;
    this.#active = undefined;
    this.#autoscroll.cancel();
    try {
      active.capture.release();
    } catch {
      // Generation invalidation already made hostile cleanup inert.
    }
    this.#options.invalidate();
  }
}
