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

/** Mounted viewport instances mapped to counter-only testing snapshots without exposing private state. */
const VIEWPORT_SCALE_READERS = new WeakMap<object, () => KanbanViewportScaleSnapshot>();

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
