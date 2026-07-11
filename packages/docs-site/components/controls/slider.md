---
title: Slider
description: Slider — a focusable groove-and-thumb control bound to a numeric signal, with live (onInput) and commit (onChange) callbacks.
---

# Slider

`Slider` is a focusable value control: a horizontal or vertical groove with a draggable thumb bound
two-way to a numeric `Signal`. Arrow keys step it, the mouse drags or clicks it, and the wheel nudges
it. Every live change fires `onInput`; each committed change — a discrete key/wheel step, or the
pointer-up ending a drag — fires `onChange`.

## Usage

```ts
import { Slider, signal } from '@jsvision/ui';

const green = signal(170);
const slider = new Slider({
  value: green,
  min: 0,
  max: 255,
  onInput: (v) => preview(v), // live: drag / arrow / wheel
  onChange: (v) => commit(v), // commit: key step, wheel, pointer-up
});
```

## Live example

<PlayComingSoon title="Slider" />

## Props

`new Slider(options)`.

| Prop          | Type                         | Default                       | Description                                                    |
| ------------- | ---------------------------- | ----------------------------- | -------------------------------------------------------------- |
| `value`       | `Signal<number>`             | —                             | Two-way numeric value; clamped to `[min, max]` on read.        |
| `min`         | `number`                     | `0`                           | Range minimum.                                                 |
| `max`         | `number`                     | `100`                         | Range maximum.                                                 |
| `step`        | `number`                     | `1`                           | Arrow / wheel step.                                            |
| `pageStep`    | `number`                     | `max(1, round((max−min)/10))` | PgUp / PgDn step.                                              |
| `orientation` | `'horizontal' \| 'vertical'` | `'horizontal'`                | The long axis.                                                 |
| `onInput`     | `(v: number) => void`        | —                             | Fired on every live change (drag, arrow, page, wheel).         |
| `onChange`    | `(v: number) => void`        | —                             | Fired on each commit (discrete key/wheel step, or pointer-up). |

## Keyboard & mouse

| Input                          | Result                                                      |
| ------------------------------ | ----------------------------------------------------------- |
| **→ / ↓** (toward the far end) | Step `+step`.                                               |
| **← / ↑**                      | Step `−step`.                                               |
| **Home / End**                 | Jump to `min` / `max`.                                      |
| **PgUp / PgDn**                | Step by `pageStep`.                                         |
| **Click** the groove           | Place the thumb there.                                      |
| **Drag**                       | Track the pointer continuously (one `onChange` on release). |
| **Wheel**                      | Step `±step` (up increases).                                |

## Sizing

`Slider` supplies a `measure()`, so an `auto` layout slot sizes it (a 1-cell cross axis and a modest
default length along the axis). Give it a longer explicit length for finer control — the value maps
across the whole groove.

## Best practices

- **Split live vs. committed with the two callbacks.** Use `onInput` for a live preview (recolour as
  the thumb drags) and `onChange` for the expensive commit (persist, re-query) — a drag fires exactly
  one `onChange`, on release.
- **Set a meaningful range.** `min` / `max` / `step` define the value space; the default `0–100` is
  rarely what you want.

## Theming

| Role          | Applies to           |
| ------------- | -------------------- |
| `sliderTrack` | The `─` / `│` groove |
| `sliderThumb` | The `█` thumb cell   |

## Related

- [Switch](/components/controls/switch) — a two-state (on/off) toggle.
- [Input](/components/controls/input) — a typed numeric field with a range validator.
- [API reference](/api/ui/classes/Slider) — the generated `Slider` signature.
