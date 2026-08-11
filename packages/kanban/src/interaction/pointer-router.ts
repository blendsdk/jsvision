import type { Point, PointerCaptureLease, PointerCaptureLossReason, PointerCaptureLostHandler } from '@jsvision/ui';

import type { KanbanActionScope, KanbanActionTarget } from '../layout/hit-map.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSelectionEntry, KanbanSelectionSnapshot } from './types.js';

/** Validated threshold configuration for one pointer-router instance. */
export interface KanbanPointerRouterOptions {
  /** Manhattan cells required to start dragging; defaults to one and is bounded to eight. */
  readonly dragThreshold?: number;
}

/** Normalized click-family input consumed by the bounded Phase B pointer router. */
export interface KanbanPointerInput {
  /** Mouse report phase; move and drag reports cancel an incomplete press. */
  readonly kind: 'down' | 'up' | 'move' | 'drag';
  /** Terminal mouse button, where zero is primary and two is context. */
  readonly button: number;
  /** Whether Ctrl was delivered with this report. */
  readonly ctrl: boolean;
  /** Whether Shift was delivered with this report. */
  readonly shift?: boolean;
  /** Whether Alt was delivered with this report. */
  readonly alt?: boolean;
  /** Framework-provided click count on a down report. */
  readonly clickCount?: number;
  /** Current final clipped target under the pointer, when actionable. */
  readonly target?: KanbanActionTarget;
  /** Revision owning the current active hit map. */
  readonly sceneRevision: KanbanRevision;
  /** Viewport-local terminal-cell coordinate supplied by a mounted dispatch envelope. */
  readonly point?: Readonly<Point>;
  /** Optional old gesture identity carried by a queued report after capture loss. */
  readonly gestureGeneration?: number;
  /** Ephemeral event-loop capture acquisition available only during real dispatch. */
  readonly acquireCapture?: (onLost: PointerCaptureLostHandler) => PointerCaptureLease;
}

/** Immutable primary-button evidence retained only until one matching up report. */
export interface KanbanPendingPress {
  /** Actionable target captured from the down report. */
  readonly target: KanbanActionTarget;
  /** Revision that owned the target when the press began. */
  readonly sceneRevision: KanbanRevision;
  /** Eligible application selection captured before focus changes. */
  readonly priorSelection: KanbanSelectionSnapshot;
  /** Whether Ctrl requested toggle semantics for a card click. */
  readonly ctrl: boolean;
  /** One for a single click or two for framework-confirmed double-click completion. */
  readonly clickCount: 1 | 2;
  /** Monotonic gesture identity allocated before application callbacks. */
  readonly generation: number;
  /** Down coordinate retained only when mounted drag evidence is available. */
  readonly originPoint?: Readonly<Point>;
  /** Whether Shift was held when the press began. */
  readonly shift: boolean;
  /** Whether Alt was held when the press began. */
  readonly alt: boolean;
}

/** Immutable threshold-crossing handoff to the render-neutral drag controller. */
export interface KanbanPointerDragStart extends KanbanPendingPress {
  /** Current coordinate that met the configured Manhattan threshold. */
  readonly point: Readonly<Point>;
  /** Generation-bound capture owned by the new drag. */
  readonly capture: PointerCaptureLease;
  /** Ordered concrete selection entries represented by the drag. */
  readonly dragged: readonly KanbanSelectionEntry[];
}

/** Serialized semantic seams used without capture, drag thresholds, or insertion geometry. */
export interface KanbanPointerRouterSink {
  /** Captures the current eligible application selection before focus changes. */
  readonly snapshotSelection: () => KanbanSelectionSnapshot;
  /** Focuses or otherwise admits one current primary-down target synchronously. */
  readonly beginPrimary: (target: KanbanActionTarget) => boolean;
  /** Completes card selection and optional activation after one matching up report. */
  readonly completeCard: (
    target: KanbanActionTarget,
    options: { readonly toggle: boolean; readonly activate: boolean },
  ) => boolean;
  /** Completes one descriptor-local card action after a matching up report. */
  readonly completeCardAction: (target: KanbanActionTarget) => boolean;
  /** Completes one application-owned header or state action. */
  readonly completeScopedAction: (target: KanbanActionTarget) => boolean;
  /** Invokes only the source-owned retry seam for a retry target. */
  readonly completeRetry: (target: KanbanActionTarget) => boolean;
  /** Focuses and opens context for the newly targeted card selection. */
  readonly openContext: (target: KanbanActionTarget) => boolean;
  /** Resolve current revision evidence for an unselected pointer-origin card. */
  readonly snapshotCard?: (target: KanbanActionTarget) => KanbanSelectionEntry | undefined;
  /** Adopt one captured threshold-crossing handoff. */
  readonly beginCardDrag?: (start: KanbanPointerDragStart) => boolean;
  /** Cancel a previously adopted generation before stale input can reach it. */
  readonly cancelCardDrag?: (generation: number, reason: PointerCaptureLossReason | 'explicit' | 'disposed') => void;
}

/** Router-owned capture retained only to invalidate loss and queued reports deterministically. */
interface ActiveKanbanPointerDrag {
  readonly generation: number;
  readonly capture: PointerCaptureLease;
}

/** Return true only for a finite viewport-local terminal coordinate. */
function validPoint(value: Readonly<Point> | undefined): value is Readonly<Point> {
  return (
    value !== undefined &&
    Number.isSafeInteger(value.x) &&
    value.x >= 0 &&
    Number.isSafeInteger(value.y) &&
    value.y >= 0
  );
}

/** Preserve numeric/string card identity when resolving a selected dragged set. */
function cardKeyEqual(left: string | number, right: string | number): boolean {
  return typeof left === typeof right && left === right;
}

/** Compares type-preserving optional identities without string coercion. */
function identityEqual(left: string | number | undefined, right: string | number | undefined): boolean {
  return typeof left === typeof right && left === right;
}

/** Compares optional semantic cell addresses. */
function addressEqual(left: KanbanActionTarget['address'], right: KanbanActionTarget['address']): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.columnId === right.columnId && left.swimlaneId === right.swimlaneId;
}

/** Compares the closed identity of two targets while deliberately ignoring rectangles. */
function targetEqual(left: KanbanActionTarget, right: KanbanActionTarget): boolean {
  return (
    left.kind === right.kind &&
    scopeEqual(left.scope, right.scope) &&
    identityEqual(left.cardKey, right.cardKey) &&
    left.columnId === right.columnId &&
    left.swimlaneId === right.swimlaneId &&
    left.logicalIndex === right.logicalIndex &&
    left.actionId === right.actionId &&
    left.regionId === right.regionId &&
    left.state === right.state &&
    addressEqual(left.address, right.address)
  );
}

/** Compares one closed semantic scope without allocating a serialized representation. */
function scopeEqual(left: KanbanActionScope, right: KanbanActionScope): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case 'board':
      return true;
    case 'column':
      return right.kind === 'column' && left.columnId === right.columnId;
    case 'swimlane':
      return right.kind === 'swimlane' && left.swimlaneId === right.swimlaneId;
    case 'cell':
      return right.kind === 'cell' && addressEqual(left.address, right.address);
    case 'card':
      return (
        right.kind === 'card' && identityEqual(left.cardKey, right.cardKey) && addressEqual(left.address, right.address)
      );
    case 'state':
      return right.kind === 'state' && left.state === right.state && addressEqual(left.address, right.address);
  }
}

/** Compares revision primitives without allowing numeric/string coercion. */
function revisionEqual(left: KanbanRevision, right: KanbanRevision): boolean {
  return typeof left === typeof right && left === right;
}

/**
 * Owns at most one bounded pending press for Phase B click-family interaction.
 *
 * Down focuses and records evidence; only a matching up commits selection or activation. The router
 * never captures the pointer, measures movement, creates insertion geometry, or starts a drag.
 */
export class KanbanPointerRouter {
  readonly #sink: KanbanPointerRouterSink;
  readonly #dragThreshold: number;
  #pending: KanbanPendingPress | undefined;
  #activeDrag: ActiveKanbanPointerDrag | undefined;
  #nextGeneration = 1;
  #disposed = false;

  /** Captures semantic completion seams without acquiring host or source ownership. */
  constructor(sink: KanbanPointerRouterSink, options: KanbanPointerRouterOptions = {}) {
    this.#sink = sink;
    const threshold = options.dragThreshold ?? 1;
    if (!Number.isSafeInteger(threshold) || threshold < 0 || threshold > 8) {
      throw new RangeError('Invalid Kanban drag threshold.');
    }
    this.#dragThreshold = threshold;
  }

  /** Routes one normalized pointer report and returns immediate handled acceptance. */
  route(input: KanbanPointerInput): boolean {
    if (this.#disposed) return false;
    if (input.kind === 'move' || input.kind === 'drag') return this.#move(input);
    if (input.kind === 'down') return this.#down(input);
    return this.#up(input);
  }

  /** Returns detached evidence for lifecycle tests without exposing mutable router state. */
  pending(): KanbanPendingPress | undefined {
    return this.#pending;
  }

  /** Cancels the current pending press idempotently. */
  cancel(): void {
    this.#pending = undefined;
    this.#cancelActive('explicit');
  }

  /** Rejects later input and releases pending evidence idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#pending = undefined;
    this.#cancelActive('disposed');
  }

  /** Begins a primary press or completes a distinct right-click context route. */
  #down(input: KanbanPointerInput): boolean {
    this.cancel();
    const target = input.target;
    if (target === undefined) return false;
    if (input.button === 2) {
      if (target.scope.kind !== 'card') return false;
      return this.#sink.openContext(target);
    }
    if (input.button !== 0) return false;
    const priorSelection = this.#sink.snapshotSelection();
    if (!this.#sink.beginPrimary(target)) return false;
    const generation = this.#allocateGeneration();
    this.#pending = Object.freeze({
      target,
      sceneRevision: input.sceneRevision,
      priorSelection,
      ctrl: input.ctrl,
      shift: input.shift === true,
      alt: input.alt === true,
      clickCount: input.clickCount === 2 ? 2 : 1,
      generation,
      ...(validPoint(input.point) ? { originPoint: Object.freeze({ x: input.point.x, y: input.point.y }) } : {}),
    });
    if (this.#dragThreshold === 0 && validPoint(input.point)) return this.#startDrag(input);
    return true;
  }

  /** Preserve click state below threshold and atomically hand off one captured card drag. */
  #move(input: KanbanPointerInput): boolean {
    if (this.#activeDrag !== undefined) {
      return input.gestureGeneration === undefined || input.gestureGeneration === this.#activeDrag.generation;
    }
    const pending = this.#pending;
    if (pending === undefined) return false;
    if (
      input.button !== 0 ||
      input.target === undefined ||
      !revisionEqual(pending.sceneRevision, input.sceneRevision) ||
      !targetEqual(pending.target, input.target) ||
      !validPoint(pending.originPoint) ||
      !validPoint(input.point)
    ) {
      this.#pending = undefined;
      return false;
    }
    const distance = Math.abs(input.point.x - pending.originPoint.x) + Math.abs(input.point.y - pending.originPoint.y);
    if (distance < this.#dragThreshold) return false;
    return this.#startDrag(input);
  }

  /** Resolve the concrete set, acquire capture, invalidate click, and publish one immutable start. */
  #startDrag(input: KanbanPointerInput): boolean {
    const pending = this.#pending;
    this.#pending = undefined;
    if (
      pending === undefined ||
      pending.target.kind !== 'card' ||
      pending.target.cardKey === undefined ||
      !validPoint(pending.originPoint) ||
      !validPoint(input.point) ||
      input.acquireCapture === undefined ||
      this.#sink.snapshotCard === undefined ||
      this.#sink.beginCardDrag === undefined
    ) {
      return false;
    }
    const originCardKey = pending.target.cardKey;
    const origin = this.#sink.snapshotCard(pending.target);
    if (origin === undefined) return false;
    const selected = pending.priorSelection.entries.some(({ cardKey }) => cardKeyEqual(cardKey, originCardKey));
    const dragged = Object.freeze(selected ? [...pending.priorSelection.entries] : [origin]);
    let lost: PointerCaptureLossReason | undefined;
    let capture: PointerCaptureLease;
    try {
      capture = input.acquireCapture((reason) => {
        lost = reason;
        if (this.#activeDrag?.generation !== pending.generation) return;
        this.#activeDrag = undefined;
        this.#sink.cancelCardDrag?.(pending.generation, reason);
      });
    } catch {
      return false;
    }
    if (lost !== undefined || !capture.active()) return false;
    this.#activeDrag = Object.freeze({ generation: pending.generation, capture });
    const accepted = this.#sink.beginCardDrag(
      Object.freeze({
        ...pending,
        point: Object.freeze({ x: input.point.x, y: input.point.y }),
        capture,
        dragged,
      }),
    );
    if (!accepted || this.#activeDrag?.generation !== pending.generation || !capture.active()) {
      if (this.#activeDrag?.generation === pending.generation) this.#activeDrag = undefined;
      capture.release();
      return false;
    }
    return true;
  }

  /** Invalidate router ownership before notifying drag cleanup and releasing capture. */
  #cancelActive(reason: 'explicit' | 'disposed'): void {
    const active = this.#activeDrag;
    if (active === undefined) return;
    this.#activeDrag = undefined;
    this.#sink.cancelCardDrag?.(active.generation, reason);
    active.capture.release();
  }

  /** Allocate one non-wrapping gesture identity before any application callback runs. */
  #allocateGeneration(): number {
    if (this.#nextGeneration > Number.MAX_SAFE_INTEGER) throw new RangeError('Kanban drag generation exhausted.');
    const generation = this.#nextGeneration;
    this.#nextGeneration += 1;
    return generation;
  }

  /** Commits only an exact current target/button/revision match, then clears pending state first. */
  #up(input: KanbanPointerInput): boolean {
    if (this.#activeDrag !== undefined) return false;
    const pending = this.#pending;
    this.#pending = undefined;
    if (
      input.button !== 0 ||
      pending === undefined ||
      input.target === undefined ||
      !revisionEqual(pending.sceneRevision, input.sceneRevision) ||
      !targetEqual(pending.target, input.target)
    ) {
      return false;
    }
    switch (pending.target.kind) {
      case 'card':
        return this.#sink.completeCard(pending.target, {
          toggle: pending.ctrl,
          activate: pending.clickCount === 2,
        });
      case 'card-action':
        return this.#sink.completeCardAction(pending.target);
      case 'workflow-header':
      case 'swimlane-header':
      case 'state-action':
        return this.#sink.completeScopedAction(pending.target);
      case 'retry':
        return this.#sink.completeRetry(pending.target);
    }
  }
}
