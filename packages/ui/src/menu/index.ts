/**
 * Menu subsystem entry point — the {@link MenuBar}, its dropdown popups, and the data builders
 * ({@link subMenu}/{@link item}/{@link separator}) you use to describe a menu.
 *
 * These are re-exported from the `@jsvision/ui` package entry point. Build a menu with the data
 * builders and hand it to `createApplication({ menuBar })`.
 */
export { MenuBar, menuBar } from './menubar.js';
export { MenuPopup } from './popup.js';
export {
  subMenu,
  item,
  separator,
  parseTilde,
  tildeSegments,
  layoutTitles,
  titleIndexAt,
  accentStyle,
} from './builders.js';
export type { MenuItem, ParsedLabel, TildeSegment, TitleLayout } from './builders.js';
export type { MenuController, MenuLoopSeam } from './controller.js';
