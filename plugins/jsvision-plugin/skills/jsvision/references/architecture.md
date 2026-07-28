# Professional application architecture

Use four layers: domain invariants; injectable services; reactive state/actions; JSVision presentation. Import only public entry points. Keep constructors cheap and application state out of drawing code.

## Shell and ownership

Use one command vocabulary across menus, status items, buttons, and accelerators. Use explicit route parameters, focus restoration, and lifecycle ownership. Place long-lived state above screens, screen state in an owner disposed with the screen, and ephemeral state in its widget. Derive with `computed`; reserve `effect` for side effects.

## Asynchronous work

Model idle/loading/success/error explicitly. Prevent stale completions with cancellation or request identity. Inject filesystem, transport, clock, and process seams. Serialize unsafe mutations.

## Terminal constraints

Design normal, minimum, and narrow sizes. Collapse panes, shorten labels, switch tabs, or state the size requirement. Do not assume mouse input, Unicode width, true color, or specific capabilities.

## Clipboard boundary

Treat the application event loop's raw plain-text value as the canonical clipboard. Copy and cut
commit there before attempting host synchronization. Incoming host paste adopts the raw text before
the focused control inserts it. This keeps `Input`, `Editor`, and `CodeEditor` consistent even when
browser clipboard permission is denied or a terminal lacks OSC 52 support.

Keep host mechanisms at the mount boundary: browser hosts use the Clipboard API, and native hosts
may inject `readClipboardText` and `writeClipboardText`. OSC 52 remains a capability-gated outbound
copy path; browser clipboard integration is also outbound-only unless the host explicitly supplies
a reader. Bracketed paste remains a separate direct input path and never calls the reader.

```ts
const app = createApplication({
  readClipboardText: () => hostClipboard.read(),
  writeClipboardText: (text) => hostClipboard.write(text),
});

const loop = createEventLoop(viewport, {
  caps,
  readClipboardText: () => hostClipboard.read(),
  writeClipboardText: (text) => hostClipboard.write(text),
});
```

Callbacks exchange exact raw Unicode and line endings. Copy/cut commits canonical state first.
Native reads run one at a time in gesture order. Dispatch does not await pending async work; with an
async host adapter, pending reads do not block input or rendering. Never perform blocking
synchronous process or filesystem work inside a callback. Discard a result after focus or modal
changes, unmount/remount, stop, or disposal. Bound successful native text to a 1 MiB UTF-8 prefix
and retain truncation metadata. An empty success clears canonical state without editing. A reader
failure uses the current app-local canonical fallback. Never log clipboard payloads or host error
details.

The `tvedit` example uses `clipboardy`, which is private to the examples package; published SDK
packages do not depend on it. Its macOS `pbcopy`/`pbpaste`, Windows PowerShell/native, and Linux
X11/Wayland paths remain host-helper-dependent. In headless or SSH sessions, missing helpers fall
back while the app remains usable. JSVision does not install helpers, retry, or poll. Do not send
OSC 52 to a browser terminal, log clipboard contents, or interpret clipboard text as terminal
output.

## Security and reliability

- Treat paste, filenames, terminal responses, and remote data as untrusted.
- Never concatenate ANSI in widgets.
- Bound histories, logs, buffers, caches, and queues.
- Restore terminal state through the application lifecycle.
- Redact secrets and surface recoverable failures.
- Test disposal, cancellation, repeated open/close, startup failure, and shutdown.
