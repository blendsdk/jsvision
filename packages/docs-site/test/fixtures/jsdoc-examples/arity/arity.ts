// Fixture: an `@example` block that calls its own subject with the wrong number
// of arguments — the canonical TS2554 the guard must report.

/**
 * Add two numbers.
 *
 * @example
 * import { add } from './arity.js';
 *
 * const sum = add(1);
 * void sum;
 */
export function add(a: number, b: number): number {
  return a + b;
}
