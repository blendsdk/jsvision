---
title: Switch
description: Toggle one boolean setting with a compact signal-bound Switch that exposes focused, on, off, and disabled states.
---

# Switch

`Switch` is a one-row boolean control with an optional caption, a bracketed track, a sliding knob,
and optional localized On/Off words. Its two-way `Signal<boolean>` can be changed by the user or by
application code, and either route repaints immediately.

Use it for an immediate setting whose two states are easy to understand. Space, Enter, click, and an
optional caption accelerator all toggle the same bound value.

## Usage

```ts
import { Switch, signal } from '@jsvision/ui';

const wifi = signal(false);
const control = new Switch({
  value: wifi,
  label: '~W~i-Fi',
  onLabel: 'On',
  offLabel: 'Off',
});
```

## Live example

<PlayExample id="controls/switch" title="Switch-state laboratory" blurb="Compare focused, on, off, custom-label, and disabled switches; toggle by hotkey, keyboard, and mouse." />

The summary line reads the same signals the controls update. Reset proves external signal writes,
while a locked switch demonstrates that disabled input remains inert.

## Props

`Switch` accepts `SwitchOptions`:

| Prop       | Type              | Default            | Purpose                                                 |
| ---------- | ----------------- | ------------------ | ------------------------------------------------------- |
| `value`    | `Signal<boolean>` | —                  | Two-way on/off source of truth.                         |
| `label`    | `string`          | no caption         | Text left of the track; `~X~` marks an Alt-hotkey.      |
| `onLabel`  | `string`          | localized `On`     | Text right of the track while true; `''` hides it.      |
| `offLabel` | `string`          | localized `Off`    | Text right of the track while false; `''` hides it.     |
| `disabled` | `boolean`         | `false`            | Makes the control dim, inert, and unavailable to focus. |
| `i18n`     | `I18n`            | English UI catalog | Translation source for default state words.             |

`select(on)` changes the bound value programmatically unless the switch is disabled. The public
`Signal<boolean>` remains the simplest route for external reset or synchronized settings.

## Size and Layout

`measure()` returns one row and enough width for the caption, a gap, the six-cell `[    ]` track,
another gap, and the wider of the On/Off words. This stable maximum prevents the surrounding layout
from shifting when the value changes.

An unlabelled switch with hidden state words measures `6×1`. Explicitly narrowing below the measured
width clips trailing content, so prefer auto sizing or reserve the measured width in a row layout.

## States and disabled behavior

Off places the knob at the left end of a dim track; on places it at the right end of the button
palette. Focus accents the brackets and the on-state foreground. Terminals without Unicode render
an ASCII `o` instead of `●`.

A disabled switch cannot receive focus and ignores click, Space, Enter, Alt-hotkeys, and `select`.
Its track, brackets, and knob use the disabled cluster role, while caption and state text remain on
the neutral static-text surface. The constructor captures disabled state; use a newly built control
when availability itself must change reactively.

## Keyboard & mouse

| Input                             | Result                                                       |
| --------------------------------- | ------------------------------------------------------------ |
| **Space / Enter** while focused   | Toggle the bound boolean.                                    |
| **Click** anywhere on the control | Focus and toggle on mouse-down.                              |
| **Alt** + caption hotkey          | Focus and toggle from elsewhere in the active dialog.        |
| External `value.set(...)`         | Repaint knob, track, and state word without synthetic input. |

A switch without a marked caption has no Alt-hotkey. Disabled controls retain their accelerator
claim for duplicate-detection purposes but do not handle it.

## Best Practices

- Phrase the caption as a setting, not an action: “Wi-Fi” with On/Off is clearer than “Change
  network.”
- Use unique dialog accelerators and keep visible On/Off words when the knob position may be
  unfamiliar.
- Reserve disabled state for genuinely unavailable settings and explain the reason nearby.
- Use [`CheckGroup`](/components/controls/check-group) for several related booleans or
  [`RadioGroup`](/components/controls/radio-group) when exactly one named alternative must win.

## Theming

`Switch` intentionally reuses established roles:

| Theme role        | Region                                              |
| ----------------- | --------------------------------------------------- |
| `button`          | Enabled on-state track.                             |
| `buttonFocused`   | Focused brackets and focused on-state track.        |
| `staticText`      | Caption, state word, row fill, and off-state track. |
| `labelShortcut`   | Marked caption accelerator while enabled.           |
| `clusterDisabled` | Disabled track, brackets, and knob.                 |

Test both boolean states when changing these roles. In particular, the off track must remain visible
against `staticText`, and the focused brackets must be distinguishable without erasing the knob.

## Related

- [Check Group](/components/controls/check-group) — several independent boolean settings.
- [Radio Group](/components/controls/radio-group) — one choice among named alternatives.
- [Slider](/components/controls/slider) — a bounded numeric setting.
- [Switch API](/api/ui/classes/Switch) — generated `SwitchOptions`, measurement, and selection API.
