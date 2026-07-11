---
title: Color picker
description: ColorPicker — a one-line color chip with a dropdown swatch and an optional hex field; the swatch and hex share one Color value.
---

# Color picker

`ColorPicker` is a compact one-line color field: a color **chip** plus a trailing `▐↓▌` dropdown
button that opens a [`ColorSwatch`](/components/color/color-swatch) (and an optional hex
[`Input`](/components/controls/input)) in a popup anchored to the field. The chip shows the current
`value` as a colored block plus a caption. Picking a swatch cell (releasing over it or pressing Enter)
commits the color and closes; with `allowCustom` on, a hex field accepts any `#rrggbb` truecolor. The
swatch and hex field share the picker's `value` and stay in sync without churning a named color (e.g.
`'red'`) into its hex form.

## Usage

```ts
import { ColorPicker, signal } from '@jsvision/ui';
import type { Color } from '@jsvision/core';

const value = signal<Color>('blue');
const picker = new ColorPicker({
  value,
  allowCustom: true, // include a #rrggbb hex field in the popup
  onChange: (c) => console.log('picked', c),
});
picker.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 16, height: 1 } };
// Down / Alt+Down / click the ▐↓▌ button opens the swatch; Tab reaches the hex field.
```

## Live example

<PlayComingSoon title="Color picker" />

## Props

`new ColorPicker(options)`.

| Prop          | Type                   | Default        | Description                                                                |
| ------------- | ---------------------- | -------------- | -------------------------------------------------------------------------- |
| `value`       | `Signal<Color>`        | —              | Two-way selected color (shared with the swatch + hex field).               |
| `colors`      | `readonly Color[]`     | `ANSI16_ORDER` | Palette forwarded to the `ColorSwatch`.                                    |
| `columns`     | `number`               | `4`            | Columns forwarded to the `ColorSwatch`.                                    |
| `allowCustom` | `boolean`              | `true`         | Include a hex `Input` for arbitrary `#rrggbb` truecolor.                   |
| `label`       | `string`               | —              | Chip caption prefix (used when `nameFor` is absent).                       |
| `nameFor`     | `(c: Color) => string` | —              | Name accessor for the chip caption.                                        |
| `onInput`     | `(c: Color) => void`   | —              | Fired on every live change in the popup (arrow / click / drag).            |
| `onChange`    | `(c: Color) => void`   | —              | Fired on the commit gesture (Enter / Space / mouse-up), which also closes. |

## Keyboard & mouse

| Input                      | Result                                                          |
| -------------------------- | --------------------------------------------------------------- |
| **Down / Alt+Down**        | Open the dropdown swatch.                                       |
| **Click** the `▐↓▌` button | Open the dropdown swatch.                                       |
| Pick a swatch cell         | Commit the color and close (Enter / Space / mouse-up).          |
| **Tab** (in the popup)     | Move to the hex field (when `allowCustom`).                     |
| Type `#rrggbb`             | Set a custom truecolor; an incomplete/invalid value is ignored. |

With no overlay host available (headless), opening is a no-op.

## Sizing & layout

One row: the color chip plus a trailing 3-cell dropdown button. Give it enough width for the caption
and the button.

## Best practices

- **Turn on `allowCustom` for truecolor.** The DOS-16 swatch covers the classic palette; the hex field
  opens the full 24-bit space for anything else.
- **Named values survive.** Selecting `'red'` stays `'red'` — it isn't rewritten to `#ff0000` — so
  themed, named colors round-trip cleanly.
- **Split live vs. committed.** `onInput`/`onChange` forward to the hosted swatch: preview on
  `onInput`, persist on `onChange` (which also closes the popup).

## Theming

The chip and popup use the input/dialog roles; the swatch marker uses `colorMarker`, and the `▐↓▌`
button draws the shared dropdown icon.

## Related

- [Color swatch](/components/color/color-swatch) — the grid opened by the dropdown.
- [Input](/components/controls/input) — the hex field used for custom truecolor.
- [API reference](/api/ui/classes/ColorPicker) — the generated `ColorPicker` signature.
