# web-xterm — jsvision in the browser (demo)

Runs the **exact same** `@jsvision/core` + `@jsvision/ui` stack that powers the native
terminal demos, but rendered into an [xterm.js](https://xtermjs.org) terminal in a
browser tab — on top of the shipped **`@jsvision/web`** browser runtime. It is both the
proof that jsvision's engine is host-agnostic (the pure render/input contract is an ANSI
byte stream, which is precisely xterm.js's output and input contract) and the live
dogfood of `@jsvision/web`.

```bash
yarn build                                      # build @jsvision/core + @jsvision/ui + @jsvision/web first
yarn workspace @jsvision/examples demo:web      # → http://localhost:5173
```

Open the page and you get a live Turbo Vision desktop: a menu bar, a status line, two
blue windows with drop-shadows, and a signal-driven clock. **Drag** a title bar to move
a window, **click** to raise/focus, **F10** for the menu, **Tab** to cycle focus.

## How it works

The engine is split so everything above the OS boundary is pure. `@jsvision/web` swaps
only that boundary, and this demo consumes it:

| Concern    | Native (`@jsvision/core` `createHost`) | This demo (`@jsvision/web`)        |
| ---------- | -------------------------------------- | ---------------------------------- |
| **output** | `serialize()` → `stdout.write(ansi)`   | `serialize()` → `term.write(ansi)` |
| **input**  | `stdin.on('data')` → `decode()`        | `term.onData()` → `decode()`       |
| **resize** | `SIGWINCH` → `{cols, rows}`            | `term.onResize()` → `loop.resize`  |
| **caps**   | `resolveCapabilities(process.env)`     | `buildBrowserCaps()`               |

`serialize()`, `decode()`/`flush()`, and `cursor` are reused verbatim — no fork, no
shim. `app.ts` is 100% ordinary `@jsvision/ui`; only `main.ts` knows it's in a browser.

### What the demo consumes from `@jsvision/web`

1. **`mountApp` (`main.ts`)** — wires the app's loop to the xterm terminal in one call
   (host, frame/caret/clipboard sinks, first paint, resize → `loop.resize`, focus). The
   demo keeps only the browser niceties `mountApp` leaves to the caller: the WebGL
   renderer, the fit addon, and the `setInterval` clock.
2. **`buildBrowserCaps()` (`app.ts`)** — the truecolor + UTF-8 capability profile, so
   `serialize()` emits real box-drawing (`┌─┐│└┘`) and block glyphs instead of the ASCII
   fallback.
3. **`@jsvision/web/browser-stubs` (`vite.config.ts` alias)** — the `@jsvision/core`
   barrel statically imports `node:fs`/`node:tty` (the native `tty` host + logger file
   sink, which this demo never calls), so Vite aliases those two specifiers to the shipped
   throwing stubs. A production build contains no `node:fs`/`node:tty` specifier.

## Not covered (deliberately)

Suspend/resume, signals, and `process.exit` have no browser meaning and are simply absent
(`@jsvision/web` mounts the loop directly rather than calling the native-TTY `run()`).
