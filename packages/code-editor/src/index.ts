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
