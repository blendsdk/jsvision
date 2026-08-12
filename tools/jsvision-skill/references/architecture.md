# Professional application architecture

Use four layers: domain invariants; injectable services; reactive state/actions; JSVision presentation. Import only public entry points. Keep constructors cheap and application state out of drawing code.

## Shell and ownership

Use one command vocabulary across menus, status items, buttons, and accelerators. Use explicit route parameters, focus restoration, and lifecycle ownership. Place long-lived state above screens, screen state in an owner disposed with the screen, and ephemeral state in its widget. Derive with `computed`; reserve `effect` for side effects.

## Asynchronous work

Model idle/loading/success/error explicitly. Prevent stale completions with cancellation or request identity. Inject filesystem, transport, clock, and process seams. Serialize unsafe mutations.

## Terminal constraints

Design normal, minimum, and narrow sizes. Collapse panes, shorten labels, switch tabs, or state the size requirement. Do not assume mouse input, Unicode width, true color, or specific capabilities.

## Kanban boundary

Use `@jsvision/kanban` when work records must remain application-owned while the SDK supplies a
responsive, bounded terminal board. Provide a `KanbanDataSource<TCard>` and card adapter; retain
persistence, authorization, workflow policy, and mutation in the application. The optional
`StandardCard` model is a convenience rather than a required record schema.

One mounted board owns one viewport, read coordinator, and interaction controller. A revisioned query
session exposes sparse cursors for visible and overscan column/swimlane cells. The controller owns
bounded semantic focus, selection, range anchor, pending navigation, and feedback—not application
records or authorization. Replace or dispose the board through its lifecycle so generation
invalidation and cancellation can prevent stale range/navigation completion. Do not treat a loaded
window as a logical edge or materialize a large logical board merely to simplify the view.

The board uses JSVision's layout DSL around one exact-cell viewport leaf and can be hosted directly
on a surface or inside an application-owned window. Its canonical sparse scene drives scrolling,
clipped variable-height cards, damage, and semantic hit targets. Mounted keyboard and pointer input
supports spatial navigation, bounded selection, activation, context, descriptor actions, retry, and
wheel scrolling. Unknown and Alt-modified keys remain available to the containing application. A
primary card press stays click-eligible until bounded movement crosses the configured drag
threshold; the mounted viewport then owns pointer capture, stable lifted-card feedback, semantic
before/after gap targeting, edge autoscroll, and atomic release through the application dispatcher.

Receive `open-card`, `open-context`, and `scoped-action` through `onInteraction`, or use the stable
`board.interaction()` facade programmatically. Each application intent contains semantic identities,
origin, closed scope, and a detached eligible selection snapshot; it never contains records or grants
mutation authority. Keep data changes behind the application-owned `KanbanRequest` dispatcher and
publish the authoritative result through the source. A standalone incremental kitchen sink now
demonstrates shipped board, card, swimlane, responsive, keyboard, pointer-drag, application-owned
publication, and operation-lifecycle behavior. Commands, card editors, lane-configuration UI, and
docs-site component labs remain later surfaces.
See the exact current API in [api/kanban.md](api/kanban.md).

## Clipboard boundary

Treat the application event loop's raw plain-text value as the canonical clipboard. Copy and cut
commit there before attempting host synchronization. Incoming host paste adopts the raw text before
the focused control inserts it. This keeps `Input`, `Editor`, and `CodeEditor` consistent even when
browser clipboard permission is denied or a terminal lacks OSC 52 support.

Keep host mechanisms at the mount boundary: browser hosts use the Clipboard API, while
`Application.run()` installs a lazy system text clipboard by default. Pass
`systemClipboard: false` to opt out. Native hosts with a custom boundary may inject
`readClipboardText` and `writeClipboardText`; explicit callbacks take precedence over the
automatic pair. OSC 52 remains a capability-gated outbound fallback. Browser clipboard integration
is outbound-only unless the host explicitly supplies a reader. Bracketed paste remains a separate
direct input path and never calls the reader.

```ts
const app = createApplication({
  readClipboardText: () => hostClipboard.read(),
  writeClipboardText: (text) => hostClipboard.write(text),
});

const isolatedApp = createApplication({ systemClipboard: false });

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

The published UI runtime uses `clipboardy` lazily for its automatic macOS `pbcopy`/`pbpaste`,
Windows PowerShell/native, and Linux X11/Wayland paths. Those paths remain host-helper-dependent.
In headless or SSH sessions, missing helpers fall back while the app remains usable. JSVision does
not install helpers, retry, or poll. Do not send OSC 52 to a browser terminal, log clipboard
contents, or interpret clipboard text as terminal output.

## Security and reliability

- Treat paste, filenames, terminal responses, and remote data as untrusted.
- Never concatenate ANSI in widgets.
- Bound histories, logs, buffers, caches, and queues.
- Restore terminal state through the application lifecycle.
- Redact secrets and surface recoverable failures.
- Test disposal, cancellation, repeated open/close, startup failure, and shutdown.
