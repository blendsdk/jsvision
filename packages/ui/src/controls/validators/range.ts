/**
 * `range(min, max)` — an integer-range validator (TV `TRangeValidator`, `tvalidat.cpp:656-704`).
 * Extends the filter with a digit/sign character set: `isValidInput` admits partial numbers mid-edit
 * (digits + the sign chars), while `isValid` additionally requires the whole string to parse to an
 * integer within `[min, max]`. The sign set is faithful to TV (`tvtext2.cpp:144-145`): unsigned
 * (`min ≥ 0`) = `"+0123456789"`, signed (`min < 0`) = `"+-0123456789"` (PA-15). The `.js` extension in
 * import specifiers is required by NodeNext ESM resolution.
 */
import type { Validator } from './types.js';
import { allInSet } from './charset.js';

/** TV `validUnsignedChars` (`tvtext2.cpp:144`) — `+` and the digits, no `-`. */
const UNSIGNED_CHARS = '+0123456789';
/** TV `validSignedChars` (`tvtext2.cpp:145`) — `+`, `-`, and the digits. */
const SIGNED_CHARS = '+-0123456789';
/** A complete optionally-signed integer (the `sscanf("%ld")` parse target). */
const INTEGER = /^[+-]?\d+$/;

/**
 * Build an integer-range validator.
 *
 * @param min The inclusive lower bound (a negative `min` admits a leading `-` in the transient gate).
 * @param max The inclusive upper bound.
 * @returns A {@link Validator} whose `isValidInput` is the digit/sign filter (partials allowed) and
 *   whose `isValid` parses the complete string and bounds-checks it.
 */
export function range(min: number, max: number): Validator {
  const set = new Set(min >= 0 ? UNSIGNED_CHARS : SIGNED_CHARS);
  const inputOk = (s: string): boolean => allInSet(s, set);
  return {
    isValidInput: inputOk,
    isValid: (s) => inputOk(s) && INTEGER.test(s) && Number(s) >= min && Number(s) <= max,
    error: `Value must be an integer between ${min} and ${max}.`,
  };
}
