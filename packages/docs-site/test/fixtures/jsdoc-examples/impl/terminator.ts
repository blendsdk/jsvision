// Fixture: an `@example` whose body contains a block comment. Its terminator has
// to be escaped in the source, and the raw JSDoc text hands the escape straight
// back — un-escaped it is not valid TypeScript.

/**
 * Format a value.
 *
 * @example
 * /* a block comment inside the example *\/
 * const formatted = String(1);
 * void formatted;
 */
export function format(): void {}
