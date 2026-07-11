---
title: Color swatch
description: ColorSwatch — a focusable grid of color cells picked with the arrow keys or mouse, with live onInput and commit onChange callbacks.
---

# Color swatch

`ColorSwatch` is a focusable grid of color cells the user picks from with the arrow keys or the mouse.
Each color is a 3-column block; the cell whose color equals the bound `value` is marked with a `◘`
glyph. Every arrow key, click, and drag updates `value` immediately (arrow navigation wraps around the
palette ends) and fires the optional `onInput`; `Enter`, `Space`, or a mouse-up over a cell fires the
optional `onChange` — the discrete commit a hosting [`ColorPicker`](/components/color/color-picker)
uses to close its dropdown. The swatch draws only its cells; a hosting popup or window supplies any
border.

## Usage

```ts
import { ColorSwatch, signal } from '@jsvision/ui';
import type { Color } from '@jsvision/core';

const value = signal<Color>('cyan');
const swatch = new ColorSwatch({
  value,
  columns: 4,
  onInput: (c) => preview(c), // live: every arrow / click / drag
  onChange: (c) => commit(c), // commit: Enter / Space / mouse-up
});
swatch.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 12, height: 4 } };
```

## Live example

<PlayComingSoon title="Color swatch" />

## Props

`new ColorSwatch(options)`.

| Prop       | Type                   | Default        | Description                                                           |
| ---------- | ---------------------- | -------------- | --------------------------------------------------------------------- |
| `value`    | `Signal<Color>`        | —              | Two-way selected color.                                               |
| `colors`   | `readonly Color[]`     | `ANSI16_ORDER` | Palette to display (the DOS-16 colors by default).                    |
| `columns`  | `number`               | `4`            | Columns per row.                                                      |
| `onInput`  | `(c: Color) => void`   | —              | Fired on every live change (arrow / click / drag).                    |
| `onChange` | `(c: Color) => void`   | —              | Fired on the discrete commit (Enter / Space / mouse-up).              |
| `nameFor`  | `(c: Color) => string` | —              | Color-name accessor a hosting `ColorPicker` uses to caption its chip. |

## Keyboard & mouse

| Input                    | Result                                                   |
| ------------------------ | -------------------------------------------------------- |
| **← / → / ↑ / ↓**        | Move the selection (wraps around the palette ends).      |
| **Enter / Space**        | Commit the current cell (fires `onChange`).              |
| **Click / drag**         | Select live (fires `onInput`); dragging outside reverts. |
| **Mouse-up** over a cell | Commit that cell (fires `onChange`).                     |

If `value` is an off-palette color (e.g. a custom hex from a hosting picker), no marker shows, but
arrow navigation still works from an internal cursor. On a near-black cell the marker is drawn in a
contrasting colour so it stays visible.

## Sizing & layout

Its `measure()` sizes it to `columns × rows` of 3-wide cells. The swatch has **no frame** — host it in
a popup or window that supplies the border.

## Best practices

- **Split live vs. committed.** Use `onInput` for a live preview (recolour as the cursor moves) and
  `onChange` for the expensive commit — a drag fires many `onInput`s and one `onChange` on release.
- **Default to the DOS-16 palette.** `ANSI16_ORDER` is the classic set; pass a custom `colors` array
  only when you need a specific palette.

## Theming

Each cell draws its own color as the foreground over a black background. The `◘` marker uses the
`colorMarker` role (black on lightGray) — forced onto a near-black cell so it stays visible.

## Related

- [Color picker](/components/color/color-picker) — a one-line field that opens a swatch in a popup.
- [API reference](/api/ui/classes/ColorSwatch) — the generated `ColorSwatch` signature.
