---
title: Slider
description: Select a bounded numeric value with a horizontal or vertical Slider and separate live-preview from commit callbacks.
---

# Slider

`Slider` is a focusable groove-and-thumb control bound two-way to a numeric signal. It supports
horizontal and vertical orientations, precise keyboard steps, direct mouse placement, captured
dragging, and wheel input.

Its callback model distinguishes live feedback from committed changes: `onInput` fires as the value
moves, while `onChange` marks a discrete key or wheel step, a programmatic selection, or the end of
one drag gesture.

## Usage

```ts
import { Slider, signal } from '@jsvision/ui';

const volume = signal(40);
const slider = new Slider({
  value: volume,
  min: 0,
  max: 100,
  step: 5,
  onInput: (value) => previewVolume(value),
  onChange: (value) => saveVolume(value),
});
```

## Live example

<PlayExample id="controls/slider" title="Range and commit laboratory" blurb="Drive horizontal and vertical sliders by keyboard, mouse, and wheel while callback counters reveal live versus committed changes." />

The horizontal slider shows range boundaries and callback counts. A second vertical slider proves
that its along-axis keys and intrinsic dimensions follow orientation.

## Props

`Slider` accepts `SliderOptions`:

| Prop          | Type                         | Default                         | Purpose                                            |
| ------------- | ---------------------------- | ------------------------------- | -------------------------------------------------- |
| `value`       | `Signal<number>`             | —                               | Two-way numeric source of truth.                   |
| `min`         | `number`                     | `0`                             | Inclusive range minimum.                           |
| `max`         | `number`                     | `100`                           | Inclusive range maximum.                           |
| `step`        | `number`                     | `1`                             | Arrow-key and wheel increment.                     |
| `pageStep`    | `number`                     | one tenth of the range, min `1` | Page Up/Down increment.                            |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'`                  | Long-axis direction and arrow mapping.             |
| `onInput`     | `(value: number) => void`    | —                               | Every changed live or discrete value.              |
| `onChange`    | `(value: number) => void`    | —                               | Every discrete commit and one pointer-up per drag. |

`select(value)` clamps and commits a programmatic value, firing both callbacks only when the stored
value changes. Rendering clamps an external out-of-range signal read but does not rewrite that
external value.

## Size and Layout

Intrinsic measurement is `10×1` horizontally and `1×10` vertically. An auto-sized slot therefore
produces a usable control, but a longer explicit axis gives more distinct pointer positions and a
clearer sense of range.

Only the long axis draws the groove. Keep the cross axis to one cell unless the surrounding layout
needs spacing; extra cross-axis area is not a larger thumb. Very short tracks collapse many numeric
values onto the same terminal cell.

## Live input and commits

Keys and wheel events are discrete changes, so each changed value calls `onInput` and then
`onChange`. Mouse down and drag call only `onInput`; pointer capture keeps tracking outside the
one-cell groove, and pointer up calls `onChange` once with the final clamped value.

A clamped discrete key, wheel, or `select()` no-op calls neither callback. A completed pointer
gesture still calls `onChange` on release, even when it ends on its starting value. This makes
`onInput` suitable for cheap previews and `onChange` suitable for persistence, queries, or other
work that should run once per gesture.

## Keyboard & mouse

| Input                                 | Result                                                        |
| ------------------------------------- | ------------------------------------------------------------- |
| **Right / Left** on horizontal slider | Increase / decrease by `step`.                                |
| **Down / Up** on vertical slider      | Increase / decrease by `step`.                                |
| **Home / End**                        | Commit `min` / `max`.                                         |
| **Page Up / Page Down**               | Decrease / increase by `pageStep`.                            |
| **Click** the groove                  | Move the thumb live to the pointed cell.                      |
| **Drag**                              | Track continuously and commit once on pointer release.        |
| **Wheel up / down**                   | Increase / decrease by `step`, clamped at the range boundary. |

Only along-axis arrows are consumed. The slider must own focus for keyboard input; pair it with a
linked [`Label`](/components/controls/label) when it needs a dialog-wide accelerator.

## Best Practices

- Choose `step` and `pageStep` values that map to meaningful domain increments rather than merely
  accepting the `0–100` defaults.
- Keep live previews cheap and idempotent; reserve persistence or network work for `onChange`.
- Show the current numeric value or semantic label nearby because a terminal thumb alone cannot
  communicate exact precision.
- Use an [`Input`](/components/controls/input) alongside the slider when users need to enter an exact
  value outside the track's practical cell resolution.

## Theming

| Theme role    | Region                                       |
| ------------- | -------------------------------------------- |
| `sliderTrack` | Horizontal `─` or vertical `│` groove cells. |
| `sliderThumb` | Single `█` cell at the mapped current value. |

The thumb needs strong contrast against the track in both orientations. Focus is communicated by
the application context and adjacent labeling, so do not make the unfocused track disappear into
the dialog surface.

## Related

- [Label](/components/controls/label) — caption and Alt-hotkey for slider focus.
- [Input](/components/controls/input) — exact typed values and validation.
- [Switch](/components/controls/switch) — a two-state value instead of a numeric range.
- [Slider API](/api/ui/classes/Slider) — generated `SliderOptions`, callbacks, and methods.
