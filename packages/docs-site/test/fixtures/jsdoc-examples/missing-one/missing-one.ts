// Fixture: an `@example` block that references exactly ONE undeclared identifier
// — a single TS2304. Paired with ../missing-two, which names two.

/**
 * Render an OK button caption.
 *
 * @example
 * const button = dialog;
 * void button;
 */
export function okCaption(): string {
  return 'OK';
}
