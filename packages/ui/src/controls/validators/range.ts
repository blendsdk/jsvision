/**
 * An integer-range validator: allow only whole numbers within `[min, max]` (inclusive).
 *
 * While the user types, only digits and sign characters are accepted, so a half-typed number like
 * `"1"` or `"-"` is allowed. The complete value is bounds-checked when the field is validated. A
 * leading `-` is only accepted when `min` is negative.
 */
import type { Validator } from './types.js';
import { allInSet } from './charset.js';

/** Characters allowed while typing an unsigned range (`min ≥ 0`): `+` and the digits, no `-`. */
const UNSIGNED_CHARS = '+0123456789';
/** Characters allowed while typing a signed range (`min < 0`): `+`, `-`, and the digits. */
const SIGNED_CHARS = '+-0123456789';
/** Matches a complete, optionally-signed integer. */
const INTEGER = /^[+-]?\d+$/;

/**
 * Build an integer-range validator.
 *
 * @param min The inclusive lower bound. A negative `min` also permits typing a leading `-`.
 * @param max The inclusive upper bound.
 * @returns A {@link Validator} that filters keystrokes to digits/signs and, on completion, requires
 *   the value to parse to an integer within `[min, max]`.
 * @example
 * import { signal } from '@jsvision/ui';
 * import { Input, range } from '@jsvision/ui';
 *
 * const age = signal('');
 * // Accepts 0–120; non-digits are rejected live, out-of-range flags invalid on focus-leave.
 * const input = new Input({ value: age, validator: range(0, 120) });
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
