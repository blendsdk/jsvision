---
title: Status Line
description: Present JSVision command hints, shortcuts, reactive labels, flexible spacing, enablement, and click/drag activation in the application footer.
---

# Status Line

`StatusLine` is the application's one-row footer for compact, actionable hints. Command items share
the event loop's enablement and dispatch pipeline; passive labels and one-row widgets can sit beside
them, while flexible spacers distribute the available width.

Build one with `statusLine`, `statusItem`, and `spacer`, then pass it to `createApplication`.

## Usage

```ts
import { createApplication, spacer, statusItem, statusLine } from '@jsvision/ui';

const status = statusLine([
  statusItem('~F1~ Help', 'help', 'F1'),
  spacer(),
  statusItem('~Ctrl+S~ Save', 'document.save', 'Ctrl+S'),
]);
const app = createApplication({ statusLine: status });
```

## Live example

<PlayExample id="application/status-line" title="Status Line laboratory" blurb="Activate a real Save status item, toggle its command enablement, and inspect passive versus command-bearing segments." />

Press **Alt+S** to activate Save and **Alt+E** to enable or disable it. The shell footer remains the
real target; the centered dialog reports exactly what the footer emitted.

## Props and public state

`StatusLine` extends `Group` and exposes its wired command seam plus `setItems(views)`.

| Builder                            | Result                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ |
| `statusLine(children)`             | One-row command-aware container.                                         |
| `statusItem(text, command?, key?)` | Reactive label, optionally command-bearing with a chord.                 |
| `spacer({ fixed })`                | Fixed gap, or flexible remaining-space segment when options are omitted. |

The item text may be a getter, enabling clocks, mode indicators, and counts without replacing the
bar. Omitting `command` creates a passive label.

## Size and Layout

The status line occupies one fixed application row and lays children left-to-right. Command items
measure from their display text plus side padding. A flexible `spacer()` absorbs remaining cells;
a fixed spacer reserves an exact gap.

Long labels can crowd later items, so put essential actions first and test the smallest supported
width. Embedded widgets must fit one row.

## Command items and enablement

All command-bearing items query `app.loop.isCommandEnabled(command)` during painting and activation.
`enableCommand(command, false)` therefore greys the item and blocks both its chord and pointer
release.

```ts
import type { Application } from '@jsvision/ui';

function updateSave(app: Application, dirty: boolean): void {
  app.loop.enableCommand('document.save', dirty);
}
```

`setItems` replaces children in place and re-wires their enablement readers, which lets a Router
present screen-specific actions while retaining the same live bar.

## Keyboard and pointer input

The optional `key` string is executable, not decorative: matching decoded chords emit the command
after the focused view declines the event. Pointer activation follows a press/drag/release model.
Press highlights an item, dragging can retarget the highlight, and release emits the enabled item
under the pointer. Releasing over a passive gap emits nothing.

This post-process order allows a focused editor to consume a chord before the status fallback uses
it.

## Best Practices

- Show a small set of high-value, currently meaningful actions.
- Use the same command name and chord in keymaps, menus, and status hints.
- Disable unavailable actions through the loop rather than hiding them unexpectedly.
- Keep passive state concise and push secondary information behind a spacer.
- Test press/drag/release, disabled activation, and narrow layouts.

## Theming

`statusBar` paints the row and normal items, `statusSelected` marks the held pointer target, and
`statusDisabled` dims unavailable commands. Accelerators use each role's hotkey accent. Preserve
contrast against both the desktop and the centered `dialog`, including monochrome output.

## Related

- [Application](/components/application/application) — wires commands, enablement, and the footer.
- [Menu Bar](/components/application/menu-bar) — hierarchical commands using the same names.
- [Router](/components/application/router) — swaps per-screen status contributions.
- [StatusLine API](/api/ui/classes/StatusLine), [statusLine API](/api/ui/functions/statusLine), and
  [statusItem API](/api/ui/functions/statusItem).
