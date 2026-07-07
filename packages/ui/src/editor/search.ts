/**
 * Pure literal search (RD-08 03-03).
 *
 * TV scans with `scan`/`iScan` (asm/C fallbacks) from the caret forward — literal, no regex
 * (regex = DEF-35). Case-insensitivity lowercases both sides (`iScan`). The whole-words test uses
 * the SEARCH-side `isWordChar` (`teditor2.cpp:61-64` — distinct from the editor word-hop classes
 * `getCharType`/`isWordBoundary` `:45-59`, PF-014/PF-009): a char is a word char unless it is
 * space, ASCII punctuation, or NUL — faithfully, tabs/newlines COUNT as word chars in this test
 * (the TV set simply omits them).
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { BufText } from './buffer/gap.js';
import type { SearchOptions } from './editor-dialog.js';

/**
 * Find the next literal occurrence of `needle` at/after `from` — TV `scan`/`iScan`.
 *
 * @returns The match position, or `-1` on miss (an empty needle always misses).
 */
export function scan(b: BufText, from: number, needle: string, o: SearchOptions): number {
  if (needle === '') return -1;
  const start = Math.max(0, Math.min(Math.trunc(from) || 0, b.length));
  const hay = b.slice(start, b.length);
  const idx = o.caseSensitive ? hay.indexOf(needle) : hay.toLowerCase().indexOf(needle.toLowerCase());
  return idx === -1 ? -1 : start + idx;
}

/** The TV search whole-words class (`teditor2.cpp:61-64`): NOT space/punctuation/NUL (out-of-range `''` = NUL). */
export function isWordChar(ch: string): boolean {
  if (ch === '' || ch === ' ') return false;
  return !'!"#$%&\'()*+,-./:;<=>?@[\\]^`{|}~'.includes(ch);
}
