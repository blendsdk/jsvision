import type { Point, Rect } from '@jsvision/ui';

import { KanbanDisposedResourceError } from '../contract/error.js';

/** Counter-only mounted scale evidence exposed exclusively through the testing package entry point. */
export interface KanbanViewportScaleSnapshot {
  /** Retained sparse source cells/cursors. */
  readonly retainedCursors: number;
  /** Unique retained semantic cell addresses. */
  readonly retainedAddresses: number;
  /** Current descriptor cache entries. */
  readonly retainedDescriptors: number;
  /** Current card-local reactive computations. */
  readonly reactiveComputations: number;
  /** Sparse exact height anchors retained across cells. */
  readonly heightAnchors: number;
  /** Sparse contiguous height runs retained across cells. */
  readonly heightRuns: number;
  /** Total sparse height records retained across cells. */
  readonly heightAllocatedEntries: number;
  /** Latest bounded damage rectangles. */
  readonly damageRegions: number;
  /** Cells requested by the grouped preliminary layout window. */
  readonly sceneWindowCells: number;
  /** Exact loaded descriptor candidates omitted by the active mounted ceiling. */
  readonly descriptorOmissions: number;
  /** Card faces retained in the final clipped projection. */
  readonly projectedCards: number;
  /** Final clipped actionable targets retained for pointer routing. */
  readonly actionTargets: number;
  /** Pending and terminal operation overlays retained in the current frame. */
  readonly operationOverlays: number;
  /** Card and structural drag overlay members retained in the current frame. */
  readonly transientOverlayMembers: number;
}

/** Counter-only drag frame evidence that never exposes card content or private overlay objects. */
export interface KanbanDragFrameSnapshot {
  /** Card and structural drag overlay members retained in the current frame. */
  readonly transientOverlayMembers: number;
  /** Pending and terminal operation overlays retained in the current frame. */
  readonly operationOverlays: number;
  /** Damage rectangles produced by the most recent frame projection. */
  readonly damageRegions: number;
  /** Current compact card ghost geometry, when a visible drag ghost exists. */
  readonly ghost?: Readonly<{
    /** Number of cards represented atomically. */
    readonly count: number;
    /** Fixed number of rows between the compact ghost frame borders. */
    readonly contentRows: 1;
    /** Complete pointer-relative origin before viewport clipping. */
    readonly rawOrigin: Readonly<Point>;
    /** Exact clipped rectangle emitted by the current viewport frame. */
    readonly visibleRect: Readonly<Rect>;
  }>;
  /** Current semantic insertion-gap geometry, when a visible target exists. */
  readonly gap?: Readonly<{
    /** Stable target slot identity. */
    readonly slotId: string;
    /** Exact clipped one-row insertion marker. */
    readonly rect: Readonly<Rect>;
  }>;
}

/** Payload-free quality evidence for one projection pass in the latest completed viewport frame. */
export interface KanbanViewportProjectionPassSnapshot {
  /** One-based pass position within the completed frame. */
  readonly ordinal: number;
  /** Whether this pass used only estimates, only exact measurements, or a mixture of both. */
  readonly heightQuality: 'estimated' | 'mixed' | 'measured';
  /** Exact sparse rows consumed by this pass. */
  readonly measuredRows: number;
  /** Estimated sparse rows consumed by this pass. */
  readonly estimatedRows: number;
}

/** Stable projection-pass evidence retained for source compatibility with existing testing consumers. */
export interface KanbanViewportOperationSnapshot {
  /** Every projection attempt performed by the latest completed frame, in execution order. */
  readonly projectionPasses: readonly KanbanViewportProjectionPassSnapshot[];
}

/** Additive testing-only operation delta returned by an explicitly correlated observation. */
export interface KanbanViewportOperationDeltaSnapshot extends KanbanViewportOperationSnapshot {
  /** Caller-owned payload-free identity correlating this delta with one fixture action. */
  readonly operationId: string;
  /** Monotonic-counter deltas accumulated since this observation was enabled. */
  readonly work: KanbanViewportOperationWorkSnapshot;
}

/** Payload-free work deltas for one explicitly observed mounted operation. */
export interface KanbanViewportOperationWorkSnapshot {
  /** Resident descriptors visited by projection passes. */
  readonly residentDescriptors: number;
  /** Exact resident descriptors inserted into the reusable cell index. */
  readonly residentGroupingVisits: number;
  /** Cell-index lookups used instead of repeated full-resident filtering. */
  readonly residentCellLookups: number;
  /** Resident card heights measured by the sparse height authority. */
  readonly heightMeasurements: number;
  /** Final hit regions produced by authoritative projection. */
  readonly hitRegions: number;
  /** Drop regions examined by captured drag-target recomputation. */
  readonly dropRegions: number;
  /** Cells covered by exact semantic damage rectangles. */
  readonly semanticDamageCells: number;
  /** Visible card leaves handed to the viewport renderer. */
  readonly drawnCards: number;
  /** Visible clipped card rows handed to the viewport renderer. */
  readonly drawnCardRows: number;
  /** Captured drag-target recomputations. */
  readonly dragTargetRecomputations: number;
}

/** Mounted viewport instances mapped to counter-only testing snapshots without exposing private state. */
const VIEWPORT_SCALE_READERS = new WeakMap<object, () => KanbanViewportScaleSnapshot>();

/** Mounted viewport instances mapped to detached drag-frame geometry readers. */
const VIEWPORT_DRAG_FRAME_READERS = new WeakMap<object, () => KanbanDragFrameSnapshot>();

/** Testing-only controls that activate expensive operation evidence only while a test observes it. */
export interface KanbanViewportOperationInspectionControl {
  /** Starts recording subsequent projection work for this viewport. */
  readonly enable: (operationId: string) => void;
  /** Stops recording and releases retained operation evidence. */
  readonly disable: () => void;
  /** Reads detached evidence accumulated since recording was enabled. */
  readonly read: () => KanbanViewportOperationDeltaSnapshot;
  /** Overrides the production pass ceiling for deterministic containment tests. */
  readonly setProjectionPassLimit: (limit: number) => void;
  /** Invalidates only reusable authoritative projection state for controlled timing tests. */
  readonly invalidateProjection: () => void;
}

/** One explicitly active testing observation of mounted viewport operations. */
export interface KanbanViewportOperationObserver {
  /** Reads detached evidence accumulated by this observation. */
  readonly snapshot: () => KanbanViewportOperationDeltaSnapshot;
  /** Stops the observation idempotently and releases retained evidence. */
  readonly dispose: () => void;
}

/** Mounted viewport instances mapped to opt-in operation-only testing controls. */
const VIEWPORT_OPERATION_CONTROLS = new WeakMap<object, KanbanViewportOperationInspectionControl>();

/** Viewports with one active correlated observation; overlapping baselines are rejected. */
const ACTIVE_OPERATION_OBSERVATIONS = new WeakSet<object>();

/**
 * Registers one live viewport's private counter reader for the testing-only entry point.
 *
 * This bridge keeps mutable implementation state private while allowing boundedness tests to read
 * scalar evidence. Application code should never call it.
 */
export function registerKanbanViewportScaleReader(viewport: object, read: () => KanbanViewportScaleSnapshot): void {
  VIEWPORT_SCALE_READERS.set(viewport, read);
}

/**
 * Removes one disposed viewport from the testing-only counter registry.
 *
 * Removing the reader ensures the testing surface observes the same lifetime as the viewport.
 */
export function unregisterKanbanViewportScaleReader(viewport: object): void {
  VIEWPORT_SCALE_READERS.delete(viewport);
  VIEWPORT_DRAG_FRAME_READERS.delete(viewport);
}

/** Registers one live viewport's detached drag-frame evidence reader for testing. */
export function registerKanbanViewportDragFrameReader(viewport: object, read: () => KanbanDragFrameSnapshot): void {
  VIEWPORT_DRAG_FRAME_READERS.set(viewport, read);
}

/** Registers one live viewport's additive operation reader for the testing-only entry point. */
export function registerKanbanViewportOperationReader(
  viewport: object,
  control: KanbanViewportOperationInspectionControl,
): void {
  VIEWPORT_OPERATION_CONTROLS.set(viewport, control);
}

/** Removes one disposed viewport from the additive operation registry. */
export function unregisterKanbanViewportOperationReader(viewport: object): void {
  VIEWPORT_OPERATION_CONTROLS.delete(viewport);
  ACTIVE_OPERATION_OBSERVATIONS.delete(viewport);
}

/**
 * Reads counter-only bounded scale evidence for a live Kanban viewport.
 *
 * @example
 * ```ts
 * const snapshot = inspectKanbanViewportScale(viewport);
 * ```
 */
export function readKanbanViewportScaleSnapshot(viewport: object): KanbanViewportScaleSnapshot {
  const read = VIEWPORT_SCALE_READERS.get(viewport);
  if (read === undefined) throw new KanbanDisposedResourceError();
  return read();
}

/**
 * Reads sanitized drag/operation overlay counts for one live mounted viewport.
 *
 * @example
 * ```ts
 * const before = inspectKanbanDragFrame(board.viewport);
 * // Dispatch a pointer drag, flush, and compare the bounded counter snapshot.
 * ```
 */
export function readKanbanDragFrameSnapshot(viewport: object): KanbanDragFrameSnapshot {
  const read = VIEWPORT_DRAG_FRAME_READERS.get(viewport);
  if (read !== undefined) return read();
  const snapshot = readKanbanViewportScaleSnapshot(viewport);
  return Object.freeze({
    transientOverlayMembers: snapshot.transientOverlayMembers,
    operationOverlays: snapshot.operationOverlays,
    damageRegions: snapshot.damageRegions,
  });
}

/**
 * Reads payload-free projection-pass evidence for one live mounted viewport.
 *
 * @example
 * ```ts
 * const operations = inspectKanbanViewportOperations(board.viewport);
 * expect(operations.projectionPasses.length).toBeLessThanOrEqual(2);
 * ```
 */
export function readKanbanViewportOperationSnapshot(viewport: object): KanbanViewportOperationSnapshot {
  const control = VIEWPORT_OPERATION_CONTROLS.get(viewport);
  if (control === undefined) throw new KanbanDisposedResourceError();
  return Object.freeze({ projectionPasses: control.read().projectionPasses });
}

/**
 * Enables payload-free projection diagnostics until the returned observer is disposed.
 *
 * Normal application rendering does not scan source windows or allocate pass snapshots. Tests opt in
 * before the frame they need to measure, then dispose the observer during teardown.
 *
 * @example
 * ```ts
 * const observation = observeKanbanViewportOperations(board.viewport);
 * render.flush();
 * const passes = observation.snapshot().projectionPasses;
 * observation.dispose();
 * ```
 */
export function observeKanbanViewportOperations(
  viewport: object,
  operationId = 'kanban-operation',
): KanbanViewportOperationObserver {
  const control = VIEWPORT_OPERATION_CONTROLS.get(viewport);
  if (control === undefined) throw new KanbanDisposedResourceError();
  if (!/^[a-z0-9][a-z0-9._:-]{0,127}$/u.test(operationId)) throw new RangeError('Invalid operation identity.');
  if (ACTIVE_OPERATION_OBSERVATIONS.has(viewport)) throw new RangeError('An operation observation is already active.');
  ACTIVE_OPERATION_OBSERVATIONS.add(viewport);
  control.enable(operationId);
  let active = true;
  return Object.freeze({
    snapshot: () => {
      if (!active) throw new KanbanDisposedResourceError();
      return control.read();
    },
    dispose: () => {
      if (!active) return;
      active = false;
      control.disable();
      ACTIVE_OPERATION_OBSERVATIONS.delete(viewport);
    },
  });
}

/**
 * Overrides one mounted viewport's projection-pass ceiling for deterministic failure tests.
 *
 * Values from zero through two are accepted. Production rendering always uses two unless a test
 * explicitly invokes this helper through the testing-only package entry point.
 *
 * @example
 * ```ts
 * setKanbanViewportProjectionPassLimitForTesting(board.viewport, 0);
 * board.viewport.invalidate();
 * render.flush();
 * ```
 */
export function setKanbanViewportProjectionPassLimitForTesting(viewport: object, limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > 2) throw new RangeError('limit must be 0, 1, or 2');
  const control = VIEWPORT_OPERATION_CONTROLS.get(viewport);
  if (control === undefined) throw new KanbanDisposedResourceError();
  control.setProjectionPassLimit(limit);
}

/**
 * Invalidates reusable authoritative geometry without changing source, descriptor, or height state.
 *
 * This testing-only seam allows a controlled benchmark to measure projection and drawing without adding
 * scroll, source mutation, or descriptor-rebuild work to the timed region.
 *
 * @example
 * ```ts
 * invalidateKanbanViewportProjectionForTesting(board.viewport);
 * board.viewport.invalidate();
 * render.flush();
 * ```
 */
export function invalidateKanbanViewportProjectionForTesting(viewport: object): void {
  const control = VIEWPORT_OPERATION_CONTROLS.get(viewport);
  if (control === undefined) throw new KanbanDisposedResourceError();
  control.invalidateProjection();
}
