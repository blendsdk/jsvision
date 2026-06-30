/**
 * `lookup(list)` — an exact-membership validator (TV `TStringLookupValidator`, `tvalidat.cpp:752-807`).
 * No per-keystroke filtering (type anything); the blocking gate accepts only an exact member of the
 * list. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Validator } from './types.js';

/**
 * Build an exact-membership validator over a fixed list of strings.
 *
 * @param list The accepted complete values (`lookup([])` is never valid — documented, PA-12).
 * @returns A {@link Validator} whose `isValidInput` is always `true` and whose `isValid` is exact
 *   membership in {@link list}.
 */
export function lookup(list: readonly string[]): Validator {
  const set = new Set(list); // defensive copy; O(1) membership
  return {
    isValidInput: () => true,
    isValid: (s) => set.has(s),
    error: `Value must be one of: ${list.join(', ')}.`,
  };
}
