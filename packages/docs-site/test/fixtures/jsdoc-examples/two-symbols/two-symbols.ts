// Fixture: two `@example` blocks in ONE file on two DIFFERENT exported symbols,
// one compiling and one not. Allowlisting the failing one must leave the other
// entirely unaffected.

/**
 * A function whose example compiles.
 *
 * @example
 * import { good } from './two-symbols.js';
 *
 * void good();
 */
export function good(): number {
  return 1;
}

/**
 * A function whose example calls it with the wrong arity.
 *
 * @example
 * import { bad } from './two-symbols.js';
 *
 * void bad(1);
 */
export function bad(a: number, b: number): number {
  return a + b;
}
