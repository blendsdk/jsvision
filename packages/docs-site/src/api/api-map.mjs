// The single source of truth for both directions of the component↔reference
// cross-links. Each row ties a public symbol's generated API page to the
// hand-written component page that documents it: the component page gains a
// forward "API reference →" link, and the symbol's generated page gains a
// "Documented in →" back-link.
//
// Extend it by adding a row — the mechanism never changes. Every `apiPath` is
// validated against the real generated tree by the build gate, so a plugin
// path-scheme change fails loudly rather than shipping a dead link.

/**
 * One component↔reference link.
 *
 * @typedef {object} ApiLink
 * @property {string} symbol            The exported symbol name, e.g. 'Button'.
 * @property {'core' | 'ui' | 'files' | 'forms' | 'datagrid'} pkg  Unscoped package.
 * @property {string} apiPath           Site-absolute route of the generated symbol page, e.g. '/api/ui/classes/Button'.
 * @property {string} componentPage     Site-absolute route of the hand-written component page.
 */

/**
 * The seeded map — one row per component page that has a single clear primary
 * symbol. Pages without a 1:1 symbol (e.g. the form-dialog pattern, the theme
 * gallery) are intentionally left unmapped until they gain one.
 *
 * @type {ApiLink[]}
 */
export const API_MAP = [
  {
    symbol: 'ColorPicker',
    pkg: 'ui',
    apiPath: '/api/ui/classes/ColorPicker',
    componentPage: '/components/color/color-picker',
  },
  {
    symbol: 'ColorSwatch',
    pkg: 'ui',
    apiPath: '/api/ui/classes/ColorSwatch',
    componentPage: '/components/color/color-swatch',
  },
  { symbol: 'Dialog', pkg: 'ui', apiPath: '/api/ui/classes/Dialog', componentPage: '/components/containers/dialog' },
  {
    symbol: 'ListBox',
    pkg: 'ui',
    apiPath: '/api/ui/classes/ListBox',
    componentPage: '/components/containers/list-box',
  },
  {
    symbol: 'ScrollBar',
    pkg: 'ui',
    apiPath: '/api/ui/classes/ScrollBar',
    componentPage: '/components/containers/scroll-bar',
  },
  {
    symbol: 'Scroller',
    pkg: 'ui',
    apiPath: '/api/ui/classes/Scroller',
    componentPage: '/components/containers/scroller',
  },
  { symbol: 'TabView', pkg: 'ui', apiPath: '/api/ui/classes/TabView', componentPage: '/components/containers/tabs' },
  { symbol: 'Tree', pkg: 'ui', apiPath: '/api/ui/classes/Tree', componentPage: '/components/containers/tree' },
  { symbol: 'Button', pkg: 'ui', apiPath: '/api/ui/classes/Button', componentPage: '/components/controls/button' },
  {
    symbol: 'CheckGroup',
    pkg: 'ui',
    apiPath: '/api/ui/classes/CheckGroup',
    componentPage: '/components/controls/check-group',
  },
  { symbol: 'Input', pkg: 'ui', apiPath: '/api/ui/classes/Input', componentPage: '/components/controls/input' },
  { symbol: 'Label', pkg: 'ui', apiPath: '/api/ui/classes/Label', componentPage: '/components/controls/label' },
  {
    symbol: 'RadioGroup',
    pkg: 'ui',
    apiPath: '/api/ui/classes/RadioGroup',
    componentPage: '/components/controls/radio-group',
  },
  { symbol: 'Slider', pkg: 'ui', apiPath: '/api/ui/classes/Slider', componentPage: '/components/controls/slider' },
  { symbol: 'Switch', pkg: 'ui', apiPath: '/api/ui/classes/Switch', componentPage: '/components/controls/switch' },
  { symbol: 'Text', pkg: 'ui', apiPath: '/api/ui/classes/Text', componentPage: '/components/controls/text' },
  { symbol: 'Calendar', pkg: 'ui', apiPath: '/api/ui/classes/Calendar', componentPage: '/components/date/calendar' },
  {
    symbol: 'DatePicker',
    pkg: 'ui',
    apiPath: '/api/ui/classes/DatePicker',
    componentPage: '/components/date/date-picker',
  },
  {
    symbol: 'ComboBox',
    pkg: 'ui',
    apiPath: '/api/ui/classes/ComboBox',
    componentPage: '/components/dropdown/combo-box',
  },
  { symbol: 'History', pkg: 'ui', apiPath: '/api/ui/classes/History', componentPage: '/components/dropdown/history' },
  { symbol: 'Editor', pkg: 'ui', apiPath: '/api/ui/classes/Editor', componentPage: '/components/editor/editor' },
  {
    symbol: 'EditWindow',
    pkg: 'ui',
    apiPath: '/api/ui/classes/EditWindow',
    componentPage: '/components/editor/edit-window',
  },
  { symbol: 'Memo', pkg: 'ui', apiPath: '/api/ui/classes/Memo', componentPage: '/components/editor/memo' },
  {
    symbol: 'ProgressBar',
    pkg: 'ui',
    apiPath: '/api/ui/classes/ProgressBar',
    componentPage: '/components/feedback/progress-bar',
  },
  { symbol: 'Spinner', pkg: 'ui', apiPath: '/api/ui/classes/Spinner', componentPage: '/components/feedback/spinner' },
  {
    symbol: 'FileDialog',
    pkg: 'files',
    apiPath: '/api/files/classes/FileDialog',
    componentPage: '/components/files/file-dialog',
  },
  {
    symbol: 'SurfaceView',
    pkg: 'ui',
    apiPath: '/api/ui/classes/SurfaceView',
    componentPage: '/components/surface/surface-view',
  },
  { symbol: 'DataGrid', pkg: 'ui', apiPath: '/api/ui/classes/DataGrid', componentPage: '/components/table/data-grid' },
  {
    symbol: 'Terminal',
    pkg: 'ui',
    apiPath: '/api/ui/classes/Terminal',
    componentPage: '/components/terminal/terminal',
  },
];

/**
 * Human-readable label for a component page route — its last path segment,
 * de-kebabed and sentence-cased, matching the site's sidebar labels
 * (`/components/table/data-grid` → `Data grid`). Used as the back-link text.
 *
 * @param {string} componentPage  A site-absolute component route.
 * @returns {string}
 *
 * @example
 * pageLabel('/components/controls/button');   // → 'Button'
 * pageLabel('/components/table/data-grid');   // → 'Data grid'
 */
export function pageLabel(componentPage) {
  const segment = componentPage.replace(/\/$/, '').split('/').pop() ?? '';
  const words = segment.split('-');
  return words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
}
