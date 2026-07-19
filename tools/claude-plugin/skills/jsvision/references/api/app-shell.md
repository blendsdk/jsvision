<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — App shell

Application, desktop, windows, menus, status line, and the event loop.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## Application

A ready-to-run terminal application.

```ts
interface Application {
  desktop: Desktop | undefined;   // The desktop window manager, or `undefined` when the app was created with a custom `content` body (a router app manages its own body and registers no window commands). A no-`content` app always has one — and `createApplication` returns the precise DesktopApplication type there, so you never need a null check for the default case.
  loop: EventLoop;   // The underlying event loop. Use it to emit commands, manage focus, or run modals.
  onCommand(command: string, handler: () => void): () => void;   // Register an app-wide handler for a named command; returns a function that unregisters it. Every handler registered for a command runs when that command is emitted, and a handled command is consumed there. Forwards to `loop.onCommand` — see it for the pre-process ordering and the modal-open caveat.
  setTheme(theme: Theme): void;   // Replace the active theme at runtime and repaint every view with the new colors in one coalesced frame. Forwards to `loop.setTheme`, so it is safe to call from a command handler or a bare imperative call — the repainted frame reaches the terminal even outside an input tick.
  statusBase(): View[];   // A **fresh** copy of the application's base status items — the global affordances (e.g. quit/help) a screen composes with its own hints via `withBase`. Each call rebuilds new item views, because a view has a single parent: composing with the live base bar's own instances would re-parent them and corrupt the fallback bar. Only command items are reproduced (spacers/widgets are not part of a composable base).
  menuBase(): MenuItem[];   // The application's base menu items — the top-level menu nodes `createApplication({ menuBar })` was given. Menu items are plain data (not views), so this returns a shallow copy safe to compose with `withBase`.
  run(): Promise<number>;   // Connect to the terminal and run until the `'quit'` command, resolving to the exit code. The terminal is always restored on exit — normal, thrown, or signalled.
}
```

## ApplicationOptions

Options for createApplication.

```ts
interface ApplicationOptions {
  content?: View;   // The app body: the single view that fills the middle of the shell (below the menu bar, above the status line). Defaults to a Desktop window manager — the classic overlapping-windows shape. Pass any view (e.g. a router) for a full-screen, non-windowed app; when you do, the app exposes no `desktop` and does not register the window-management commands.
  caps?: CapabilityProfile | 'auto';   // Terminal capability profile that drives color-depth encoding for every painted frame. Defaults to `'auto'`, which detects the running terminal's capabilities via `resolveCapabilities()`. Pass an explicit profile to override the detection (used verbatim, no re-resolution).
  viewport?: Size2D;   // Initial viewport size in cells. Defaults to the output terminal's size, or 80×24 if unknown.
  theme?: Theme;   // Color/style theme applied to every view; defaults to the built-in `defaultTheme`.
  logger?: Logger;   // Logger that receives errors thrown from a view's `draw()`/`onEvent()`; defaults to a no-op logger.
  keymap?: Keymap;   // Key-chord → command map (from core's `createKeymap`) applied across the whole app.
  clipboardKeys?: ClipboardKeys;   // Which clipboard key set the framework binds by default (default `'both'` — modern Ctrl+A/C/X/V plus the classic Ctrl+Insert/Shift+Insert/Shift+Delete aliases). Any `keymap` you supply merges on top and wins on a conflicting chord. Use `'none'` to bind no clipboard chords (e.g. an app hosting a WordStar-mode `Editor`) and supply your own keymap instead.
  menuBar?: MenuBar;   // Optional menu bar shown as the top row. Build one with `menuBar(...)`.
  statusLine?: StatusLine;   // Optional status line shown as the bottom row. Build one with `statusLine(...)`.
  revealKey?: string | null;   // The key that toggles accelerator mode (default `'f12'`): while on, every `~X~` hotkey is underlined and a bare letter fires the matching accelerator. Pass `null` to disable the feature.
  runtime?: RuntimeAdapter;   // OS boundary the host runs against; defaults to the real Node runtime. Inject a fake in tests.
  input?: NodeJS.ReadStream;   // Input stream to read from; defaults to `process.stdin`. Inject a fake TTY stream to run headlessly.
  output?: NodeJS.WriteStream;   // Output stream to write to; defaults to `process.stdout`.
  warnAmbiguousWidth?: boolean;   // On a real terminal, warn once at startup if the terminal renders the ambiguous-width frame glyphs double-width (which shifts alignment). Default `true`; pass `false` to skip the probe in tests.
  adaptAmbiguousWidth?: boolean;   // On a real terminal, automatically switch to ASCII-safe frame chrome if the startup probe finds the ambiguous-width glyphs render double-width. Default `true`; pass `false` to skip the probe.
  requireTty?: boolean;   // Require an interactive TTY at startup. When `true` (the default), `run()` asserts the terminal essentials before taking over the screen and throws `EssentialsNotMetError` when there is no interactive terminal at all — a cron/CI job, a container with no tty, or stdin and stdout both redirected with no controlling terminal — instead of silently starting a keyboard-less app. (Piping output while a controlling terminal exists still works: the host binds `/dev/tty`.) Set `false` for headless/automated runs that drive the loop without a real terminal.
}
```

## buildKeymap

Build the loop's keymap: the framework's default clipboard bindings for `clipboardKeys`, with the caller's own `keymap` merged on top (the caller's bindings win on any conflicting chord).

```ts
buildKeymap(clipboardKeys: ClipboardKeys = 'both', userKeymap?: Keymap): Keymap | undefined
```

## ClipboardKeys

Which clipboard key set the framework binds by default. - `'modern'` — Ctrl+A (select-all), Ctrl+C (copy), Ctrl+X (cut), Ctrl+V (paste). - `'classic'` — the Turbo Vision chords Ctrl+Insert (copy), Shift+Insert (paste), Shift+Delete (cut).

```ts
type ClipboardKeys = 'modern' | 'classic' | 'both' | 'none'
```

## CommandName

A standard shell command name (a value of Commands).

```ts
type CommandName = (typeof Commands)[keyof typeof Commands]
```

## Commands

The standard command names.

```ts
const Commands: { readonly quit: "quit"; readonly close: "close"; readonly zoom: "zoom"; readonly next: "next"; readonly prev: "prev"; readonly cascade: "cascade"; readonly tile: "tile"; readonly ok: "ok"; readonly cancel: "cancel"; readonly yes: "yes"; readonly no: "no"; readonly selectAll: "selectAll"; readonly cut: "cut"; readonly copy: "copy"; readonly paste: "paste"; readonly undo: "undo"; readonly redo: "redo"; }
```

## createApplication

Create a terminal application: assemble the event loop, desktop, optional menu bar/status line, and popup overlay, register the standard window-management commands, and return an Application.

```ts
createApplication<O extends ApplicationOptions = ApplicationOptions>(opts: O = {} as O): CreatedApplication<O>
```

## CreatedApplication

The precise application type for a given options object: a RouterApplication when `content` is a view, otherwise a DesktopApplication.

```ts
type CreatedApplication<O extends ApplicationOptions> = O extends { content: View }
  ? RouterApplication
  : DesktopApplication
```

## createEventLoop

Create an event loop over a viewport of the given size.

```ts
createEventLoop(viewport: Size2D, opts: EventLoopOptions): EventLoop
```

## Desktop

The window manager and desktop background.

```ts
new Desktop()   // extends Group
// methods & signals:
shadow: boolean
handleViewportResize(): void
attachLoop(seam: DesktopLoopSeam): void
activeWindow(): Window | null
addWindow(w: Window): void
removeWindow(w: Window): void
raise(w: Window): void
cascade(): void
tile(): void
focusNextWindow(): void
focusPrevWindow(): void
focusWindowNumber(n: number): void
beginMove(w: Window, grabLocal: Point): void
beginResize(w: Window): void
beginResizeLeft(w: Window): void
```

## DesktopApplication

An application whose body is the default Desktop window manager (no `content` was given).

```ts
interface DesktopApplication {
  desktop: Desktop;   // The desktop window manager — always present for a no-`content` app.
}
```

## DesktopLoopSeam

The slice of the event loop the desktop needs, injected by `createApplication`: pointer capture for drag/resize, command emit/enablement, and focus for raise-on-click.

```ts
interface DesktopLoopSeam {
  setCapture(view: View): void;   // Capture the pointer to a view for the duration of a drag or resize.
  releaseCapture(): void;   // Release the pointer capture.
  emitCommand(command: string, arg?: unknown): void;   // Emit a command through the loop.
  isCommandEnabled(command: string): boolean;   // Whether a command is currently enabled.
  focusView(view: View): void;   // Focus a view.
  focusInto(view: View): void;   // Focus into a container, descending to its inner focusable view.
}
```

## DuplicateAccelerator

One within-scope accelerator collision: the shared (lowercase) char and the claiming indices, in order.

```ts
interface DuplicateAccelerator {
  char: string;   // The colliding accelerator character, lowercased.
  indices: number[];   // The 0-based positions in the input list that claim this char, in first-appearance order.
}
```

## EventLoop

The event loop: a host-agnostic engine that owns a render root, routes input and commands, manages focus, commands, and modal windows, and paints exactly one coalesced frame per dispatch tick.

```ts
interface EventLoop {
  renderRoot: RenderRoot;   // The render root the loop builds and owns — read `renderRoot.buffer()` to inspect the composed frame.
  mount(root: View): void;   // Mount a view tree as the loop's root and paint the first frame. Call once before dispatching.
  stop(): void;   // Stop the loop's out-of-tick painter. After `stop()`, a mutation that would normally schedule a deferred repaint — a timer, a promise continuation, a direct call between ticks — is ignored, and any already-queued deferred paint is skipped, so a late callback during or after teardown never writes to a stopped host. Idempotent. In-tick painting (a `dispatch`/`resize`/command) is unaffected: a running loop never calls this, and `run()` calls it once during shutdown. It does not dispose the mounted view tree.
  dispatch(event: AppEvent): void;   // Feed one decoded input event (key/mouse/wheel/paste) into the loop; it routes and repaints in one tick.
  resize(size: Size2D): void;   // Resize the viewport: reflow the tree and paint exactly one frame.
  focusNext(): void;   // Move focus to the next focusable view in **document (tree) order**, bounded by the active scope (the open modal's subtree while a modal is up, else the mounted root). Focus descends through nested groups and, at a group's end, crosses into the parent's next focusable sibling, wrapping at the scope — so a dialog built from nested `col`/`row` containers is fully traversable and Tab never escapes an open modal. Continuous Tab is pure tree order (a wrap re-enters at the tree start, not the last-visited child); container **restore** memory applies only to a non-Tab entry (a click, `focusView`, a window switch, opening/closing a dialog).
  focusPrev(): void;   // Move focus to the previous focusable view — the exact inverse of EventLoop.focusNext (reverse descent lands on a container's last leaf), bounded by and wrapping at the same scope.
  focusView(view: View): void;   // Focus exactly `view`. A no-op if `view` is not currently focusable.
  focusInto(view: View): void;   // Focus **into** a container: restore its last-focused child, or focus its first focusable descendant.
  getFocused(): View | null;   // The currently focused view, or `null` if nothing is focused.
  emitCommand(command: string, arg?: unknown): void;   // Emit a command, routing it to any handler. Dropped silently if the command is disabled.
  enableCommand(command: string, on: boolean): void;   // Enable or disable a command. While disabled, `emitCommand` for it is dropped.
  isCommandEnabled(command: string): boolean;   // Whether a command is currently enabled. Commands are enabled by default until disabled.
  commandsVersion(): number;   // A version counter that changes whenever any command's enablement changes via enableCommand. Read it inside a view's `bind` to repaint on greying — the shell's status line and menu bar do exactly this so a disabled command greys live with no manual invalidate.
  execView(view: View): Promise<R>;   // Open `view` as a modal: input is captured to its subtree until it closes. Returns a promise that resolves with the value passed to endModal. `await` it to run a dialog and read its result.
  endModal(result: R): void;   // Close the top-most modal, restore the previously focused view, and resolve its `execView` promise with `result`.
  setAcceleratorMode(on: boolean): void;   // Turn accelerator mode on or off. When on, every reachable `~X~` hotkey is underlined and a bare letter fires the matching accelerator like `Alt`+letter. The reveal key (default `F12`) toggles this for you; call it directly to arm/dismiss the mode programmatically. A no-op when the feature is disabled (`revealKey: null`).
  setTheme(theme: Theme): void;   // Replace the active theme and repaint every view with the new colors in one coalesced frame. Safe to call from anywhere — a command handler, an async callback, or a bare imperative call between input ticks — because the swap runs inside the loop's own tick and reuses its trailing flush + `onFrame`, so the repainted frame reaches the host even outside a dispatch.
  onCommand(command: string, handler: () => void): () => void;   // Register a handler for a named command; returns a function that unregisters it. Every handler registered for a command runs (in registration order) when that command is emitted, and a handled command is consumed there — a downstream view matching the same command does not also receive it. Handlers run in the pre-process phase, so an `onCommand` handler fires before a focused view could handle the same command. One exception: while a modal (e.g. a `Dialog`) owns the dispatch scope, commands are confined to the modal subtree, so a general `onCommand` handler does not fire until the modal closes.
  setCapture(view: View): void;   // Capture the pointer to `view`: while captured, **all** mouse/wheel events go to `view` (with view-local `ev.local` coordinates), bypassing hit-testing and focus-on-click — this is how a drag or resize keeps tracking even after the cursor leaves the affordance. Setting a new target replaces any current one; capture is released automatically when a modal opens/closes or the target unmounts.
  releaseCapture(): void;   // Release the pointer capture. A no-op if nothing is captured.
  onFrame?: (buffer: ScreenBuffer) => void;   // Called with the composed buffer after every frame (each dispatch tick, resize, and mount) so a host can paint it. Set this to `host.render` (or your own writer) after the host exists; `createApplication` wires it for you. While unset, frames are still composed but not pushed — headless tests read `renderRoot.buffer()` directly.
  onCaret?: (cell: Point | null) => void;   // Called right after onFrame at every frame with the focused view's absolute caret cell, or `null` when nothing is focused or the focused view wants no visible caret. Wire it to move the terminal's hardware cursor. It reads the persisted view origin, so the caret position stays correct even on a partial repaint that skips the focused view. `undefined` ⇒ no caret output.
  onResize?: (size: Size2D) => void;   // Called inside resize after the reflow settles the new geometry, so a handler can re-anchor viewport-sized chrome against fresh bounds (the app uses it to re-fit maximized windows and re-anchor the open menu). The loop repaints once more afterward so the adjustment is visible. `undefined` ⇒ resize only reflows.
  refreshCaret(): void;   // Re-send the current caret cell to onCaret out of band. `run()` calls it once after the first frame (which is painted directly, not through a tick) to position the initial cursor. A no-op when `onCaret` is unset.
  writeClipboard?: (seq: string) => void;   // Called with a ready-to-write terminal clipboard sequence when a control copies/cuts text (the loop encodes and sanitizes it for you). Wire it to your output stream. `undefined` ⇒ clipboard writes are dropped, so copy/cut is a safe no-op headlessly.
  popupHost?: PopupHost;   // The host that anchored dropdown popups (menus, combo boxes, date/color pickers) mount into. `createApplication` wires it to the app's overlay + focus. `undefined` ⇒ no host, so opening a dropdown is a safe no-op; a standalone `Dialog` can supply its own.
}
```

## EventLoopOptions

Options for createEventLoop .

```ts
interface EventLoopOptions {
  caps: CapabilityProfile;   // Required. Terminal capability profile that drives color-depth encoding for every painted frame.
  theme?: Theme;   // Color/style theme applied to every view; defaults to the built-in `defaultTheme`.
  logger?: Logger;   // Logger that receives errors thrown from a view's `onEvent()`/`draw()`; defaults to a no-op logger.
  keymap?: Keymap;   // Key-chord → command map (from core's `createKeymap`): a matched chord fires the command and swallows the key.
  clipboardKeys?: ClipboardKeys;   // Which clipboard key set the framework binds by default (default `'both'` — modern Ctrl+A/C/X/V plus the classic Ctrl+Insert/Shift+Insert/Shift+Delete aliases). A `keymap` you supply is merged on top and wins on any conflicting chord. `'none'` binds no clipboard chords at all — only a widget's built-in raw Ctrl+A select-all still fires — so an app on `'none'` supplies its own keymap for copy/cut/paste (and the classic chords).
  commands?: Iterable<string>;   // Optional list of command names known up front. Commands are enabled by default whether listed or not.
  onIdle?: () => void;   // Called once per dispatch tick after all cascaded events drain, just before the frame is painted.
  now?: () => number;   // Clock used to time double-clicks (defaults to `Date.now`). Two mouse-downs on the same cell within the multi-click window are reported as a double-click via `DispatchEvent.clickCount`. Inject a controllable clock in headless tests to drive exact timestamps.
  quitCommand?: string;   // The command that terminates the app (default `'quit'`). If a quit is emitted while modal windows are open, it cascades top-down through the modal stack: each modal is asked to close, and a modal that vetoes (e.g. a dialog whose validation fails) stops the cascade and keeps the app running. Once the stack is empty the quit reaches the app's quit handler.
  revealKey?: string | null;   // The key that toggles "accelerator mode" (default `'f12'`). While it is on, every reachable `~X~` hotkey in the current scope is underlined and pressing a bare letter fires the matching accelerator as if you had pressed `Alt`+letter. Pass `null` to disable the feature entirely.
  onQuit?: (code: number) => void;   // Called when the quitCommand is emitted, with the exit code carried by the command (0 when none was given). This is how the loop terminates: `createApplication` wires it to resolve `run()`. When unset (a bare loop), the quit command is a plain command with no special termination.
  scheduleMicrotask?: (cb: () => void) => void;   // How the loop defers an out-of-tick repaint. Defaults to `queueMicrotask`. A mutation that reaches the retained view tree outside a dispatch tick — a timer callback, a promise continuation, or a direct imperative call between input ticks — is painted on the callback this schedules, coalesced so a burst of such mutations in one JS turn produces a single frame. Inject a capturing implementation to step that deferred paint deterministically in a test.
}
```

## findDuplicateAccelerators

Find every accelerator character claimed by more than one entry, case-insensitively.

```ts
findDuplicateAccelerators(chars: readonly string[]): DuplicateAccelerator[]
```

## item

Build a command item — a selectable row that emits `command` when chosen.

```ts
item(title: string, command: string, key?: string): MenuItem
```

## menuBar

Build a MenuBar from a list of top-level menu entries.

```ts
menuBar(items: MenuItem[]): MenuBar
```

## MenuBar

The application menu bar.

```ts
new MenuBar()   // extends View
// methods & signals:
items: readonly MenuItem[]
controller: MenuController | null
setItems(items: readonly MenuItem[]): void
```

## MenuController

The navigation surface a MenuBar drives — one method per navigation action.

```ts
interface MenuController {
  isOpen(): boolean;   // Whether a top-level menu is currently open.
  openIndex(): number | null;   // The open top-level index (for the bar's title highlight), or `null` when closed.
  openTop(index: number): void;   // Open the top-level menu at `index` (saving focus the first time); switches if already open.
  closeLevel(): void;   // Close the deepest open popup; closing the last level closes the whole menu.
  close(): void;   // Close every level and the catcher, and restore the saved focus.
  move(dir: -1 | 1): void;   // Move the deepest level's highlight, skipping separators and disabled items.
  activate(): void;   // Activate the deepest highlighted item: open a submenu, or emit an enabled item's command + close.
  left(): void;   // `←`: close a nested level, or (at the top level) switch to the previous top-level menu.
  right(): void;   // `→`: open a highlighted submenu, else switch to the next top-level menu.
  topHotkey(char: string): boolean;   // `Alt+<char>`: open/switch to the top-level menu whose hotkey matches; `true` if consumed.
  itemHotkey(char: string): boolean;   // A plain `<char>` while open: activate the deepest item whose hotkey matches; `true` if consumed.
  resize(): void;   // Resize hook for the app shell; a no-op now — the outside-click catcher covers the viewport and re-fills on reflow.
}
```

## MenuItem

A node in the menu tree (plain data).

```ts
type MenuItem = | { kind: 'item'; title: string; command: string; key?: string } // `~X~` in the title marks the hotkey
  | { kind: 'sub'; title: string; items: MenuItem[] }
  | { kind: 'separator' }
  | { kind: 'spacer'; weight?: number }
```

## MenuLoopSeam

The application-level operations the controller calls into for activation, greying, and focus.

```ts
interface MenuLoopSeam {
  emitCommand(command: string, arg?: unknown): void;   // Emit the activated item's command so the app can handle it.
  isCommandEnabled(command: string): boolean;   // Whether a command is enabled — a disabled item is greyed and cannot be activated.
  commandsVersion(): number;   // A tick that changes on any command-enablement change; the bar binds it so greying repaints live.
  focusView(view: View): void;   // Focus a view — used to restore the pre-menu focus when the menu closes.
  getFocused(): View | null;   // The currently-focused view, captured when a menu opens so it can be restored on close.
  dismissAccelerators(): void;   // Turn off the accelerator-hint overlay when a menu opens. Optional — a bare event loop without the full app shell omits it. An open menu owns plain letter keys (for item hotkeys), so the overlay must not also intercept them; the controller calls this on every open path.
}
```

## MenuPopup

A single dropdown menu box, driven by the menu bar's controller and mounted into the app overlay.

```ts
new MenuPopup()   // extends View
// methods & signals:
items: readonly MenuItem[]
highlight
isEnabled: (command: string) => boolean
onPick?: (row: number) => void
layout: LayoutProps
```

## menuSpacer

Build a flexible gap between top-level menu titles: the titles placed after it are pushed toward the bar's right edge, so `menuBar([subMenu('~F~ile', …), menuSpacer(), subMenu('~H~elp', …)])` right-aligns Help.

```ts
menuSpacer(weight = 1): MenuItem
```

## ModalHost

The handle a self-closing modal view receives so it can close itself from its own event handling.

```ts
interface ModalHost {
  endModal(result: unknown): void;   // Resolve the active `execView` promise with `result` (e.g. the command that closed the dialog).
  isCommandEnabled(command: string): boolean;   // Whether a command is currently enabled (a dialog gates its close-on-command on this).
}
```

## ModalHostAware

Implement this on a view to opt into self-closing modality.

```ts
interface ModalHostAware {
  attachModalHost(host: ModalHost): void;   // Receive the loop's modal-host handle when this view is opened via `execView`.
}
```

## ParsedLabel

A label with its `~X~` accelerator parsed out.

```ts
interface ParsedLabel {
  text: string;   // The display text (tildes removed).
  hotkey: string | null;   // The lowercase accelerator char, or `null` if the label had no `~X~`.
  hotkeyCol: number;   // The accelerator char's column in text, or `-1` when there is none.
}
```

## reportDuplicateAccelerators

Run findDuplicateAccelerators over a scope's accelerator chars and emit one dev-only warning per collision (silent under `NODE_ENV=production`).

```ts
reportDuplicateAccelerators(scope: string, chars: readonly string[], labels?: readonly string[]): void
```

## RouterApplication

An application whose body is a custom `content` view (e.g. a router); it has no window manager.

```ts
interface RouterApplication {
  desktop: undefined;   // No window manager: a `content` app manages its own body.
}
```

## separator

Build a separator — a horizontal rule between groups of items inside a submenu.

```ts
separator(): MenuItem
```

## statusItem

Build a status entry for a statusLine .

```ts
statusItem(text: string | (() => string), command?: string, key?: string): StatusItemView
```

## StatusItem

A status entry's readable contract: its (possibly live) label, the command it emits, and an optional accelerator.

```ts
interface StatusItem {
  text: string | (() => string);   // Display label, or a getter for a live one; `~X~` marks the accent character.
  command?: string;   // The command emitted when clicked or when its accelerator is pressed; omitted ⇒ a passive label.
  key?: string;   // Optional accelerator label, e.g. `'Alt+X'`, `'Ctrl+Q'`, or `'F1'`.
}
```

## StatusItemView

The presentational status entry view.

```ts
new StatusItemView(text: string | (() => string), command?: string, key?: string)   // extends View
// methods & signals:
text: string | (() => string)
command?: string
key?: string
```

## statusLine

Build a StatusLine from a heterogeneous list of views: command items (statusItem ), flexible `spacer()`s, and any fitting 1-row passive widget.

```ts
statusLine(children: View[]): StatusLine
```

## StatusLine

The application status line.

```ts
new StatusLine()   // extends Group
// methods & signals:
seam: StatusLoopSeam | null
setItems(items: View[]): void
```

## StatusLoopSeam

The application operations the status line calls into for activation, greying, and press capture.

```ts
interface StatusLoopSeam {
  emitCommand(command: string, arg?: unknown): void;   // Emit the item's command so the app can handle it.
  isCommandEnabled(command: string): boolean;   // Whether a command is enabled — a disabled item is greyed and cannot be activated.
  commandsVersion(): number;   // A tick that changes on any command-enablement change; the bar binds it so greying repaints live.
  setCapture(view: Group): void;   // Capture the pointer to the status line for the duration of a press.
  releaseCapture(): void;   // Release the pointer capture.
}
```

## subMenu

Build a submenu node — a titled entry that opens a nested list of items (or further submenus).

```ts
subMenu(title: string, items: MenuItem[]): MenuItem
```

## TitleLayout

A top-level title's placement on the menu bar.

```ts
interface TitleLayout {
  index: number;
  x: number;   // The button's left column (the leading pad space).
  width: number;   // The full ` text ` button width — display text + one pad column on each side.
  label: ParsedLabel;
}
```

## Window

A titled, framed container.

```ts
new Window(title?: string)   // extends Group
// methods & signals:
layout: LayoutProps
title: Signal<string>
dragging: Signal<boolean>
active: Signal<boolean>
number?: number
movable
resizable
zoomable
closable
minWidth
minHeight
onResized(): void
commitPlacement(): void
isZoomed(): boolean
resetZoom(): void
zoom(): void
onDesktopResize(size: Size2D): void
close(): void
selectByClick(): void
```
