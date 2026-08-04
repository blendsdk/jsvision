/**
 * Public production entry point for Kanban contracts, sources, renderers, and components.
 *
 * Symbols are added here only after their owning module has specification coverage. Testing helpers
 * remain available exclusively from `@jsvision/kanban/testing`.
 */
export * from './contract/authority.js';
export * from './contract/capability.js';
export * from './contract/error.js';
export * from './contract/identity.js';
export * from './contract/limits.js';
export * from './contract/observation.js';
export * from './contract/request.js';
export * from './contract/revision.js';
export * from './contract/semantic-query.js';
export * from './card/adapter.js';
export { createKanbanChecklistItemId } from './card/checklist.js';
export { KANBAN_OPEN_CARD_EDITOR_ACTION_ID } from './card/checklist-renderer.js';
export type { KanbanCardFormattingContext } from './card/formatting.js';
export * from './card/descriptor.js';
export * from './card/presentation-policy.js';
export * from './card/presentation-snapshot.js';
export * from './card/renderer.js';
export * from './card/standard-card.js';
export { composeStandardKanbanCard, renderStandardKanbanCard } from './card/standard-renderer.js';
export type { KanbanStandardCardCompositionContext } from './card/standard-renderer.js';
export * from './card/theme.js';
export * from './card/theme-resolver.js';
export * from './i18n/catalog.js';
export * from './interaction/types.js';
export * from './layout/hit-map.js';
export * from './layout/metrics.js';
export * from './layout/scroll-model.js';
export * from './layout/sparse-height-index.js';
export * from './layout/vertical-projector.js';
export * from './layout/width-solver.js';
export * from './board/kanban-viewport.js';
export * from './board/kanban-board.js';
export type { KanbanViewportInspection } from './board/viewport-inspection.js';
export type { KanbanOverscanOptions } from './board/viewport-source.js';
export type { KanbanRevealAlignment, KanbanRevealResult, KanbanScrollTarget } from './board/viewport-scroll.js';
export * from './source/address.js';
export * from './source/counts.js';
export { createEagerKanbanDataSource } from './source/eager-source.js';
export type {
  EagerKanbanSourceOptions,
  KanbanFilterField,
  KanbanFilterOperator,
  KanbanGroupingField,
  KanbanSortField,
  KanbanSummaryAdapter,
} from './source/eager-index.js';
export * from './source/placement.js';
export * from './source/states.js';
export * from './source/types.js';
export * from './source/validation.js';
export * from './structure/collapsed-hover.js';
export * from './structure/grouping.js';
export * from './structure/model.js';
export * from './structure/policy.js';
export * from './structure/swimlane-presentation.js';
export * from './workflow/definition-of-done.js';
export * from './workflow/transition.js';
export * from './workflow/wip.js';
