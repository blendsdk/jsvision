# 03-02 · Browser Host, Caps Profile & `mountApp`

> **Document**: 03-02-browser-host.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-02 Must-Have #2, #3, #4 + Should-Have `mountApp` · ST-2, ST-3, ST-7, ST-10 · AR-3

## `src/host.ts` — `createBrowserHost` (promoted verbatim)

Promote the spike's `browser-host.ts` **behavior byte-for-byte** (03-current-state), rewriting the
JSDoc to shipped-code standards (no CodeOps IDs, `@example` on each export). Nothing about the logic
changes:

- `render(buffer)` → `const out = serialize(buffer, previous, { caps }); if (out) term.write(out); previous = buffer.clone();`
- `start()` → `term.write(ENTER_MODES); term.onData(pump);`
- `pump(data)` → `decode(encoder.encode(data), state, { caps })`; dispatch events; manage the lone-ESC
  timer: when the decoder carry begins with `ESC` (`0x1b`), arm a `setTimeout(…, ESC_TIMEOUT_MS)` that
  `flush()`es (so a bare Escape / Alt-prefix never fuses with the next key); any new byte disarms it.
- `setCaret(cell|null)` → `term.write(cell === null ? cursor.hide() : cursor.show() + cursor.to(cell.y+1, cell.x+1))`.

Exports: `createBrowserHost`, `BrowserHost`, `BrowserHostOptions`, `CaretCell` (unchanged names).

**ENTER_MODES** (Must-Have #3): `?1006h` SGR mouse · `?1000h` button · `?1002h` drag · `?2004h`
bracketed paste · `?1004h` focus · `?7l` wrap-off · `?25l` hide cursor. **No `?1049h`** (no alternate
screen — the demo owns the terminal).

> **The lock-down invariant (ST-2 / AC-2):** with `previous === null`, the bytes `render()` writes to
> the terminal **equal** `serialize(buffer, null, { caps })`. The spec test asserts exact equality —
> this is what proves the engine is reused, not reimplemented.

### The ESC timer seam (testability, AR-4)

The spike uses `window.setTimeout`. To test the lone-ESC path deterministically without a DOM
(ST-3, second half) and to keep the host free of a hard `window` reference, accept an **injectable
timer** in `BrowserHostOptions` defaulting to the global timers:

```ts
/**
 * The narrow slice of an xterm.js terminal the host + mountApp actually touch — declared as a local
 * structural interface (NO `@xterm/xterm` import) so BOTH a real `@xterm/xterm` terminal AND an
 * `@xterm/headless` terminal satisfy it. This is what makes the host headless-testable: the concrete
 * `@xterm/xterm` `Terminal` type carries DOM-only members (`focus`/`blur`/`element`/`textarea`/…)
 * that `@xterm/headless` lacks, so annotating against it would reject the headless test terminal
 * (it is not structurally assignable) and force an `as unknown` cast the standards forbid.
 */
interface TerminalLike {
  write(data: string): void;
  onData(handler: (data: string) => void): { dispose(): void };
  onResize(handler: (size: { cols: number; rows: number }) => void): { dispose(): void };
  /** Present on a DOM terminal, absent on `@xterm/headless` — always call it optionally. */
  focus?(): void;
  dispose?(): void;
}

interface BrowserHostOptions {
  readonly term: TerminalLike;
  readonly caps: CapabilityProfile;
  readonly onInput: (event: InputEvent) => void;
  /** Timer seam (defaults to setTimeout/clearTimeout) so the lone-ESC flush is testable headlessly. */
  readonly timer?: { setTimeout(fn: () => void, ms: number): number; clearTimeout(id: number): void };
}
```

The injectable timer and the `term` type narrowing (from `@xterm/xterm`'s concrete `Terminal` to the
local `TerminalLike` above) are the only structural changes from the spike — the runtime **logic** is
promoted byte-for-byte, and both defaults preserve the browser behavior exactly. As a result
`@jsvision/web`'s source imports **no** `@xterm/xterm` value or type; consumers pin the real xterm as
an optional peer.

## `src/caps.ts` — `buildBrowserCaps`

Extract `WEB_CAPS` from the spike's `app.ts` into a builder, so `colorDepth` is overridable per the
RD (Must-Have #4) to exercise downsampling (ST-7):

```ts
export interface BrowserCapsOptions {
  /** Colour depth the profile advertises; lower values make serialize() downsample. Default 'truecolor'. */
  readonly colorDepth?: 'truecolor' | '256' | '16' | 'mono';
}
/** Build the browser CapabilityProfile: truecolor + UTF-8 (real box-drawing/blocks), colorDepth overridable. */
export function buildBrowserCaps(options: BrowserCapsOptions = {}): CapabilityProfile {
  return resolveCapabilities({
    env: { COLORTERM: 'truecolor', TERM: 'xterm-256color', LANG: 'en_US.UTF-8' },
    platform: 'linux',
    override: { colorDepth: options.colorDepth ?? 'truecolor' },
  }).profile;
}
```

The synthetic `LANG=…UTF-8` is what flips `unicode.utf8` + `glyphs.boxDrawing`/`halfBlocks` on, so
`serialize()` emits real `┌─┐│└┘`/`█▄▀▒` instead of the ASCII fallback. **ST-7**: `buildBrowserCaps({
colorDepth: '16' })` fed a truecolor style through `serialize()` produces a 16-colour SGR — proving
the profile drives the existing downsample chain (no new downsample code).

## `src/mount.ts` — `mountApp` (Should-Have, AR-3)

The browser mirror of `@jsvision/ui`'s `run()` (distilled from the spike's `main.ts`), so a consumer
needs a few lines, not the full boot dance. It is the API RD-03's Play dialog builds on.

```ts
export interface MountAppOptions {
  readonly element: HTMLElement;   // the mount point (narrow local type; no DOM lib needed)
  readonly app: Application;       // a composed @jsvision/ui application
  readonly caps: CapabilityProfile;
  /**
   * The terminal to drive. Either inject a ready terminal (tests pass an `@xterm/headless`
   * `Terminal`; a browser app passes an opened `@xterm/xterm` one) OR pass `createTerminal`.
   */
  readonly term?: TerminalLike;
  /**
   * A factory used when `term` is omitted, e.g. `() => { const t = new Terminal({…}); t.open(el);
   * return t; }` in a browser app. `mountApp` NEVER constructs a terminal itself — it does not import
   * `@xterm/xterm` (a browser-only, CommonJS-default package), so that value-import stays in the
   * caller's bundle where it belongs.
   */
  readonly createTerminal?: () => TerminalLike;
}
export interface MountedApp {
  readonly term: TerminalLike;
  readonly host: BrowserHost;
  dispose(): void;                 // tear down listeners + terminal
}
/** Requires `term` or `createTerminal`; throws a clear error if neither is supplied. */
export function mountApp(options: MountAppOptions): MountedApp { /* … */ }
```

Wiring (distilled from `main.ts`, minus the demo clock): resolve the terminal
(`options.term ?? options.createTerminal?.()`; throw if neither), build the host, point
`loop.onFrame`/`loop.onCaret`/`loop.writeClipboard` at it, `host.start()`, paint the first frame +
`loop.refreshCaret()`, map `term.onResize` → `loop.resize`, then `term.focus?.()` — **optional**,
because an `@xterm/headless` terminal has no `focus()` (calling it unconditionally would throw in the
ST-10 headless test). `dispose()` tears down the terminal's listeners + terminal. Attaching
`attachKeyReclaim` (03-04) and WebGL are the **caller's** choice (kept out so `mountApp` stays
DOM-light and headless-testable).

**ST-10**: `mountApp` over an `@xterm/headless` terminal (injected as `term`) + a trivial
`@jsvision/ui` app renders a first frame (the terminal buffer is non-empty) and a dispatched key
reaches the app — the convenience boots end-to-end headlessly.

## Verify (this component)

`yarn verify` green; ST-2, ST-3, ST-7, ST-10 pass; `check:docs` green (every export has `@example`,
no CodeOps/TV refs).
