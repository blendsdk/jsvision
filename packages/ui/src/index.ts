/**
 * `@jsvision/ui` — public entry point of the Turbo Vision-style widget framework.
 *
 * The UI layer of jsvision: a **retained widget tree** with **fine-grained signal
 * reactivity** (the "disciplined hybrid" model), built on the `@jsvision/core`
 * engine (rendering, input, host, color, capability detection).
 *
 * First subsystem landed: the cell-native **layout** core (ADR-008) — integer
 * apportionment + a 1-D flex track solver. The reactive core, the view/group
 * spine, and the widgets follow per `plans/tui-ui/01-component-map.md`, each
 * re-exporting its public symbols through this single entry point.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution
 * (it resolves to the `.ts` source during development).
 */
export { VERSION } from './version.js';

// Layout (ADR-008 / RD-02) — cell-native, integer-correct.
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

// Reactive core (RD-01) — fine-grained signals, effects, computeds, combinators.
export * from './reactive/index.js';

// View/Group spine (RD-03) — retained widget tree + clipped paint + theming. Explicit named
// re-exports (not `export *`), per the layout convention (AC-18). Grows per phase.
export { View, Group, intersect, translate, contains, createRenderRoot } from './view/index.js';
export type { Point, ViewState, DrawContext, ThemeRoleName, RenderRoot, RenderRootOptions } from './view/index.js';

// Event loop (RD-04) — host-agnostic dispatch mechanism. Explicit named re-exports, per the layout
// convention. Grows per phase.
export { createEventLoop } from './event/index.js';
export type {
  EventLoop,
  EventLoopOptions,
  CommandEvent,
  AppEvent,
  DispatchEvent,
  ModalHost,
  ModalHostAware,
} from './event/index.js';

// App shell (RD-05) — Application/Desktop/Window/MenuBar/StatusLine. Explicit named re-exports, per
// the layout convention. Grows per phase (Phase 2: createApplication + run() lifecycle).
export { createApplication } from './app/index.js';
export type { Application, ApplicationOptions } from './app/index.js';
export { Desktop } from './desktop/index.js';
export type { DesktopLoopSeam } from './desktop/index.js';
export { Window } from './window/index.js';
export { MenuBar, MenuPopup, menuBar, subMenu, item, separator } from './menu/index.js';
export type { MenuItem, ParsedLabel, TitleLayout, MenuController, MenuLoopSeam } from './menu/index.js';
export { Commands, StatusLine, statusLine, statusItem } from './status/index.js';
export type { CommandName, StatusItem, StatusLoopSeam } from './status/index.js';

// Essential controls (RD-06) — leaf widgets + validators (`src/controls/`). Explicit named
// re-exports, per the layout convention (AC-18 / ST-13). The list grows one phase at a time
// (Text/Label → Button → validators → Input → clusters) as each control lands.
export {
  Text,
  Label,
  Button,
  Input,
  CheckGroup,
  RadioGroup,
  MultiCheckGroup,
  filter,
  range,
  lookup,
  picture,
} from './controls/index.js';
export type { ButtonOptions, InputOptions, MultiCheckGroupOptions, Validator } from './controls/index.js';

// Containers, scrolling & lists (RD-11) — `scroll/`·`list/`·`dialog/`. Explicit named re-exports,
// per the layout convention (AC-14 / ST-15). The barrels grow per phase: Phase 1 `ScrollBar`,
// Phase 2 `Scroller`, Phase 3 `ListView`/`ListBox`, Phase 4 `Dialog` + standard-button helpers.
export { ScrollBar, Scroller } from './scroll/index.js';
export type { ScrollBarOptions, ScrollerOptions, ScrollbarsMode } from './scroll/index.js';
export { ListView, ListBox } from './list/index.js';
export type { ListViewOptions, ListBoxOptions } from './list/index.js';
export { Dialog, okButton, cancelButton, yesButton, noButton, okCancelButtons, yesNoButtons } from './dialog/index.js';
export type { DialogOptions } from './dialog/index.js';

// Input dropdowns (RD-14) — `dropdown/`. Explicit named re-exports; the shared `openAnchoredPopup`
// primitive stays INTERNAL (not re-exported here). The `History` + `ComboBox` controls + the global
// MRU store functions are public; the `PopupHost` seam is public so a bare `Dialog` can host a
// dropdown (PA-9).
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

// Tree/outline (RD-15) — expandable virtual-scroll outline. Explicit named re-exports, per the layout
// convention. Built on the RD-11 virtual-scroll helpers + owned-`ScrollBar` pattern; the only additive
// surface is the 4 core `cpOutlineViewer` theme roles.
export { Tree } from './tree/index.js';
export type { TreeNode, TreeOptions } from './tree/index.js';

// RD-16 table: the focusable, virtual-scrolling multi-column `DataGrid<T>` — a documented Turbo
// Vision extension on the `TListViewer` spine (sticky header + heterogeneous columns + click-to-sort
// + H-scroll). Explicit named re-exports (the layout-convention rule); the only additive surface is
// the one core `tableHeader` theme role.
export { DataGrid } from './table/index.js';
export type { Column, ColumnWidth, ColumnAlign, SortState, ColumnGeometry, DataGridOptions } from './table/index.js';

// RD-17 tabs: the self-contained folder-tab `TabView` container (a documented new component — TV has
// no tab class, AR-172) over the shipped facilities + the additive core `tab*` theme roles. Explicit
// named re-exports (the layout-convention rule, AR-181); the renderer split + nav helpers stay internal.
export { TabView } from './tabs/index.js';
export type { Tab, TabViewOptions } from './tabs/index.js';

// RD-18 feedback: the determinate `ProgressBar` (smooth sub-cell fill) + the indeterminate `Spinner`
// (caller-driven) + the `runSpinner` timer helper. Documented new components (TV has no gauge/spinner
// class, AR-186); additive surface = 2 core `progress*` theme roles + the `DrawContext.caps` seam.
export { ProgressBar, Spinner, runSpinner, SPINNERS } from './feedback/index.js';
export type {
  ProgressBarOptions,
  LabelPosition,
  SpinnerOptions,
  SpinnerName,
  RunSpinnerOptions,
  TimerSeam,
} from './feedback/index.js';

// RD-20 date family: the `Calendar` month-grid view (a faithful `TCalendarView` decode + extensions) +
// the `DatePicker` dropdown + the `CalendarDate` civil-date value type with pure helpers. Additive
// surface = 6 core `calendar*` theme roles + the generalized anchored popup (PA-5). Explicit named
// re-exports (the layout-convention rule); the grid/format internals + `dateFormat()` stay internal.
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

// RD-21 color family: the `ColorSwatch` color-grid view (a faithful `TColorSelector` decode +
// extensions) + the `ColorPicker` dropdown (chip + anchored swatch/hex popup). Additive surface = 1
// core `colorMarker` theme role + 2 core re-exports (`ANSI16_ORDER`/`toRgb`) + the generalized popup
// focus-loss dismiss (PA-16). Explicit named re-exports; the pure `color-grid.ts` helpers stay internal.
export { ColorSwatch, ColorPicker } from './color/index.js';
export type { ColorSwatchOptions, ColorPickerOptions } from './color/index.js';

// RD-19 surface family: the `Surface` offscreen cell buffer (a `TDrawSurface` port wrapping core
// `ScreenBuffer`) + the passive `SurfaceView` `delta`-viewport (a faithful `TSurfaceView::draw()`
// decode). Self-contained: 0 new core theme roles (the empty area reuses `windowInactive`), no core
// export change. Explicit named re-exports; the pure `surface-geometry.ts` helpers stay internal, and
// `Point` is reused from `view/geometry` (PA-13, no duplicate export).
export { Surface, SurfaceView } from './surface/index.js';
export type { SurfaceOptions, SurfaceViewOptions, SurfaceSource } from './surface/index.js';
