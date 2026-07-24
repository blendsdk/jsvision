import type { CodeEditorLanguageId } from '../index.js';

/**
 * Identifies the built-in TypeScript language adapter.
 *
 * @example
 * ```ts
 * import { typescriptLanguageId } from '@jsvision/code-editor/languages/typescript';
 * ```
 */
export const typescriptLanguageId: CodeEditorLanguageId = 'typescript';
export { typescriptLanguageAdapter } from './builtins.js';
