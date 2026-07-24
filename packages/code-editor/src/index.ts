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
export { inspectInvisibleCharacters } from './languages/invisibles.js';
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
  CodeEditorHostEffect,
  CodeEditorLspCapabilities,
  CodeEditorLspOperation,
  CodeEditorLspPresentation,
  CreateCodeEditorLspCoordinatorOptions,
  LspServiceState,
  ProtocolPosition,
  ProtocolRange,
} from './lsp/types.js';
export { CodeEditorController, createCodeEditorController } from './controller.js';
export type {
  CodeEditorControllerHostEffect,
  CodeEditorControllerMetrics,
  CreateCodeEditorControllerOptions,
} from './controller.js';
export { CodeEditor, CodeEditorWindow, projectCodeEditor } from './ui/index.js';
export type {
  CodeEditorFrame,
  CodeEditorKeyRoute,
  CodeEditorOptions,
  CodeEditorProjectedCell,
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
