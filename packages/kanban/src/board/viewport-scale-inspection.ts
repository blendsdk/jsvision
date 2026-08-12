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

/** Additive testing-only operation evidence kept separate from the stable scale snapshot. */
export interface KanbanViewportOperationSnapshot {
  /** Every projection attempt performed by the latest completed frame, in execution order. */
  readonly projectionPasses: readonly KanbanViewportProjectionPassSnapshot[];
}

/** Mounted viewport instances mapped to counter-only testing snapshots without exposing private state. */
const VIEWPORT_SCALE_READERS = new WeakMap<object, () => KanbanViewportScaleSnapshot>();

/** Testing-only controls that activate expensive operation evidence only while a test observes it. */
export interface KanbanViewportOperationInspectionControl {
  /** Starts recording subsequent projection work for this viewport. */
  readonly enable: () => void;
  /** Stops recording and releases retained operation evidence. */
  readonly disable: () => void;
  /** Reads detached evidence accumulated since recording was enabled. */
  readonly read: () => KanbanViewportOperationSnapshot;
  /** Overrides the production pass ceiling for deterministic containment tests. */
  readonly setProjectionPassLimit: (limit: number) => void;
}

/** One explicitly active testing observation of mounted viewport operations. */
export interface KanbanViewportOperationObserver {
  /** Reads detached evidence accumulated by this observation. */
  readonly snapshot: () => KanbanViewportOperationSnapshot;
  /** Stops the observation idempotently and releases retained evidence. */
  readonly dispose: () => void;
}

/** Mounted viewport instances mapped to opt-in operation-only testing controls. */
const VIEWPORT_OPERATION_CONTROLS = new WeakMap<object, KanbanViewportOperationInspectionControl>();

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
  return control.read();
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
export function observeKanbanViewportOperations(viewport: object): KanbanViewportOperationObserver {
  const control = VIEWPORT_OPERATION_CONTROLS.get(viewport);
  if (control === undefined) throw new KanbanDisposedResourceError();
  control.enable();
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
