/**
 * Status subsystem entry point — the bottom {@link StatusLine} command row, its {@link statusItem}
 * builder, and the standard {@link Commands} constants.
 *
 * These are re-exported from the `@jsvision/ui` package entry point. Build a status line with
 * {@link statusLine} and hand it to `createApplication({ statusLine })`.
 */
export { Commands } from './commands.js';
export type { CommandName } from './commands.js';
export { StatusLine, statusLine } from './statusline.js';
export type { StatusLoopSeam } from './statusline.js';
export { StatusItemView, statusItem } from './status-item.js';
export type { StatusItem } from './status-item.js';
