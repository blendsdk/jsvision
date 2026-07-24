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
  if (options.caseSensitive === false) {
    return searchCaseInsensitive(text, query, maxResults);
  }
  const results: DocumentSearchMatch[] = [];
  let from = 0;
  while (from <= text.length && results.length < maxResults) {
    const match = text.indexOf(query, from);
    if (match < 0) {
      break;
    }
    results.push(Object.freeze({ from: match, to: match + query.length }));
    from = match + Math.max(query.length, 1);
  }
  return Object.freeze(results);
}

function searchCaseInsensitive(text: string, query: string, maxResults: number): readonly DocumentSearchMatch[] {
  const folded = foldWithSourceOffsets(text);
  const foldedQuery = query.toLocaleLowerCase('und');
  if (foldedQuery.length === 0) {
    return [];
  }
  const results: DocumentSearchMatch[] = [];
  let from = 0;
  while (from <= folded.text.length && results.length < maxResults) {
    const match = folded.text.indexOf(foldedQuery, from);
    if (match < 0) {
      break;
    }
    const last = match + foldedQuery.length - 1;
    results.push(Object.freeze({ from: folded.starts[match], to: folded.ends[last] }));
    from = match + foldedQuery.length;
  }
  return Object.freeze(results);
}

interface FoldedText {
  readonly text: string;
  readonly starts: readonly number[];
  readonly ends: readonly number[];
}

function foldWithSourceOffsets(text: string): FoldedText {
  let foldedText = '';
  let sourceOffset = 0;
  const starts: number[] = [];
  const ends: number[] = [];
  for (const character of text) {
    const foldedCharacter = character.toLocaleLowerCase('und');
    const sourceEnd = sourceOffset + character.length;
    foldedText += foldedCharacter;
    for (let index = 0; index < foldedCharacter.length; index += 1) {
      starts.push(sourceOffset);
      ends.push(sourceEnd);
    }
    sourceOffset = sourceEnd;
  }
  return { text: foldedText, starts, ends };
}
