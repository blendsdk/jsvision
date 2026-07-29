---
title: Check Group
description: Present several independent boolean choices as a keyboard- and mouse-friendly group bound to one signal.
---

# Check Group

`CheckGroup` presents a vertical set of independent checkboxes. Every label corresponds to one
boolean in a two-way `Signal<boolean[]>`, so users can select none, one, or many items without the
exclusive-choice semantics of a radio group.

The control owns one focus stop for the whole set. Arrow keys move its highlighted row, while Space,
clicks, and item-specific Alt-hotkeys toggle individual values.

## Usage

```ts
import { CheckGroup, signal } from '@jsvision/ui';

const formatting = signal([true, false, false]);
const group = new CheckGroup({
  labels: ['~B~old', '~I~talic', '~S~trike'],
  value: formatting,
});
```

## Live example

<PlayExample id="controls/check-group" title="Independent-selection laboratory" blurb="Toggle formatting choices by arrows, Space, mouse, and Alt-hotkeys; compare an inert disabled row." />

The live readout names every selected item. One row is disabled so wrapping navigation and inert
input are visible beside enabled states instead of described in isolation.

## Props

`CheckGroup` accepts `CheckGroupOptions`:

| Prop     | Type                | Purpose                                                                 |
| -------- | ------------------- | ----------------------------------------------------------------------- |
| `labels` | `readonly string[]` | One caption per row; each may mark one `~X~` item accelerator.          |
| `value`  | `Signal<boolean[]>` | Two-way state with one boolean per label, in the same positional order. |

The bound array is the public source of truth. Missing entries read as `false`; the next toggle
writes a normalized array whose length matches the labels.

Each row can also be changed at runtime with `setItemEnabled(index, enabled)`. An invalid index is a
safe no-op.

## Size and Layout

The group draws one item per row and uses five cells for the checkbox marker before the label begins.
Allocate at least `labels.length` rows to show every choice and enough width for the longest display
label plus the marker. A shorter height clips trailing items; the control does not add scrolling.

Treat the whole group as one layout child. Place a heading or explanatory `Text` above it when the
choices need a shared question, and use an enclosing scrolling container when the option set cannot
fit the available dialog.

## Independent selection

Toggling one item copies and writes the full boolean array without clearing any other item. External
signal writes repaint the markers, so application presets and reset actions stay synchronized with
keyboard and mouse changes.

Disabled rows remain visible in a muted role. Arrow navigation skips them, and Space, click, or their
Alt-hotkeys cannot change the corresponding boolean.

## Keyboard & mouse

| Input                    | Result                                                          |
| ------------------------ | --------------------------------------------------------------- |
| **Up / Down**            | Move the highlighted row, wrapping and skipping disabled items. |
| **Space**                | Toggle the highlighted enabled row.                             |
| **Click** an enabled row | Focus the group, highlight that row, and toggle it.             |
| **Alt** + item hotkey    | Focus the group, highlight that enabled row, and toggle it.     |

If every row is disabled, arrows leave the selection unchanged. Item accelerators are available
dialog-wide because the group participates in post-processing.

## Best Practices

- Keep `labels` and the signal's positions stable. Reordering labels without remapping the values
  silently changes what each boolean means.
- Use independent, affirmative labels such as “Bold” or “Show line numbers.” For exactly one choice,
  use [`RadioGroup`](/components/controls/radio-group).
- Disable only temporarily unavailable choices and explain the reason nearby; a visible inert option
  without context looks broken.
- Use [`MultiCheckGroup`](/components/controls/multi-check-group) when each row has three or more
  ordered states rather than a boolean.

## Theming

| Theme role        | Region                                               |
| ----------------- | ---------------------------------------------------- |
| `clusterNormal`   | Enabled rows that do not own the internal highlight. |
| `clusterSelected` | The highlighted row while the group is focused.      |
| `clusterShortcut` | Marked accelerator glyph on enabled rows.            |
| `clusterDisabled` | Disabled row marker, label, and accelerator.         |

The `[ ]` and `[X]` marker glyphs use the row role. Ensure the normal and selected foregrounds remain
distinguishable even when their backgrounds are similar.

## Related

- [Radio Group](/components/controls/radio-group) — one mutually exclusive selection.
- [Multi-check Group](/components/controls/multi-check-group) — ordered state cycles per item.
- [Switch](/components/controls/switch) — one compact boolean setting.
- [CheckGroup API](/api/ui/classes/CheckGroup) — generated `CheckGroupOptions` and methods.
