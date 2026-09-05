/**
 * Complete resize-policy contract for every standard component example.
 *
 * Fixed-height galleries preserve every direct content row. Mixed workspaces preserve their chrome
 * while allowing exactly one named principal pane to consume additional vertical space.
 */

/** Standard examples whose direct content children all retain their authored heights. */
export const FIXED_HEIGHT_EXAMPLE_IDS = [
  'controls/button',
  'controls/input',
  'controls/text',
  'controls/label',
  'controls/check-group',
  'controls/radio-group',
  'controls/multi-check-group',
  'controls/switch',
  'controls/form-dialog',
  'containers/dialog',
  'dropdown/combo-box',
  'dropdown/history',
  'feedback/progress-bar',
  'feedback/spinner',
  'date/calendar',
  'date/date-picker',
  'color/color-swatch',
  'color/color-picker',
  'editor/indicator',
  'files/file-input',
  'files/file-info-pane',
  'foundations/view',
  'foundations/group',
  'application/application',
  'application/menu-bar',
  'application/status-line',
] as const;

/** Standard examples paired with the single direct content pane that grows vertically. */
export const MIXED_HEIGHT_EXAMPLES = [
  ['controls/slider', 'Slider'],
  ['containers/group-box', 'GroupBox'],
  ['containers/list-view', 'ListView'],
  ['containers/list-box', 'ListBox'],
  ['containers/scroller', 'Scroller'],
  ['containers/scroll-bar', 'ScrollBar'],
  ['containers/tree', 'Tree'],
  ['containers/tabs', 'TabView'],
  ['containers/split-view', 'SplitView'],
  ['surface/surface', 'SurfaceView'],
  ['surface/surface-view', 'SurfaceView'],
  ['editor/editor', 'Editor'],
  ['editor/memo', 'Memo'],
  ['editor/edit-window', 'EditWindow'],
  ['terminal/terminal', 'Terminal'],
  ['files/file-dialog', 'FileList'],
  ['files/chdir-dialog', 'DirList'],
  ['files/file-list', 'FileList'],
  ['files/dir-list', 'DirList'],
  ['files/file-editor', 'FileEditor'],
  ['application/desktop', 'Desktop'],
  ['application/router', 'Router'],
  ['application/window', 'Desktop'],
] as const;
