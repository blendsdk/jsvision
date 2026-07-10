---
title: Check group
description: CheckGroup — a column of independent checkboxes bound to a boolean[] signal; MultiCheckGroup adds multi-state items.
---

# Check group

`CheckGroup` is a column of independent checkboxes (`[ ]` / `[X]`) where **any number** of items can
be checked at once. It binds two-way to a `Signal<boolean[]>` — one flag per item, in the same order
as the labels. `↑` / `↓` move between items, **Space** or a click toggles the focused item, and
**Alt**+a label's hotkey toggles that item from anywhere in the dialog. Mark a hotkey with tildes,
e.g. `'~B~old'`.

## Usage

```ts
import { CheckGroup, signal } from '@jsvision/ui';

const styles = signal([true, false]); // Bold on, Italic off
const group = new CheckGroup({ labels: ['~B~old', '~I~talic'], value: styles });
// styles() tracks the checkbox states — after toggling Italic: [true, true]
```

## Live example

<PlayComingSoon title="Check group" />

## Props

`new CheckGroup(options)`.

| Prop     | Type                | Description                                            |
| -------- | ------------------- | ------------------------------------------------------ |
| `labels` | `readonly string[]` | One label per checkbox; each may mark a `~X~` hotkey.  |
| `value`  | `Signal<boolean[]>` | Two-way binding — one boolean flag per item, in order. |

## Keyboard & mouse

| Input          | Result                                            |
| -------------- | ------------------------------------------------- |
| **↑ / ↓**      | Move the highlight (wraps; skips disabled items). |
| **Space**      | Toggle the highlighted item.                      |
| **Click**      | Focus and toggle the clicked item.                |
| **Alt**+hotkey | Toggle that item, from anywhere in the dialog.    |

## Best practices

- **Match the array length to the labels.** `value` holds one flag per label, in order; a shorter
  array reads the missing items as unchecked and is normalised to full length on the next toggle.
- **Reach for it when choices are independent.** For a mutually-exclusive pick, use
  [`RadioGroup`](/components/controls/radio-group); for a single on/off, [`Switch`](/components/controls/switch).

## Multi-state variant

`MultiCheckGroup` is the same column, but each item cycles through **more than two** states instead of
on/off. You supply the ordered marker glyphs and bind to a `Signal<number[]>` of state indices;
pressing an item advances it to the next state, wrapping at the end.

```ts
import { MultiCheckGroup, signal } from '@jsvision/ui';

const levels = signal([0, 2]); // Volume off, Treble full
const group = new MultiCheckGroup({
  items: ['~V~olume', '~T~reble'],
  states: ' xX', // three states: off, some, full
  value: levels,
});
// Pressing Space on Volume cycles it 0 → 1 → 2 → 0.
```

| Prop     | Type                | Description                                                                         |
| -------- | ------------------- | ----------------------------------------------------------------------------------- |
| `items`  | `readonly string[]` | One label per item; each may mark a `~X~` hotkey.                                   |
| `states` | `string`            | Ordered marker glyphs, one per state (e.g. `' xX'`) — its length = the state count. |
| `value`  | `Signal<number[]>`  | Two-way binding — one state index per item, in order.                               |

## Theming

| Role              | Applies to                  |
| ----------------- | --------------------------- |
| `clusterNormal`   | An item's normal text       |
| `clusterSelected` | The focused item            |
| `clusterShortcut` | The `~hotkey~` accent glyph |
| `clusterDisabled` | A disabled item             |

## Related

- [Radio group](/components/controls/radio-group) — the mutually-exclusive counterpart.
- [Switch](/components/controls/switch) — a single on/off toggle.
