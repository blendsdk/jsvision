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
export * from './testing/windowed-fixture.js';
export { routeKanbanKeyInput } from './interaction/input-router.js';
export type { KanbanKeyInput, KanbanKeyInputSink } from './interaction/input-router.js';
export { KanbanPointerRouter } from './interaction/pointer-router.js';
export type { KanbanPendingPress, KanbanPointerInput, KanbanPointerRouterSink } from './interaction/pointer-router.js';
export {
  readKanbanViewportScaleSnapshot as inspectKanbanViewportScale,
  type KanbanViewportScaleSnapshot,
} from './board/viewport-scale-inspection.js';
