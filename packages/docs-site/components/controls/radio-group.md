---
title: Radio group
description: RadioGroup — a column of mutually-exclusive radio buttons bound to a number signal (the selected index).
---

# Radio group

`RadioGroup` is a column of mutually-exclusive radio buttons (`( )` / `(•)`) where **exactly one**
item is selected. It binds two-way to a `Signal<number>` holding the selected index. `↑` / `↓` move
**and** select — moving the highlight picks that option — and **Space**, a click, or **Alt**+a label's
hotkey also select. Mark a hotkey with tildes, e.g. `'~L~eft'`.

## Usage

```ts
import { RadioGroup, signal } from '@jsvision/ui';

const align = signal(0); // 0 = Left
const group = new RadioGroup({ labels: ['~L~eft', '~C~enter', '~R~ight'], value: align });
// Pressing ↓ moves the selection: align() becomes 1 (Center), then 2 (Right).
```

## Live example

<PlayComingSoon title="Radio group" />

## Props

`new RadioGroup(options)`.

| Prop     | Type                | Description                                         |
| -------- | ------------------- | --------------------------------------------------- |
| `labels` | `readonly string[]` | One label per option; each may mark a `~X~` hotkey. |
| `value`  | `Signal<number>`    | Two-way binding to the selected option index.       |

## Keyboard & mouse

| Input          | Result                                                                 |
| -------------- | ---------------------------------------------------------------------- |
| **↑ / ↓**      | Move the highlight **and** select that option (wraps; skips disabled). |
| **Space**      | Select the highlighted option.                                         |
| **Click**      | Focus and select the clicked option.                                   |
| **Alt**+hotkey | Select that option, from anywhere in the dialog.                       |

Because moving the highlight also selects, arrowing through a `RadioGroup` changes `value` on every
step — that's what makes a radio group feel like one control rather than a stack of buttons.

## Best practices

- **Use it only for exclusive choices.** Exactly one option is always selected; if users should pick
  several, use [`CheckGroup`](/components/controls/check-group).
- **Seed `value` to a valid index.** The highlight starts on the currently-selected item.

## Theming

Shares the check/radio cluster roles: `clusterNormal`, `clusterSelected` (focused), `clusterShortcut`
(the `~hotkey~` accent), and `clusterDisabled`.

## Related

- [Check group](/components/controls/check-group) — independent (multi-select) checkboxes.
- [Switch](/components/controls/switch) — a single on/off toggle.
