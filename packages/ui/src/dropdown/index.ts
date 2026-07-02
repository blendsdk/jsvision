/**
 * Dropdown subsystem barrel (RD-14) — the shared anchored-popup primitive + the `History` control
 * (and, later, `ComboBox<T>`). Explicit named re-exports; separated value/type exports; `.js`
 * specifiers per NodeNext. The public controls + store functions are re-exported through
 * `@jsvision/ui`'s entry point; `openAnchoredPopup` is an INTERNAL primitive (AR-137), exported here
 * for the controls + tests only.
 */
export { openAnchoredPopup, DEFAULT_MAX_ROWS } from './popup.js';
export type { AnchoredPopup, AnchoredPopupOptions, PopupHost } from './popup.js';
export { History } from './history.js';
export type { HistoryOptions } from './history.js';
export {
  historyAdd,
  historyStr,
  historyCount,
  historyEntries,
  clearHistory,
  addEntry,
  HISTORY_MAX_ENTRIES,
} from './history-store.js';
