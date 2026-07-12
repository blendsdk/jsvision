# @jsvision/web

Run any [jsvision](https://github.com/blendsdk/jsvision) terminal app in a browser
tab — inside an [xterm.js](https://xtermjs.org) terminal, with **no backend**.

The engine is already host-agnostic (`serialize()` emits ANSI, `decode()` consumes
it — exactly xterm.js's contract), so this package only replaces the OS boundary and
adds the browser facilities a real app needs:

- **`createBrowserHost` / `mountApp`** — a browser host over the reused engine, and a
  one-call mount that wires an `@jsvision/ui` app to a terminal.
- **`buildBrowserCaps`** — the browser capability profile (truecolor + UTF-8).
- **`createBrowserFileSystem`** — an in-memory virtual `FileSystem` for `@jsvision/files`.
- **`attachKeyReclaim`** — stop the browser stealing F-keys and chords from the terminal.
- **`setClipboard`** — the outbound clipboard bridge.

> **Private until its first release**, under heavy development. ESM-only, zero native
> runtime dependencies.

## Quick start

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

`mountApp` starts the host, paints the first frame, maps terminal resize to the loop,
and focuses. It never imports `@xterm/xterm` itself — you create the terminal — so the
browser-only xterm import stays in your bundle.

> **Bundler note:** `@jsvision/core`'s barrel statically imports `node:fs`/`node:tty`
> (native code paths a browser never runs). Alias both specifiers to the shipped
> `@jsvision/web/browser-stubs` subpath so they resolve to throwing placeholders.

The `web-xterm` example (`packages/examples/web-xterm/`) is a full working demo. See
the [documentation site](https://blendsdk.github.io/jsvision/) for the guide and the
[API reference](https://blendsdk.github.io/jsvision/api/).

## License

MIT
