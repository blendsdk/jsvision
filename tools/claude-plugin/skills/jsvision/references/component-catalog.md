# Component catalog

Every widget below is imported from `@jsvision/ui`. Each takes an options object (`new X({ ... })`)
unless noted, and each carries a matching `XOptions` type. Reach for the one that matches the job.

> **This page is the chooser; `api/index.md` is the signature lookup.** For the exact constructor,
> options fields, methods, and types of anything here — generated from the source, always current —
> open the matching page under [`api/`](api/index.md) instead of reading `@jsvision/*` source.

## Controls (leaf inputs)

- **Text** — static, word-wrapped paragraph. `new Text('hello')` or `new Text(() => reactive())`.
- **Label** — a caption linked to a control, with a `~H~otkey`. `new Label('~N~ame:', input)`.
- **Button** — a command button (`[ OK ]`). Emits its `command` on activate; one can be the default.
- **Input** — single-line text editor over a two-way `Signal<string>`, with an optional `validator`.
- **CheckGroup** — a column of checkboxes bound to a `Signal<boolean[]>`.
- **RadioGroup** — a column of radio buttons bound to a `Signal<number>` (the selected index).
- **MultiCheckGroup** — checkboxes with multi-state (e.g. tri-state) items.
- **Slider** — a horizontal/vertical value slider (keyboard + drag + wheel); `onInput`/`onChange`.
- **Switch** — an on/off toggle bound to a `Signal<boolean>`.

Validators for `Input` (functions, not classes): `filter(chars)`, `range(min, max)`,
`lookup(list)`, `picture(mask)`. Pass one as `new Input({ value, validator: range(0, 120) })`.

## Containers, scrolling & lists

- **Group** — the container primitive: holds children and arranges them (see `layout.md`). Every
  composite you build is a `Group`.
- **ScrollBar** — a standalone scroll bar bound to a value `Signal`; arrows, page track, thumb drag.
- **Scroller** — a focusable viewport that scrolls oversized content and owns its scroll bars.
- **ListView** — a single-column, virtual-scroll list `[rows | scrollbar]`; focus its `rows`.
- **ListBox** — a `ListView<string>` preset for simple string lists.
- **SplitView** — N resizable panes divided by N−1 draggable splitters (row or col; nest for grids). Drag a divider or Tab to it and use the arrows; pane sizes live in a caller-owned `Signal<number[]>`.
- **Dialog** — a modal window (gray frame, close box) opened with `loop.execView(dialog)`; its
  `valid()` gate vetoes a bad OK. Pair with `okButton()`/`cancelButton()`; see `recipes/forms-dialogs.md`.

## Data views

- **DataGrid** — a typed multi-column table (`DataGrid<T>`) over a rows `Signal`, with sortable
  columns, selection, zebra striping, and a sticky header. See `recipes/data-driven.md`.
- **GridRows** — the focusable, multi-column, virtual-scroll grid body that draws only the visible
  window; the low-level body `DataGrid` composes, exposed for building custom grid layouts.
- **GridHeader** — the non-scrolling sticky header: column titles in `tableHeader`, a sort
  indicator, and click-to-sort; the low-level header `DataGrid` composes.
- **Tree** — a collapsible outline/tree of nodes with expand/collapse, keyboard nav, and type-ahead.

## Feedback

- **ProgressBar** — a determinate bar with smooth sub-cell fill, an optional `NN%` caption, and a
  label; bound to a `Signal<number>` in `[0,1]`.
- **Spinner** — an indeterminate spinner; you advance its `frame` signal (or drive it with the
  `runSpinner` helper). See `recipes/live-dashboard.md`.

## Date & color pickers

- **Calendar** — a month-grid date view with keyboard navigation and selection.
- **DatePicker** — a masked `Input` plus a dropdown `Calendar`.
- **ColorSwatch** — a DOS-16 color grid selector.
- **ColorPicker** — a color chip plus a dropdown swatch and optional hex field.

## Dropdowns

- **ComboBox** — an editable select-from-list dropdown.
- **History** — a recall dropdown backed by a store of recent entries.

## Text editing

- **Editor** — a full multi-line text editor (selection, mouse, undo/redo, search, clipboard).
- **Memo** — a dialog-embeddable editor bound to a two-way `Signal<string>` (`memo.getText()`).
- **EditWindow** — a window pre-wired around an `Editor` (a ready file/edit window).
- **Indicator** — a line/column status readout target for an `Editor`.

## Terminal output

- **Terminal** — a scrollback terminal-output view (write lines to it; bounded ring buffer).

## Offscreen surfaces

- **Surface** — an offscreen cell buffer you draw into once and blit.
- **SurfaceView** — a panning viewport over a `Surface` (scroll a large canvas through a small hole).

## Tabs

- **TabView** — a folder-tab container hosting one visible page at a time, with hotkeys and overflow.

## App shell

- **Window** — a titled, movable/resizable/zoomable frame; `win.add(child)`, `win.layout.rect = …`.
- **Desktop** — the window manager (`app.desktop`): `addWindow`, `cascade`, `tile`, `raise`, focus.
- **Router** — a full-screen screen stack (the alternative app body to `Desktop`): `createRouter({ initial, routes })` then `push`/`back`/`replace`/`reset`, reactive `location()`/`canGoBack()`, per-route typed params, opt-in `keepAlive`, and per-screen menu/status via `withBase`. Pass it as `createApplication({ content: router })`.
- **MenuBar** — the top menu bar with nested pop-up menus (`menuBar([...])` builders).
- **MenuPopup** — a single pop-up menu panel (used by `MenuBar`; rarely constructed directly).
- **StatusLine** — the bottom status/command row (`statusLine([statusItem(...)])`).
- **StatusItemView** — a single status-row entry, built with `statusItem(text, command?, key?)`: an
  interactive command shortcut (label + emitted command + accelerator) or a passive live label
  (accessor text, no command). Drop it into `statusLine([...])`; `StatusLine` drives its interaction.

## The escape hatch

- **View** — the abstract base of every widget. Subclass it to author a custom widget when nothing
  above fits — see `widget-authoring.md`.
