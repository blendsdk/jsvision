/**
 * Status subsystem entry point — the bottom {@link StatusLine} command row, its {@link statusItem}
 * builder, and the standard {@link Commands} constants.
 *
 * These are re-exported from the `@jsvision/ui` package entry point. Build a status line with
 * {@link statusLine} and hand it to `createApplication({ statusLine })`.
 */
export { Commands } from './commands.js';
export type { CommandName } from './commands.js';
export { StatusLine, statusLine, statusItem } from './statusline.js';
export type { StatusItem, StatusLoopSeam } from './statusline.js';
