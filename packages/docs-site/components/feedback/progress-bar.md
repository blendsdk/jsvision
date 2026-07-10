---
title: Progress bar
description: ProgressBar — a determinate bar with smooth sub-cell fill, an optional knockout percent caption, and a positioned label; driven by a [0,1] signal.
---

# Progress bar

`ProgressBar` is a determinate progress bar driven by a caller-owned `Signal<number>` in `[0, 1]`. On
a Unicode terminal it fills a fraction of a cell at a time — a run of full blocks `█` followed by one
eighth-block partial (`▏▎▍▌▋▊▉`) over a light `░` track; on a terminal without those glyphs it falls
back to whole cells (`#` fill, `-` track), chosen at draw time from the live terminal caps. It is a
non-focusable leaf, and the value is clamped on every read — `NaN`, `±Infinity`, and out-of-range
numbers are all safe and simply pin to 0 or 1.

## Usage

```ts
import { ProgressBar, signal } from '@jsvision/ui';

const value = signal(0.4); // progress in [0, 1]
const bar = new ProgressBar({ value, caption: true, label: 'Copying', labelPosition: 'left' });
bar.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 24, height: 1 } };
// Advance it — the bar repaints reactively: value.set(Math.min(1, value() + 0.1)).
```

## Live example

<PlayComingSoon title="Progress bar" />

## Props

`new ProgressBar(options)`.

| Prop            | Type                                       | Default  | Description                                                       |
| --------------- | ------------------------------------------ | -------- | ----------------------------------------------------------------- |
| `value`         | `Signal<number>`                           | —        | Reactive progress in `[0, 1]`; clamped on read, writing repaints. |
| `caption`       | `boolean`                                  | `false`  | Show a centred `NN%` knockout caption over the bar.               |
| `label`         | `string \| (() => string)`                 | —        | Text beside or above the bar (literal or reactive accessor).      |
| `labelPosition` | `'left' \| 'right' \| 'top' \| 'top-left'` | `'left'` | Where the label sits (see Sizing).                                |

## Behaviour

The bar is passive — it has no keyboard or mouse interaction. It advances purely when you write its
`value` signal (from a timer, a download callback, a loop). The optional `NN%` caption reads _on_ the
bar: each digit's background matches whatever it sits on (fill colour where the fill has reached it,
track colour where it hasn't), with an inverted foreground — no separate box.

## Sizing & layout

Give the bar bounds via an absolute `rect` or a flex slot. A `left`/`right` label reserves
`width(label)+1` columns on the bar's row (the bar shrinks to fit); a `top`/`top-left` label reserves
the row above, making the widget **two rows tall** (its `measure()` advertises 2 rows). A
variable-width label (`9%`→`100%`) reflows the bar as it grows — pad it to a stable width, e.g.
``() => `${pct}%`.padStart(4)``, to keep the bar fixed.

## Best practices

- **Just write the signal.** There is nothing to poll or refresh — a `value.set(...)` from your work
  loop repaints the bar. Out-of-range values are clamped, so you needn't guard against overshoot.
- **Pad a variable-width label.** A growing `NN%` label retreats the bar a cell at each digit; pad it
  to a fixed width so the bar stays put.
- **The ASCII fallback is automatic.** You don't choose the glyph set — the bar reads the terminal
  caps at draw time and downgrades to `#`/`-` where block glyphs aren't available.

## Theming

| Role            | Applies to                                          |
| --------------- | --------------------------------------------------- |
| `progressFill`  | The filled `█`/eighth-block run: brightCyan on blue |
| `progressTrack` | The unfilled `░` track: cyan on blue                |

## Related

- [Spinner](/components/feedback/spinner) — the indeterminate counterpart, for unknown-duration work.
