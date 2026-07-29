// The single source of truth for both directions of the component↔reference
// cross-links. Each row ties a public symbol's generated API page to the
// hand-written component page that documents it: the component page gains a
// forward "API reference →" link, and the symbol's generated page gains a
// "Documented in →" back-link.
//
// Extend it by adding a row — the mechanism never changes. Every `apiPath` is
// validated against the real generated tree by the build gate, so a plugin
// path-scheme change fails loudly rather than shipping a dead link.

import { parseComponentTarget } from './component-target.mjs';

/**
 * One component↔reference link.
 *
 * @typedef {object} ApiLink
 * @property {string} symbol            The exported symbol name, e.g. 'Button'.
 * @property {'core' | 'i18n' | 'ui' | 'files' | 'forms' | 'datagrid' | 'code-editor'} pkg  Unscoped package.
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
    symbol: 'createApplication',
    pkg: 'ui',
    apiPath: '/api/ui/functions/createApplication',
    componentPage: '/components/application/application',
  },
  {
    symbol: 'Desktop',
    pkg: 'ui',
    apiPath: '/api/ui/classes/Desktop',
    componentPage: '/components/application/desktop',
  },
  {
    symbol: 'MenuBar',
    pkg: 'ui',
    apiPath: '/api/ui/classes/MenuBar',
    componentPage: '/components/application/menu-bar',
  },
  {
    symbol: 'createRouter',
    pkg: 'ui',
    apiPath: '/api/ui/functions/createRouter',
    componentPage: '/components/application/router',
  },
  {
    symbol: 'StatusLine',
    pkg: 'ui',
    apiPath: '/api/ui/classes/StatusLine',
    componentPage: '/components/application/status-line',
  },
  {
    symbol: 'Window',
    pkg: 'ui',
    apiPath: '/api/ui/classes/Window',
    componentPage: '/components/application/window',
  },
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
    symbol: 'ListView',
    pkg: 'ui',
    apiPath: '/api/ui/classes/ListView',
    componentPage: '/components/containers/list-view',
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
  {
    symbol: 'SplitView',
    pkg: 'ui',
    apiPath: '/api/ui/classes/SplitView',
    componentPage: '/components/containers/split-view',
  },
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
  {
    symbol: 'MultiCheckGroup',
    pkg: 'ui',
    apiPath: '/api/ui/classes/MultiCheckGroup',
    componentPage: '/components/controls/multi-check-group',
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
  {
    symbol: 'Indicator',
    pkg: 'ui',
    apiPath: '/api/ui/classes/Indicator',
    componentPage: '/components/editor/indicator',
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
    symbol: 'ChDirDialog',
    pkg: 'files',
    apiPath: '/api/files/classes/ChDirDialog',
    componentPage: '/components/files/chdir-dialog',
  },
  {
    symbol: 'DirList',
    pkg: 'files',
    apiPath: '/api/files/classes/DirList',
    componentPage: '/components/files/dir-list',
  },
  {
    symbol: 'FileEditor',
    pkg: 'files',
    apiPath: '/api/files/classes/FileEditor',
    componentPage: '/components/files/file-editor',
  },
  {
    symbol: 'FileInfoPane',
    pkg: 'files',
    apiPath: '/api/files/classes/FileInfoPane',
    componentPage: '/components/files/file-info-pane',
  },
  {
    symbol: 'FileInput',
    pkg: 'files',
    apiPath: '/api/files/classes/FileInput',
    componentPage: '/components/files/file-input',
  },
  {
    symbol: 'FileList',
    pkg: 'files',
    apiPath: '/api/files/classes/FileList',
    componentPage: '/components/files/file-list',
  },
  {
    symbol: 'formDialog',
    pkg: 'forms',
    apiPath: '/api/forms/functions/formDialog',
    componentPage: '/components/controls/form-dialog',
  },
  {
    symbol: 'Group',
    pkg: 'ui',
    apiPath: '/api/ui/classes/Group',
    componentPage: '/components/foundations/group',
  },
  {
    symbol: 'View',
    pkg: 'ui',
    apiPath: '/api/ui/classes/View',
    componentPage: '/components/foundations/view',
  },
  {
    symbol: 'Surface',
    pkg: 'ui',
    apiPath: '/api/ui/classes/Surface',
    componentPage: '/components/surface/surface',
  },
  {
    symbol: 'SurfaceView',
    pkg: 'ui',
    apiPath: '/api/ui/classes/SurfaceView',
    componentPage: '/components/surface/surface-view',
  },
  {
    symbol: 'CodeEditor',
    pkg: 'code-editor',
    apiPath: '/api/code-editor/classes/CodeEditor',
    componentPage: '/components/code-editor/',
  },
  {
    symbol: 'CodeEditorWindow',
    pkg: 'code-editor',
    apiPath: '/api/code-editor/classes/CodeEditorWindow',
    componentPage: '/components/code-editor/',
  },
  {
    symbol: 'DataGrid',
    pkg: 'ui',
    apiPath: '/api/ui/classes/DataGrid',
    componentPage: '/components/data-grid/#data-grid',
  },
  {
    symbol: 'GridRows',
    pkg: 'ui',
    apiPath: '/api/ui/classes/GridRows',
    componentPage: '/components/data-grid/#data-grid',
  },
  {
    symbol: 'GridHeader',
    pkg: 'ui',
    apiPath: '/api/ui/classes/GridHeader',
    componentPage: '/components/data-grid/#data-grid',
  },
  {
    symbol: 'EditableDataGrid',
    pkg: 'datagrid',
    apiPath: '/api/datagrid/classes/EditableDataGrid',
    componentPage: '/components/data-grid/#editable-data-grid',
  },
  {
    symbol: 'EditableGridRows',
    pkg: 'datagrid',
    apiPath: '/api/datagrid/classes/EditableGridRows',
    componentPage: '/components/data-grid/#editable-data-grid',
  },
  {
    symbol: 'SortHeader',
    pkg: 'datagrid',
    apiPath: '/api/datagrid/classes/SortHeader',
    componentPage: '/components/data-grid/#editable-data-grid',
  },
  {
    symbol: 'QuickFilterRow',
    pkg: 'datagrid',
    apiPath: '/api/datagrid/classes/QuickFilterRow',
    componentPage: '/components/data-grid/#editable-data-grid',
  },
  {
    symbol: 'FilterPopup',
    pkg: 'datagrid',
    apiPath: '/api/datagrid/classes/FilterPopup',
    componentPage: '/components/data-grid/#editable-data-grid',
  },
  {
    symbol: 'ValueList',
    pkg: 'datagrid',
    apiPath: '/api/datagrid/classes/ValueList',
    componentPage: '/components/data-grid/#editable-data-grid',
  },
  {
    symbol: 'FooterBand',
    pkg: 'datagrid',
    apiPath: '/api/datagrid/classes/FooterBand',
    componentPage: '/components/data-grid/#editable-data-grid',
  },
  {
    symbol: 'personalizeGrid',
    pkg: 'datagrid',
    apiPath: '/api/datagrid/functions/personalizeGrid',
    componentPage: '/components/data-grid/#editable-data-grid',
  },
  {
    symbol: 'Terminal',
    pkg: 'ui',
    apiPath: '/api/ui/classes/Terminal',
    componentPage: '/components/terminal/terminal',
  },
];

/**
 * Human-readable label for a validated component target.
 *
 * @param {string} componentPage  A site-absolute component route.
 * @returns {string}
 *
 * @example
 * pageLabel('/components/controls/button');   // → 'Button'
 * pageLabel('/components/data-grid/');        // → 'Data Grid'
 */
export function pageLabel(componentPage) {
  return parseComponentTarget(componentPage).label;
}
