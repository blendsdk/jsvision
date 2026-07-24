import type { CodeEditorLanguageId } from '../index.js';

/**
 * Identifies the built-in PostgreSQL language adapter.
 *
 * @example
 * ```ts
 * import { postgresqlLanguageId } from '@jsvision/code-editor/languages/postgresql';
 * ```
 */
export const postgresqlLanguageId: CodeEditorLanguageId = 'postgresql';
export { postgresqlLanguageAdapter } from './postgresql-adapter.js';
