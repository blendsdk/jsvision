/**
 * Pure literal (non-regex) text search, scanning forward from a given position.
 *
 * Case-insensitivity lowercases both the haystack and the needle. The whole-words test uses its own
 * notion of "word char": a character is a word char unless it is a space, ASCII punctuation, or the
 * empty string — so, unlike the cursor word-hop classifier, tabs and newlines count as word
 * characters here.
 */
import type { BufText } from './buffer/gap.js';
import type { SearchOptions } from './editor-dialog.js';

/**
 * Find the next literal occurrence of `needle` at or after `from`.
 *
 * @param b The text to search.
 * @param from The position to start scanning from (clamped into range).
 * @param needle The literal string to find.
 * @param o Search options; only `caseSensitive` affects this scan.
 * @returns The match position, or `-1` on miss (an empty needle always misses).
 */
export function scan(b: BufText, from: number, needle: string, o: SearchOptions): number {
  if (needle === '') return -1;
  const start = Math.max(0, Math.min(Math.trunc(from) || 0, b.length));
  const hay = b.slice(start, b.length);
  const idx = o.caseSensitive ? hay.indexOf(needle) : hay.toLowerCase().indexOf(needle.toLowerCase());
  return idx === -1 ? -1 : start + idx;
}

/** The whole-words classifier: a word char unless it is a space, ASCII punctuation, or `''`. */
export function isWordChar(ch: string): boolean {
  if (ch === '' || ch === ' ') return false;
  return !'!"#$%&\'()*+,-./:;<=>?@[\\]^`{|}~'.includes(ch);
}
