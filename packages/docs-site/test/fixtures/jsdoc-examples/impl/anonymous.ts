// Fixture: two `@example` tags whose JSDoc hangs on unnamed nodes (leading file
// comments bind to the import that follows them). Both fall back to the anonymous
// key, so the ordinal is the only thing keeping them apart.

/**
 * A module-level usage note.
 *
 * @example
 * const first = 1;
 * void first;
 */
import { join } from 'node:path';

/**
 * A second module-level usage note.
 *
 * @example
 * const second = 2;
 * void second;
 */
import { resolve } from 'node:path';

export const paths = [join, resolve];
