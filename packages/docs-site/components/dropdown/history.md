---
title: History
description: History — a ▐↓▌ dropdown next to an Input that recalls that field's past values from a bounded most-recently-used store.
---

# History

`History` is a small `▐↓▌` button you place next to an [`Input`](/components/controls/input). Opening
it drops a bounded most-recently-used (MRU) list of that field's past values in an anchored popup;
picking one replaces the field's text. Values live either in a process-global store keyed by a numeric
`historyId`, or in an app-owned `Signal<string[]>` you pass in. Like the other dropdowns, it needs an
overlay host to open, so it is a no-op headless.

## Usage

```ts
import { History, Input, Group, historyAdd, signal } from '@jsvision/ui';

const value = signal('/etc/hosts');
const input = new Input({ value });
input.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 20, height: 1 } };

// Seed the shared store for id 1, then link a dropdown to the field.
for (const past of ['/usr/bin', '/etc/hosts', '~/dev']) historyAdd(1, past);
const history = new History({ link: input, historyId: 1 });
history.layout = { position: 'absolute', rect: { x: 22, y: 1, width: 3, height: 1 } };

const controls = new Group();
controls.add(input);
controls.add(history);
// Alt+↓ (or a click on the button) drops the field's past values; Enter fills the field.
```

## Live example

<PlayComingSoon title="History" />

## Props

`new History(options)`.

| Prop        | Type               | Default | Description                                                          |
| ----------- | ------------------ | ------- | -------------------------------------------------------------------- |
| `link`      | `Input`            | —       | The `Input` this history is linked to (its text is read + replaced). |
| `historyId` | `number`           | `0`     | Numeric id keying the process-global MRU store (shared by id).       |
| `history`   | `Signal<string[]>` | —       | Bind an app-owned list instead of the global store.                  |
| `maxRows`   | `number`           | `6`     | Max visible popup rows.                                              |

### The MRU store

Standalone helpers manage the process-global store (each id keeps an oldest→newest list, capped at
`HISTORY_MAX_ENTRIES` = 16):

| Function                | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| `historyAdd(id, str)`   | Record a value: skip empty, dedup to newest, append, evict the oldest over cap. |
| `historyEntries(id)`    | A safe-to-mutate snapshot copy, oldest→newest.                                  |
| `historyStr(id, index)` | The `index`-th entry (0 = oldest), or `undefined` out of range.                 |
| `historyCount(id)`      | The entry count for an id.                                                      |
| `clearHistory()`        | Clear every id's history (handy between runs or in tests).                      |

## Keyboard & mouse

| Input                      | Result                                                                    |
| -------------------------- | ------------------------------------------------------------------------- |
| **Down**                   | Open the popup (while the linked field is focused).                       |
| **Alt+Down**               | Open the popup from anywhere.                                             |
| **Click** the `▐↓▌` button | Open the popup.                                                           |
| **↑ / ↓**                  | Move through the entries (starts on the second-oldest when there are ≥2). |
| **Enter / click** an entry | Copy it into the field (clamped to max length) and select all its text.   |
| **Esc / click outside**    | Dismiss; the field is left unchanged.                                     |

Opening first records the field's current text into the store, then shows the list. With no overlay
host available, opening is a no-op.

## Sizing & layout

The button is a fixed 3-cell `▐↓▌` glyph; place it flush against the right edge of the linked field.
The popup anchors to the field and shows up to `maxRows` entries.

## Best practices

- **Share a list with an id.** Two `History` controls with the same `historyId` share one MRU list —
  the natural way to give "recent files" the same history across dialogs.
- **Or own the list.** Pass a `history` signal when you want the app to persist or seed the entries
  itself, rather than using the process-global store.
- **Reset in tests.** `clearHistory()` empties the global store so golden output stays deterministic.

## Theming

The button draws the shared `▐↓▌` dropdown icon; the popup rows use the history-viewer roles
(white-on-blue / white-on-green) so they blend into the blue popup window.

## Related

- [Combo box](/components/dropdown/combo-box) — a field + dropdown list of arbitrary items.
- [Input](/components/controls/input) — the field a history dropdown recalls values for.
