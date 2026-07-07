/**
 * Input validators — the `Validator` shape plus the built-in factories that constrain what an
 * {@link Input} will accept.
 *
 * Attach any of these to an `Input` via its `validator` option:
 * - `filter(chars)` — allow only characters from a set.
 * - `range(min, max)` — allow only integers within a bound.
 * - `lookup(list)` — allow only exact members of a fixed list.
 * - `picture(mask)` — enforce a formatted mask (phone numbers, dates) with auto-fill.
 *
 * Each returns a plain `Validator` object, so you can also write your own by implementing the shape.
 */
export type { Validator } from './types.js';
export { filter } from './filter.js';
export { range } from './range.js';
export { lookup } from './lookup.js';
export { picture } from './picture.js';
