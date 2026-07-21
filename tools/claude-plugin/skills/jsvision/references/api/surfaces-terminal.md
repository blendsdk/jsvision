<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Surfaces & terminal

Offscreen surfaces and the scrollback terminal view.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## Surface

An offscreen, freely-writable cell buffer.

```ts
new Surface(opts: SurfaceOptions)
// methods & signals:
size: Point
from(rows: readonly string[], opts?: Omit<SurfaceOptions, 'size'>): Surface
buffer: ScreenBuffer
resize(size: Point): void
grow(delta: Point): void
clear(style: Style = DEFAULT_FILL): void
at(x: number, y: number): Readonly<Cell> | undefined
set(x: number, y: number, char: string, style: Style): void
getDrawContext(overrides?: { theme?: Theme; caps?: CapabilityProfile }): DrawContext
version(): number
snapshot(): ScreenBuffer
```

## SurfaceOptions

Options for a Surface.

```ts
interface SurfaceOptions {
  size: Point;   // Buffer size `{x: width, y: height}` (clamped to at least 1×1).
  theme?: Theme;   // Default theme for the paint facade; defaults to the built-in theme.
  caps?: CapabilityProfile;   // Default capabilities for the paint facade; defaults to a conservative ASCII-safe profile.
  fill?: Style & { char?: string };   // Initial cell fill; defaults to a space in terminal-default colours.
}
```

## SurfaceSource

A static surface, `null`, or a reactive accessor of either (so the surface can be swapped live).

```ts
type SurfaceSource = Surface | null | (() => Surface | null)
```

## SurfaceView

A passive, scrollable window onto a Surface.

```ts
new SurfaceView(opts: SurfaceViewOptions)   // extends View
// methods & signals:
delta: Signal<Point>
scrollTo(target: Point): void
panBy(dx: number, dy: number): void
```

## SurfaceViewOptions

Options for a SurfaceView.

```ts
interface SurfaceViewOptions {
  surface: SurfaceSource;   // The bound surface (static, `null`, or a reactive accessor — swap-aware).
  delta?: Signal<Point>;   // Two-way scroll offset `{x,y}`; defaults to `signal({x:0,y:0})`. The caller drives it (e.g. a `ScrollBar`).
  onScroll?: (delta: Point) => void;   // Fired when `delta` changes (skips the initial value and same-coordinate no-op writes).
}
```

## Terminal

A scrolling log-output view.

```ts
new Terminal(options: TerminalOptions = {})   // extends View
// methods & signals:
write(text: string): void
writeLine(text: string): void
clear(): void
```

## TerminalOptions

Options for Terminal.

```ts
interface TerminalOptions {
  capacity?: number;   // How much scroll-back to retain, in UTF-16 code units (default 32000). Older lines are dropped.
}
```

## terminalWriter

Wrap a Terminal as a plain `(text) => void` sink, so anything that writes strings to a callback — a logger, a subprocess `stdout` handler, a progress reporter — can stream into the view.

```ts
terminalWriter(term: Terminal): (s: string) => void
```
