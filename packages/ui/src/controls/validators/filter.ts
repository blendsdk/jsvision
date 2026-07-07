/**
 * A character-set validator: allow only characters drawn from a given set. A value is accepted (by
 * both gates) when every one of its characters is in the set, so typing a disallowed character is
 * rejected live. Note that an empty value is always allowed.
 */
import type { Validator } from './types.js';
import { expandCharSet, allInSet } from './charset.js';

/**
 * Build a filter validator over an allowed-character set.
 *
 * @param chars The allowed characters, as a literal list or a compact range spec — `X-Y` expands to
 *   an inclusive range (e.g. `'0-9'`, `'A-Za-z '`, `'A-Fa-f0-9'`). Passing `''` rejects all
 *   non-empty input.
 * @returns A {@link Validator} that accepts only values whose characters are all in the set.
 * @example
 * import { signal } from '@jsvision/ui';
 * import { Input, filter } from '@jsvision/ui';
 *
 * const name = signal('');
 * // Letters and spaces only — digits/punctuation are rejected as you type.
 * const input = new Input({ value: name, validator: filter('A-Za-z ') });
 */
export function filter(chars: string): Validator {
  const set = expandCharSet(chars);
  const test = (s: string): boolean => allInSet(s, set);
  return {
    isValidInput: test,
    isValid: test, // both gates use the same membership test — a partial value is judged like a whole one
    error: 'Invalid character.',
  };
}
