/**
 * The dropdown subsystem: the {@link History} MRU dropdown, the {@link ComboBox} selector, the shared
 * MRU history store, and the shared anchored-popup primitive. The public controls and store functions
 * are re-exported through `@jsvision/ui`'s entry point; `openAnchoredPopup` is an internal primitive
 * shared by the dropdown controls (exported here for them and for tests).
 */
export { openAnchoredPopup, DEFAULT_MAX_ROWS, drawDropdownIcon, absoluteRect } from './popup.js';
export type { AnchoredPopup, AnchoredPopupOptions, PopupHost } from './popup.js';
export { History } from './history.js';
export type { HistoryOptions } from './history.js';
export { ComboBox } from './combo-box.js';
export type { ComboBoxOptions } from './combo-box.js';
export {
  historyAdd,
  historyStr,
  historyCount,
  historyEntries,
  clearHistory,
  addEntry,
  HISTORY_MAX_ENTRIES,
} from './history-store.js';
