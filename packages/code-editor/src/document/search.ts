import type { DocumentSnapshot } from './types.js';

/**
 * Controls bounded literal document searches.
 */
export interface DocumentSearchOptions {
  readonly caseSensitive?: boolean;
  readonly maxResults?: number;
}

/**
 * One literal search match expressed in UTF-16 document offsets.
 */
export interface DocumentSearchMatch {
  readonly from: number;
  readonly to: number;
}

/**
 * Finds literal matches without mutating document or history state.
 *
 * @example
 * ```ts
 * const matches = searchDocument(snapshot, 'value');
 * ```
 */
export function searchDocument(
  snapshot: DocumentSnapshot,
  query: string,
  options: DocumentSearchOptions = {},
): readonly DocumentSearchMatch[] {
  if (query.length === 0) {
    return [];
  }
  const maxResults = options.maxResults ?? 10_000;
  if (!Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 100_000) {
    throw new RangeError('Maximum search results must be an integer from 1 through 100000.');
  }

  const text = snapshot.slice(0);
  const source = options.caseSensitive === false ? text.toLocaleLowerCase('und') : text;
  const needle = options.caseSensitive === false ? query.toLocaleLowerCase('und') : query;
  const results: DocumentSearchMatch[] = [];
  let from = 0;
  while (from <= source.length && results.length < maxResults) {
    const match = source.indexOf(needle, from);
    if (match < 0) {
      break;
    }
    results.push(Object.freeze({ from: match, to: match + needle.length }));
    from = match + Math.max(needle.length, 1);
  }
  return Object.freeze(results);
}
