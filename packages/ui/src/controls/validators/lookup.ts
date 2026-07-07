/**
 * An exact-membership validator: accept only a value that exactly matches one of a fixed list of
 * strings. There is no per-keystroke filtering — the user can type anything — but the field is
 * flagged invalid on completion unless the finished value is an exact list member.
 */
import type { Validator } from './types.js';

/**
 * Build an exact-membership validator over a fixed list of strings.
 *
 * @param list The accepted complete values. Passing `[]` means nothing is ever valid.
 * @returns A {@link Validator} that accepts any keystroke but only validates a value that exactly
 *   equals a member of `list`.
 * @example
 * import { signal } from '@jsvision/ui';
 * import { Input, lookup } from '@jsvision/ui';
 *
 * const color = signal('');
 * // Any typing is allowed, but only 'red' | 'green' | 'blue' passes validation.
 * const input = new Input({ value: color, validator: lookup(['red', 'green', 'blue']) });
 */
export function lookup(list: readonly string[]): Validator {
  const set = new Set(list); // defensive copy; O(1) membership
  return {
    isValidInput: () => true,
    isValid: (s) => set.has(s),
    error: `Value must be one of: ${list.join(', ')}.`,
  };
}
