import type { KanbanActionScope, KanbanActionTarget } from '../layout/hit-map.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSelectionSnapshot } from './types.js';

/** Normalized click-family input consumed by the bounded Phase B pointer router. */
export interface KanbanPointerInput {
  /** Mouse report phase; move and drag reports cancel an incomplete press. */
  readonly kind: 'down' | 'up' | 'move' | 'drag';
  /** Terminal mouse button, where zero is primary and two is context. */
  readonly button: number;
  /** Whether Ctrl was delivered with this report. */
  readonly ctrl: boolean;
  /** Framework-provided click count on a down report. */
  readonly clickCount?: number;
  /** Current final clipped target under the pointer, when actionable. */
  readonly target?: KanbanActionTarget;
  /** Revision owning the current active hit map. */
  readonly sceneRevision: KanbanRevision;
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
  #pending: KanbanPendingPress | undefined;
  #disposed = false;

  /** Captures semantic completion seams without acquiring host or source ownership. */
  constructor(sink: KanbanPointerRouterSink) {
    this.#sink = sink;
  }

  /** Routes one normalized pointer report and returns immediate handled acceptance. */
  route(input: KanbanPointerInput): boolean {
    if (this.#disposed) return false;
    if (input.kind === 'move' || input.kind === 'drag') {
      this.cancel();
      return false;
    }
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
  }

  /** Rejects later input and releases pending evidence idempotently. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancel();
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
    this.#pending = Object.freeze({
      target,
      sceneRevision: input.sceneRevision,
      priorSelection,
      ctrl: input.ctrl,
      clickCount: input.clickCount === 2 ? 2 : 1,
    });
    return true;
  }

  /** Commits only an exact current target/button/revision match, then clears pending state first. */
  #up(input: KanbanPointerInput): boolean {
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
