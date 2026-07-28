/**
 * Language identifiers supported by the built-in code-editor adapters.
 */
export type CodeEditorLanguageId = 'plain' | 'javascript' | 'typescript' | 'postgresql';

/**
 * Identifies plain text, which intentionally has no parser dependency.
 *
 * @example
 * ```ts
 * import { plainLanguageId } from '@jsvision/code-editor';
 * ```
 */
export const plainLanguageId: CodeEditorLanguageId = 'plain';

export { CODE_EDITOR_ACCELERATOR_MANIFEST } from './i18n/catalog.js';

export { HARD_CODE_EDITOR_LIMITS, classifyDocumentSize, resolveCodeEditorLimits } from './limits.js';
export type {
  CodeEditorDocumentFeatureState,
  CodeEditorDocumentSizeClassification,
  CodeEditorLimits,
  CodeEditorLimitsInput,
  CodeEditorSizeTierFeature,
  EssentialCodeEditorFeature,
} from './limits.js';
export { createDegradationState, formatCodeEditorDegradationNotice } from './degradation.js';
export type {
  CodeEditorDegradationNotice,
  CodeEditorDegradationOptions,
  CodeEditorDegradationSnapshot,
  CodeEditorDegradationState,
  CodeEditorDegradedFeature,
  CodeEditorFeatureInspection,
  CodeEditorFeatureStatus,
  CodeEditorPendingDetails,
  CodeEditorSuspensionDetails,
} from './degradation.js';
export { createObservabilityChannel } from './observability.js';
export type {
  CodeEditorObservabilityChannel,
  CodeEditorObservabilityOptions,
  CodeEditorObservabilitySnapshot,
  CodeEditorObservation,
  CodeEditorObservationEvent,
} from './observability.js';
export { CodeEditorDocumentModel, createDocumentModel } from './document/model.js';
export type { CreateDocumentModelOptions, LargeDocumentDetails } from './document/model.js';
export { offsetToPosition, offsetToVisualColumn, positionToOffset } from './document/positions.js';
export { searchDocument } from './document/search.js';
export type { DocumentSearchMatch, DocumentSearchOptions } from './document/search.js';
export type {
  DocumentEdit,
  DocumentEditInput,
  DocumentCharacter,
  DocumentIdentity,
  DocumentLineEnding,
  DocumentLine,
  DocumentMutationResult,
  DocumentOffset,
  DocumentPosition,
  DocumentPositionInput,
  DocumentRevision,
  DocumentSelection,
  DocumentSelectionInput,
  DocumentSizeMode,
  DocumentSnapshot,
  DocumentTransaction,
  DocumentTransactionInput,
  EditOrigin,
  LogicalLine,
  VisualColumn,
} from './document/types.js';
export {
  documentCharacter,
  documentLine,
  documentOffset,
  documentRevision,
  documentSelection,
  visualColumn,
} from './document/types.js';
export { LanguageRegistry } from './languages/registry.js';
export { createLanguageScheduler, LanguageScheduler } from './languages/scheduler.js';
export { indentLines, toggleLineComments } from './languages/editing.js';
export { formatInvisibleCharacterWarning, inspectInvisibleCharacters } from './languages/invisibles.js';
export {
  clipCodeEditorDisplayText,
  formatCodeEditorDiagnosticOverlay,
  formatCodeEditorStatus,
} from './i18n/presentation.js';
export { querySyntaxViewport } from './languages/syntax.js';
export type {
  BracketPair,
  CommentMetadata,
  FoldRange,
  LanguageAdapter,
  LanguageCapability,
  LanguageCapabilityContext,
  LanguageCapabilityResult,
  LocalLanguageResult,
  SyntaxCategory,
  SyntaxSpan,
} from './languages/contracts.js';
export { CodeEditorLspCoordinator, createCodeEditorLspCoordinator } from './lsp/coordinator.js';
export { createInProcessLspSession, InProcessLspSession } from './lsp/session.js';
export type { CodeEditorLspSession, CodeEditorLspSessionState } from './lsp/session.js';
export type {
  CodeEditorCompletionItem,
  CodeEditorControllerPresentation,
  CodeEditorOverlayPresentation,
} from './presentation.js';
export type { CodeEditorDisposable, CodeEditorMutationInput, CodeEditorMutationSink } from './integration.js';
export type {
  CodeEditorHostEffect,
  CodeEditorLspCapabilities,
  CodeEditorLspCommandAvailability,
  CodeEditorLspOperation,
  CodeEditorLspPresentation,
  CodeEditorLspSnippetSnapshot,
  CodeEditorLspStateSnapshot,
  CreateCodeEditorLspCoordinatorOptions,
  LspServiceState,
  ProtocolPosition,
  ProtocolRange,
} from './lsp/types.js';
export type {
  CodeEditorDocumentLifecycleHostEffect,
  CodeEditorExternalChangeDecision,
  CodeEditorExternalChangeInput,
  CodeEditorExternalChangeResult,
  CodeEditorSaveFormattingOutcome,
} from './document-lifecycle.js';
export { CodeEditorController, createCodeEditorController } from './controller.js';
export type {
  CodeEditorControllerEvent,
  CodeEditorControllerHostEffect,
  CodeEditorControllerMetrics,
  CodeEditorControllerMutationEvent,
  CodeEditorControllerPublicState,
  CreateCodeEditorControllerOptions,
} from './controller.js';
export {
  CodeEditor,
  CodeEditorKeyBindingConflictError,
  CodeEditorWindow,
  projectCodeEditor,
  registerCodeEditorKeyBindings,
} from './ui/index.js';
export type {
  CodeEditorFrame,
  CodeEditorKeyRoute,
  CodeEditorOptions,
  CodeEditorProjectedCell,
  CodeEditorSearchField,
  CodeEditorSearchPresentation,
  CodeEditorSearchState,
  CodeEditorViewportMetrics,
  CodeEditorWindowOptions,
  ProjectCodeEditorOptions,
} from './ui/index.js';
export {
  classicCodeEditorTheme,
  darkCodeEditorTheme,
  lightCodeEditorTheme,
  resolveCodeEditorTheme,
} from './theme/index.js';
export type {
  CodeEditorCellStyle,
  CodeEditorTheme,
  CodeEditorThemeResolutionReport,
  CodeEditorThemeSource,
  ResolvedCodeEditorTheme,
} from './theme/index.js';
export type { ResolveCodeEditorThemeContext } from './theme/resolve.js';
