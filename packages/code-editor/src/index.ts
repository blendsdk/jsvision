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
  DocumentIdentity,
  DocumentMutationResult,
  DocumentPosition,
  DocumentSelection,
  DocumentSizeMode,
  DocumentSnapshot,
  DocumentTransaction,
  EditOrigin,
  LogicalLine,
} from './document/types.js';
