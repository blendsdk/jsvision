/**
 * Public production entry point for Kanban contracts, sources, renderers, and components.
 *
 * Symbols are added here only after their owning module has specification coverage. Testing helpers
 * remain available exclusively from `@jsvision/kanban/testing`.
 */
export { dispatchKanbanRequest, reconcileKanbanPublication } from './contract/authority.js';
export * from './contract/capability.js';
export * from './contract/error.js';
export * from './contract/identity.js';
export * from './contract/limits.js';
export * from './contract/observation.js';
export * from './contract/request.js';
export { createKanbanRequestEnvelope, snapshotKanbanRequestProposal } from './contract/request-validation.js';
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
export { createKanbanEditorCoordinator } from './editor/coordinator.js';
export {
  confirmAndReloadKanbanEditor,
  confirmKanbanEditorAction,
  type KanbanEditorConfirm,
  type KanbanEditorConfirmationRequest,
  type KanbanEditorConfirmedReloadResult,
} from './editor/confirmation.js';
export {
  createKanbanEditorControlBinding,
  type KanbanEditorControlBinding,
  type KanbanEditorControlBindingOptions,
} from './editor/controls.js';
export {
  openKanbanCardCreateDialog,
  openKanbanCardEditDialog,
  openKanbanCardViewDialog,
  type KanbanEditorAuthorityCompletion,
  type KanbanEditorDialogCompletion,
  type KanbanEditorDialogActions,
  type KanbanEditorDialogContext,
  type KanbanEditorDialogHandlers,
  type KanbanEditorDialogHost,
  type KanbanEditorDialogOptions,
  type KanbanEditorDialogPresentation,
  type KanbanEditorDialogResult,
  type KanbanEditorDialogReplacement,
  type KanbanEditorDialogSubmitResult,
  type KanbanEditorDialogViewport,
  type KanbanEditorResultOnlyCompletion,
  type KanbanEditorCreatedRecord,
  type KanbanEditorCreatePublicationContext,
  type KanbanEditorCreatePublicationResolver,
  type OpenKanbanCardCreateDialogOptions,
  type OpenKanbanCardEditDialogOptions,
  type OpenKanbanCardViewDialogOptions,
} from './editor/dialog.js';
export {
  openKanbanCardInspector,
  type KanbanEditorInspectorPresentation,
  type KanbanEditorInspectorResult,
  type OpenKanbanCardInspectorOptions,
} from './editor/inspector.js';
export { createKanbanEditorControlRegistry } from './editor/registry.js';
export { createKanbanCardEditorSchema, type KanbanCardEditorSchemaOptions } from './editor/schema.js';
export { createKanbanEditorSession } from './editor/session.js';
export {
  createStandardKanbanEditorAdapter,
  type StandardKanbanEditorAdapter,
  type StandardKanbanEditorAdapterOptions,
  type StandardKanbanEditorCreateDefaults,
  type StandardKanbanEditorCreateOptions,
  type StandardKanbanEditorForm,
  type StandardKanbanEditorFormField,
  type StandardKanbanFormFieldSchema,
  type StandardKanbanFormParseResult,
  type StandardKanbanFormSchema,
  type StandardKanbanFormValues,
} from './editor/standard-adapter.js';
export {
  STANDARD_KANBAN_EDITOR_FIELDS,
  createStandardKanbanEditorSchema,
  type StandardKanbanEditableCard,
  type StandardKanbanEditorDraft,
  type StandardKanbanEditorFieldId,
  type StandardKanbanFieldValidator,
  type StandardKanbanSchemaOptions,
} from './editor/standard-schema.js';
export * from './editor/types.js';
export * from './configuration/builders.js';
export {
  confirmKanbanConfigurationDeletion,
  type KanbanConfigurationDeleteConfirmationOptions,
} from './configuration/delete-dialog.js';
export * from './configuration/deletion.js';
export {
  openKanbanColumnConfigurationDialog,
  type OpenKanbanColumnConfigurationDialogOptions,
} from './configuration/column-dialog.js';
export { createKanbanConfigurationSession, type KanbanConfigurationSessionOptions } from './configuration/session.js';
export {
  openKanbanSwimlaneConfigurationDialog,
  type OpenKanbanSwimlaneConfigurationDialogOptions,
} from './configuration/swimlane-dialog.js';
export * from './configuration/types.js';
export { createKanbanConfigurationSnapshot, normalizeKanbanConfigurationName } from './configuration/validation.js';
export * from './command/actions.js';
export * from './command/capability.js';
export * from './command/defaults.js';
export * from './command/help.js';
export * from './command/input-adapter.js';
export * from './command/keymap.js';
export * from './command/registry.js';
export * from './command/router.js';
export * from './command/types.js';
export * from './event/types.js';
export * from './event/validation.js';
export * from './event/hub.js';
export * from './event/history.js';
export * from './event/operation-events.js';
export * from './i18n/catalog.js';
export type {
  KanbanActivateOptions,
  KanbanInteractionController,
  KanbanInteractionControllerFactory,
  KanbanInteractionFacade,
  KanbanOpenContextOptions,
} from './interaction/facade.js';
export type {
  KanbanCardMovePositionInput,
  KanbanMoveCardOptions,
  KanbanMoveDirection,
  KanbanMoveSelectedBlockOptions,
  KanbanReorderColumnOptions,
  KanbanReorderSwimlaneOptions,
} from './interaction/operation-facade.js';
export { createKanbanInteractionController } from './interaction/controller.js';
export * from './interaction/intent.js';
export * from './interaction/types.js';
export type { KanbanDragConfiguration } from './interaction/pointer-router.js';
export * from './layout/hit-map.js';
export * from './layout/metrics.js';
export * from './layout/scroll-model.js';
export * from './layout/sparse-height-index.js';
export * from './layout/swimlane-geometry.js';
export * from './layout/swimlane-custom.js';
export * from './layout/swimlane-rail.js';
export * from './layout/vertical-projector.js';
export * from './layout/width-solver.js';
export * from './operation/eligibility.js';
export * from './operation/operation-id.js';
export * from './operation/placement.js';
export * from './operation/types.js';
export * from './operation/undo.js';
export {
  createKanbanBoardEditorBinding,
  type CreateKanbanBoardEditorBindingOptions,
  type KanbanBoardEditorBinding,
  type KanbanBoardEditorOpenContext,
} from './board/editor-binding.js';
export * from './board/board-configuration-binding.js';
export * from './board/kanban-viewport.js';
export * from './board/kanban-board.js';
export * from './board/scene-builder.js';
export * from './board/scene-model.js';
export { calculateKanbanSceneDamage } from './board/viewport-damage.js';
export type { CalculateKanbanSceneDamageOptions } from './board/viewport-damage.js';
export type { KanbanViewportInspection } from './board/viewport-inspection.js';
export type { KanbanInteractionInspection } from './board/viewport-inspection.js';
export type { KanbanViewportInteractionAdapter } from './board/viewport-interaction.js';
export {
  resolveKanbanSceneWindow,
  type KanbanOverscanOptions,
  type KanbanSceneWindowCell,
  type KanbanSceneWindowLayoutHint,
  type KanbanSceneWindowLayoutRow,
  type KanbanSceneWindowResult,
} from './board/viewport-source.js';
export type { KanbanRevealAlignment, KanbanRevealResult, KanbanScrollTarget } from './board/viewport-scroll.js';
export * from './source/address.js';
export * from './source/counts.js';
export { createEagerKanbanDataSource } from './source/eager-source.js';
export type {
  EagerKanbanSourceOptions,
  KanbanFilterField,
  KanbanFilterOperator,
  KanbanGroupingField,
  KanbanLegacySortField,
  KanbanMultiComparatorSortField,
  KanbanSortComparator,
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
export {
  KANBAN_VIEW_SEARCH_DEBOUNCE_MS,
  createKanbanViewController,
  type KanbanViewControllerInitialState,
  type KanbanViewControllerOptions,
} from './view/controller.js';
export {
  createKanbanViewRegistry,
  type KanbanQuickFilterMapping,
  type KanbanQuickFilterParameterCodec,
  type KanbanQuickFilterRegistration,
  type KanbanViewRegistry,
  type KanbanViewRegistryOptions,
} from './view/registry.js';
export { parseKanbanSavedView, serializeKanbanSavedView } from './view/saved-view-codec.js';
export { createKanbanSavedViewMigrationRegistry, migrateKanbanSavedView } from './view/saved-view-migration.js';
export { reconcileKanbanSavedView } from './view/saved-view-reconcile.js';
export { applyKanbanSavedView, captureKanbanSavedView, createKanbanSavedViewStore } from './view/saved-view-store.js';
export {
  KANBAN_SAVED_VIEW_KIND,
  KANBAN_SAVED_VIEW_SUPPORTED_VERSIONS,
  type KanbanDurableViewStateV1,
  type KanbanReconciledSavedView,
  type KanbanSavedColumnV1,
  type KanbanSavedFilterV1,
  type KanbanSavedGroupingV1,
  type KanbanSavedPresentationV1,
  type KanbanSavedQuickFilterV1,
  type KanbanSavedSortV1,
  type KanbanSavedSwimlaneV1,
  type KanbanSavedViewCaptureMode,
  type KanbanSavedViewCaptureOptions,
  type KanbanSavedViewColumnDefinition,
  type KanbanSavedViewDiagnostic,
  type KanbanSavedViewDiagnosticCode,
  type KanbanSavedViewFieldDefinition,
  type KanbanSavedViewMigration,
  type KanbanSavedViewMigrationOptions,
  type KanbanSavedViewMigrationRegistry,
  type KanbanSavedViewMigrationRegistryOptions,
  type KanbanSavedViewMigrationResult,
  type KanbanSavedViewMissingPolicy,
  type KanbanSavedViewParseResult,
  type KanbanSavedViewProvenance,
  type KanbanSavedViewReconciliationContext,
  type KanbanSavedViewReconciliationResult,
  type KanbanSavedViewReferenceCategory,
  type KanbanSavedViewReferencePolicy,
  type KanbanSavedViewStore,
  type KanbanSavedViewStoreOptions,
  type KanbanSavedViewStoreResult,
  type KanbanSavedViewSwimlaneDefinition,
  type KanbanSavedViewV1,
} from './view/saved-view-types.js';
export type { KanbanViewEmptyState, KanbanViewSummary } from './view/summary.js';
export type {
  KanbanColumnViewItem,
  KanbanColumnViewState,
  KanbanFilterSelection,
  KanbanGroupingSelection,
  KanbanQuickFilterSelection,
  KanbanSearchPolicy,
  KanbanSwimlaneViewItem,
  KanbanSwimlaneViewState,
  KanbanViewController,
  KanbanViewPresentation,
  KanbanViewState,
  KanbanViewSubscriber,
  KanbanViewTransition,
  KanbanViewTransitionResult,
} from './view/types.js';
export {
  KanbanViewBar,
  type KanbanViewBarControlId,
  type KanbanViewBarControlInspection,
  type KanbanViewBarInspection,
  type KanbanViewBarMode,
  type KanbanViewBarOptions,
  type KanbanViewBarOverflowEntryInspection,
} from './view/view-bar.js';
export * from './workflow/definition-of-done.js';
export * from './workflow/transition.js';
export * from './workflow/wip.js';
