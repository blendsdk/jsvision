---
title: Combo box
description: ComboBox — a text field plus a dropdown list of items of any type T, in editable (free text + filter) or select-only mode.
---

# Combo box

`ComboBox<T>` is a dropdown selector: a text [`Input`](/components/controls/input) plus a trailing
`▐↓▌` button that opens a scrollable [`ListView`](/components/containers/list-box) of items of any
type `T`. It binds two signals — `value` (the selected item, or `null`) and `text` (the field text) —
and works in two modes: **editable** (the default: free text that filters the list) and
**select-only** (a read-only picker with type-ahead). It opens on a click of the button, or on Down /
Alt+Down while the field is focused; opening needs an overlay host (the app shell provides one), so it
is a no-op headless.

## Usage

```ts
import { ComboBox, Group, createEventLoop, signal } from '@jsvision/ui';
import { resolveCapabilities } from '@jsvision/core';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const items = signal(['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go']);
const value = signal<string | null>(null);

const combo = new ComboBox<string>({ items, getText: (s) => s, value, editable: true });
combo.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 22, height: 1 } };

const controls = new Group();
controls.add(combo);
const loop = createEventLoop({ width: 40, height: 12 }, { caps });
loop.mount(controls);
loop.focusView(combo.input); // the field is the focus target
// Typing filters the candidates; Alt+↓ opens the list; Enter picks (sets value + text).
```

## Live example

<PlayComingSoon title="Combo box" />

## Props

`new ComboBox(options)`.

| Prop       | Type                               | Default            | Description                                                                |
| ---------- | ---------------------------------- | ------------------ | -------------------------------------------------------------------------- |
| `items`    | `Signal<T[]>`                      | —                  | The source items (reactive — the open select-only popup re-renders).       |
| `getText`  | `(item: T) => string`              | —                  | Render an item to its display string (list rows + the value ⟷ text match). |
| `value`    | `Signal<T \| null>`                | —                  | Two-way selected value (`null` = none / no exact match).                   |
| `text`     | `Signal<string>`                   | internal `''`      | Two-way field text.                                                        |
| `editable` | `boolean`                          | `true`             | `true` = free text + filter; `false` = read-only picker + type-ahead.      |
| `filter`   | `(item: T, text: string) => bool`  | substring (i-case) | Candidate predicate for editable mode.                                     |
| `onSelect` | `(index: number, item: T) => void` | —                  | Fired on pick, with the list index + item.                                 |
| `command`  | `string`                           | —                  | Typed command emitted on pick.                                             |
| `maxRows`  | `number`                           | `6`                | Max visible popup rows.                                                    |

The composed field is exposed as `combo.input` (the focus target); `combo.filtered()` reads the
current candidate list.

## Keyboard & mouse

| Input                      | Result                                                                       |
| -------------------------- | ---------------------------------------------------------------------------- |
| Type in the field          | **Editable:** filters the candidates. **Select-only:** read-only.            |
| **Down / Alt+Down**        | Open the dropdown list (while the field is focused).                         |
| **Click** the `▐↓▌` button | Open the dropdown list.                                                      |
| Type in the open list      | **Select-only:** type-ahead jumps the focused row.                           |
| **Enter / Space / click**  | Pick the focused row (sets `text` in editable mode, `value` in select-only). |

With no overlay host available (headless), opening is a no-op.

## Sizing & layout

One row: the text field (flex-grows) plus a trailing 3-cell dropdown button. Give it enough width for
the longest value you expect to show inline.

## Best practices

- **Pick the mode to match the intent.** Editable when free text is meaningful (a path, a search);
  select-only (`editable: false`) when the value must be one of the items.
- **`value` vs. `text`.** In editable mode `value` tracks the item whose `getText` exactly equals the
  field text, else `null` — so free text matching nothing leaves `value` null by design.
- **Focus the field, not the group.** Focus `combo.input`; the ComboBox sees Down/Alt+Down because
  the focused field is its descendant.

## Theming

The field uses the input roles, the button draws the shared `▐↓▌` dropdown icon, and the popup list
uses the standard list roles.

## Related

- [History](/components/dropdown/history) — a most-recently-used dropdown for an `Input`'s past values.
- [List box](/components/containers/list-box) — the list the dropdown opens.
- [Input](/components/controls/input) — the text field the combo box is built on.
- [API reference](/api/ui/classes/ComboBox) — the generated `ComboBox` signature.
