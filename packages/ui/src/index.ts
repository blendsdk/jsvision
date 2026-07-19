/**
 * `@jsvision/ui` — the public entry point of the widget framework for building
 * text-mode (terminal) user interfaces.
 *
 * A retained widget tree with fine-grained signal reactivity: you build a tree of
 * views, bind them to signals, and the framework re-renders only what changed. It
 * ships a full set of classic terminal-UI widgets (windows, menus, dialogs,
 * buttons, inputs, lists, tables, trees, and more) on top of the `@jsvision/core`
 * rendering, input, and color engine.
 *
 * Everything a consumer needs is re-exported from this one module.
 */
export { VERSION } from './version.js';

// Core essentials — the handful of `@jsvision/core` symbols a UI developer needs, re-exported so a
// hello-world app imports from one package: terminal capability detection (`createApplication`
// auto-detects, but a power user can resolve a profile to override it), the chord `createKeymap`
// builder, and the `Attr` style-attribute constants (a runtime object used by value in a custom
// `draw()`), plus the `CapabilityProfile`/`Style`/`Keymap` types.
export { resolveCapabilities, resolveCapabilitiesAsync, createKeymap, Attr } from '@jsvision/core';
export type { CapabilityProfile, Style, Keymap } from '@jsvision/core';

// Layout engine — flexbox-style layout that works in whole terminal cells, so
// boxes always fill their container exactly with no rounding gaps.
export { apportion, solveTrack, layout } from './layout/index.js';
export type {
  TrackItem,
  Align,
  Direction,
  Justify,
  LayoutBox,
  LayoutProps,
  LayoutResult,
  Padding,
  Rect,
  Size,
  Size2D,
} from './layout/index.js';

// Reactivity — fine-grained signals, effects, computeds, and combinators that
// drive UI updates. Change a signal and only the views that read it re-render.
export * from './reactive/index.js';

// The view tree — the base `View`/`Group` widgets, clipped drawing, theming, and
// the render root that paints a tree to the screen.
export { View, Group, intersect, translate, contains, createRenderRoot } from './view/index.js';
export type { Point, ViewState, DrawContext, ThemeRoleName, RenderRoot, RenderRootOptions } from './view/index.js';

// Declarative layout builders — compose a screen as one nested expression (`col`/`row` containers,
// `grow`/`fixed` size shorthands, `spacer` gaps, a `stack` z-overlay with `place`/`centered`/corner
// helpers, and the absolute `at`/`cover`/`center` escape hatch) instead of imperative
// `new`/`.add()`/`.layout =`.
export {
  col,
  row,
  grow,
  fixed,
  spacer,
  stack,
  place,
  centered,
  topRight,
  bottomRight,
  topLeft,
  at,
  cover,
  center,
} from './view/index.js';
export type { Flex, Placement } from './view/index.js';

// The event loop — routes keyboard and mouse input to views, manages focus, and
// drives one render per tick. Host-agnostic: you supply the input source.
export { createEventLoop, buildKeymap } from './event/index.js';
export type {
  EventLoop,
  EventLoopOptions,
  ClipboardKeys,
  CommandEvent,
  AppEvent,
  DispatchEvent,
  ModalHost,
  ModalHostAware,
} from './event/index.js';

// The application shell — the top-level pieces of a full-screen app: the
// `Application` lifecycle, a `Desktop` window manager, `Window` chrome, a
// `MenuBar`, and a `StatusLine`.
export { createApplication } from './app/index.js';
export type {
  Application,
  ApplicationOptions,
  DesktopApplication,
  RouterApplication,
  CreatedApplication,
} from './app/index.js';
export { Desktop } from './desktop/index.js';
export type { DesktopLoopSeam } from './desktop/index.js';
// The screen router: a full-screen screen-stack application body (the complement to `Desktop`).
export { createRouter, withBase } from './router/index.js';
export type {
  Router,
  NavArgs,
  Route,
  RouteMap,
  RouteContext,
  ScreenBundle,
  RouterLocation,
  InitialRoute,
  RouterOptions,
  ChromeHost,
  ChromeHostAware,
  FocusHost,
  FocusHostAware,
} from './router/index.js';
export { Window } from './window/index.js';
export { MenuBar, MenuPopup, menuBar, subMenu, item, separator, menuSpacer } from './menu/index.js';
export type { MenuItem, ParsedLabel, TitleLayout, MenuController, MenuLoopSeam } from './menu/index.js';
export { findDuplicateAccelerators, reportDuplicateAccelerators } from './menu/index.js';
export type { DuplicateAccelerator } from './menu/index.js';
export { Commands, StatusLine, StatusItemView, statusLine, statusItem } from './status/index.js';
export type { CommandName, StatusItem, StatusLoopSeam } from './status/index.js';

// Form controls — the everyday leaf widgets (static text, labels, buttons, text
// input, checkboxes, radio groups) plus input validators (`filter`/`range`/
// `lookup`/`picture`) you attach to an `Input`.
export {
  Text,
  Label,
  Button,
  Input,
  Slider,
  Switch,
  CheckGroup,
  RadioGroup,
  MultiCheckGroup,
  filter,
  range,
  lookup,
  picture,
} from './controls/index.js';
export type {
  TextOptions,
  TextSeverity,
  ButtonOptions,
  InputOptions,
  SliderOptions,
  SwitchOptions,
  MultiCheckGroupOptions,
  RadioGroupOptions,
  CheckGroupOptions,
  Validator,
} from './controls/index.js';

// Containers, scrolling, and lists — scroll bars, a scrollable viewport, single-
// column list boxes, and modal dialogs with standard OK/Cancel/Yes/No buttons.
export { ScrollBar, Scroller } from './scroll/index.js';
export type { ScrollBarOptions, ScrollerOptions, ScrollbarsMode } from './scroll/index.js';
export { ListView, ListBox } from './list/index.js';
export type { ListViewOptions, ListBoxOptions } from './list/index.js';
export { Dialog, okButton, cancelButton, yesButton, noButton, okCancelButtons, yesNoButtons } from './dialog/index.js';
export type { DialogOptions } from './dialog/index.js';
// Async modal helpers over `Dialog` — show a message, ask yes/no, or prompt for one line of text.
export { messageBox, confirm, inputBox } from './dialog/index.js';
export type { ModalDialogHost, MessageBoxOptions, InputBoxOptions } from './dialog/index.js';

// Input dropdowns — a `History` field (recall previously entered values) and a
// `ComboBox` (an input paired with a drop-down list), plus the shared
// most-recently-used store the history field reads from. `PopupHost` lets a plain
// dialog host a dropdown's popup.
export {
  History,
  ComboBox,
  historyAdd,
  historyStr,
  historyCount,
  historyEntries,
  clearHistory,
  HISTORY_MAX_ENTRIES,
} from './dropdown/index.js';
export type { HistoryOptions, ComboBoxOptions } from './dropdown/index.js';
export type { PopupHost } from './view/index.js';

// Tree / outline — an expandable, scrollable outline view for hierarchical data
// (file trees, nested records, and the like).
export { Tree } from './tree/index.js';
export type { TreeNode, TreeOptions, MarkerStyle } from './tree/index.js';

// Data table — a scrollable, multi-column `DataGrid<T>` with a sticky header,
// per-column widths and alignment, click-to-sort, and horizontal scrolling.
// The grid engine underneath is exposed too — the `GridRows`/`GridHeader` renderers, the pure
// column math (`apportionColumns`/`alignCell`/`sortRows`/`measureAutoWidths`), and the wide-glyph
// `stringWidth` measure they draw with — so another package can compose a bespoke grid on it.
// `wrapText` ships alongside it: the same word-wrap a `Text` view draws with, exposed so a caller
// can count the lines a message will occupy *before* laying anything out (e.g. to size a dialog).
export {
  DataGrid,
  GridRows,
  GridHeader,
  apportionColumns,
  alignCell,
  sortRows,
  measureAutoWidths,
} from './table/index.js';
export type {
  Column,
  ColumnWidth,
  ColumnAlign,
  SortState,
  ColumnGeometry,
  DataGridOptions,
  GridRowsConfig,
  GridHeaderConfig,
} from './table/index.js';
export { stringWidth, wrapText } from './controls/measure.js';

// Tabs — a `TabView` folder-tab container that shows one page at a time, with
// keyboard and hotkey switching and closable/overflowing tabs.
export { TabView } from './tabs/index.js';
export type { Tab, TabViewOptions } from './tabs/index.js';

// Split panes — a resizable `SplitView`: N panes divided by N−1 draggable 1-cell
// splitters, row or column, nestable for grids.
export { SplitView } from './split/index.js';
export type { SplitViewOptions } from './split/index.js';

// Progress feedback — a determinate `ProgressBar` (smooth sub-cell fill), an
// indeterminate `Spinner`, and `runSpinner`, a helper that advances a spinner on
// a timer.
export { ProgressBar, Spinner, runSpinner, SPINNERS } from './feedback/index.js';
export type {
  ProgressBarOptions,
  LabelPosition,
  SpinnerOptions,
  SpinnerName,
  RunSpinnerOptions,
  TimerSeam,
} from './feedback/index.js';

// Dates — a `Calendar` month-grid view, a `DatePicker` dropdown, and the
// `CalendarDate` value type with a set of pure date-math helpers (add days/months,
// day-of-week, ISO parse/format, and interop with the built-in `Date`).
export { Calendar, DatePicker } from './date/index.js';
export {
  daysInMonth,
  dayOfWeek,
  addMonths,
  addDays,
  compare,
  toISO,
  parseISO,
  fromDate,
  toDate,
} from './date/index.js';
export type { CalendarDate, CalendarOptions, DatePickerOptions, DateFormat, CalendarDensity } from './date/index.js';

// Color pickers — a `ColorSwatch` grid for choosing from the terminal palette and
// a `ColorPicker` dropdown (a color chip plus a swatch/hex-entry popup).
export { ColorSwatch, ColorPicker } from './color/index.js';
export type { ColorSwatchOptions, ColorPickerOptions } from './color/index.js';

// Off-screen surfaces — a `Surface` you can draw into off-screen and a passive
// `SurfaceView` that shows a scrollable window onto it (useful for large canvases,
// diagrams, or content bigger than the visible area).
export { Surface, SurfaceView } from './surface/index.js';
export type { SurfaceOptions, SurfaceViewOptions, SurfaceSource } from './surface/index.js';

// Text editing — a full multi-line `Editor` (selection, mouse, undo/redo,
// clipboard, and search), a dialog-embeddable `Memo`, an `EditWindow`, a
// `line:col` position `Indicator`, ready-made find/replace and message-box dialog
// builders, and a `Terminal` streaming log-output view.
export {
  Editor,
  Memo,
  EditWindow,
  Indicator,
  EditorCommands,
  defaultEditorDialog,
  findDialog,
  replaceDialog,
  confirmBox,
  infoBox,
  replacePrompt,
  wireEditorDialogs,
} from './editor/index.js';
export type {
  EditorOptions,
  MemoOptions,
  EditWindowOptions,
  IndicatorTarget,
  EditorCommandSeam,
  EditorAction,
  EditorKeyBindings,
  EditorDialogHandler,
  EditorDialogRequest,
  EditorDialogResult,
  EditorDialogHost,
  FindRec,
  ReplaceRec,
  SearchOptions,
  LineEnding,
} from './editor/index.js';
export { Terminal, terminalWriter } from './terminal/index.js';
export type { TerminalOptions } from './terminal/index.js';
