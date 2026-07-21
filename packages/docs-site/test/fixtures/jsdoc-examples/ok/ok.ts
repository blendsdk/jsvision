// Fixture: an `@example` block that compiles cleanly. Deliberately imports only
// its own sibling source, so the guard's oracle never depends on a built dist/.

/**
 * Join two words with a single space.
 *
 * @example
 * import { join2 } from './ok.js';
 *
 * const greeting = join2('hello', 'world');
 * void greeting;
 */
export function join2(a: string, b: string): string {
  return `${a} ${b}`;
}
