# App lifecycle

The app shell composes an event loop, a desktop window manager, an optional menu bar and status
line, and a popup overlay into one ready-to-run application.

## Create → add windows → run

```ts
import { createApplication, Window, Text, statusLine, statusItem, Commands } from '@jsvision/ui';

const app = createApplication({
  statusLine: statusLine([statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X')]),
});

const win = new Window('Editor');
win.layout.rect = { x: 2, y: 1, width: 50, height: 16 };
win.add(new Text('content'));
app.desktop.addWindow(win);

const code = await app.run(); // resolves the exit code; the terminal is always restored
```

## `createApplication(options)`

All options are optional:

- **`caps`** — capability profile or `'auto'` (default). `'auto'` detects the terminal once; pass a
  concrete profile only for tests or to force a color depth.
- **`viewport`** — initial size in cells (defaults to the terminal size, or 80×24).
- **`theme`** — a preset or a `createTheme(...)` result (see `theming.md`).
- **`menuBar`** / **`statusLine`** — chrome rows (see `component-catalog.md`).
- **`requireTty`** (default `true`) — `run()` asserts an interactive terminal and throws otherwise.
  Pass `false` for headless/piped runs.

## Commands

Menu items, status items, and buttons emit **commands** (strings). Handle them app-wide:

```ts
app.onCommand('about', () => {
  /* open an about box, etc. */
});
```

`Commands` holds the built-ins every shell understands: `Commands.quit`, `close`, `zoom`, `next`,
`prev`, `cascade`, `tile`, `ok`, `cancel`, `yes`, `no`. Emit one imperatively with
`app.loop.emitCommand(Commands.tile)`.

Built-in quit is already wired: a `Commands.quit` (e.g. from an `Alt-X` status item) ends `run()`.

## The desktop

`app.desktop` is the window manager. Beyond `addWindow(win)`, it can `cascade()`, `tile()`,
`raise(win)`, and cycle focus. Windows are movable/resizable/zoomable by default; set their initial
place with `win.layout.rect = { x, y, width, height }`.

## Runtime theme change

`app.setTheme(nordTheme)` swaps the palette and repaints every view in one frame — safe to call from
a command handler.

## Browser: `mountApp` instead of `run()`

The same app runs in an xterm.js terminal with no backend via `@jsvision/web`:

```ts
import { Terminal } from '@xterm/xterm';
import { buildBrowserCaps, mountApp } from '@jsvision/web';

const caps = buildBrowserCaps();
const app = createApplication({ caps, viewport: { width: 80, height: 24 } });
// ...add windows...
const term = new Terminal({ allowProposedApi: true });
term.open(document.getElementById('app'));
const mounted = mountApp({ element: document.getElementById('app'), app, caps, term });
// later: mounted.dispose();
```

Keep the browser-only imports (`@xterm/xterm`, its CSS) in one entry file; the app-composition
module stays plain `@jsvision/ui` so it also runs headless and on a TTY. See
`running-and-testing.md`.
