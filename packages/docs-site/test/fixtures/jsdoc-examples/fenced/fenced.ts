// Fixture: a valid `@example` wrapped in a ```ts fence. Compiles only if the
// fence is stripped first; left in place the backticks parse as a template literal.

/**
 * Double a number.
 *
 * @example
 * ```ts
 * import { double } from './fenced.js';
 *
 * const n = double(21);
 * void n;
 * ```
 */
export function double(n: number): number {
  return n * 2;
}
