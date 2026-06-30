/**
 * `filter(chars)` — a character-set validator (TV `TFilterValidator`, `tvalidat.cpp:639-647`). A
 * candidate is valid (for both gates) iff every one of its characters is in the allowed set. The live
 * per-keystroke rejection comes from `Input` calling `isValidInput`. The `.js` extension in import
 * specifiers is required by NodeNext ESM resolution.
 */
import type { Validator } from './types.js';
import { expandCharSet, allInSet } from './charset.js';

/**
 * Build a filter validator over an allowed-character set.
 *
 * @param chars An allowed-character set, literal or a compact range spec (e.g. `'0-9'`, `'A-Za-z '`).
 * @returns A {@link Validator} accepting only candidates whose characters are all in the set
 *   (`filter('')` rejects all non-empty input — the caller's choice, PA-12).
 */
export function filter(chars: string): Validator {
  const set = expandCharSet(chars);
  const test = (s: string): boolean => allInSet(s, set);
  return {
    isValidInput: test,
    isValid: test, // TV uses the same membership test for both gates (tvalidat.cpp:645-651)
    error: 'Invalid character.',
  };
}
