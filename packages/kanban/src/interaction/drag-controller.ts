import type { Point, PointerCaptureLease } from '@jsvision/ui';

import {
  snapshotKanbanDataArray,
  snapshotKanbanDataProperties,
  validateKanbanDataKeys,
} from '../contract/data-snapshot.js';
import { KANBAN_LIMITS } from '../contract/limits.js';
import { createKanbanCardKey } from '../contract/identity.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanCardMoveProposal, KanbanMovedCardSnapshot } from '../contract/request.js';
import { snapshotKanbanRequestProposal } from '../contract/request-validation.js';
import { snapshotKanbanRevision } from '../contract/revision.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanEligibility } from '../operation/eligibility.js';
import type { KanbanCardDropTarget, KanbanDragCancellationReason, KanbanDragOverlayEvidence } from './drag-types.js';
import { createKanbanDragGhostEvidence } from './drag-selection.js';

/** Exact members accepted when beginning one captured card drag. */
const BEGIN_KEYS = new Set([
  'generation',
  'capture',
  'dragged',
  'originCardKey',
  'originPoint',
  'sceneRevision',
  'geometryGeneration',
  'viewRevision',
]);

/** Minimal threshold-crossing evidence adopted by the controller. */
export interface KanbanCardDragBegin {
  /** Monotonic pointer gesture identity. */
  readonly generation: number;
  /** Active generation-bound pointer capture. */
  readonly capture: PointerCaptureLease;
  /** Ordered concrete source evidence for the atomic move. */
  readonly dragged: readonly KanbanMovedCardSnapshot[];
  /** Pointer-origin identity retained separately from deterministic moved-set ordering. */
  readonly originCardKey?: CardKey;
  /** Viewport-local point where the press began. */
  readonly originPoint: Readonly<Point>;
  /** Scene revision that owns the source evidence. */
  readonly sceneRevision: KanbanRevision;
  /** Geometry generation used for target discovery. */
  readonly geometryGeneration: number;
  /** Optional saved-view revision captured with the selected set. */
  readonly viewRevision?: KanbanRevision;
}

/** Current semantic target update for one active generation. */
export interface KanbanCardDragProposalUpdate {
  /** Gesture identity whose proposal is changing. */
  readonly generation: number;
  /** Current target, or absence when the pointer is outside a target. */
  readonly target?: KanbanCardDropTarget;
  /** Current scene revision after any drag-owned scrolling and reprojection. */
  readonly sceneRevision?: KanbanRevision;
  /** Current geometry generation after any drag-owned scrolling and reprojection. */
  readonly geometryGeneration?: number;
}

/** Current release evidence captured before atomic coordinator handoff. */
export interface KanbanCardDragRelease {
  /** Gesture identity carried by the pointer-up report. */
  readonly generation: number;
  /** Current scene revision. */
  readonly sceneRevision: KanbanRevision;
  /** Current post-layout geometry generation. */
  readonly geometryGeneration: number;
}

/** Relevant publication evidence used to cancel stale source ownership. */
export interface KanbanCardDragReconcile {
  /** Gesture identity being revalidated. */
  readonly generation: number;
  /** Current scene revision after publication. */
  readonly sceneRevision: KanbanRevision;
  /** Exact card identities changed by the publication, when known. */
  readonly changedCardKeys?: readonly CardKey[];
}

/** Fresh equivalent source snapshots adopted after an unrelated authoritative publication. */
export interface KanbanCardDragSourceRefresh {
  /** Current gesture identity. */
  readonly generation: number;
  /** Same ordered card identities with refreshed cursor and entity revisions. */
  readonly dragged: readonly KanbanMovedCardSnapshot[];
  /** Scene revision owning the refreshed snapshots. */
  readonly sceneRevision: KanbanRevision;
}

/** Application-independent seams used by one render-neutral card drag. */
export interface KanbanCardDragControllerOptions {
  /** Atomically hand a fresh move proposal and current eligibility to board coordination. */
  readonly commitProposal: (proposal: KanbanCardMoveProposal, eligibility: KanbanEligibility) => boolean;
  /** Schedule the one settled cleanup repaint after release or cancellation. */
  readonly invalidate: () => void;
}

/** Payload-free controller state exposed to viewport inspection. */
export type KanbanCardDragControllerSnapshot =
  | { readonly kind: 'idle' }
  | { readonly kind: 'dragging'; readonly overlay: KanbanDragOverlayEvidence }
  | { readonly kind: 'proposed'; readonly overlay: KanbanDragOverlayEvidence; readonly target: KanbanCardDropTarget };

/** Internal resources retained for exactly one live gesture. */
interface ActiveCardDrag {
  readonly generation: number;
  readonly capture: PointerCaptureLease;
  dragged: readonly KanbanMovedCardSnapshot[];
  readonly viewRevision?: KanbanRevision;
  sceneRevision: KanbanRevision;
  geometryGeneration: number;
  overlay: KanbanDragOverlayEvidence;
  target?: KanbanCardDropTarget;
}

const IDLE: KanbanCardDragControllerSnapshot = Object.freeze({ kind: 'idle' });

/** Validate a non-negative viewport-local terminal point. */
function point(value: unknown): Readonly<Point> {
  const properties = snapshotKanbanDataProperties(value, 2);
  validateKanbanDataKeys(properties, new Set(['x', 'y']));
  if (
    typeof properties.x !== 'number' ||
    !Number.isSafeInteger(properties.x) ||
    properties.x < 0 ||
    typeof properties.y !== 'number' ||
    !Number.isSafeInteger(properties.y) ||
    properties.y < 0
  ) {
    throw new RangeError('Invalid Kanban drag point.');
  }
  return Object.freeze({ x: properties.x, y: properties.y });
}

/** Validate one positive safe generation without allowing wrap or coercion. */
function generation(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new RangeError('Invalid Kanban drag generation.');
  }
  return value;
}

/** Narrow the internal UI lease seam while containing hostile member access. */
function isPointerCaptureLease(value: unknown): value is PointerCaptureLease {
  try {
    const leaseGeneration = typeof value === 'object' && value !== null ? Reflect.get(value, 'generation') : undefined;
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof leaseGeneration === 'number' &&
      Number.isSafeInteger(leaseGeneration) &&
      leaseGeneration > 0 &&
      typeof Reflect.get(value, 'active') === 'function' &&
      typeof Reflect.get(value, 'release') === 'function'
    );
  } catch {
    return false;
  }
}

/** Validate moved-card evidence through the canonical request boundary. */
function draggedCards(value: unknown): readonly KanbanMovedCardSnapshot[] {
  const inputs = snapshotKanbanDataArray(value, KANBAN_LIMITS.selectedKeys.safe);
  if (inputs.length === 0) throw new RangeError('A Kanban drag requires at least one card.');
  const firstProperties = snapshotKanbanDataProperties(inputs[0]);
  const source = firstProperties.source;
  const sourceRevision = firstProperties.sourceRevision;
  const proposal = snapshotKanbanRequestProposal({
    kind: 'card-move',
    moved: inputs,
    target: source,
    position: { kind: 'start', cursorRevision: sourceRevision },
  });
  if (proposal.kind !== 'card-move') throw new RangeError('Invalid Kanban dragged cards.');
  return proposal.moved;
}

/** Group ordered dragged identities into source placeholders without retaining card records. */
function placeholders(dragged: readonly KanbanMovedCardSnapshot[]) {
  const groups = new Map<string, { address: KanbanMovedCardSnapshot['source']; cardKeys: CardKey[] }>();
  for (const card of dragged) {
    const key = `${card.source.columnId.length}:${card.source.columnId}:${card.source.swimlaneId ?? ''}`;
    const group = groups.get(key) ?? { address: card.source, cardKeys: [] };
    group.cardKeys.push(card.cardKey);
    groups.set(key, group);
  }
  return Object.freeze(
    [...groups.values()].map(({ address, cardKeys }) => Object.freeze({ address, cardKeys: Object.freeze(cardKeys) })),
  );
}

/** Create initial render-neutral ghost and source-placeholder evidence. */
function initialOverlay(begin: KanbanCardDragBegin): KanbanDragOverlayEvidence {
  return Object.freeze({
    generation: begin.generation,
    geometryGeneration: begin.geometryGeneration,
    ghost: createKanbanDragGhostEvidence(begin.dragged, begin.originPoint, begin.originCardKey),
    placeholders: placeholders(begin.dragged),
  });
}

/** Preserve numeric/string identity while checking relevant publication evidence. */
function sameCard(left: CardKey, right: CardKey): boolean {
  return typeof left === typeof right && left === right;
}

/**
 * Owns one capture-backed card drag without rendering or mutating application data.
 *
 * Every terminal path invalidates internal ownership before callbacks or capture release, so a
 * synchronous loss callback and queued pointer-up cannot revive the completed generation.
 */
export class KanbanCardDragController {
  readonly #commitProposal: KanbanCardDragControllerOptions['commitProposal'];
  readonly #invalidate: () => void;
  #active: ActiveCardDrag | undefined;

  /** Capture the board handoff seams without reading source records. */
  constructor(options: KanbanCardDragControllerOptions) {
    this.#commitProposal = options.commitProposal;
    this.#invalidate = options.invalidate;
  }

  /** Adopt one validated active capture; a second live drag is rejected. */
  begin(value: KanbanCardDragBegin): boolean {
    if (this.#active !== undefined) return false;
    try {
      const properties = snapshotKanbanDataProperties(value, BEGIN_KEYS.size);
      validateKanbanDataKeys(properties, BEGIN_KEYS);
      const currentGeneration = generation(properties.generation);
      const originPoint = point(properties.originPoint);
      const dragged = draggedCards(properties.dragged);
      const sceneRevision = snapshotKanbanRevision(properties.sceneRevision);
      const geometryGeneration = generation(properties.geometryGeneration);
      const originCardKey =
        properties.originCardKey === undefined
          ? undefined
          : typeof properties.originCardKey === 'string' || typeof properties.originCardKey === 'number'
            ? createKanbanCardKey(properties.originCardKey)
            : (() => {
                throw new RangeError('Invalid Kanban drag origin identity.');
              })();
      const viewRevision =
        properties.viewRevision === undefined ? undefined : snapshotKanbanRevision(properties.viewRevision);
      const capture = properties.capture;
      if (!isPointerCaptureLease(capture) || capture.active() !== true) {
        return false;
      }
      const begin = Object.freeze({
        generation: currentGeneration,
        capture,
        dragged,
        originPoint,
        sceneRevision,
        geometryGeneration,
        ...(originCardKey === undefined ? {} : { originCardKey }),
        ...(viewRevision === undefined ? {} : { viewRevision }),
      });
      this.#active = {
        ...begin,
        overlay: initialOverlay(begin),
      };
      return true;
    } catch {
      return false;
    }
  }

  /** Replace or clear the current semantic proposal for the matching generation. */
  propose(update: KanbanCardDragProposalUpdate): boolean {
    const active = this.#active;
    if (active === undefined || update.generation !== active.generation) return false;
    active.target = update.target;
    if (update.sceneRevision !== undefined) active.sceneRevision = snapshotKanbanRevision(update.sceneRevision);
    if (update.geometryGeneration !== undefined) {
      active.geometryGeneration = generation(update.geometryGeneration);
    }
    active.overlay = Object.freeze({
      ...active.overlay,
      geometryGeneration: active.geometryGeneration,
      ...(update.target === undefined
        ? {}
        : {
            gap: Object.freeze({
              slotId: update.target.slotId,
              address: update.target.address,
              rect: update.target.rect ?? Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
              eligibility: update.target.eligibility,
            }),
          }),
    });
    return true;
  }

  /** Dispatch one current allowed/warning move, then settle capture and overlay exactly once. */
  release(value: KanbanCardDragRelease): boolean {
    const active = this.#active;
    if (active === undefined) return false;
    let current = false;
    try {
      current =
        value.generation === active.generation &&
        snapshotKanbanRevision(value.sceneRevision) === active.sceneRevision &&
        value.geometryGeneration === active.geometryGeneration;
    } catch {
      current = false;
    }
    const target = active.target;
    const dispatchable = target?.eligibility.kind === 'allowed' || target?.eligibility.kind === 'warning';
    if (!current || !dispatchable || target === undefined) {
      this.#finish(active);
      return false;
    }
    const proposal = snapshotKanbanRequestProposal({
      kind: 'card-move',
      moved: active.dragged,
      target: target.address,
      position: target.position,
      ...(active.viewRevision === undefined ? {} : { viewRevision: active.viewRevision }),
    });
    try {
      return proposal.kind === 'card-move' && this.#commitProposal(proposal, target.eligibility);
    } catch {
      return false;
    } finally {
      // Pending publication happens synchronously inside admission. Retaining the released overlay
      // until that boundary prevents an observable idle frame between drag and pending feedback.
      this.#finish(active);
    }
  }

  /** Cancel one live generation and clear visual ownership idempotently. */
  cancel(_reason: KanbanDragCancellationReason): boolean {
    const active = this.#active;
    if (active === undefined) return false;
    this.#finish(active);
    return true;
  }

  /** Convert decoded host focus loss to the shared cancellation path. */
  focusChanged(focused: boolean, currentGeneration: number): boolean {
    return !focused && this.#active?.generation === currentGeneration ? this.cancel('host-lost') : false;
  }

  /** Cancel only when current publication evidence intersects the dragged card set. */
  reconcile(value: KanbanCardDragReconcile): boolean {
    const active = this.#active;
    if (active === undefined || value.generation !== active.generation) return false;
    const changed = value.changedCardKeys ?? [];
    const relevant = changed.some((cardKey) => active.dragged.some((card) => sameCard(card.cardKey, cardKey)));
    if (!relevant) return false;
    return this.cancel('source-change');
  }

  /** Replaces stale cursor revisions only when ordered card and source ownership stay identical. */
  refreshSource(value: KanbanCardDragSourceRefresh): boolean {
    const active = this.#active;
    if (active === undefined || value.generation !== active.generation) return false;
    try {
      const refreshed = draggedCards(value.dragged);
      if (
        refreshed.length !== active.dragged.length ||
        refreshed.some(
          (entry, index) =>
            !sameCard(entry.cardKey, active.dragged[index]!.cardKey) ||
            entry.source.columnId !== active.dragged[index]!.source.columnId ||
            entry.source.swimlaneId !== active.dragged[index]!.source.swimlaneId,
        )
      ) {
        return false;
      }
      active.dragged = refreshed;
      active.sceneRevision = snapshotKanbanRevision(value.sceneRevision);
      return true;
    } catch {
      return false;
    }
  }

  /** Return immutable renderer-neutral evidence for inspection and later projection. */
  snapshot(): KanbanCardDragControllerSnapshot {
    const active = this.#active;
    if (active === undefined) return IDLE;
    return active.target === undefined
      ? Object.freeze({ kind: 'dragging', overlay: active.overlay })
      : Object.freeze({ kind: 'proposed', overlay: active.overlay, target: active.target });
  }

  /** Invalidate ownership before release so synchronous capture callbacks are stale. */
  #finish(active: ActiveCardDrag): void {
    if (this.#active !== active) return;
    this.#active = undefined;
    try {
      active.capture.release();
    } catch {
      // Generation invalidation already made hostile capture cleanup inert.
    }
    this.#safeInvalidate();
  }

  /** Isolate repaint scheduling from semantic state ownership. */
  #safeInvalidate(): void {
    try {
      this.#invalidate();
    } catch {
      // A repaint callback cannot roll back an already-published drag transition.
    }
  }
}

/** Create one independent render-neutral card drag controller. */
export function createKanbanCardDragController(options: KanbanCardDragControllerOptions): KanbanCardDragController {
  return new KanbanCardDragController(options);
}
