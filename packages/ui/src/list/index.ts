/**
 * The list-container subsystem: {@link ListView} (a virtual-scroll list of any item type with an
 * owned scroll bar) and {@link ListBox} (its string-list preset), over the shared virtual-scroll
 * helpers. All public symbols are re-exported through `@jsvision/ui`'s single entry point.
 */
export { ListView } from './list-view.js';
export type { ListViewOptions } from './list-view.js';
export { ListBox } from './list-box.js';
export type { ListBoxOptions } from './list-box.js';
export { ListRows, DEFAULT_LIST_ROLES } from './list-rows.js';
export type { ListRowsConfig, ListRoles } from './list-rows.js';
export { clampIndex, keepVisible } from './virtual.js';
