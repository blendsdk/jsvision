---
title: Radio Group
description: Model one required choice with a vertically navigable RadioGroup bound to a selected-index signal.
---

# Radio Group

`RadioGroup` presents mutually exclusive choices as one focusable control. Its two-way
`Signal<number>` stores the selected label's index, and moving the highlighted row with Up or Down
selects immediately. That arrow behavior distinguishes a radio group from independent checkboxes.

Use it when the user must choose exactly one option from a short, visible list. The `( )` and `(•)`
markers keep the current value readable without relying on color.

## Usage

```ts
import { RadioGroup, signal } from '@jsvision/ui';

const alignment = signal(0);
const group = new RadioGroup({
  labels: ['~L~eft', '~C~enter', '~R~ight'],
  value: alignment,
});
```

## Live example

<PlayExample id="controls/radio-group" title="Exclusive-selection laboratory" blurb="Move with arrows, choose by mouse or Alt-hotkey, and observe navigation skip a disabled option." />

The selected name and numeric index update together. A disabled row remains visible so you can test
wrapping navigation without losing the context of the complete choice set.

## Props

`RadioGroup` accepts `RadioGroupOptions`:

| Prop     | Type                | Purpose                                                       |
| -------- | ------------------- | ------------------------------------------------------------- |
| `labels` | `readonly string[]` | Ordered option captions; each may mark one `~X~` accelerator. |
| `value`  | `Signal<number>`    | Two-way selected index and the initial highlighted row.       |

Call `setItemEnabled(index, enabled)` to change whether a row can be selected. The method ignores an
index outside the labels array.

Seed the `Signal<number>` with a valid enabled index. The constructor uses that value as its initial
highlight; later external writes repaint the marker but do not move the internal highlight.

## Size and Layout

The control needs one row per label. Each row reserves five cells for its `( )` marker and starts the
caption in the sixth cell. Assign enough width for the longest display label after tilde markers are
removed.

Height smaller than the label count clips trailing choices; `RadioGroup` does not scroll internally.
For a long or dynamic set, prefer a list-oriented control rather than hiding radio choices outside a
scroll viewport.

## Exclusive selection

Selecting a row writes only its index, so two rows can never be on at the same time. Space and click
select the highlighted or pointed row; Up and Down both move and commit selection. Re-selecting the
current row writes the same value and leaves the display unchanged.

Disabled choices are skipped during wrapped arrow movement and ignore click, Space, and accelerators.
Disabling the currently bound index does not silently rewrite application state, so reconcile that
value explicitly when availability rules change.

## Keyboard & mouse

| Input                    | Result                                                              |
| ------------------------ | ------------------------------------------------------------------- |
| **Up / Down**            | Move, wrap, skip disabled rows, and select the new highlighted row. |
| **Space**                | Select the highlighted enabled row.                                 |
| **Click** an enabled row | Focus the group, move the highlight, and select that row.           |
| **Alt** + item hotkey    | Focus the group and select the matching enabled row dialog-wide.    |

When no row is enabled, arrows are a handled no-op. This keeps focus stable rather than leaking
navigation to a surrounding container.

## Best Practices

- Write labels as parallel alternatives and keep the list short enough to scan as one decision.
- Use a valid initial index and update it when disabling the selected choice; do not make users infer
  a hidden fallback.
- Choose unique item accelerators inside the dialog.
- Use [`CheckGroup`](/components/controls/check-group) when more than one item may be selected, or
  [`Switch`](/components/controls/switch) for a single immediate on/off setting.

## Theming

| Theme role        | Region                                               |
| ----------------- | ---------------------------------------------------- |
| `clusterNormal`   | Enabled rows outside the current keyboard highlight. |
| `clusterSelected` | Highlighted row while the group owns focus.          |
| `clusterShortcut` | Marked accelerator glyph on enabled rows.            |
| `clusterDisabled` | Disabled marker, caption, and accelerator.           |

The marker uses the same row role as its caption. Preserve a strong foreground distinction between
normal and selected states, and keep the filled `•` glyph legible on both.

## Related

- [Check Group](/components/controls/check-group) — independent boolean choices.
- [Multi-check Group](/components/controls/multi-check-group) — ordered multi-state choices.
- [Switch](/components/controls/switch) — one immediate boolean choice.
- [RadioGroup API](/api/ui/classes/RadioGroup) — generated `RadioGroupOptions` and methods.
