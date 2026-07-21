// Fixture: the same TS2304 code as ../missing-one, but naming a SECOND missing
// identifier as well. This is the pair that proves the guard compares the named
// identifiers and not merely the diagnostic code — a forgotten `at` import is
// TS2304 exactly like the pre-existing `dialog` failure it would hide behind.

/**
 * Render an OK button caption.
 *
 * @example
 * const button = at(dialog, 1, 1, 10, 2);
 * void button;
 */
export function okCaption(): string {
  return 'OK';
}
