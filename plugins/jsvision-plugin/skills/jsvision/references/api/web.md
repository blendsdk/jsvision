<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:update`. Source: @jsvision/* JSDoc. -->

# API — @jsvision/web — browser runtime

Mount an app in an xterm.js terminal; the in-memory browser file system.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import these symbols from `@jsvision/web`. For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## BrowserCapsOptions

Options for buildBrowserCaps.

```ts
interface BrowserCapsOptions {
  colorDepth?: 'truecolor' | '256' | '16' | 'mono';   // Colour depth the profile advertises; a lower value makes `serialize()` downsample. Default `'truecolor'`.
}
```

## BrowserFileSystemOptions

Options for createBrowserFileSystem.

```ts
interface BrowserFileSystemOptions {
  tree?: FileTree;   // The initial tree. Absolute-path keys seed at that path; nested records are directories.
  home?: string;   // The home directory the dialogs open at. Default `'/home/demo'`.
  mtime?: Date;   // The deterministic mtime for every seeded and written entry (keeps golden output stable).
}
```

## BrowserHost

The browser host surface wired to the event loop.

```ts
interface BrowserHost {
  start(): void;   // Enable input modes and start pumping terminal bytes into the decoder.
  render(buffer: ScreenBuffer): void;   // Diff `buffer` against the previous frame and write the ANSI delta to the terminal.
  setCaret(cell: CaretCell | null): void;   // Position (or hide, when `null`) the hardware caret — wire to the loop's `onCaret`.
  dispose(): void;   // Stop terminal input and pending decoder timers owned by this host.
}
```

## BrowserHostOptions

Options for createBrowserHost.

```ts
interface BrowserHostOptions {
  term: TerminalLike;   // The terminal to render into and read input from (any object satisfying TerminalLike).
  caps: CapabilityProfile;   // The capability profile driving `serialize()`/`decode()` (build one with `buildBrowserCaps`).
  onInput: (event: InputEvent) => void;   // Sink for decoded input events (wire to `loop.dispatch`).
  timer?: TimerSeam;   // Timer seam; defaults to the global timers. Inject a fake to drive the lone-ESC flush in tests.
}
```

## BrowserKeyEvent

The browser-key fields needed to recognize a host clipboard gesture without importing DOM types.

```ts
interface BrowserKeyEvent {
  type: string;   // Browser event phase, normally `keydown` or `keyup`.
  key: string;   // Layout-resolved key value, such as `C`.
  code: string;   // Physical key code, such as `KeyC`.
  ctrlKey: boolean;   // Whether Control is held.
  shiftKey: boolean;   // Whether Shift is held.
  altKey: boolean;   // Whether Alt/Option is held.
  metaKey: boolean;   // Whether Command/Meta is held.
}
```

## CaretCell

A 0-based absolute caret cell, matching the event loop's `onCaret` payload.

```ts
interface CaretCell {
  x: number;
  y: number;
}
```

## ClipboardBridge

The outbound-only slice of the browser Clipboard API (a narrow local type — no DOM lib, no reads).

```ts
interface ClipboardBridge {
  writeText(text: string): Promise<void>;   // Write `text` to the clipboard. The browser requires an active user gesture; may reject otherwise.
}
```

## FileTree

A seed tree: a string value is a file's UTF-8 content; a nested record is a directory.

```ts
type FileTree = { [name: string]: string | FileTree }
```

## KeyReclaimOptions

Options for attachKeyReclaim.

```ts
interface KeyReclaimOptions {
  also?: readonly string[];   // Extra chords to reclaim beyond the defaults (e.g. `'Ctrl+X'`), or `['*']` to reclaim every chord.
  isFocused?: () => boolean;   // Predicate for "is the terminal focused". Defaults to a DOM check for a focused xterm textarea; a headless terminal has none, so headless runs and tests inject this predicate.
  target?: KeyEventTarget;   // The event target to attach the capture-phase listener to. Defaults to the global `document`; a test injects a hand-mocked target (the repo avoids a jsdom devDependency).
}
```

## MountAppOptions

Options for mountApp.

```ts
interface MountAppOptions {
  element: HostElement;   // The mount point the terminal lives in.
  app: Application;   // A composed `@jsvision/ui` application (its loop is wired to the terminal).
  caps: CapabilityProfile;   // The capability profile (build one with `buildBrowserCaps`).
  term?: TerminalLike;   // A ready terminal to drive. A test passes an `@xterm/headless` `Terminal`; a browser app passes an opened `@xterm/xterm` one. Provide this **or** createTerminal.
  createTerminal?: () => TerminalLike;   // A factory used when `term` is omitted, e.g. `() => { const t = new Terminal({…}); t.open(el); return t; }`. Keeps the `@xterm/xterm` value-import in the caller's bundle.
  clipboard?: ClipboardBridge;   // Browser clipboard bridge used for outbound copy/cut. Defaults to `navigator.clipboard` when available. Inject a bridge for non-DOM hosts and deterministic permission/error tests.
}
```

## MountedApp

The handle returned by mountApp.

```ts
interface MountedApp {
  term: TerminalLike;   // The terminal the app was mounted onto.
  host: BrowserHost;   // The browser host driving the terminal.
  dispose(): void;   // Release host input, the app loop, browser bridges, resize handling, and the optional terminal.
}
```

## TerminalLike

The narrow slice of an xterm.js terminal the host (and `mountApp`) actually touch, declared as a local structural interface so that **both** a real `@xterm/xterm` terminal **and** an `@xterm/headless` terminal satisfy it.

```ts
interface TerminalLike {
  write(data: string): void;   // Write a string (ANSI/text) to the terminal.
  onData(handler: (data: string) => void): { dispose(): void };   // Subscribe to input bytes the terminal produced; returns a disposer.
  onResize(handler: (size: { cols: number; rows: number }) => void): { dispose(): void };   // Subscribe to terminal resize; returns a disposer.
  attachCustomKeyEventHandler?(handler: (event: BrowserKeyEvent) => boolean): void;   // Install a DOM-key filter before xterm.js translates the key to terminal input. Browser terminals provide this hook; headless terminals may omit it. Returning `false` consumes the key.
  focus?(): void;   // Present on a DOM terminal, absent on `@xterm/headless` — always call it optionally.
  dispose?(): void;   // Present on a DOM terminal — tear the terminal down.
}
```

## UNRECLAIMABLE_CHORDS

Chords a browser (or the OS) will not release even with `preventDefault()` — a curated best-effort list (some browsers reserve `Ctrl+W`/`Ctrl+N`/`Ctrl+T` and their `Shift` variants regardless).

```ts
const UNRECLAIMABLE_CHORDS: readonly string[]
```

## attachKeyReclaim

Attach key-chord reclaim to a terminal.

```ts
attachKeyReclaim(_term: TerminalLike, options: KeyReclaimOptions = {}): () => void
```

## buildBrowserCaps

Build the browser CapabilityProfile: truecolor + UTF-8, with `colorDepth` overridable.

```ts
buildBrowserCaps(options: BrowserCapsOptions = {}): CapabilityProfile
```

## createBrowserFileSystem

Create an in-memory FileSystem seeded from a plain object.

```ts
createBrowserFileSystem(options: BrowserFileSystemOptions = {}): FileSystem
```

## createBrowserHost

Build a BrowserHost over an xterm.js-style terminal.

```ts
createBrowserHost(options: BrowserHostOptions): BrowserHost
```

## mountApp

Mount an application onto a terminal and start it.

```ts
mountApp(options: MountAppOptions): MountedApp
```

## setClipboard

Write `text` to the browser clipboard (outbound only).

```ts
setClipboard(text: string, _caps: CapabilityProfile, clipboard?: ClipboardBridge): Promise<void>
```
