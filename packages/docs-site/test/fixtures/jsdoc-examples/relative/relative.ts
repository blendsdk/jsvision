// Fixture: an `@example` that imports a sibling by relative specifier.

import { THING } from './thing.js';

/**
 * Return the shared thing.
 *
 * @example
 * import { THING } from './thing.js';
 *
 * const label = THING.toUpperCase();
 * void label;
 */
export function useThing(): string {
  return THING;
}
