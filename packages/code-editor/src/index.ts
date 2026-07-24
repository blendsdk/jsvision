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
