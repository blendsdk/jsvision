/**
 * Dropdown subsystem barrel (RD-14) — the shared anchored-popup primitive + (later) the `History`
 * and `ComboBox<T>` controls. Explicit named re-exports; separated value/type exports; `.js`
 * specifiers per NodeNext. The public controls are re-exported through `@jsvision/ui`'s entry point;
 * `openAnchoredPopup` is an INTERNAL primitive (AR-137), exported here for the controls + tests only.
 */
export { openAnchoredPopup, DEFAULT_MAX_ROWS } from './popup.js';
export type { AnchoredPopup, AnchoredPopupOptions, PopupHost } from './popup.js';
