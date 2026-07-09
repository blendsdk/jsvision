# @jsvision/web

Run any [JSVision](https://github.com/blendsdk/jsvision) terminal app in a browser tab — inside an
[xterm.js](https://xtermjs.org) terminal, with **no backend**.

The engine is already host-agnostic: `serialize()` emits ANSI and `decode()` consumes ANSI, which is
exactly xterm.js's output/input contract. This package replaces only the OS boundary and adds the
three browser facilities a real app needs:

- **`createBrowserHost` / `mountApp`** — a browser host over the reused pure engine, and a one-call
  mount that wires an `@jsvision/ui` application to a terminal.
- **`buildBrowserCaps`** — the browser capability profile (truecolor + UTF-8, `colorDepth` overridable).
- **`createBrowserFileSystem`** — an in-memory virtual `FileSystem` so `@jsvision/files` dialogs and
  the editor run against a seeded tree, with no `node:fs`.
- **`attachKeyReclaim` / `UNRECLAIMABLE_CHORDS`** — stop the browser stealing F-keys and chords from a
  focused terminal.
- **`setClipboard`** — the outbound (write-only) clipboard bridge.

> Private until its first release. ESM-only, zero native runtime dependencies.

## Quick start — `mountApp`

```ts
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { createApplication } from '@jsvision/ui';
import { mountApp, buildBrowserCaps } from '@jsvision/web';

const caps = buildBrowserCaps();
const app = createApplication({ caps, viewport: { width: 80, height: 24 } });
const element = document.getElementById('terminal')!;

const mounted = mountApp({
  element,
  app,
  caps,
  createTerminal: () => {
    const term = new Terminal({ allowProposedApi: true });
    term.open(element);
    return term;
  },
});
// later: mounted.dispose();
```

`mountApp` starts the host, paints the first frame, maps terminal resize to the loop, and focuses.
It never imports `@xterm/xterm` itself — you create the terminal (via `createTerminal` or by passing a
ready `term`), so the browser-only xterm value-import stays in your bundle. A WebGL renderer, the fit
addon, and key-chord reclaim are your choice to add.

## Entry points

| Import                        | What it is                                                                                                            |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `@jsvision/web`               | The library barrel — host, caps, `mountApp`, virtual FS, reclaim, clipboard.                                          |
| `@jsvision/web/browser-stubs` | Throwing placeholders for `node:fs`/`node:tty`; **alias target only** (see below). Never re-exported from the barrel. |

## Bundler recipe — the `node:fs`/`node:tty` alias

`@jsvision/core`'s barrel statically imports `node:fs` and `node:tty` (the native `tty` host and the
screen-safe logger's default file sink) — code paths a browser never runs. Point your bundler's alias
at the shipped `browser-stubs` subpath so those specifiers resolve to throwing placeholders:

```ts
// vite.config.ts (consumer)
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      'node:fs': '@jsvision/web/browser-stubs',
      'node:tty': '@jsvision/web/browser-stubs',
    },
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
});
```

The stubs throw loudly if ever invoked — which would only happen if the app reached into a native
facility that cannot exist in the browser. A stubbed production build contains **no** `node:fs` /
`node:tty` specifier.

## Virtual FileSystem

```ts
import { createBrowserFileSystem } from '@jsvision/web';
import { FileDialog } from '@jsvision/files';
import { signal } from '@jsvision/ui';

const fs = createBrowserFileSystem({
  tree: { '/home/demo': { 'notes.txt': 'hello', src: { 'main.ts': '…' } } },
  home: '/home/demo',
});
const dialog = new FileDialog({ fs, directory: signal('/home/demo') });
```

Files and directories only, a deterministic mtime, and pure-POSIX path operations — `..` normalizes
lexically and can never escape to a real filesystem. Writes mutate the in-memory tree only; nothing
leaves the browser.

## Key-chord reclaim

```ts
import { attachKeyReclaim, UNRECLAIMABLE_CHORDS } from '@jsvision/web';

const detach = attachKeyReclaim(term); // reclaim F-keys, Ctrl+W/N/T/S/P, Tab, Alt+<letter>, … while focused
// later: detach();
```

Some chords are reserved by the OS/browser even against `preventDefault()` —
`UNRECLAIMABLE_CHORDS` enumerates the best-effort list so you can document a remap.

## Live demo

The `web-xterm` example (`packages/examples/web-xterm/`) is a full Turbo Vision-style desktop running
on this package. From the monorepo root:

```bash
yarn build                                    # build @jsvision/core + @jsvision/ui + @jsvision/web
yarn workspace @jsvision/examples demo:web    # → http://localhost:5173
```

## License

MIT
