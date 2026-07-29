---
title: Multi-check Group
description: Give each row an ordered cycle of three or more marker states with MultiCheckGroup and a number-array signal.
---

# Multi-check Group

`MultiCheckGroup` extends the checkbox-group interaction model to an ordered set of states per item.
Instead of a boolean, every row stores a numeric state index in a two-way `Signal<number[]>`.
Pressing a row advances its index and wraps from the final state back to the first.

This is useful for compact inheritance, coverage, or tri-state settings such as Off, Partial, and
Full. It is not a substitute for a menu when state order has no clear meaning.

## Usage

```ts
import { MultiCheckGroup, signal } from '@jsvision/ui';

const coverage = signal([0, 2]);
const group = new MultiCheckGroup({
  items: ['~S~ync', '~B~ackup'],
  states: ' xX',
  value: coverage,
});
```

## Live example

<PlayExample id="controls/multi-check-group" title="Multi-state cycle laboratory" blurb="Cycle Off, Partial, and Full states independently; watch the last state wrap to the first." />

The laboratory translates numeric state indexes into readable words beside the glyphs. It also
includes a disabled row and a reset action so state boundaries remain easy to inspect.

## Props

`MultiCheckGroup` accepts `MultiCheckGroupOptions`:

| Prop     | Type                | Purpose                                                                |
| -------- | ------------------- | ---------------------------------------------------------------------- |
| `items`  | `readonly string[]` | One caption per row; each may mark a `~X~` item accelerator.           |
| `states` | `string`            | Ordered one-code-unit, one-cell marker glyphs; each defines one state. |
| `value`  | `Signal<number[]>`  | Two-way state index per item, in the same positional order.            |

Provide at least one state glyph. Missing array entries read as state `0`; an out-of-range value also
renders as the first marker. The next press normalizes the written array and advances with wrapping,
including from a negative external value.

Rows inherit `setItemEnabled(index, enabled)` from the shared cluster control.

## Size and Layout

The group paints one row per item, using five cells for the bracketed marker before the caption.
Allocate `items.length` rows and enough width for the longest display caption. A smaller height clips
rows and does not introduce scrolling.

Use one UTF-16 code unit and one terminal display cell per marker, such as a space, `x`, or `X`.
Astral emoji, wide glyphs, and combining sequences are not valid state markers because marker lookup
is positional within the JavaScript string and the drawing column is exactly one cell.

## State cycles

The glyph order is the interaction order. With `states: ' xX'`, index `0` draws a blank marker,
index `1` draws `x`, and index `2` draws `X`; another press returns to `0`. Each row advances
independently and writes a full-length number array.

External signal writes repaint all markers. Keep a separate semantic label table in application
code when the numeric indexes need to be shown to users or persisted as domain values.

## Keyboard & mouse

| Input                    | Result                                                      |
| ------------------------ | ----------------------------------------------------------- |
| **Up / Down**            | Move and wrap the highlight, skipping disabled rows.        |
| **Space**                | Advance the highlighted row by one state.                   |
| **Click** an enabled row | Focus, highlight, and advance that row.                     |
| **Alt** + item hotkey    | Focus, highlight, and advance the matching row dialog-wide. |

Disabled rows remain visible but cannot advance. Navigation is a handled no-op when every item is
disabled.

## Best Practices

- Use a stable, documented state order. Users should be able to predict what the next press means.
- Pair unfamiliar marker glyphs with a visible legend or reactive text, as the live example does.
- Keep `items`, persisted indexes, and state labels aligned when reordering data.
- Prefer [`CheckGroup`](/components/controls/check-group) for ordinary booleans and
  [`RadioGroup`](/components/controls/radio-group) for one selection across rows.

## Theming

| Theme role        | Region                                               |
| ----------------- | ---------------------------------------------------- |
| `clusterNormal`   | Enabled rows outside the current keyboard highlight. |
| `clusterSelected` | Highlighted row while the group owns focus.          |
| `clusterShortcut` | Marked accelerator glyph on enabled rows.            |
| `clusterDisabled` | Disabled marker, caption, and accelerator.           |

Custom state glyphs inherit the row's role rather than receiving state-specific colors. Choose
glyphs that remain distinguishable in every cluster role and under limited terminal capabilities.

## Related

- [Check Group](/components/controls/check-group) — two-state independent choices.
- [Radio Group](/components/controls/radio-group) — one exclusive selection.
- [Text](/components/controls/text) — readable state legends and live summaries.
- [MultiCheckGroup API](/api/ui/classes/MultiCheckGroup) — generated options and methods.
