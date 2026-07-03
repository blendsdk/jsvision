/**
 * `src/tabs/` barrel — the RD-17 `TabView` folder-tab container (a self-contained `Group` over the
 * shipped RD-01…RD-05 facilities + the additive core `tab*` theme roles). The renderer split
 * (`tab-strip.ts`) and the view-free nav helpers stay internal; the public surface is the container
 * class + its two option/descriptor types, re-exported by name from `src/index.ts` per the
 * layout-convention rule (AR-181).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
export { TabView } from './tab-view.js';
export type { Tab, TabViewOptions } from './tab-view.js';
