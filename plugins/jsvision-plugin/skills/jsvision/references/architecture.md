# Professional application architecture

Use four layers: domain invariants; injectable services; reactive state/actions; JSVision presentation. Import only public entry points. Keep constructors cheap and application state out of drawing code.

## Shell and ownership

Use one command vocabulary across menus, status items, buttons, and accelerators. Use explicit route parameters, focus restoration, and lifecycle ownership. Place long-lived state above screens, screen state in an owner disposed with the screen, and ephemeral state in its widget. Derive with `computed`; reserve `effect` for side effects.

## Asynchronous work

Model idle/loading/success/error explicitly. Prevent stale completions with cancellation or request identity. Inject filesystem, transport, clock, and process seams. Serialize unsafe mutations.

## Terminal constraints

Design normal, minimum, and narrow sizes. Collapse panes, shorten labels, switch tabs, or state the size requirement. Do not assume mouse input, Unicode width, true color, or specific capabilities.

## Security and reliability

- Treat paste, filenames, terminal responses, and remote data as untrusted.
- Never concatenate ANSI in widgets.
- Bound histories, logs, buffers, caches, and queues.
- Restore terminal state through the application lifecycle.
- Redact secrets and surface recoverable failures.
- Test disposal, cancellation, repeated open/close, startup failure, and shutdown.
