---
title: Switch
description: Switch — a compact on/off toggle bound to a boolean signal; Space, Enter, a click, or an Alt-hotkey flips it.
---

# Switch

`Switch` is a compact on/off toggle bound two-way to a `Signal<boolean>`. It shows an optional
caption, a bracketed sliding track with a knob on the left (off) or right (on), and an optional
`On` / `Off` word. Flip it with **Space** / **Enter** while focused, a click anywhere on it, or — when
the caption marks a `~X~` letter — that **Alt**+hotkey from anywhere in the dialog. The flip is
instant.

## Usage

```ts
import { Switch, signal } from '@jsvision/ui';

const wifi = signal(false);
const sw = new Switch({ value: wifi, label: '~W~i-Fi' });
// Space / Enter / a click / Alt+W flips it; wifi.set(true) drives it externally.
```

## Live example

<PlayComingSoon title="Switch" />

## Props

`new Switch(options)`.

| Prop       | Type              | Default | Description                                            |
| ---------- | ----------------- | ------- | ------------------------------------------------------ |
| `value`    | `Signal<boolean>` | —       | Two-way on/off state; an external write repaints.      |
| `label`    | `string`          | —       | Caption left of the track; `~X~` marks an Alt-hotkey.  |
| `onLabel`  | `string`          | `'On'`  | Word shown right of the track when on; `''` hides it.  |
| `offLabel` | `string`          | `'Off'` | Word shown right of the track when off; `''` hides it. |
| `disabled` | `boolean`         | `false` | Dim and inert (also not focusable).                    |

## Keyboard & mouse

| Input                             | Result                                         |
| --------------------------------- | ---------------------------------------------- |
| **Space / Enter** (while focused) | Toggle.                                        |
| **Click** (anywhere on it)        | Focus and toggle.                              |
| **Alt**+hotkey                    | Focus and toggle, from anywhere in the dialog. |

## Sizing

`Switch` supplies a `measure()` (caption + track + the wider of the on/off words), so an `auto` slot
sizes it without clipping. It draws on a single row.

## Best practices

- **Bind, don't poll.** Read `value()` for the current state and let an external `value.set(...)`
  drive the knob — the switch repaints itself.
- **Use it for a single on/off.** For a set of independent toggles use
  [`CheckGroup`](/components/controls/check-group); for a range, [`Slider`](/components/controls/slider).

## Theming

`Switch` adds **no new theme role** — it reuses existing ones: the on track is green (`button`, or
`buttonFocused` when focused), the off track dim (`staticText`), the hotkey accent `labelShortcut`,
and a disabled switch `clusterDisabled`.

## Related

- [Check group](/components/controls/check-group) — several independent on/off boxes.
- [Slider](/components/controls/slider) — a continuous value instead of two states.
