import type { CommentMetadata } from './contracts.js';

/** Shared JavaScript and TypeScript comment syntax used by their built-in adapters. */
export const javascriptCommentMetadata: CommentMetadata = Object.freeze({
  line: '//',
  block: Object.freeze(['/*', '*/'] as const),
});

/** Shared PostgreSQL comment syntax used by its built-in adapter. */
export const postgresqlCommentMetadata: CommentMetadata = Object.freeze({
  line: '--',
  block: Object.freeze(['/*', '*/'] as const),
});

/** Resolves comment syntax for one built-in language without loading its parser. */
export function builtInCommentMetadata(languageId: string): CommentMetadata | undefined {
  if (languageId === 'javascript' || languageId === 'typescript') return javascriptCommentMetadata;
  if (languageId === 'postgresql') return postgresqlCommentMetadata;
  return undefined;
}
