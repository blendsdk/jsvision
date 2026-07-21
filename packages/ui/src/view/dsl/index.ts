/**
 * Declarative layout builders — expression-oriented sugar over `Group`/`View` and their `layout`
 * props, so a whole screen can be composed in one nested expression instead of a sequence of `new`,
 * `.add()`, and `setLayout(…)` calls.
 *
 * `col`/`row` build flex containers; `grow`/`fixed` set a child's size; `spacer` inserts flexible or
 * fixed gaps; `stack` is a z-overlay with `place`/`centered`/corner taggers. Because the builders
 * only assemble ordinary views and set ordinary `layout` props, the result reflows and resizes
 * exactly like a hand-built tree — there is no separate runtime.
 */
export { col, row, grow, fixed, spacer } from './flex.js';
export type { Flex } from './flex.js';
export { stack, place, centered, topRight, bottomRight, topLeft } from './stack.js';
export type { Placement } from './stack.js';
export { at, cover, center } from './absolute.js';
