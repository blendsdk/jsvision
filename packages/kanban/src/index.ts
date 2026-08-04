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
export { createStandardKanbanCardAdapter } from './card/adapter.js';
export type { KanbanCardAdapter } from './card/adapter.js';
export type { KanbanCardFormattingContext } from './card/formatting.js';
export * from './card/descriptor.js';
export * from './card/renderer.js';
export * from './card/standard-card.js';
export { renderStandardKanbanCard } from './card/standard-renderer.js';
export * from './card/theme.js';
export * from './card/theme-resolver.js';
export * from './i18n/catalog.js';
export * from './layout/hit-map.js';
export * from './layout/metrics.js';
export * from './layout/scroll-model.js';
export * from './layout/vertical-projector.js';
export * from './layout/width-solver.js';
export * from './board/kanban-viewport.js';
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
