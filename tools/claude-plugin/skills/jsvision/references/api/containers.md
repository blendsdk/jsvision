<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Containers, scrolling, lists & tabs

Scroll bars, scrollers, list views, dialogs, dropdowns, tabs, and split panes.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## cancelButton

A Cancel button — emits `Commands.cancel` (the same command Esc and the frame close-box resolve to).

```ts
cancelButton(): Button
```

## clearHistory

Clear all stored history for every id (useful to reset between runs or in tests).

```ts
clearHistory(): void
```

## ComboBox

A dropdown selector: a text field + a trailing `▐↓▌` button opening a `ListView<T>` popup.

```ts
new ComboBox<T>(opts: ComboBoxOptions<T>)   // extends Group
// methods & signals:
items: Signal<T[]>
value: Signal<T | null>
text: Signal<string>
input: Input
filtered: () => T[]
```

## ComboBoxOptions

Options for a ComboBox.

```ts
interface ComboBoxOptions<T> {
  items: Signal<T[]>;   // The source items (reactive — the open popup re-renders on change in select-only mode).
  getText: (item: T) => string;   // Render an item to its display string (list rows + the editable value ⟷ text match).
  value: Signal<T | null>;   // The selected value (two-way; `null` = none / no match).
  text?: Signal<string>;   // The field text (two-way). Defaults to an internal signal seeded `''` (or `getText(value)`).
  editable?: boolean;   // Editable free-text + filter (default `true`); `false` = read-only picker + type-ahead.
  filter?: (item: T, text: string) => boolean;   // Candidate predicate for editable mode (default case-insensitive substring).
  onSelect?: (index: number, item: T) => void;   // App callback on pick, with the list's display index + the item.
  command?: string;   // Typed command emitted on pick (via the list's activation).
  maxRows?: number;   // Max visible popup rows (default 6).
  placeholder?: string | Signal<string>;   // A muted hint shown in the field while it is empty (editable mode); forwarded to the inner field.
}
```

## confirm

Ask a yes/no question modally.

```ts
confirm(host: ModalDialogHost, text: string): Promise<boolean>
```

## Dialog

A modal/modeless gray dialog: a `Window` in the `dialog` role with a `valid()` close-gate.

```ts
new Dialog(opts: DialogOptions = {})   // extends Window
// methods & signals:
acceleratorScope
valid(command: string): boolean
```

## DialogOptions

Construction options for Dialog.

```ts
interface DialogOptions {
  title?: string;   // Initial title (centered in the top border).
  rect?: Rect;   // Optional initial absolute placement rect (the host/desktop may override). An explicit rect is a manual placement: it is honored verbatim and is NOT centered unless `centered` is set true.
  width?: number;   // Dialog width in cells (alternative to a full `rect` when you want the dialog auto-centered).
  height?: number;   // Dialog height in cells (alternative to a full `rect` when you want the dialog auto-centered).
  centered?: boolean;   // Center the dialog in its parent. Defaults to `true` when a size is given via `width`/`height` (with no explicit `rect` position) — the modern convention; `false` for an explicit `rect`. Set explicitly to override either.
}
```

## History

The `▐↓▌` history dropdown button linked to an `Input` (see the module docs).

```ts
new History(opts: HistoryOptions)   // extends View
```

## HISTORY_MAX_ENTRIES

The default per-id entry cap.

```ts
const HISTORY_MAX_ENTRIES: 16
```

## historyAdd

Append `str` as the most-recent entry for `id` (skip-empty / dedup / append / evict-oldest, per addEntry).

```ts
historyAdd(id: number, str: string, maxEntries?: number): void
```

## historyCount

The number of stored entries for `id` (0 when the id is unknown).

```ts
historyCount(id: number): number
```

## historyEntries

A snapshot copy of the entries for `id`, oldest→newest; empty when the id is unknown.

```ts
historyEntries(id: number): string[]
```

## HistoryOptions

Options for a History control.

```ts
interface HistoryOptions {
  link: Input;   // The `Input` this history is linked to (drawn adjacent; its text is read and replaced on pick).
  historyId?: number;   // Numeric id keying the process-global MRU store; two Histories with the same id share a list.
  history?: Signal<string[]>;   // Bind an app-owned list instead of the global store.
  maxRows?: number;   // Max visible popup rows (default 6).
}
```

## historyStr

The `index`-th entry for `id` (0 = oldest), or `undefined` if out of range (bounds-checked).

```ts
historyStr(id: number, index: number): string | undefined
```

## inputBox

Prompt for a single line of text modally.

```ts
inputBox(host: ModalDialogHost, o: InputBoxOptions): Promise<string | null>
```

## InputBoxOptions

Options for inputBox.

```ts
interface InputBoxOptions {
  title: string;   // Title centered in the top border.
  label: string;   // Label shown above the field (supports `~X~` hotkey markup).
  value: Signal<string>;   // The two-way value signal the field reads and writes.
  validator?: Validator;   // Optional validator; OK is gated by the dialog's `valid()` sweep, which refocuses an invalid field.
  placeholder?: string | Signal<string>;   // A muted hint shown in the prompt field while it is empty; never part of the value.
}
```

## ListBox

A single-column list of strings over a `Signal<string[]>`.

```ts
new ListBox(opts: ListBoxOptions)   // extends ListView<string>
```

## ListBoxOptions

Construction options for ListBox — ListViewOptions without the fixed `getText`.

```ts
type ListBoxOptions = Omit<ListViewOptions<string>, 'getText'>
```

## ListView

A single-column virtual-scroll list: a rows renderer + an owned vertical scroll bar.

```ts
new ListView<T>(opts: ListViewOptions<T>)   // extends Group
// methods & signals:
layout: LayoutProps
rows: ListRows<T>
focused: Signal<number>
selected: Signal<number>
```

## ListViewOptions

Construction options for ListView.

```ts
interface ListViewOptions<T> {
  items: Signal<T[]>;   // The source items.
  getText: (item: T) => string;   // Render an item to its row text.
  focused?: Signal<number>;   // The focused (highlighted) display index (default an internal signal at 0).
  selected?: Signal<number>;   // The selected (chosen) display index (default an internal signal at -1).
  onSelect?: (index: number, item: T) => void;   // Activation callback (Enter/Space or double-click); `index` is display order, `item` the value.
  command?: string;   // Command emitted on activation (like `Button`).
  sorted?: boolean;   // Display items in ascending `getText` order (stable); `focused`/`selected` index the display.
  typeAhead?: boolean;   // Enable the linear case-insensitive prefix type-ahead.
  roles?: ListRoles;   // Row theme roles (default the standard `list*` roles); override for a different palette.
  numCols?: number;   // Number of columns (default `1`). `>1` lays the items out column-major with a `│` divider between columns; the scroll model stays vertical.
  bar?: ScrollBar;   // Inject an externally owned + placed `ScrollBar` to bind to, instead of this view owning a vertical right-edge bar. When provided, `ListView` does not create or lay out a bar — the caller owns and places it (e.g. a horizontal bottom bar) and this view only wires the rows renderer to drive it. The injected bar must share this view's `focused` signal (construct it with `value: <that signal>`).
}
```

## messageBox

Show a modal message box and wait for the user to dismiss it.

```ts
messageBox(host: ModalDialogHost, o: MessageBoxOptions): Promise<'ok' | 'cancel'>
```

## MessageBoxOptions

Options for messageBox.

```ts
interface MessageBoxOptions {
  title: string;   // Title centered in the top border.
  text: string;   // The message body; the box sizes itself to fit.
  buttons?: 'ok' | 'okCancel';   // `'ok'` (default) shows one OK button; `'okCancel'` shows OK + Cancel.
}
```

## ModalDialogHost

The minimal host a modal helper needs: an event loop to run the modal and a desktop to mount it into.

```ts
interface ModalDialogHost {
  loop: Pick<EventLoop, 'execView'>;   // Runs a view modally, resolving to the command that closed it.
  desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'>;   // The desktop the modal mounts into (and whose extent bounds it).
}
```

## noButton

A No button — emits `Commands.no` when activated.

```ts
noButton(): Button
```

## okButton

An OK button — the dialog default; emits `Commands.ok` when activated.

```ts
okButton(): Button
```

## okCancelButtons

The OK + Cancel pair, in tab/z order (OK first).

```ts
okCancelButtons(): [Button, Button]
```

## ScrollBar

A scroll bar: arrows + a page track + a proportional thumb, driven by mouse (see the module docs).

```ts
new ScrollBar(opts: ScrollBarOptions)   // extends View
// methods & signals:
setRange(min: number, max: number, pageStep?: number, arrowStep?: number): void
pageStep(): number
arrowStep(): number
```

## ScrollBarOptions

Construction options for ScrollBar.

```ts
interface ScrollBarOptions {
  value: Signal<number>;   // Two-way position binding: reading renders the thumb, gestures write back, clamped to `[min,max]`.
  min?: number;   // Range minimum (default 0).
  max?: number;   // Range maximum (default 0 ⇒ disabled, whole track drawn `▓`).
  pageStep?: number;   // Page-click step (default: the axis length − 1).
  arrowStep?: number;   // Arrow-click step (default 1); wheel steps `3·arrowStep`.
  orientation?: 'vertical' | 'horizontal';   // Long axis (default `'vertical'`).
}
```

## ScrollbarsMode

Which owned scrollbars a Scroller creates (default `'vertical'`).

```ts
type ScrollbarsMode = 'vertical' | 'horizontal' | 'both' | 'none'
```

## Scroller

A scrolling viewport: an oversized content child + auto-owned scroll bar(s) in the reserved edges.

```ts
new Scroller(opts: ScrollerOptions)   // extends Group
// methods & signals:
delta: { readonly x: number; readonly y: number }
```

## ScrollerOptions

Construction options for Scroller.

```ts
interface ScrollerOptions {
  content: View;   // The oversized content view (clipped to the viewport, offset by `-delta`).
  extent: Size2D | (() => Size2D);   // The content's natural size = the scroll limit; a thunk is re-read each `draw()` for dynamic content.
  scrollbars?: ScrollbarsMode;   // Which owned bars to create (default `'vertical'`).
}
```

## SplitView

A resizable split-pane container.

```ts
new SplitView(opts: SplitViewOptions)   // extends Group
// methods & signals:
splitters: Splitter[]
grabMark: Signal<boolean>
beginDrag(index: number, ev: DispatchEvent): void
resizeBy(index: number, delta: number): void
```

## SplitViewOptions

Construction options for SplitView.

```ts
interface SplitViewOptions {
  direction: Direction;   // Split axis: `'row'` = side-by-side panes, `'col'` = stacked panes.
  children: View[];   // The pane views, in order. N children produce N−1 splitters.
  sizes: Signal<number[]>;   // Two-way pane sizing as `fr` weights. Seed it with ratios (`signal([1, 1])` = equal, `[2, 1]` = 2:1); a drag rewrites it with the resolved cell counts. Restoring saved weights into a differently-sized container rescales them proportionally.
  minSize?: number | number[];   // Minimum pane size in cells — a scalar applies to every pane, an array is per-pane.
  grabMark?: boolean;   // Whether each splitter draws the `▓` grab mark at its midpoint. Defaults to `true`. This is only the initial value — the live state lives in the public SplitView.grabMark signal, so you can flip it at runtime.
  onResize?: (sizes: number[]) => void;   // Fired on every **live** change: each drag move that actually changes the sizes, and each keyboard step. Never fires when the sizes are unchanged — a drag held against a minimum is a silent no-op. Use this to mirror the layout live; use SplitViewOptions.onResizeEnd to persist it.
  onResizeEnd?: (sizes: number[]) => void;   // Fired once per **commit**: the pointer-up that ends a drag, and each discrete keyboard step. One drag gesture fires this exactly once however far the pointer travelled — so this, not SplitViewOptions.onResize, is the hook to persist a layout from.
}
```

## Tab

A single tab descriptor.

```ts
interface Tab {
  title: string;   // Tab label; wrap the hotkey letter in tildes (`~X~`) to mark the Alt-hotkey. Sanitized on draw.
  content: Group;   // The page shown when this tab is active. Built up-front and kept mounted while other tabs show.
  disabled?: boolean;   // When true, the tab is drawn greyed, cannot be activated, and is skipped by cycling/hotkeys.
  closeable?: boolean;   // When true, the label draws a `×`; clicking it removes the tab and fires `onClose`.
}
```

## TabView

A tabbed layout container: a folder-tab strip over a bordered, one-page-at-a-time content region.

```ts
new TabView(opts: TabViewOptions)   // extends Group
// methods & signals:
acceleratorScope
tabs: Signal<Tab[]>
active: Signal<number>
strip: TabStrip
select(i: number): void
next(): void
prev(): void
closeTab(i: number): void
```

## TabViewOptions

Constructor options for TabView.

```ts
interface TabViewOptions {
  tabs: Signal<Tab[]>;   // Caller-owned reactive tab list.
  active: Signal<number>;   // Caller-owned active-index signal; clamped to the tab count at render time.
  onClose?: (tab: Tab, index: number) => void;   // Fired after a tab is removed via its `×` close mark.
  onChange?: (index: number) => void;   // Fired when the effective active index changes.
}
```

## yesButton

A Yes button — the dialog default; emits `Commands.yes` when activated.

```ts
yesButton(): Button
```

## yesNoButtons

The Yes + No pair, in tab/z order (Yes first).

```ts
yesNoButtons(): [Button, Button]
```
