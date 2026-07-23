<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:update`. Source: @jsvision/* JSDoc. -->

# API — @jsvision/core — engine, capabilities & themes

Rendering, terminal capabilities, input, colors, contrast, themes, and safety.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## AMBIGUOUS_PROBE_GLYPHS

The arrow/geometric probe group: the fallback-prone chrome the SDK draws (scroll arrows, submenu/input arrows, radio mark, zoom/restore/close icons).

```ts
const AMBIGUOUS_PROBE_GLYPHS: "▲▼◄►•↑↕×"
```

## ANSI16_ORDER

The 16 ANSI names in palette-index order: 0–7 normal, 8–15 bright.

```ts
const ANSI16_ORDER: readonly Ansi16Name[]
```

## Ansi16Name

The 16 named ANSI colors; the style encoder maps each to the terminal's actual color depth.

```ts
type Ansi16Name = | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'brightBlack'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite'
```

## Attr

Attribute bit constants.

```ts
const Attr: { readonly none: 0; readonly bold: number; readonly dim: number; readonly italic: number; readonly underline: number; readonly blink: number; readonly reverse: number; readonly strike: number; }
```

## Attr

Attribute bit constants.

```ts
const Attr: {
    readonly none: 0;
    readonly bold: number;
    readonly dim: number;
    readonly italic: number;
    readonly underline: number;
    readonly blink: number;
    readonly reverse: number;
    readonly strike: number;
}
```

## AttrMask

Text-attribute bitmask.

```ts
type AttrMask = number
```

## BOX_PROBE_GLYPHS

The box-drawing + shade probe group (corners, edges, shades).

```ts
const BOX_PROBE_GLYPHS: "┌┐└┘─│▒█"
```

## CSI

Control Sequence Introducer (`ESC [`).

```ts
const CSI: "\u001B["
```

## CapabilityProfile

The immutable, detected description of the running terminal.

```ts
interface CapabilityProfile {
  colorDepth: ColorDepth;
  mouse: MouseCaps;
  unicode: UnicodeCaps;
  osc: OscCaps;
  sync2026: boolean;
  altScreen: boolean;
  bracketedPaste: boolean;
  keyboard: KeyboardCaps;
  glyphs: GlyphCaps;
  platform: Platform;
  multiplexer: boolean;   // True when running under tmux/screen; consumers apply passthrough policy.
}
```

## CapabilityProfile

The immutable, detected description of the running terminal.

```ts
interface CapabilityProfile {
  colorDepth: ColorDepth;
  mouse: MouseCaps;
  unicode: UnicodeCaps;
  osc: OscCaps;
  sync2026: boolean;
  altScreen: boolean;
  bracketedPaste: boolean;
  keyboard: KeyboardCaps;
  glyphs: GlyphCaps;
  platform: Platform;
  multiplexer: boolean;   // True when running under tmux/screen; consumers apply passthrough policy.
}
```

## CapabilityReasons

Which detection layer decided each capability — one ReasonLayer per top-level field of CapabilityProfile (per field group, not per nested boolean).

```ts
interface CapabilityReasons {
  colorDepth: ReasonLayer;
  mouse: ReasonLayer;
  unicode: ReasonLayer;
  osc: ReasonLayer;
  sync2026: ReasonLayer;
  altScreen: ReasonLayer;
  bracketedPaste: ReasonLayer;
  keyboard: ReasonLayer;
  glyphs: ReasonLayer;
  platform: ReasonLayer;
  multiplexer: ReasonLayer;
}
```

## CapabilityResolution

The frozen result returned by the capability resolvers.

```ts
interface CapabilityResolution {
  profile: CapabilityProfile;   // The detected capabilities.
  reasons: CapabilityReasons;   // Which detection layer decided each field of profile.
  passthrough?: Uint8Array;   // Real input bytes the user typed while a live probe was in flight (not part of any terminal response). Present only on resolveCapabilitiesAsync runs that issued a query and captured such bytes. If you detect before starting your input loop, feed these into the decoder **first**, ahead of further stdin, so the keystrokes surface as events in arrival order. Omitted on the sync path and whenever nothing was captured.
}
```

## Cell

A single screen cell.

```ts
interface Cell {
  char: string;
  fg: Color;
  bg: Color;
  attrs: AttrMask;
  width: 0 | 1 | 2;   // Display width: 1 = normal, 2 = lead of a wide glyph, 0 = trailing continuation.
}
```

## ChromeHost

The chrome seam an application hands to a router-style body so each screen can define its own status line and menu.

```ts
interface ChromeHost {
  setStatus(items: View[] | null): void;   // Replace the status line's items with `items`; pass `null` to restore the application's base status line (whatever `createApplication({ statusLine })` was given). Swapped-in command items are re-wired so their greyed/enabled state stays correct.
  setMenu(items: MenuItem[] | null): void;   // Replace the menu bar's top-level items with `items`, rebuilding its navigation controller; pass `null` to restore the application's base menu.
}
```

## ChromeHostAware

Implemented by an application body (e.g. a router) that wants to drive the shared chrome.

```ts
interface ChromeHostAware {
  attachChromeHost(host: ChromeHost): void;   // Receive the application's chrome seam. Called once by `createApplication` after the menu/status bars are attached.
}
```

## Color

An app-specified color: a 24-bit hex, a named ANSI-16 color, or the terminal default.

```ts
type Color = `#${string}` | Ansi16Name | 'default'
```

## ColorDepth

Color rendering depth, coarsest to richest.

```ts
type ColorDepth = 'mono' | '16' | '256' | 'truecolor'
```

## ColorRole

Whether a color is a foreground or background (selects the SGR base code).

```ts
type ColorRole = 'fg' | 'bg'
```

## CursorPosition

A parsed Cursor-Position-Report: 1-based row and column, as the terminal reports them.

```ts
interface CursorPosition {
  row: number;
  col: number;
}
```

## DEFAULT_WIDTH_PROBE_TIMEOUT_MS

Default whole-probe timeout in milliseconds (mirrors the layer-2 query budget).

```ts
const DEFAULT_WIDTH_PROBE_TIMEOUT_MS: 200
```

## DecodeOptions

Per-decode configuration.

```ts
interface DecodeOptions {
  caps?: CapabilityProfile;   // Resolved terminal capabilities; informs which keyboard grammar to use and focus handling.
  pasteCap?: number;   // Override the bracketed-paste size cap in bytes (default PASTE_CAP_BYTES).
}
```

## DecodeResult

The result of one decode /flush call.

```ts
interface DecodeResult {
  events: InputEvent[];
  queries: QueryResponse[];
  rest: Uint8Array;   // Incomplete trailing bytes carried to the next decode() call (=== `state.carry`).
  state: DecoderState;   // The next decoder state to pass to the following decode() call.
}
```

## DecoderState

The opaque carry threaded between decode calls.

```ts
interface DecoderState {
  carry: Uint8Array;   // Incomplete trailing bytes from the previous call (bounded, so a runaway sequence cannot grow it).
  paste: PasteState;   // In-progress bracketed-paste accumulation.
  resync: boolean;   // True while discarding the tail of an oversized, unterminated sequence: after the carry bound trips, subsequent bytes are dropped (no events) until the next `ESC` resynchronises the stream.
}
```

## DeepPartial

Recursive partial: every field (nested included) becomes optional.

```ts
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
}
```

## Degradation

A non-essential capability gap the SDK runs around in a reduced mode instead of stopping.

```ts
interface Degradation {
  cap: 'mouse' | 'color' | 'altScreen';   // The missing capability.
  mode: 'keyboard-only' | 'monochrome' | 'inline';   // The reduced mode the SDK runs in for this gap.
  message: string;   // A short, screen-safe human notice (no secrets).
}
```

## ESC_TIMEOUT_MS

Lone-`ESC` disambiguation window, in milliseconds — the recommended delay before calling `flush()`.

```ts
const ESC_TIMEOUT_MS: 50
```

## EssentialsNotMetError

Thrown when the terminal does not meet the SDK's runtime essentials, so the app must not start.

```ts
new EssentialsNotMetError(missing: readonly string[])   // extends TuiError
// methods & signals:
missing: readonly string[]
```

## EssentialsReport

The outcome of evaluating the runtime essentials against a capability profile + TTY facts.

```ts
interface EssentialsReport {
  met: boolean;   // True when every essential is satisfied (the SDK may start).
  missing: readonly string[];   // Names of the unmet essentials (empty when `met`).
  degradations: readonly Degradation[];   // Non-essential gaps the SDK degrades around (may be present even when `met`).
}
```

## FocusEvent

A terminal focus-gained / focus-lost report (emitted only when the host enables focus reporting).

```ts
interface FocusEvent {
  type: 'focus';
  focused: boolean;
}
```

## FocusHost

The focus seam an application hands to a router-style body so it can save and restore keyboard focus across navigation — restoring the exact field a warm screen had focused, or the same-position field of a rebuilt one.

```ts
interface FocusHost {
  focusView(view: View): void;   // Move keyboard focus to `view` (a no-op if the view is not currently mounted).
  getFocused(): View | null;   // The currently focused view, or `null` when nothing holds focus.
}
```

## FocusHostAware

Implemented by an application body (e.g. a router) that saves/restores focus across navigation.

```ts
interface FocusHostAware {
  attachFocusHost(host: FocusHost): void;   // Receive the application's focus seam. Called once by `createApplication` after the loop is built.
}
```

## GlyphCaps

Line/box glyph rendering capabilities.

```ts
interface GlyphCaps {
  boxDrawing: boolean;
  halfBlocks: boolean;
  ambiguousWide: boolean;   // True when the terminal renders the fallback-prone arrow/geometric chrome glyphs (`▲▼◄►•↑↕×`) as double-width. When true, the renderer swaps those glyphs for ASCII equivalents so the layout stays intact. Default `false`.
}
```

## Host

A running terminal host, returned by createHost .

```ts
interface Host {
  isTTY: boolean;   // True when both the bound output and input are a real TTY.
  start(): Promise<void>;   // Take over the terminal: bind streams, enter raw mode + the configured screen modes, install handlers. Idempotent.
  stop(): Promise<void>;   // Give the terminal back: leave modes, restore cooked mode / main screen / cursor, remove handlers. Idempotent; does not exit.
  render(buffer: ScreenBuffer, trailer?: string): void;   // Paint a frame. Diffs `buffer` against the previously rendered frame and writes only the changed cells as one coalesced write. `trailer` (optional) is appended to that same write — typically the show-and-move-cursor sequence — so the terminal never repaints between the damage and the cursor move (a separate write would flash the cursor at the last damaged cell for one frame). A trailer is written even when the diff is empty.
}
```

## HostFacts

The minimal TTY facts the gate reads.

```ts
interface HostFacts {
  isTTY: boolean;
}
```

## HostOptions

Options for createHost .

```ts
interface HostOptions {
  caps: CapabilityProfile;   // The detected capability profile; gates every terminal mode the host enables.
  input?: NodeJS.ReadStream;   // Input stream to read from. Default: `process.stdin` (or `/dev/tty` when stdout is piped).
  output?: NodeJS.WriteStream;   // Output stream to render to. Default: `process.stdout` (or `/dev/tty` when piped).
  preferDevTty?: boolean;   // When true (default) and stdout is piped but a controlling terminal exists, bind to `/dev/tty`.
  onInput?: (event: InputEvent) => void;   // Called with each decoded input event. Terminal query replies are handled internally and never delivered here.
  onResize?: (event: ResizeEvent) => void;   // Called with a terminal resize, coalesced so a burst of SIGWINCH yields a single event.
  onSuspend?: () => void;   // POSIX Ctrl+Z (SIGTSTP): fired just before the terminal is restored and the process suspends.
  onResume?: () => void;   // POSIX resume (SIGCONT): fired after modes are re-asserted and the last frame is repainted.
  onBeforeExit?: (code: number) => void;   // Runs just before the host calls `process.exit` on a signal or crash path (receives the exit code).
  exitOnSignal?: boolean;   // When false, terminating signals restore the terminal but do not call `process.exit`. Default true.
  focus?: boolean;   // Enable focus reporting (the terminal reports when it gains/loses focus). No capability models this, so it is a host policy rather than caps-gated. Default `true`.
  warnAmbiguousWidth?: boolean;   // Probe the terminal at startup for double-width chrome glyphs — East-Asian *Ambiguous* code points (e.g. `▲◄■▒`) that a font fallback or CJK locale renders two cells wide, shifting box/scroll chrome — and warn via onWidthWarning when found. Real TTY only; runs after raw mode and before the alternate screen, so the probe and its erase stay off your UI. Default `false` (the higher-level app runner turns this on). Detection is best-effort — a silent or non-TTY terminal never warns.
  adaptAmbiguousWidth?: boolean;   // Automatically switch to ASCII-safe chrome when the startup width probe finds that box/scroll glyphs render two cells wide: wide arrows turn on the `ambiguousWide` glyph flag, wide box/shade glyphs turn `boxDrawing`/`halfBlocks` off — so every frame stays aligned instead of shearing. Downgrade-only; the original caps are still used for input decoding, mode setup, and restore. Real TTY only, and it shares the single probe run with warnAmbiguousWidth. Default `false` (the higher-level app runner turns this on).
  env?: NodeJS.ProcessEnv;   // Environment to read the `JSVISION_ASCII` force switch from (NO_COLOR-style: its mere presence, with any value, turns it on). When set, the host renders fully ASCII-safe chrome and skips the width probe entirely. Default `process.env`. Presence-checked only — the value is never parsed or logged.
  onWidthWarning?: (message: string) => void;   // Where the startup width warning goes (see warnAmbiguousWidth). Default: one line to `process.stderr` (never the terminal's output stream). Provide your own to route it into a logger or custom reporting.
  runtime?: RuntimeAdapter;   // The OS boundary the host runs against. Defaults to the real Node runtime; inject a fake to test headlessly.
}
```

## HostSignal

The abstract, payload-free signal set the host reacts to.

```ts
type HostSignal = 'resize' | 'interrupt' | 'terminate' | 'hangup' | 'suspend' | 'continue'
```

## InitialRoute

The initial route for a router: a route name plus its params.

```ts
type InitialRoute<R> = {
  [K in keyof R]: { name: K } & (R[K] extends void ? { params?: undefined } : { params: R[K] });
}[keyof R]
```

## InputEvent

Any app-facing decoded event.

```ts
type InputEvent = KeyEvent | MouseEvent | WheelEvent | PasteEvent | FocusEvent
```

## InvalidColorError

Thrown when a color string is not a valid `#rgb`/`#rrggbb`, named, or `'default'` value.

```ts
new InvalidColorError()   // extends TuiError
```

## InvalidThemeError

Thrown when a serialized theme is structurally invalid, carries a malformed color/pattern/attribute, or names an unexpected role.

```ts
new InvalidThemeError()   // extends TuiError
```

## KEY_NAMES

The named (non-printable) keys the decoder can emit, all lowercase.

```ts
const KEY_NAMES: readonly ["up", "down", "left", "right", "enter", "tab", "backspace", "escape", "space", "home", "end", "pageup", "pagedown", "insert", "delete", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "f10", "f11", "f12"]
```

## KeyEvent

A printable character or named key press.

```ts
interface KeyEvent {
  type: 'key';
  key: string;   // Printable → the character; named key → a lowercase name (see KEY_NAMES).
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  codepoint?: number;   // Unicode code point when `key` is a printable character; omitted for named keys.
}
```

## KeyboardCaps

Keyboard-protocol capabilities.

```ts
interface KeyboardCaps {
  kittyFlags: boolean;
  modifyOtherKeys: boolean;
}
```

## Keymap

A compiled keymap: a pure lookup from a decoded KeyEvent to a bound name.

```ts
interface Keymap {
  lookup(event: KeyEvent): string | undefined;   // Return the bound name for the event's chord, or `undefined` if unbound.
}
```

## Keymap

A compiled keymap: a pure lookup from a decoded KeyEvent to a bound name.

```ts
interface Keymap {
  lookup(event: KeyEvent): string | undefined;   // Return the bound name for the event's chord, or `undefined` if unbound.
}
```

## LogLevel

Severity levels, coarsest to finest.

```ts
type LogLevel = 'error' | 'warn' | 'info' | 'debug'
```

## LogRecord

A single structured log record.

```ts
interface LogRecord {
  level: LogLevel;
  component: string;   // Subsystem tag, e.g. 'input' | 'gate' | 'host'.
  msg: string;
  fields?: Readonly<Record<string, unknown>>;   // Extra non-secret fields (e.g. a redacted event). Never raw input.
}
```

## LogSink

Where log records go: - `auto` — a file if a path is set, else stderr when it is a distinct device, else the ring. - `file` — append to `path` (or the `JSVISION_LOG` env var). - `stderr` — write to fd 2 (rejected if it is the same device as the screen). - `ring` — an in-memory buffer readable via Logger.entries (also self-enables).

```ts
type LogSink = 'auto' | 'file' | 'stderr' | 'ring'
```

## Logger

A screen-safe logger, returned by createLogger.

```ts
interface Logger {
  enabled: boolean;
  debug(component: string, msg: string, fields?: Record<string, unknown>): void;
  info(component: string, msg: string, fields?: Record<string, unknown>): void;
  warn(component: string, msg: string, fields?: Record<string, unknown>): void;
  error(component: string, msg: string, fields?: Record<string, unknown>): void;
  entries(): readonly LogRecord[];   // Ring sink only: the buffered records (oldest→newest). Empty otherwise. For tests.
  close(): void;   // Flush/close the sink (closes the file handle). Idempotent.
}
```

## LoggerConfigError

Thrown by createLogger when the configured log sink would resolve to the terminal's own output stream.

```ts
new LoggerConfigError()   // extends TuiError
```

## LoggerFs

The minimal filesystem interface the logger uses.

```ts
interface LoggerFs {
  openSync(path: string, flags: string): number;
  fstatSync(fd: number): { readonly dev: number; readonly ino: number };
  writeSync(fd: number, data: string): number;
  closeSync(fd: number): void;
}
```

## LoggerOptions

Options for createLogger; every field is optional (env supplies the defaults).

```ts
interface LoggerOptions {
  enabled?: boolean;   // Force enable/disable. Default: enabled iff `sink==='ring'` or `env.JSVISION_DEBUG==='1'`.
  level?: LogLevel;   // Minimum level emitted. Default: 'debug' when enabled.
  sink?: LogSink;   // Sink override. Default 'auto' (file if a path is set, else stderr-if-safe).
  path?: string;   // File path for the 'file' sink. Default: `env.JSVISION_LOG`.
  size?: number;   // Ring capacity in entries (sink==='ring'). Default 1024.
  env?: NodeJS.ProcessEnv;   // Environment to read flags from. Default: `process.env`. (Injectable for tests.)
  uiFd?: number;   // UI output stream fd to refuse (screen-safety guard). Default: stdout fd (1).
  fs?: LoggerFs;   // Filesystem seam (injectable for tests). Default: `node:fs`.
}
```

## ManagedTerminalQuery

A TerminalQuery with an explicit ManagedTerminalQuery.close to detach the input listener and end any active `read()` iteration.

```ts
interface ManagedTerminalQuery {
  close(): void;   // Detach the input 'data' listener and end any active `read()` iterator. Idempotent.
}
```

## MouseCaps

Mouse-reporting capabilities.

```ts
interface MouseCaps {
  sgr: boolean;
  drag: boolean;
  wheel: boolean;
}
```

## MouseEvent

A mouse button/motion report.

```ts
interface MouseEvent {
  type: 'mouse';
  kind: 'down' | 'up' | 'move' | 'drag';
  button: number;
  x: number;
  y: number;
  ctrl?: boolean;   // Ctrl held during the report (from the SGR button byte).
  alt?: boolean;   // Meta/Alt held during the report.
  shift?: boolean;   // Shift held during the report.
}
```

## NavArgs

The trailing arguments of a navigation call for a route with param type `P`: none for a `void` route, exactly `[params]` otherwise.

```ts
type NavArgs<P> = P extends void ? [] : [params: P]
```

## OscCaps

OSC (Operating System Command) escape-sequence capabilities.

```ts
interface OscCaps {
  hyperlink8: boolean;
  clipboard52: boolean;
  title: boolean;
  notify9: boolean;
  notify777: boolean;
  notify99: boolean;
  progress9_4: boolean;
}
```

## PALETTE

The classic DOS 16-color palette as ready-to-use `#rrggbb` colors.

```ts
const PALETTE: { readonly black: "#000000"; readonly blue: "#0000aa"; readonly green: "#00aa00"; readonly cyan: "#00aaaa"; readonly red: "#aa0000"; readonly magenta: "#aa00aa"; readonly brown: "#aa5500"; readonly lightGray: "#aaaaaa"; readonly darkGray: "#555555"; readonly brightBlue: "#5555ff"; readonly brightGreen: "#55ff55"; readonly brightCyan: "#55ffff"; readonly brightRed: "#ff5555"; readonly brightMagenta: "#ff55ff"; readonly yellow: "#ffff55"; readonly white: "#ffffff"; }
```

## PASTE_CAP_BYTES

Default bracketed-paste size cap in bytes.

```ts
const PASTE_CAP_BYTES: 1048576
```

## PRESET_SEEDS

The seed sets behind the createTheme -generated presets, keyed by name — the same `{ mode, accent, neutral, overrides }` options each curated theme is built from, exposed as data so a tool (e.g. a theme editor) can load a preset as an *editable* starting point rather than an opaque finished theme.

```ts
const PRESET_SEEDS: Record<
  | 'slate'
  | 'nord'
  | 'dracula'
  | 'solarized-dark'
  | 'gruvbox-dark'
  | 'janus'
  | 'warp'
  | 'solstice'
  | 'platinum'
  | 'workbench'
  | 'horizon',
  ThemeOptions
>
```

## PasteEvent

A completed bracketed paste.

```ts
interface PasteEvent {
  type: 'paste';
  text: string;
  truncated: boolean;
}
```

## PasteState

Internal bracketed-paste accumulation state.

```ts
interface PasteState {
  active: boolean;
  bytes: number[];
  truncated: boolean;
}
```

## Platform

Host platform, mirroring the supported values of `process.platform`.

```ts
type Platform = 'linux' | 'darwin' | 'win32'
```

## QueryResponse

A recognised terminal query reply (device attributes, version, mode report), used by capability detection.

```ts
interface QueryResponse {
  raw: Uint8Array;   // The raw recognised bytes, for the capability layer to parse further.
  kind: 'da1' | 'da2' | 'xtversion' | 'decrpm' | 'unknown';   // The reply classification.
}
```

## ReasonLayer

Which detection layer decided a given field, from highest precedence to lowest: an explicit `override`, a live `runtime` probe, an `env` variable, the known-terminal `table`, or the `default` baseline.

```ts
type ReasonLayer = 'override' | 'runtime' | 'env' | 'table' | 'default'
```

## RedactedEvent

A redacted, log-safe view of an input event — carries modifiers and coordinates, never raw content.

```ts
type RedactedEvent = | {
      readonly type: 'key';
      readonly key?: string;
      readonly printable?: true;
      readonly ctrl: boolean;
      readonly alt: boolean;
      readonly shift: boolean;
    }
  | { readonly type: 'mouse'; readonly kind: string; readonly button: number; readonly x: number; readonly y: number }
  | { readonly type: 'wheel'; readonly dir: string; readonly x: number; readonly y: number }
  | { readonly type: 'paste'; readonly length: number; readonly truncated: boolean }
  | { readonly type: 'focus'; readonly focused: boolean }
```

## RenderOptions

Options for serialize: the terminal capabilities plus an optional custom style encoder.

```ts
interface RenderOptions {
  caps: CapabilityProfile;   // Resolved terminal capabilities (color depth, glyph support, synchronized output).
  encodeStyle?: StyleEncoder;   // Custom style encoder; defaults to the depth-aware defaultEncodeStyle.
}
```

## ResizeEvent

A terminal resize, delivered via SIGWINCH (POSIX) or a stdout 'resize' event (Windows).

```ts
interface ResizeEvent {
  type: 'resize';
  columns: number;   // New terminal width in columns.
  rows: number;   // New terminal height in rows.
}
```

## ResolveOptions

Options for the capability resolvers; every input is injectable.

```ts
interface ResolveOptions {
  override?: DeepPartial<CapabilityProfile>;   // Force any subset of fields, bypassing detection (deep-merged over the result).
  env?: NodeJS.ProcessEnv;   // Environment to read from; defaults to `process.env`.
  platform?: Platform;   // Platform to assume; defaults to `process.platform`.
  query?: TerminalQuery;   // Live-query seam for runtime probing; when absent, the live probe is skipped.
  timeoutMs?: number;   // Live-query timeout in milliseconds (default 200).
  refresh?: boolean;   // Force re-detection, ignoring the per-process cache.
}
```

## Rgb

RGB components, each an integer 0–255.

```ts
interface Rgb {
  r: number;
  g: number;
  b: number;
}
```

## Route

A route definition: how to build the screen for a set of params, plus optional keep-alive, focus, and (de)serialization behavior.

```ts
interface Route<P> {
  build: (ctx: RouteContext<P>) => ScreenBundle;   // Build this route's screen bundle for the given params. Called on each activation unless kept alive.
  keepAlive?: boolean;   // Keep the screen mounted-but-hidden when navigating away, so its state survives a round-trip. Default off.
  focusKey?: (view: View) => string;   // Optional exact-restore key: derive a stable key from the focused view so focus survives a rebuild.
  serialize?: (params: P) => string;   // Optional codec: serialize this route's params to a string (designed for deep-linking).
  parse?: (s: string) => P;   // Optional codec: parse this route's params back from a string.
}
```

## RouteContext

The context a route's `build` receives: the typed params the screen was navigated to.

```ts
interface RouteContext<P> {
  params: P;   // The params the route was entered with.
}
```

## RouteMap

The route table: one Route per key of the `Routes` map, typed to that route's params.

```ts
type RouteMap<R> = { [K in keyof R]: Route<R[K]> }
```

## Router

A navigation / screen router.

```ts
new Router<R>(opts: RouterOptions<R>)   // extends Group
// methods & signals:
push(name: K, ...args: NavArgs<R[K]>): void
replace(name: K, ...args: NavArgs<R[K]>): void
reset(name: K, ...args: NavArgs<R[K]>): void
back(): boolean
location(): RouterLocation<R>
canGoBack(): boolean
```

## RouterLocation

The reactive current location: the top route's name and the params it was entered with.

```ts
interface RouterLocation<R> {
  name: keyof R;   // The current route name.
  params: R[keyof R];   // The current params.
}
```

## RouterOptions

Options for `createRouter`.

```ts
interface RouterOptions<R> {
  initial: InitialRoute<R>;   // The route to show first (structured + typed, so it can carry params).
  routes: RouteMap<R>;   // The route table.
  logger?: Logger;   // Optional logger for isolated `build` errors; defaults to the framework's screen-safe logger.
}
```

## RuntimeAdapter

The injectable OS boundary the host runs against.

```ts
interface RuntimeAdapter {
  platform: 'linux' | 'darwin' | 'win32';   // The OS the adapter targets; selects the per-OS signal source map.
  setRawMode(stream: NodeJS.ReadStream, on: boolean): void;   // Put the input stream in or out of raw mode. Guarded so it is a no-op on a non-TTY.
  on(event: HostSignal, handler: () => void): () => void;   // Subscribe to a payload-free signal/resize source; returns an unsubscribe function.
  onUncaughtException(handler: (err: unknown) => void): () => void;   // Subscribe to an uncaught exception; the handler receives the thrown value.
  onUnhandledRejection(handler: (reason: unknown) => void): () => void;   // Subscribe to an unhandled promise rejection; the handler receives the reason.
  suspendSelf(): void;   // Suspend the current process (real: `process.kill(pid, 'SIGSTOP')`), used for Ctrl+Z.
  scheduleImmediate(fn: () => void): void;   // Schedule a callback to run after the current turn (real: `setImmediate`), used to coalesce resizes.
  setTimer(fn: () => void, ms: number): TimerHandle;   // Arm a timer (real: `setTimeout`), used for the lone-ESC disambiguation window; returns a clearable handle.
  clearTimer(handle: TimerHandle): void;   // Clear a timer previously armed by setTimer (real: `clearTimeout`).
  onProcessExit(handler: () => void): () => void;   // Register a last-resort restore to run on process exit (real: `process.on('exit')`); returns an unsubscribe.
  writeSync(fd: number, data: string): void;   // Synchronously write to a file descriptor (real: `fs.writeSync`). Used only by the on-exit restore backstop, where the event loop is draining and an async write would never flush. Synchronous on every platform.
  exit(code: number): never;   // Terminate the process (real: `process.exit`).
  writeError(message: string): void;   // Write a diagnostic line to stderr (real: `process.stderr.write`). Never receives raw input.
  warn(message: string): void;   // Best-effort warning channel (e.g. a legacy Windows console without VT processing). Never logs input.
}
```

## SGR_RESET

Reset all SGR attributes (`CSI 0 m`).

```ts
const SGR_RESET: "\u001B[0m"
```

## SYNC_BEGIN

Begin a synchronized update (`CSI ?2026 h`); the terminal buffers until end.

```ts
const SYNC_BEGIN: "\u001B[?2026h"
```

## SYNC_END

End a synchronized update (`CSI ?2026 l`); the terminal paints atomically.

```ts
const SYNC_END: "\u001B[?2026l"
```

## ScreenBuffer

A mutable 2-D grid of styled cells — the surface you draw a frame onto before handing it to serialize for painting.

```ts
new ScreenBuffer(width: number, height: number, fill: Style & { char?: string })
// methods & signals:
width: number
height: number
set(x: number, y: number, char: string, style: Style, widthMode: WidthMode = DEFAULT_WIDTH_MODE): void
get(x: number, y: number): Cell | undefined
fillRect(x: number, y: number, w: number, h: number, char: string, style: Style): void
text(x: number, y: number, str: string, style: Style, widthMode: WidthMode = DEFAULT_WIDTH_MODE): number
box(x: number, y: number, w: number, h: number, style: Style, variant: 'single' | 'double' = 'single', title?: string): void
shadow(x: number, y: number, w: number, h: number, style: Style): void
rows(): readonly Cell[][]
clone(): ScreenBuffer
```

## ScreenBundle

What a route's `build` returns: the screen view plus its optional per-screen chrome.

```ts
interface ScreenBundle {
  view: View;   // The full-screen view for this screen.
  status?: View[];   // Optional status-line items for this screen; omit to keep the app base.
  menu?: MenuItem[];   // Optional menu-bar items for this screen; omit to keep the app base.
}
```

## StreamOptions

The stream-related subset of HostOptions — enough for detectTty to run the same binding logic the host uses, before the host is started.

```ts
interface StreamOptions {
  input?: NodeJS.ReadStream;   // Input stream. Default: `process.stdin`.
  output?: NodeJS.WriteStream;   // Output stream. Default: `process.stdout`.
  preferDevTty?: boolean;   // When true (default) and stdout is piped but a controlling terminal exists, bind to `/dev/tty`.
}
```

## Style

A foreground/background/attribute style; used by every drawing helper.

```ts
interface Style {
  fg: Color;
  bg: Color;
  attrs?: AttrMask;   // Attribute bitmask; defaults to `Attr.none`.
}
```

## Style

A foreground/background/attribute style; used by every drawing helper.

```ts
interface Style {
  fg: Color;
  bg: Color;
  attrs?: AttrMask;   // Attribute bitmask; defaults to `Attr.none`.
}
```

## StyleEncoder

Encodes a cell's foreground/background/attributes to an SGR escape sequence for the terminal's color depth.

```ts
type StyleEncoder = (fg: Color, bg: Color, attrs: AttrMask, caps: CapabilityProfile) => string
```

## SyncResolveOptions

Options for the synchronous resolveCapabilities.

```ts
type SyncResolveOptions = Omit<ResolveOptions, 'query' | 'timeoutMs'>
```

## TerminalQuery

A minimal byte-stream seam for probing the terminal at runtime.

```ts
interface TerminalQuery {
  write(data: string): void;   // Write a query request (e.g. a DA request) to the terminal.
  read(): AsyncIterable<Uint8Array>;   // Async iterator of raw bytes received from the terminal.
}
```

## TerminalQueryOptions

Options for createTerminalQuery.

```ts
interface TerminalQueryOptions {
  input?: NodeJS.ReadableStream;   // Stream to read terminal responses from. Default: `process.stdin`.
  output?: NodeJS.WritableStream;   // Stream to write query requests to. Default: `process.stdout`.
}
```

## Theme

Named semantic UI roles mapped to colors.

```ts
interface Theme {
  desktop: ThemeRole & { readonly pattern: string };   // The desktop fill: a role plus the repeating pattern glyph tiled across it.
  menuBar: ThemeRole;   // The top menu bar.
  menuSelected: ThemeRole;   // The highlighted (hovered/open) menu item.
  window: ThemeRole & { readonly border: Color; readonly title: Color; readonly icon: Color };   // The active (focused) window chrome. `border`/`title` color the frame lines and title text; `icon` is the brighter accent used for the close/zoom glyphs and the resize grips so they stand out from the frame.
  windowInactive: ThemeRole & { readonly border: Color; readonly title: Color; readonly icon: Color };   // The **inactive** (background) window chrome — the same shape as window (fg/bg + border/title + icon) but dimmed, so a background window reads as distinct from the focused one. `icon` is present for shape symmetry but an inactive window draws no title-bar icons.
  dialog: ThemeRole & { readonly border: Color; readonly title: Color; readonly icon: Color };   // The gray dialog chrome. `border`/`title` color the frame lines and title; `icon` is the accent for the close-box `[×]` glyph. The gray dialog palette is deliberately distinct from the blue window.
  button: ThemeRole;   // A normal command button face.
  buttonFocused: ThemeRole;   // A focused command button face.
  staticText: ThemeRole;   // Static (non-interactive) text: black on lightGray.
  label: ThemeRole;   // A control label's normal text: black on lightGray.
  labelSelected: ThemeRole;   // A label when its linked control is focused: white on lightGray.
  labelShortcut: ThemeRole;   // A label's `~hotkey~` accent character: yellow on lightGray.
  buttonDefault: ThemeRole;   // The default button's face when unfocused: brightCyan on green.
  buttonDisabled: ThemeRole;   // A disabled button's face: darkGray on lightGray.
  buttonShortcut: ThemeRole;   // A button's `~hotkey~` accent character: yellow on green.
  buttonShadow: ThemeRole;   // The button's drop-shadow blocks (`▄`/`█`/`▀`): black on lightGray. Painting black block glyphs over the dialog's own gray field produces the shadow. This is NOT the window drop-shadow (shadow, darkGray on black).
  clusterNormal: ThemeRole;   // A check/radio cluster item, normal: black on cyan.
  clusterSelected: ThemeRole;   // A check/radio cluster item, focused: white on cyan.
  clusterShortcut: ThemeRole;   // A cluster item's `~hotkey~` accent: yellow on cyan.
  clusterDisabled: ThemeRole;   // A disabled cluster item: darkGray on cyan.
  inputNormal: ThemeRole;   // An input-line field, unfocused: white on blue. A focused field uses the same color (inputSelected) — focus is signalled by the blinking caret, not by a color change. The reverse-video highlight over a text selection is a separate role, inputSelection.
  inputSelected: ThemeRole;   // An input-line field, focused: white on blue — the same as inputNormal.
  inputSelection: ThemeRole;   // The highlight band over selected text inside an input line: white on green. Distinct from the focused **field** color (inputSelected).
  inputArrows: ThemeRole;   // The input-line `◄`/`►` scroll arrows shown when text overflows: brightGreen on blue.
  inputPlaceholder: ThemeRole;   // The muted hint text shown in an empty input line (its placeholder): a dimmed, secondary foreground on the input field's own background — visible but clearly not the typed value.
  scrollBarPage: ThemeRole;   // A scrollbar's track / page area (the `▒`/`▓` fill): cyan on blue. The track and the controls share a color; the glyph (`■` thumb vs `▒` track) is the visual distinction.
  scrollBarControls: ThemeRole;   // A scrollbar's controls — the `▲▼◄►` arrows and the `■` thumb: cyan on blue.
  listNormal: ThemeRole;   // A list's normal (unfocused) row: black on cyan.
  listFocused: ThemeRole;   // A list's focused row — the primary focus signal in color mode: white on green.
  listSelected: ThemeRole;   // A list's selected row: yellow on cyan.
  listDivider: ThemeRole;   // A list's inter-column divider `│` (unused for a single-column list): blue on cyan.
  tableHeader: ThemeRole;   // A data-grid header row: white on cyan — a bright heading over the same cyan field as the listNormal rows, distinct from both normal (black-on-cyan) and selected (yellow-on-cyan) rows.
  historyButtonSides: ThemeRole;   // The history dropdown button's `▐`/`▌` half-block sides: green on lightGray.
  historyButtonArrow: ThemeRole;   // The history dropdown button's `↓` arrow: black on green.
  historyWindow: ThemeRole & { readonly border: Color; readonly icon: Color };   // The history popup window — the same shape as window (interior fg/bg + `border` + `icon`). It renders as a **blue** window (white-on-blue border, brightGreen icon accent) even when opened from a gray dialog.
  historyViewer: ThemeRole;   // A history list's normal (unfocused) row: white on blue.
  historyViewerFocused: ThemeRole;   // A history list's focused row: white on green.
  outlineNormal: ThemeRole;   // An outline/tree normal row (an expanded node or a leaf): yellow on blue.
  outlineFocused: ThemeRole;   // An outline/tree focused row — a distinct inverted bar: blue on lightGray.
  outlineSelected: ThemeRole;   // An outline/tree selected row: brightGreen on blue.
  outlineNotExpanded: ThemeRole;   // An outline/tree collapsed-node's text: white on blue.
  tabActive: ThemeRole;   // The active (selected) tab — the brighter, "raised" button face: white on green, with a yellow accent for the `~X~` hotkey letter.
  tabInactive: ThemeRole;   // An inactive tab — the normal button face: black on green, with a yellow `~X~` hotkey accent.
  tabDisabled: ThemeRole;   // A disabled tab — dimmed but kept on the green field so it stays part of the strip: darkGray on green.
  progressFill: ThemeRole;   // A progress bar's filled portion: brightCyan on blue — a brighter sibling of scrollBarPage. Paints the `█`/eighth-block sub-cell fill (and the whole-cell `#` fill in ASCII mode).
  progressTrack: ThemeRole;   // A progress bar's unfilled track: cyan on blue (identical to scrollBarPage), so the fill reads brighter than the track on the shared blue field. Paints the `░` track (and the whole-cell `-` track in ASCII mode).
  sliderTrack: ThemeRole;   // A slider's groove — the `─`/`│` rule the thumb travels along: a dim darkGray-on-lightGray line on the gray dialog field where sliders live.
  sliderThumb: ThemeRole;   // A slider's thumb — the `█` block marking the current value: a solid blue-on-lightGray block, brighter than the sliderTrack groove.
  calendarNormal: ThemeRole;   // A calendar's in-month day cell (normal): yellow on cyan.
  calendarToday: ThemeRole;   // A calendar's "today" cell — the highlighted current date: blue on green.
  calendarSelected: ThemeRole;   // A calendar's selected day — the committed value cell: white on blue, a distinct blue cell against the cyan grid. Takes precedence over calendarToday when they coincide.
  calendarCursor: ThemeRole;   // A calendar's focus cursor — the navigable focus cell, drawn **only while the calendar has focus**, at highest precedence: black on white (a filled reverse block) so the focused day reads as a solid highlight against the cyan grid.
  calendarDisabled: ThemeRole;   // A calendar's disabled day — dimmed but still navigable: darkGray on cyan.
  calendarWeekNumber: ThemeRole;   // A calendar's ISO week-number column (the opt-in leading `NN` column): black on cyan.
  colorMarker: ThemeRole;   // The forced-contrast `◘` selection marker drawn on a near-black color-swatch cell: black on lightGray, so the marker stays visible against the dark cell. A normal (non-dark) cell's marker uses the cell's own color instead.
  gridCursor: ThemeRole;   // The focused **cell** highlight in an editable data grid — a filled black-on-white reverse block drawn over the focused row so the cursor cell reads distinctly inside the row highlight. Painted only while the grid body has focus.
  gridDirty: ThemeRole;   // The pending-commit marker colour in an editable data grid: the `•` drawn on a cell whose edit has not yet been confirmed. Its foreground is composited over the cell's own background at draw time, so the stored background is nominal.
  gridSelectedRow: ThemeRole;   // A selected row in an editable data grid — the multi-row selection highlight, a solid band distinct from both the focused-cell gridCursor and the base list's listSelected: bright white on blue. It carries its own background (not `listSelected`'s cyan, which matches a normal row), so a selected row reads clearly even against zebra striping. Painted for every row whose key is in the selection set; the focused-cell cursor and the pending-commit marker win over it.
  gridInvalid: ThemeRole;   // A cell whose edit failed validation in an editable data grid — a solid band (white on a deep red), distinct from both the gridDirty pending-commit marker (a `•`, not a band) and the gridCursor focus. Painted over the whole invalid cell so a rejected value reads as a hard error; it wins over the dirty marker but yields to the focused-cell cursor.
  fileInfo: ThemeRole;   // A file dialog's info pane — the strip below the dialog that reads out the expanded path and the focused entry's name/size/date/time: cyan on blue.
  editorNormal: ThemeRole;   // Editor text — an editor/memo body's normal cell: yellow on blue.
  editorSelected: ThemeRole;   // Editor selected text — the reverse-video selection band: blue on lightGray.
  memoNormal: ThemeRole;   // A dialog-embedded memo's normal cell: black on cyan.
  memoSelected: ThemeRole;   // A memo's selected text: white on green.
  indicatorNormal: ThemeRole;   // The `line:col` indicator in an editor window's bottom border, at rest: white on blue, drawn over a `═` fill while the window is not being dragged.
  indicatorDragging: ThemeRole;   // The `line:col` indicator while its window is being dragged: brightGreen on blue, drawn over a `─` fill.
  terminalNormal: ThemeRole;   // Terminal text — a streaming log sink's normal cell: yellow on blue.
  statusBar: ThemeRole;   // The status line.
  statusSelected: ThemeRole;   // The status-line **pressed/selected** item (mouse-down feedback): black on green, with a red-on-green hotkey run. The pressed counterpart of statusBar, mirroring how menuSelected relates to menuBar.
  shadow: ThemeRole;   // The window drop-shadow: darkGray on black.
  splitter: ThemeRole;   // A split-pane divider at rest: lightGray on blue, drawn over the divider's `│` (row split) or `─` (col split) fill, with a `▓` grab mark at its midpoint.
  splitterDragging: ThemeRole;   // A split-pane divider while it is being dragged: brightGreen on blue — the dragging counterpart of splitter, mirroring how indicatorDragging relates to indicatorNormal.
  dangerText: ThemeRole;   // Danger/error body text — a validation error or alert line: danger-red on the static-text field.
  warningText: ThemeRole;   // Advisory/warning body text — a non-blocking caution: amber on the static-text field.
}
```

## ThemeColors

The 18 semantic color aliases a generated theme is built from.

```ts
interface ThemeColors {
  foreground: Color;   // Primary body text — the default readable foreground on a normal surface.
  foregroundMuted: Color;   // De-emphasized text — captions, dividers, inactive titles; sits on the same surfaces as foreground.
  foregroundDisabled: Color;   // Disabled text — a greyed control's label; deliberately low-contrast.
  foregroundOnAccent: Color;   // Text drawn *on* the accent fill — a button caption, a focused row; must contrast the accent.
  background: Color;   // The base backdrop — the desktop field behind all windows.
  backgroundRaised: Color;   // A raised surface — window/dialog interiors, menus, list bodies; sits above background.
  backgroundSunken: Color;   // A sunken surface — the well of an input/editor field, visually recessed below backgroundRaised.
  backgroundSelected: Color;   // A selected-but-unfocused row's fill — a quiet highlight distinct from the accent focus fill.
  accent: Color;   // The brand/focus color — focused rows, the default button, selected menu/tab fills.
  accentMuted: Color;   // A dimmer/pressed step of accent — a focused button face, an inactive tab.
  accelerator: Color;   // The highlighted hotkey letter of an in-dialog control — a focused button, a tab, a label/cluster shortcut.
  menuAccelerator: Color;   // The highlighted hotkey letter of the global chrome — the menu bar and the status line.
  border: Color;   // Frame and border lines on an active surface.
  borderMuted: Color;   // Dimmed border lines — an inactive window frame, an inter-column divider.
  danger: Color;   // Danger / destructive signal — error emphasis, a destructive action. Drives the `dangerText` UI role.
  warning: Color;   // Warning / attention signal. Drives the `warningText` UI role.
  success: Color;   // Success / positive signal — a completed action, a drag-in-progress indicator.
  info: Color;   // Informational signal — a "today" marker, a neutral highlight.
}
```

## ThemeOptions

Seed colors and override hooks for createTheme.

```ts
interface ThemeOptions {
  mode: 'light' | 'dark';   // Light or dark: inverts which end of the neutral ramp becomes surface vs. text.
  accent: Color;   // The brand/accent seed — a resolvable color (hex or named), **not** `'default'`.
  neutral?: Color;   // Neutral seed for the surface/text ramp; defaults to a mode-neutral gray. Low-chroma works best.
  accelerator?: Color;   // In-dialog control hotkey (accelerator) seed; defaults to an amber. Independent of `warning`.
  menuAccelerator?: Color;   // Menu-bar / status-line hotkey (accelerator) seed; defaults to a red. Independent of `danger`.
  danger?: Color;   // Danger signal seed; defaults to a red. Drives the `dangerText` role a `Text` paints at `severity: 'error'`.
  warning?: Color;   // Warning signal seed; defaults to an amber. Drives the `warningText` role a `Text` paints at `severity: 'warning'`.
  success?: Color;   // Success signal seed; defaults to a green.
  info?: Color;   // Info signal seed; defaults to a blue.
  overrides?: Partial<ThemeColors>;   // Per-alias overrides merged after generation — an overridden alias re-drives every role that uses it.
  roleOverrides?: RoleOverrides;   // Per-role overrides deep-merged last — surgical single-role/single-field fixes. Each role is optional, and so is each field within it: patching one field leaves the rest of that role as generated. `Partial<Theme>` cannot express that — it would make every field of a named role mandatory, forcing a caller to restate the values it does not want to change.
}
```

## ThemeRole

A foreground/background pair (+ optional hotkey accent) for a UI surface.

```ts
interface ThemeRole {
  fg: Color;
  bg: Color;
  hotkey?: Color;   // Accent color for a highlighted hotkey character, when the role has one.
  attrs?: AttrMask;   // Optional text-attribute mask (dim/bold/italic/underline/…) applied when the role is painted. Omitted on every defaultTheme role; an attribute-driven theme (e.g. a monochrome preset) uses it to distinguish states without color. Attributes render even at `mono` depth.
}
```

## TimerHandle

Opaque timer handle returned by RuntimeAdapter.setTimer.

```ts
type TimerHandle = unknown
```

## TuiError

Base class for every error the SDK throws.

```ts
new TuiError(message: string)   // extends Error
```

## UnicodeCaps

Unicode rendering capabilities.

```ts
interface UnicodeCaps {
  utf8: boolean;
  widthMode: 'wcwidth' | 'ambiguous-wide';
  emoji: 'narrow' | 'wide' | 'unknown';
}
```

## VERSION

The published package version of `@jsvision/core`.

```ts
const VERSION: "1.1.0"
```

## VERSION

The package version of `@jsvision/ui`.

```ts
const VERSION: "1.1.0"
```

## WIDTH_ADAPTED_MESSAGE

The one-line console notice emitted when a wide group is found AND auto-adapted.

```ts
const WIDTH_ADAPTED_MESSAGE: string
```

## WIDTH_WARNING_MESSAGE

The one-line console warning emitted when a wide group is found but NOT adapted.

```ts
const WIDTH_WARNING_MESSAGE: string
```

## WheelEvent

A wheel/scroll report.

```ts
interface WheelEvent {
  type: 'wheel';
  dir: 'up' | 'down' | 'left' | 'right';
  x: number;
  y: number;
  shift: boolean;   // Shift held during the wheel report.
  alt: boolean;   // Meta/Alt held during the wheel report.
  ctrl: boolean;   // Ctrl held during the wheel report.
}
```

## WidthMode

Width-resolution mode.

```ts
type WidthMode = 'wcwidth' | 'ambiguous-wide'
```

## WidthProbeGroupResult

Per-group width measurement (arrows or boxes).

```ts
interface WidthProbeGroupResult {
  expectedWidth: number;   // The group's code-point count — the advance a narrow-rendering terminal produces.
  measuredWidth: number | null;   // The measured column advance for this group, or `null` when the terminal did not answer.
  wide: boolean;   // True iff the measured advance exceeds expectedWidth (this group renders wide).
}
```

## WidthProbeOptions

Options for probeAmbiguousWidth.

```ts
interface WidthProbeOptions {
  arrowGlyphs?: string;   // Group-1 probe string (default AMBIGUOUS_PROBE_GLYPHS); measured by code-point count.
  boxGlyphs?: string;   // Group-2 probe string (default BOX_PROBE_GLYPHS); measured by code-point count.
  timeoutMs?: number;   // Whole-probe timeout in ms (default DEFAULT_WIDTH_PROBE_TIMEOUT_MS), shared by both groups.
}
```

## WidthProbeResult

The outcome of a two-group ambiguous-width probe.

```ts
interface WidthProbeResult {
  probed: boolean;   // True only when the terminal answered BOTH groups with usable position reports.
  arrows: WidthProbeGroupResult;   // The arrow/geometric chrome group.
  boxes: WidthProbeGroupResult;   // The box-drawing + shade group.
}
```

## WidthWarnOptions

Options for warnIfAmbiguousWide: the probe options plus a warning sink + variant.

```ts
interface WidthWarnOptions {
  warn?: (message: string) => void;   // Warning sink (default: a single line to `process.stderr`). Injected for tests.
  adapted?: boolean;   // When true, the emitted message reports automatic adaptation (WIDTH_ADAPTED_MESSAGE).
}
```

## aliasesFromSeeds

Derive the 18 semantic ThemeColors aliases from a set of seeds — the step createTheme runs before it merges `overrides` and expands the roles.

```ts
aliasesFromSeeds(options: ThemeOptions): ThemeColors
```

## assertEssentials

Assert the essentials before starting: throws EssentialsNotMetError when the terminal is unusable, otherwise returns the report.

```ts
assertEssentials(caps: CapabilityProfile, facts: HostFacts, options?: { readonly logger?: Logger }): EssentialsReport
```

## bell

Emit a literal terminal bell (`\x07`).

```ts
bell(): string
```

## charWidth

Display width of a Unicode code point.

```ts
charWidth(codepoint: number, widthMode: WidthMode): 0 | 1 | 2
```

## classicTheme

The classic DOS "gray dialog / blue window" theme — an alias of defaultTheme and the render-root default.

```ts
const classicTheme: Theme
```

## contrastRatio

Compute the WCAG 2.x contrast ratio between two colors, `1` (identical) to `21` (black on white).

```ts
contrastRatio(a: Color, b: Color): number
```

## createDecoderState

Create a fresh, empty decoder state to pass into the first decode call: no carried bytes, no in-progress paste, not resyncing.

```ts
createDecoderState(): DecoderState
```

## createHost

Create a terminal host.

```ts
createHost(options: HostOptions): Host
```

## createKeymap

Build a keymap from chord→name bindings.

```ts
createKeymap(bindings: Readonly<Record<string, string>>): Keymap
```

## createKeymap

Build a keymap from chord→name bindings.

```ts
createKeymap(bindings: Readonly<Record<string, string>>): Keymap
```

## createLogger

Create a screen-safe logger. **Enablement.** Off unless you pass `enabled: true`, set `JSVISION_DEBUG=1`, or choose `sink: 'ring'`.

```ts
createLogger(options: LoggerOptions = {}): Logger
```

## createRouter

Create a navigation / screen router — a full-screen screen stack that mounts as an application's `content` body.

```ts
createRouter<R>(opts: RouterOptions<R>): Router<R>
```

## createTerminalQuery

Create a real, tty-backed TerminalQuery over a pair of Node streams.

```ts
createTerminalQuery(options: TerminalQueryOptions = {}): ManagedTerminalQuery
```

## createTheme

Build a complete Theme from seed colors.

```ts
createTheme(options: ThemeOptions): Theme
```

## cursor

Capability-independent cursor controls (show/hide/absolute move).

```ts
const cursor: { readonly show: () => string; readonly hide: () => string; readonly to: (row: number, col: number) => string; }
```

## cursorTo

Absolute cursor move to a **1-based** (row, col) (`CSI row;col H`).

```ts
cursorTo(row: number, col: number): string
```

## darken

Darken a color by lowering its OKLab lightness.

```ts
darken(color: Color, amount: number): Color
```

## decode

Decode a chunk of terminal bytes into input events.

```ts
decode(bytes: Uint8Array, state: DecoderState, options?: DecodeOptions): DecodeResult
```

## defaultEncodeStyle

The default style encoder: depth-aware, downsampling truecolor→256→16→mono and merging attributes + foreground + background into one SGR sequence.

```ts
const defaultEncodeStyle: StyleEncoder
```

## defaultTheme

The classic DOS text-mode look — a "gray dialog / blue window" theme ready to use as-is or as the base for your own.

```ts
const defaultTheme: Theme
```

## degradeCapsForWidth

Apply a probe outcome to a capability profile — downgrade only, never upgrade.

```ts
degradeCapsForWidth(caps: CapabilityProfile, result: WidthProbeResult): CapabilityProfile
```

## degradeCapsFully

Force a capability profile fully ASCII-safe: box-drawing and half-blocks off, ambiguous-wide on, so every chrome glyph maps to plain ASCII when rendered.

```ts
degradeCapsFully(caps: CapabilityProfile): CapabilityProfile
```

## detectTty

Check whether the app has an interactive terminal, **before** starting the host.

```ts
detectTty(options: StreamOptions = {}): boolean
```

## draculaTheme

The Dracula palette — a dark theme with its signature purple accent and `#282a36` background pinned.

```ts
const draculaTheme: Theme
```

## dumpCaps

Render a one-line, secret-free summary of a resolved capability profile — handy for a single debug log line explaining what the SDK detected and *why* (which resolution layer decided each value).

```ts
dumpCaps(resolution: CapabilityResolution): string
```

## encode

Encode ONE color to a standalone ANSI escape sequence for the given depth, downsampling automatically when the depth is lower than truecolor.

```ts
encode(color: Color, role: ColorRole, depth: ColorDepth): string
```

## encodeStyle

Merge text attributes + foreground + background into ONE escape sequence, downsampled to the terminal's color depth.

```ts
encodeStyle(fg: Color, bg: Color, attrs: AttrMask, caps: CapabilityProfile): string
```

## essentialsMet

Convenience boolean — true when every essential is satisfied.

```ts
essentialsMet(caps: CapabilityProfile, facts: HostFacts): boolean
```

## evaluateEssentials

Evaluate the runtime essentials against a capability profile and TTY facts, without throwing.

```ts
evaluateEssentials(caps: CapabilityProfile, facts: HostFacts): EssentialsReport
```

## fallbackGlyph

Substitute a glyph for the terminal's capabilities.

```ts
fallbackGlyph(char: string, caps: CapabilityProfile): string
```

## flush

Resolve a held, ambiguous trailing `ESC` as a standalone Escape keypress.

```ts
flush(state: DecoderState, options?: DecodeOptions): DecodeResult
```

## gruvboxDarkTheme

The Gruvbox Dark palette — a warm retro dark theme with its `bg0` background and amber accent pinned.

```ts
const gruvboxDarkTheme: Theme
```

## horizonTheme

A modern enterprise-software theme — a dark-blue shell field, white cards, and a clear corporate blue accent for the primary button, focus, and selection.

```ts
const horizonTheme: Theme
```

## hyperlink

Emit an OSC 8 hyperlink wrapping `text` with `url`.

```ts
hyperlink(text: string, url: string, caps: CapabilityProfile): string
```

## isAsciiSafe

Whether a capability profile already renders as pure ASCII, so the width probe can be skipped with nothing to learn or swap.

```ts
isAsciiSafe(caps: CapabilityProfile): boolean
```

## janusTheme

A retro PC-desktop theme — a teal field, silver 3D chrome, black text, and a navy highlight for the primary button, focus, and selection.

```ts
const janusTheme: Theme
```

## lighten

Lighten a color by raising its OKLab lightness.

```ts
lighten(color: Color, amount: number): Color
```

## mix

Blend two colors in OKLab space.

```ts
mix(a: Color, b: Color, t: number): Color
```

## monochromeTheme

A color-free theme that distinguishes state by **text attribute** (reverse / bold / dim / underline) rather than hue — the readable choice on a monochrome terminal, and a working demonstration of the ThemeRole `attrs` axis.

```ts
const monochromeTheme: Theme
```

## nearest16

Find the ANSI-16 palette index (0–15) closest to an RGB color, where 0–7 are the normal colors and 8–15 the bright variants.

```ts
nearest16(rgb: Rgb): number
```

## nearest256

Find the xterm-256 palette index (0–255) closest to an RGB color.

```ts
nearest256(rgb: Rgb): number
```

## nordTheme

The Nord palette — a cool arctic dark theme, with its canonical `nord0` background, `snow storm` foreground, and `frost` accent pinned.

```ts
const nordTheme: Theme
```

## notify

Emit a desktop notification via the first protocol the terminal supports (Kitty, iTerm2, urxvt, or Windows Terminal/ConEmu), falling back to a single bell when none is available.

```ts
notify(title: string, body: string, caps: CapabilityProfile): string
```

## parseCursorPosition

Parse the first Cursor-Position-Report (`ESC [ <row> ; <col> R`) out of a byte buffer, ignoring any surrounding bytes.

```ts
parseCursorPosition(buf: Uint8Array): CursorPosition | null
```

## parseTheme

Parse a serialized theme, validating every field, and return a complete Theme.

```ts
parseTheme(json: string): Theme
```

## platinumTheme

A classic-Mac Platinum theme — crisp grayscale surfaces with a restrained highlight blue for the primary button, focus, and selection.

```ts
const platinumTheme: Theme
```

## probeAmbiguousWidth

Measure how many columns each probe group advances on the live terminal.

```ts
probeAmbiguousWidth(query: TerminalQuery, options: WidthProbeOptions = {}): Promise<WidthProbeResult>
```

## ramp

Generate `steps` perceptually-even shades of a seed color, dark → light.

```ts
ramp(seed: Color, steps: number): Color[]
```

## redactEvent

Reduce a decoded input event to a shape that is safe to log — drops any raw content while keeping the structural facts (modifiers, coordinates, lengths) useful for debugging.

```ts
redactEvent(event: InputEvent): RedactedEvent
```

## resolveCapabilities

Detect the running terminal's capabilities **synchronously** from environment variables and the known-terminal table.

```ts
resolveCapabilities(options: SyncResolveOptions = {}): CapabilityResolution
```

## resolveCapabilities

Detect the running terminal's capabilities **synchronously** from environment variables and the known-terminal table.

```ts
resolveCapabilities(options?: SyncResolveOptions): CapabilityResolution
```

## resolveCapabilitiesAsync

Detect the running terminal's capabilities **asynchronously**, additionally probing the terminal live when you pass a TerminalQuery seam (the most accurate detection available).

```ts
resolveCapabilitiesAsync(options: ResolveOptions = {}): Promise<CapabilityResolution>
```

## resolveCapabilitiesAsync

Detect the running terminal's capabilities **asynchronously**, additionally probing the terminal live when you pass a TerminalQuery seam (the most accurate detection available).

```ts
resolveCapabilitiesAsync(options?: ResolveOptions): Promise<CapabilityResolution>
```

## rgb256

Reference RGB for xterm-256 palette index `n` (0–255): the 16 base colors (0–15), the 6×6×6 cube (16–231), then the 24-step gray ramp (232–255).

```ts
rgb256(index: number): Rgb
```

## rolesFromAliases

Build a complete Theme from a resolved 18-token ThemeColors set.

```ts
rolesFromAliases(c: ThemeColors): Theme
```

## sanitize

Remove escape and other terminal-control bytes from untrusted text, returning a string that is safe to write to the terminal.

```ts
sanitize(text: string): string
```

## serialize

Build the ANSI string that turns `previous` into `current` (a damage diff).

```ts
serialize(current: ScreenBuffer, previous: ScreenBuffer | null, options: RenderOptions): string
```

## serializeTheme

Serialize a theme to a JSON string.

```ts
serializeTheme(theme: Theme): string
```

## setClipboard

Emit an OSC 52 clipboard-write of `text`.

```ts
setClipboard(text: string, caps: CapabilityProfile): string
```

## setTitle

Emit an OSC 0/2 window-title set.

```ts
setTitle(text: string, caps: CapabilityProfile): string
```

## slateTheme

An enterprise muted blue-gray theme — a calm, low-saturation dark scheme generated from a slate accent and neutral.

```ts
const slateTheme: Theme
```

## solarizedDarkTheme

The Solarized Dark palette — a low-contrast dark theme with its `base03` background and blue accent pinned.

```ts
const solarizedDarkTheme: Theme
```

## solsticeTheme

A Unix-workstation theme in the CDE / OpenWindows spirit — a sage field, warm putty chrome, and a teal accent for the primary button, focus, and selection.

```ts
const solsticeTheme: Theme
```

## styleKey

Build a stable string key that is identical for cells sharing the same style — use it to cache encoded sequences or merge adjacent same-style runs.

```ts
styleKey(fg: Color, bg: Color, attrs: AttrMask): string
```

## toRgb

Validate a `Color` and parse it to RGB components.

```ts
toRgb(color: Color): Rgb | null
```

## warnIfAmbiguousWide

Probe the terminal for double-width chrome glyphs and, if a group is wide, emit one warning line.

```ts
warnIfAmbiguousWide(query: TerminalQuery, options: WidthWarnOptions = {}): Promise<WidthProbeResult>
```

## warpTheme

A Workplace-Shell-style theme — cool steel-blue surfaces over a mid steel field, with a deep corporate blue accent for the primary button, focus, and selection.

```ts
const warpTheme: Theme
```

## withBase

Compose a chrome contribution from a base list plus per-screen extras: `[...base, ...extra]`.

```ts
withBase<T extends View | { readonly kind: string }>(base: readonly T[], extra: readonly T[]): T[]
```

## workbenchTheme

An Amiga-Workbench 1.x theme — an unmistakable blue field with white windows, black text, and an orange accent for the primary button, focus, and selection.

```ts
const workbenchTheme: Theme
```
