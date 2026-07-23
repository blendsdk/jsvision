// Fixture: ONE `@example` tag on an `export const`. The tag is reachable from
// three AST nodes (the statement, the declaration and its identifier), so a naive
// tag walk mints three blocks — two of them with the wrong name. Exactly one
// block must come back.

/**
 * The answer.
 *
 * @example
 * const doubled = ANSWER * 2;
 * void doubled;
 */
export const ANSWER = 42;
