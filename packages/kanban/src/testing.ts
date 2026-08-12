/**
 * Public entry point for deterministic Kanban fixtures and instrumentation.
 *
 * This module is intentionally separate so production consumers never pull testing helpers into
 * their runtime import graph.
 */
export * from './testing/cursor-harness.js';
export * from './testing/descriptor-cache-harness.js';
export * from './testing/eager-fixture.js';
export * from './testing/instrumentation.js';
export * from './testing/query-harness.js';
export * from './testing/stabilization-fixture.js';
export * from './testing/windowed-fixture.js';
export * from './testing/board-setup-harness.js';
export {
  createKanbanDragHarness,
  createKanbanFakeClock,
  createKanbanStandardPointerTrace,
  replayKanbanSemanticPointerTrace,
} from './testing/drag-harness.js';
export type {
  KanbanDragHarness,
  KanbanDragHarnessEvent,
  KanbanFakeClock,
  KanbanFakeClockHandle,
  KanbanSemanticHostEvidence,
  KanbanSemanticPointerResult,
  KanbanSemanticPointerTrace,
  KanbanSemanticTraceTransport,
} from './testing/drag-harness.js';
export { createKanbanDispatcherHarness, createKanbanOperationLifecycleHarness } from './testing/operation-harness.js';
export type {
  KanbanDispatcherHarness,
  KanbanDispatcherHarnessCall,
  KanbanOperationLifecycleHarness,
  KanbanOperationLifecycleMetrics,
  KanbanOperationLifecycleRecord,
} from './testing/operation-harness.js';
export { routeKanbanKeyInput } from './interaction/input-router.js';
export type { KanbanKeyInput, KanbanKeyInputSink } from './interaction/input-router.js';
export { KanbanPointerRouter } from './interaction/pointer-router.js';
export type {
  KanbanPendingPress,
  KanbanPointerStructureDragStart,
  KanbanDragConfiguration,
  KanbanPointerDragStart,
  KanbanPointerInput,
  KanbanPointerRouterOptions,
  KanbanPointerRouterSink,
} from './interaction/pointer-router.js';
export { projectKanbanCardDropMap } from './interaction/drop-map.js';
export type {
  KanbanActiveDropGapInput,
  KanbanDropCardInput,
  KanbanDropCellCompleteness,
  KanbanDropCellInput,
  KanbanDropRegionInput,
  KanbanUnknownDropEdgeInput,
  ProjectKanbanCardDropMapOptions,
} from './interaction/drop-map.js';
export type { KanbanCardDropMap, KanbanCardDropTarget, KanbanCardDropTargetKind } from './interaction/drag-types.js';
export {
  observeKanbanViewportOperations,
  readKanbanDragFrameSnapshot as inspectKanbanDragFrame,
  readKanbanViewportOperationSnapshot as inspectKanbanViewportOperations,
  readKanbanViewportScaleSnapshot as inspectKanbanViewportScale,
  type KanbanDragFrameSnapshot,
  type KanbanViewportOperationSnapshot,
  type KanbanViewportOperationObserver,
  type KanbanViewportProjectionPassSnapshot,
  type KanbanViewportScaleSnapshot,
} from './board/viewport-scale-inspection.js';
