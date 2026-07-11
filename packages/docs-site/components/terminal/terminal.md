---
title: Terminal
description: Terminal — a passive scrolling log view; stream text into it with write / writeLine, wheel back through the history.
---

# Terminal

`Terminal` is a passive scrolling log view — a place to stream program output, log lines, or command
results into. You feed it with `write` / `writeLine`; it keeps the most recent output in a
fixed-capacity ring buffer and shows the newest lines at the bottom. It is **not focusable** and takes
no keyboard input; scroll-back is mouse-wheel only, and any new write snaps the view back to the
newest line. Incoming text is sanitized as it is drawn, so untrusted output can't corrupt the screen.

## Usage

```ts
import { Group, Terminal, terminalWriter } from '@jsvision/ui';

const group = new Group();
const log = new Terminal({ capacity: 8000 });
log.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 60, height: 10 } };
group.add(log);

log.writeLine('Build started...');
log.write('compiling');
log.write('.'.repeat(3) + '\n');
log.writeLine('Done.');

// Wrap it as a plain (text) => void sink for anything that streams strings:
const write = terminalWriter(log);
write('server listening on :8080\n');
// childProcess.stdout.on('data', (chunk) => write(String(chunk)));
```

## Live example

<PlayComingSoon title="Terminal" />

## Props

`new Terminal(options)`.

| Prop       | Type     | Default | Description                                                          |
| ---------- | -------- | ------- | -------------------------------------------------------------------- |
| `capacity` | `number` | `32000` | Scroll-back retained, in UTF-16 code units. Older lines are dropped. |

### Methods

| Member                 | Description                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| `write(text)`          | Append raw text; snaps the view back to the bottom.                        |
| `writeLine(text)`      | Append one line (adds the trailing newline).                               |
| `clear()`              | Drop all content.                                                          |
| `terminalWriter(term)` | Standalone helper: wraps a `Terminal` as a `(text) => void` callback sink. |

## Keyboard & mouse

| Input          | Result                                                |
| -------------- | ----------------------------------------------------- |
| **Wheel up**   | Scroll back through history (3 lines per notch).      |
| **Wheel down** | Scroll forward toward the newest line.                |
| Any `write`    | Jumps back to the bottom (pinned to the newest line). |

Mouse buttons and keyboard keys are inert — this is a passive output sink.

## Sizing & layout

Give it an absolute rect (or a flex size). It shows the newest lines that fit the height, pinned to
the bottom; a wheel-up offsets that window upward until the oldest retained line, then stops.

## Best practices

- **Stream through `terminalWriter`.** It adapts the view to the `(text) => void` shape a logger,
  a subprocess `stdout` handler, or a progress reporter already expects.
- **Size `capacity` to the workload.** The ring is bounded — a chatty build log wants more than the
  default; a short status feed wants less.
- **Don't sanitize upstream.** Every cell is sanitized at draw time, so it is safe to pipe raw,
  possibly-hostile process output straight in.

## Theming

Lines are drawn in the `terminalNormal` role.

## Related

- [Surface view](/components/surface/surface-view) — a scrollable window onto an offscreen canvas.
- [List box](/components/containers/list-box) — a focusable, selectable single-column list.
- [API reference](/api/ui/classes/Terminal) — the generated `Terminal` signature.
