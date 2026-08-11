import type { Point, PointerCaptureLease, PointerCaptureLossReason, Rect } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import type { CardKey } from '../contract/identity.js';
import type { KanbanMovePosition, KanbanMovedCardSnapshot } from '../contract/request.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanActionTarget } from '../layout/hit-map.js';
import type { KanbanCellAddress } from '../source/types.js';
import type { KanbanEligibility } from '../operation/eligibility.js';
import type { KanbanSelectionSnapshot } from './types.js';

/** Positive safe-integer identity owned by one pointer gesture. */
export type KanbanDragGeneration = number;

/** Closed cancellation causes shared by pointer input, drag work, and board lifecycle. */
export type KanbanDragCancellationReason =
  | PointerCaptureLossReason
  | 'explicit'
  | 'escape'
  | 'resize'
  | 'source-change'
  | 'policy-change'
  | 'dispose'
  | 'capture-lost'
  | 'invalid-input';

/** Exact semantic kinds produced by the pure card drop map. */
export type KanbanCardDropTargetKind =
  | 'resting-gutter'
  | 'card-before'
  | 'card-after'
  | 'cell-leading'
  | 'cell-trailing'
  | 'post-header'
  | 'empty-cell'
  | 'active-gap'
  | 'unknown-edge';

/** Bounded source acquisition hint carried only by an unavailable window-edge target. */
export interface KanbanDragPrefetchHint {
  /** Semantic cell whose cursor may resolve the edge. */
  readonly address: KanbanCellAddress;
  /** First logical card index requested from the source. */
  readonly start: number;
  /** Finite card count requested from the source. */
  readonly count: number;
  /** Equality-only cursor revision that owns the hint. */
  readonly revision: KanbanRevision;
}

/** One immutable semantic card destination independent of ordinary action-hit z-order. */
export interface KanbanCardDropTarget {
  /** Visual target category used by projection and non-color feedback. */
  readonly kind: KanbanCardDropTargetKind;
  /** Stable semantic slot identity used by hysteresis across layout movement. */
  readonly slotId: string;
  /** Destination cell represented by the target. */
  readonly address: KanbanCellAddress;
  /** Current revision-bound application placement. */
  readonly position: KanbanMovePosition;
  /** Pure policy result captured with this target. */
  readonly eligibility: KanbanEligibility;
  /** Current clipped viewport-local target rectangle. */
  readonly rect?: Readonly<Rect>;
  /** Geometry generation that owns the rectangle and placement. */
  readonly geometryGeneration: number;
  /** Card whose upper or lower half supplied a fallback target. */
  readonly cardKey?: CardKey;
  /** Bounded source hint present only while an unknown edge is unavailable. */
  readonly prefetch?: KanbanDragPrefetchHint;
}

/** Immutable pure target projection tied to one current geometry generation. */
export interface KanbanCardDropMap {
  /** Geometry generation represented by every retained target. */
  readonly geometryGeneration: number;
  /** Density whose gutter rules produced the target set. */
  readonly density: KanbanCardDensity;
  /** Bounded deterministic targets in overlap-priority order. */
  readonly targets: readonly KanbanCardDropTarget[];
  /** Resolve the highest-priority target containing one viewport-local point. */
  targetAt(point: Readonly<Point>): KanbanCardDropTarget | undefined;
}

/** Press evidence retained while an ordinary card click remains possible. */
export interface KanbanDragPressSnapshot {
  /** Monotonic pointer-gesture identity allocated before application callbacks. */
  readonly generation: KanbanDragGeneration;
  /** Whole-card action target captured at primary down. */
  readonly target: KanbanActionTarget;
  /** Viewport-local primary-down coordinate. */
  readonly originPoint: Readonly<Point>;
  /** Scene revision that owns the target and coordinate. */
  readonly sceneRevision: KanbanRevision;
  /** Eligible selection captured before focus mutation. */
  readonly priorSelection: KanbanSelectionSnapshot;
  /** Whether Ctrl requested click-toggle semantics. */
  readonly ctrl: boolean;
  /** Whether Shift was held when the press began. */
  readonly shift: boolean;
  /** Whether Alt was held when the press began. */
  readonly alt: boolean;
  /** One for an ordinary click or two for framework-confirmed activation. */
  readonly clickCount: 1 | 2;
}

/** Complete immutable handoff created only after threshold crossing and capture acquisition. */
export interface KanbanCardDragStart extends KanbanDragPressSnapshot {
  /** Current point that met the configured Manhattan threshold. */
  readonly point: Readonly<Point>;
  /** Generation-bound UI capture owned for the drag lifetime. */
  readonly capture: PointerCaptureLease;
  /** Ordered concrete cards resolved atomically for the drag. */
  readonly dragged: readonly KanbanMovedCardSnapshot[];
  /** Current density used to interpret card gaps and target geometry. */
  readonly density: KanbanCardDensity;
  /** Current geometry generation used for initial target discovery. */
  readonly geometryGeneration: number;
}

/** Bounded recognizable ghost metadata without application card bodies. */
export interface KanbanDragGhostEvidence {
  /** Stable identity of the pointer-origin card represented by the ghost. */
  readonly cardKey: CardKey;
  /** Viewport-local ghost anchor after clipping and pointer offset. */
  readonly point: Readonly<Point>;
  /** Number of cards represented atomically by the bounded ghost. */
  readonly count: number;
}

/** Source placeholder that prevents the visual stack from collapsing during a drag. */
export interface KanbanDragSourcePlaceholder {
  /** Semantic source cell retaining the placeholder. */
  readonly address: KanbanCellAddress;
  /** Ordered card identities removed from normal source projection. */
  readonly cardKeys: readonly CardKey[];
}

/** Optional insertion-gap projection for one current semantic target. */
export interface KanbanDragGapEvidence {
  /** Stable semantic target slot represented by the gap. */
  readonly slotId: string;
  /** Semantic target cell whose visible stack may reflow around the active insertion row. */
  readonly address: KanbanCellAddress;
  /** Clipped one-row or resting-gap rectangle. */
  readonly rect: Readonly<Rect>;
  /** Current target eligibility used for color and non-color cues. */
  readonly eligibility: KanbanEligibility;
}

/** Render-neutral drag evidence consumed later by viewport overlay projection. */
export interface KanbanDragOverlayEvidence {
  /** Gesture generation owning every overlay member. */
  readonly generation: KanbanDragGeneration;
  /** Current geometry generation represented by the overlay. */
  readonly geometryGeneration: number;
  /** Bounded lifted-card representation. */
  readonly ghost: KanbanDragGhostEvidence;
  /** One placeholder per distinct source cell represented by the drag. */
  readonly placeholders: readonly KanbanDragSourcePlaceholder[];
  /** Current insertion gap, absent while outside or unavailable. */
  readonly gap?: KanbanDragGapEvidence;
}

/** Publicly inspectable render-neutral lifecycle state of one card drag controller. */
export type KanbanCardDragSnapshot =
  | { readonly kind: 'idle' }
  | { readonly kind: 'dragging'; readonly start: KanbanCardDragStart; readonly overlay: KanbanDragOverlayEvidence }
  | {
      readonly kind: 'proposed';
      readonly start: KanbanCardDragStart;
      readonly target: KanbanCardDropTarget;
      readonly overlay: KanbanDragOverlayEvidence;
    };
