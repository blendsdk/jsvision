import type { DocumentSnapshot } from './types.js';

/** Maximum Unicode code points accepted by one literal document-search query. */
export const MAXIMUM_DOCUMENT_SEARCH_QUERY_CODE_POINTS = 4_096;

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
  return searchDocumentText(snapshot.slice(0), query, options);
}

/**
 * Finds bounded literal matches in an already-bounded text segment.
 *
 * This internal-friendly form lets terminal search scan large snapshots in cancellable chunks
 * while preserving the same validation and Unicode offset semantics as whole-document search.
 */
export function searchDocumentText(
  text: string,
  query: string,
  options: DocumentSearchOptions = {},
): readonly DocumentSearchMatch[] {
  if (typeof text !== 'string') throw new TypeError('Search text must be a primitive string.');
  if (typeof query !== 'string') throw new TypeError('Search query must be a primitive string.');
  if (exceedsCodePointLimit(query, MAXIMUM_DOCUMENT_SEARCH_QUERY_CODE_POINTS)) {
    throw new RangeError(
      `Search query cannot exceed ${MAXIMUM_DOCUMENT_SEARCH_QUERY_CODE_POINTS} Unicode code points.`,
    );
  }
  if (query.length === 0) {
    return [];
  }
  const normalized = normalizeSearchOptions(options);
  const maxResults = normalized.maxResults;
  if (!Number.isSafeInteger(maxResults) || maxResults < 1 || maxResults > 100_000) {
    throw new RangeError('Maximum search results must be an integer from 1 through 100000.');
  }

  if (!normalized.caseSensitive) {
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

/** Copies optional search settings without executing inherited or accessor properties. */
function normalizeSearchOptions(options: DocumentSearchOptions): {
  readonly caseSensitive: boolean;
  readonly maxResults: number;
} {
  try {
    if (options === null || typeof options !== 'object') throw new TypeError('Search options are invalid.');
    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Search options are invalid.');
    const caseSensitive = ownData(options, 'caseSensitive');
    const maxResults = ownData(options, 'maxResults');
    if (caseSensitive !== undefined && typeof caseSensitive !== 'boolean') {
      throw new TypeError('Case sensitivity must be a boolean.');
    }
    if (maxResults !== undefined && typeof maxResults !== 'number') {
      throw new TypeError('Maximum search results must be a number.');
    }
    return {
      caseSensitive: caseSensitive !== false,
      maxResults: maxResults ?? 10_000,
    };
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Search options are invalid.');
  }
}

/** Returns an own data property without invoking getters. */
function ownData(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

/** Stops counting as soon as a hostile query exceeds the public allocation ceiling. */
function exceedsCodePointLimit(value: string, maximum: number): boolean {
  let count = 0;
  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    if (
      first >= 0xd800 &&
      first <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      index += 1;
    }
    count += 1;
    if (count > maximum) return true;
  }
  return false;
}

function searchCaseInsensitive(text: string, query: string, maxResults: number): readonly DocumentSearchMatch[] {
  const foldedQuery = query.toLocaleLowerCase('und');
  if (foldedQuery.length === 0) return [];

  const failure = buildFailureTable(foldedQuery);
  const sourceStarts = new Array<number>(foldedQuery.length);
  const sourceEnds = new Array<number>(foldedQuery.length);
  const results: DocumentSearchMatch[] = [];
  let foldedOffset = 0;
  let matched = 0;

  for (let sourceOffset = 0; sourceOffset < text.length;) {
    const first = text.charCodeAt(sourceOffset);
    const astral =
      first >= 0xd800 &&
      first <= 0xdbff &&
      sourceOffset + 1 < text.length &&
      text.charCodeAt(sourceOffset + 1) >= 0xdc00 &&
      text.charCodeAt(sourceOffset + 1) <= 0xdfff;
    const sourceEnd = sourceOffset + (astral ? 2 : 1);
    if (first <= 0x7f) {
      const currentCode = first >= 0x41 && first <= 0x5a ? first + 0x20 : first;
      const ringIndex = foldedOffset % foldedQuery.length;
      sourceStarts[ringIndex] = sourceOffset;
      sourceEnds[ringIndex] = sourceEnd;
      while (matched > 0 && currentCode !== foldedQuery.charCodeAt(matched)) matched = failure[matched - 1] ?? 0;
      if (currentCode === foldedQuery.charCodeAt(matched)) matched += 1;
      foldedOffset += 1;
      if (matched === foldedQuery.length) {
        const firstRingIndex = (foldedOffset - foldedQuery.length) % foldedQuery.length;
        results.push(
          Object.freeze({
            from: sourceStarts[firstRingIndex] ?? sourceOffset,
            to: sourceEnds[ringIndex] ?? sourceEnd,
          }),
        );
        if (results.length >= maxResults) return Object.freeze(results);
        matched = 0;
      }
      sourceOffset = sourceEnd;
      continue;
    }
    const foldedCharacter = text.slice(sourceOffset, sourceEnd).toLocaleLowerCase('und');
    for (let index = 0; index < foldedCharacter.length; index += 1) {
      const current = foldedCharacter[index] ?? '';
      const ringIndex = foldedOffset % foldedQuery.length;
      sourceStarts[ringIndex] = sourceOffset;
      sourceEnds[ringIndex] = sourceEnd;
      while (matched > 0 && current !== foldedQuery[matched]) matched = failure[matched - 1] ?? 0;
      if (current === foldedQuery[matched]) matched += 1;
      foldedOffset += 1;
      if (matched !== foldedQuery.length) continue;

      const firstRingIndex = (foldedOffset - foldedQuery.length) % foldedQuery.length;
      results.push(
        Object.freeze({
          from: sourceStarts[firstRingIndex] ?? sourceOffset,
          to: sourceEnds[ringIndex] ?? sourceEnd,
        }),
      );
      if (results.length >= maxResults) return Object.freeze(results);
      // Literal search has always returned non-overlapping matches.
      matched = 0;
    }
    sourceOffset = sourceEnd;
  }
  return Object.freeze(results);
}

/**
 * Builds the Knuth-Morris-Pratt fallback table for one already-bounded folded query.
 */
function buildFailureTable(query: string): readonly number[] {
  const failure = new Array<number>(query.length).fill(0);
  let matched = 0;
  for (let index = 1; index < query.length; index += 1) {
    while (matched > 0 && query[index] !== query[matched]) matched = failure[matched - 1] ?? 0;
    if (query[index] === query[matched]) matched += 1;
    failure[index] = matched;
  }
  return failure;
}
