/**
 * The scrolling container subsystem: the passive {@link ScrollBar} chrome and the {@link Scroller}
 * viewport that pans an oversized content view. Both are re-exported through `@jsvision/ui`'s single
 * entry point.
 */
export { ScrollBar } from './scroll-bar.js';
export type { ScrollBarOptions } from './scroll-bar.js';
export { Scroller } from './scroller.js';
export type { ScrollerOptions, ScrollbarsMode } from './scroller.js';
