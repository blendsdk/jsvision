import { isSafeText } from './messages.js';
import type { CatalogIssue } from './types.js';

const MAX_IDENTIFIER_SCALARS = 512;

/** Escape one issue identifier for safe, bounded, single-line CI output. */
function formatIdentifier(value: string): string {
  const characters = [...value];
  const escaped = characters
    .slice(0, MAX_IDENTIFIER_SCALARS)
    .map((character) =>
      isSafeText(character) ? character : `\\u{${character.codePointAt(0)?.toString(16).toUpperCase() ?? 'FFFD'}}`,
    )
    .join('');
  return JSON.stringify(escaped + (characters.length > MAX_IDENTIFIER_SCALARS ? '…' : ''));
}

/**
 * Format a structural issue without including translated text or parameter values.
 *
 * Unsafe identifier characters are escaped so a malformed catalog cannot inject terminal state
 * into CI output.
 *
 * @param issue Catalog issue to render.
 * @returns Stable single-line CI representation.
 *
 * @example
 * ```ts
 * formatCatalogIssue({ code: 'INVALID_KEY', severity: 'error', path: ['messages', 'Bad'] });
 * ```
 */
export function formatCatalogIssue(issue: CatalogIssue): string {
  const fields = [
    issue.source === undefined ? undefined : `source=${formatIdentifier(issue.source)}`,
    issue.locale === undefined ? undefined : `locale=${formatIdentifier(issue.locale)}`,
    issue.key === undefined ? undefined : `key=${formatIdentifier(issue.key)}`,
    `path=${formatIdentifier(issue.path.join('.'))}`,
  ].filter((field): field is string => field !== undefined);
  return `[${issue.severity.toUpperCase()} ${issue.code}] ${fields.join(' ')}`;
}
