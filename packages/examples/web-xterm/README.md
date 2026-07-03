# web-xterm — jsvision in the browser (spike)

Runs the **exact same** `@jsvision/core` + `@jsvision/ui` stack that powers the native
terminal demos, but rendered into an [xterm.js](https://xtermjs.org) terminal in a
browser tab. It is the proof that jsvision's engine is host-agnostic: the pure render
+ input contract is an ANSI byte stream, which is precisely xterm.js's output and
input contract.

```bash
yarn build                                      # build @jsvision/core + @jsvision/ui first
yarn workspace @jsvision/examples demo:web      # → http://localhost:5173
```

Open the page and you get a live Turbo Vision desktop: a menu bar, a status line, two
blue windows with drop-shadows, and a signal-driven clock. **Drag** a title bar to move
a window, **click** to raise/focus, **F10** for the menu, **Tab** to cycle focus.

## How it works

The engine is split so everything above the OS boundary is pure. This demo swaps only
that boundary:

| Concern      | Native (`@jsvision/core` `createHost`) | This demo (`browser-host.ts`)        |
| ------------ | -------------------------------------- | ------------------------------------ |
| **output**   | `serialize()` → `stdout.write(ansi)`   | `serialize()` → `term.write(ansi)`   |
| **input**    | `stdin.on('data')` → `decode()`        | `term.onData()` → `decode()`         |
| **resize**   | `SIGWINCH` → `{cols, rows}`            | `term.onResize()` → `{cols, rows}`   |
| **caps**     | `resolveCapabilities(process.env)`     | a fixed truecolor+UTF-8 profile      |

`serialize()`, `decode()`/`flush()`, and `cursor` are reused verbatim — no fork, no
shim. `app.ts` is 100% ordinary `@jsvision/ui`; only `main.ts` knows it's in a browser.

### The three browser adaptations

Everything the port needs lives in three small, well-marked places:

1. **`node-stub.ts` + `vite.config.ts` alias** — the `@jsvision/core` barrel statically
   imports `node:fs`/`node:tty` (the native `tty` host, which this demo never calls), so
   Vite aliases those two specifiers to a throwing stub to keep them out of the bundle.
2. **UTF-8 capability profile (`app.ts`)** — a synthetic `LANG=…UTF-8` flips on
   `glyphs.boxDrawing`/`halfBlocks` so `serialize()` emits real box-drawing (`┌─┐│└┘`)
   and block/icon glyphs instead of the ASCII fallback (`+-|`, `?`).
3. **WebGL renderer (`main.ts`)** — xterm's WebGL addon rasterizes box-drawing and
   block/shade glyphs with its own geometry, so frame chrome is crisp and gap-free
   regardless of the system monospace font. Falls back to the DOM renderer if WebGL is
   unavailable.

## Not covered (deliberately)

This is a spike, not a shipped `packages/web` host. It reuses `createApplication`'s
composition but drives the loop directly instead of calling `run()` (which is native-TTY
only). Suspend/resume, signals, and `process.exit` have no browser meaning and are simply
absent. A production browser host would live in its own package with a dedicated
`./browser` entry point so consumers never pull `node:tty` into their bundle.
