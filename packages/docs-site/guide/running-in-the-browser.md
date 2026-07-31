---
title: Running in the browser
description: Mount an unchanged JSVision app through xterm.js and manage browser lifecycle, clipboard, keyboard reclaim, resize, and virtual files.
---

# Running in the browser

## Who is this course for?

This course is for developers evaluating or contributing to JSVision's browser host, and for
maintainers embedding repository applications in xterm.js. It assumes the ownership model from
[The application shell](/guide/application-shell) and the injected storage model from
[Files & the FileSystem seam](/guide/files-and-filesystem).

By the end you can **build** an in-repository browser mount, **explain** its byte and ownership
boundaries, **diagnose** input, resize, permission, and cleanup failures, and **verify** that browser
files and tests never reach visitor resources.

::: warning Current release boundary
`@jsvision/web` is private to this repository, is not published on npm, and is not a supported
consumer deployment target yet. The code below documents the current exported contract for
contributors and repository applications. Do not copy these imports into an npm consumer project
until the package is published. Every `@jsvision/web` snippet below is repository-internal
architecture evidence, not consumer setup. See the [browser release boundary](/guide/install-and-packages#browser-boundary).
:::

The beginner boundary is mounting and disposing one app. Intermediate work adds resize, focus,
keyboard, clipboard, and virtual files. Advanced work covers bundling, authorization, degradation,
failure recovery, and production lifecycle judgment.

## What is the browser-host mental model?

The application is unchanged. Only the host below its event loop changes:

```text
same retained application
        │ frames / decoded input
        ▼
   @jsvision/web host
        │ ANSI bytes
        ▼
      xterm.js
        │
        ▼
 browser DOM, focus, permissions
```

The native host writes ANSI to a terminal and reads terminal bytes. The browser host writes the
same ANSI to xterm.js and feeds xterm.js `onData` bytes to the same decoder. `serialize()` and
`decode()` remain core engine behavior; the browser package replaces the OS boundary.

| Owner               | Responsibilities                                                                 |
| ------------------- | -------------------------------------------------------------------------------- |
| Application         | View tree, commands, state, focus, cleanup callbacks                             |
| `mountApp()`        | Frame/caret/clipboard sinks, first paint, resize subscription, terminal disposal |
| xterm.js            | DOM terminal, byte input/output, measured rows and columns                       |
| Browser             | Focus, user-gesture authorization, reserved shortcuts                            |
| Application adapter | Virtual data and any additional authorization policy                             |

## How do I mount my first application?

Build the application with browser capabilities, then pass that unchanged application to
`mountApp()`:

```ts
import { createApplication } from '@jsvision/ui';
import { buildBrowserCaps, mountApp } from '@jsvision/web';

const caps = buildBrowserCaps();
const app = createApplication({
  caps,
  viewport: { width: 80, height: 24 },
});

const mounted = mountApp({ element, app, caps, term });
```

The same application can use `app.run()` behind a native terminal or `mountApp()` in a browser.
Do not fork business state or view composition by host.

`mountApp()` deliberately does not import xterm.js. The caller keeps the browser-only value import
and opens the terminal into the real element:

```ts
import { Terminal } from '@xterm/xterm';
import { buildBrowserCaps } from '@jsvision/web';

const caps = buildBrowserCaps();
const term = new Terminal({ allowProposedApi: true });
term.open(element);
```

Construct the app at `term.cols` and `term.rows` after fitting the terminal when the initial DOM
size is authoritative.

## Laboratory: browser host lifecycle

<PlayExample id="guides/browser-host-lifecycle" title="Browser Host Lifecycle Laboratory" blurb="Mount an unchanged app over a deterministic xterm-shaped terminal, observe its first paint and decoded input, resize the real nested loop, then dispose every owner." />

Use Alt+M, Alt+I, and Alt+S in order, then click **Dispose host**. The lab calls the real public
`mountApp()` with an in-memory structural terminal. It verifies output, decoder input, resize,
optional focus, and disposal without creating a second DOM terminal.

## How do xterm.js input and output connect to JSVision?

On startup the host enables SGR mouse, drag tracking, bracketed paste, focus reporting, and
line-wrap control. It then paints the first frame immediately. Later frames are damage diffs:

```ts
import { createBrowserHost } from '@jsvision/web';

const host = createBrowserHost({
  term,
  caps,
  onInput: (event) => app.loop.dispatch(event),
});

host.start();
host.render(app.loop.renderRoot.buffer());

// Required when this direct host owner shuts down.
host.dispose();
```

`term.onData` supplies ANSI bytes such as an up-arrow sequence or bracketed paste. The host sends
them through the core decoder and dispatches typed events. A lone Escape uses the same bounded
disambiguation timer as the native host.

Direct `createBrowserHost()` ownership always pairs `start()` with `dispose()`. Disposal detaches
terminal input and clears a pending lone-Escape timer. The higher-level `mountApp()` handle performs
that host cleanup as part of `mounted.dispose()`.

The first frame and input are separate evidence. A visible first paint does not prove that
`onData` is subscribed, and a decoded key does not prove the current frame was serialized.

## How do resize and focus stay synchronized?

xterm.js owns the actual cell grid. `mountApp()` subscribes to `onResize` and maps `{ cols, rows }`
to `loop.resize({ width: cols, height: rows })`. Fit the terminal when its DOM container changes;
the resulting terminal resize updates the application:

```ts
const resize = term.onResize(({ cols, rows }) => {
  app.loop.resize({ width: cols, height: rows });
});

// Release a manually owned subscription.
resize.dispose();
```

The helper already owns this subscription; do not add the snippet above beside `mountApp()` or the
loop will receive duplicate resize events.

`term.focus()` is optional and is called when available. Headless terminals do not need to
implement it. DOM applications should track the xterm helper textarea's focus separately so
document-level shortcut reclaim is active only while the terminal owns keyboard focus.

Dispose the complete mount, not just the DOM element:

```ts
mounted.dispose();
```

`mounted.dispose()` first detaches host input and pending decoder timers. It then unmounts the loop
and view tree, clears the clipboard writer, disables the custom key route, disposes the resize
subscription, and finally disposes the terminal when that structural method exists. Register every
timer, subscription, and listener with its owner:

```ts
view.onMount(() => {
  const timer = setInterval(refresh, 1000);
  view.onCleanup(() => clearInterval(timer));
});
```

## How do I reclaim browser keyboard shortcuts?

Browsers consume F-keys, Tab, Alt-letter commands, and some Ctrl chords before xterm can encode
them. `attachKeyReclaim()` installs a capture-phase `keydown` listener and calls `preventDefault()`
only while the terminal is focused:

```ts
import { attachKeyReclaim } from '@jsvision/web';

const detachReclaim = attachKeyReclaim(term, {
  isFocused: () => terminalFocused,
  also: ['Ctrl+X'],
});

// On host teardown:
detachReclaim();
```

Never reclaim across the whole unfocused page. Doing so breaks browser navigation and assistive
technology outside the terminal. Detach the reclaim listener with the mount owner.

Some OS/browser shortcuts cannot be recovered even with `preventDefault()`. Treat
`UNRECLAIMABLE_CHORDS` as an advisory remap list, not a runtime probe:

```ts
import { UNRECLAIMABLE_CHORDS } from '@jsvision/web';

const needsAlternate = UNRECLAIMABLE_CHORDS.includes('Ctrl+W');
if (needsAlternate) showShortcut('Close', 'Alt+Q');
```

Always provide an alternate command path in a menu or visible control.

## How does browser clipboard authorization work?

The browser bridge is outbound-only. `setClipboard()` calls `writeText` during a user gesture and
never calls `readText`. Inbound paste already arrives through xterm's bracketed-paste byte route.

```ts
import { buildBrowserCaps, setClipboard } from '@jsvision/web';

try {
  await setClipboard(selectedText, buildBrowserCaps());
  status.set('Copied');
} catch {
  status.set('Copy denied; use the app-local clipboard');
}
```

An absent or unavailable browser clipboard is a graceful no-op. A present bridge may reject with a
permission or `NotAllowedError`; the caller owns feedback and fallback. Secret or sensitive
selected text must never be logged when a write fails.

`mountApp()` also consumes xterm.js's browser-owned Ctrl+Shift+C gesture and routes it as a normal
copy key. This keeps terminal selection and application selection distinct while preserving one
focused-control copy implementation.

For deterministic authorization tests, inject only the write capability:

```ts
import type { ClipboardBridge } from '@jsvision/web';

const denied: ClipboardBridge = {
  writeText: () => Promise.reject(new Error('permission denied')),
};
```

## How do virtual files keep workflows host-neutral?

The browser filesystem is an in-memory POSIX implementation of the same public
[`FileSystem`](/api/files/interfaces/FileSystem) abstraction accepted by file controls:

```ts
import { createBrowserFileSystem } from '@jsvision/web';

const fs = createBrowserFileSystem({
  tree: { '/workspace': { 'readme.txt': 'hello' } },
  home: '/workspace',
});
```

The same unchanged `FileSystem` workflow can receive this adapter instead of `nodeFileSystem`:

```ts
import { openFile } from '@jsvision/files';

const selected = await openFile(app, {
  fs,
  directory: fs.homedir(),
});
```

The adapter uses pure POSIX string math and a bounded deterministic tree. It has no backend,
network, visitor disk, or real visitor files. Lexical `..` normalization is not authorization; an
application-defined root policy must still validate canonical paths.

```ts
const root = '/workspace';
const canonical = fs.resolve(root, requestedPath);
if (canonical !== root && !canonical.startsWith(root + fs.sep)) {
  throw new Error('path outside authorized root');
}
```

## Laboratory: browser capability boundaries

<PlayExample id="guides/browser-capability-boundaries" title="Browser Capability Boundaries Laboratory" blurb="Reclaim one focused key, compare authorized and denied outbound clipboard writes, and mutate a bounded virtual filesystem without visitor or network access." />

Try Alt+K, Alt+C, Alt+D, and Alt+F. Every operation uses an injected deterministic seam. The
authorized and denied writers never reach `navigator.clipboard`; the file action never reaches disk
or `fetch`.

## How does the browser runtime integrate with an unchanged app?

Keep host choice at the composition root:

```ts
import type { Application } from '@jsvision/ui';
import { mountApp } from '@jsvision/web';

function mountBrowser(app: Application) {
  return mountApp({ element, app, caps, term });
}
```

Views depend on commands, events, and injected services—not DOM globals. File views receive
`FileSystem`; copy routes use the application clipboard seam; resize enters through the loop; and
cleanup stays with mounted owners. This keeps the [Application component](/components/application/application)
portable.

The current repository dogfood application also aliases `node:fs` and `node:tty` to the shipped
throwing `@jsvision/web/browser-stubs` subpath. Those stubs prevent accidental native execution;
they do not emulate Node APIs. This bundler recipe belongs to the unpublished browser package and
may change before release.

## What belongs in advanced browser hosting?

- Fit the xterm grid before composing the first application frame.
- Load WebGL only as an optional renderer; retain xterm's DOM renderer fallback.
- Lazy-load xterm and addons so server rendering does not evaluate browser-only modules.
- Use generation guards when a lazy import can settle after its modal or page was closed.
- Run example cleanup before mount disposal so late timers cannot touch a half-disposed app.
- Keep one mounted terminal per host region and make close idempotent.
- Treat capability profiles as explicit evidence, not browser or GPU guarantees.

```ts
const generation = ++currentGeneration;
const module = await loadApplication();
if (generation !== currentGeneration) return;
mount(module);
```

## How do I diagnose browser-host failures?

| Symptom                     | Likely cause                                                       | Correction                                          | Distinguishing evidence                                   |
| --------------------------- | ------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------------- |
| Blank terminal              | Terminal was not opened, first paint failed, or grid is zero-sized | Open and fit xterm before mounting                  | No first-frame write or rows/cols are zero                |
| Keys do nothing             | Focus is elsewhere, reclaim is missing, or `onData` is detached    | Inspect focus, capture listener, then decoded input | Reclaimed key has `preventDefault`; host receives bytes   |
| Page shortcuts stop working | Reclaim ignored terminal focus                                     | Gate reclaim on focused xterm and detach it         | Unfocused synthetic key is not prevented                  |
| Resize clips content        | DOM changed without fitting xterm, or resize was duplicated        | Fit once and let `onResize` drive `loop.resize`     | Terminal grid and render buffer dimensions differ         |
| Copy appears silent         | Clipboard is absent or authorization rejected                      | Preserve app-local copy and show bounded feedback   | Injected writer resolves, rejects, or is absent           |
| Virtual file is missing     | Wrong home/path or fixture was recreated                           | Inspect canonical POSIX path and adapter lifetime   | `readDir`, `resolve`, and `homedir` identify the mismatch |
| State updates after close   | Lazy work or a timer outlived its generation                       | Guard settlement and register cleanup               | A post-close callback still reaches a disposed view       |

Diagnose from the boundary inward: DOM grid and focus, reclaim, terminal bytes, decoder event,
application route, rendered buffer, then serialized output. Never include clipboard secrets,
visitor paths, or raw untrusted terminal text in diagnostics.

## What are the best practices?

- Keep one unchanged application model; host-specific forks drift.
- Build capabilities once and pass the same profile to the app and mount.
- Make xterm the source of cell geometry; pixel sizes are not terminal rows and columns.
- Reclaim only focused keys and always show alternatives for unreclaimable chords.
- Treat clipboard writes as permissioned, fallible, and outbound-only.
- Inject bounded virtual files; never imply that a browser lab can inspect visitor disk.
- Acquire and release terminal, reclaim, observers, timers, and view scopes together.
- Label private-package and compatibility evidence honestly until the browser host is released.

## What should I practice next?

Practice exercises:

1. Resize the lifecycle lab twice and verify the nested render buffer follows 52×15 without a remount.
2. Change the reclaim fixture to unfocused and confirm F1 remains a browser-owned gesture.
3. Make the clipboard bridge reject and preserve useful feedback without logging selected content.
4. Add a second virtual directory and reuse the same file workflow to navigate it.
5. Close a mount while a lazy load is pending and verify the generation guard prevents publication.

Continue with [Keyboard & clipboard](/guide/keyboard-and-clipboard) for the full canonical clipboard
model and [Files & the FileSystem seam](/guide/files-and-filesystem) for adapter authorization and
path behavior. The current browser symbols are intentionally excluded from generated product API
pages while `@jsvision/web` remains private; use the repository package source and its tests as the
authoritative reference until publication.
