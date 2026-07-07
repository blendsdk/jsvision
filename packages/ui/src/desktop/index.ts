/**
 * The desktop: the window manager that hosts an application's windows.
 *
 * `Desktop` fills the area between the menu bar and status line, draws the patterned background, and
 * manages the windows on it — raising on click, dragging, resizing, zooming, cascading, tiling, and
 * switching. `createApplication` owns one; you interact with it through `app.desktop`.
 */
export { Desktop } from './desktop.js';
export type { DesktopLoopSeam } from './desktop.js';
