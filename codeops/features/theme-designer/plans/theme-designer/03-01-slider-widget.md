# Slider Widget: Theme Designer

> **Document**: 03-01-slider-widget.md
> **Parent**: [Index](00-index.md)
> Ships in `@jsvision/core` (2 roles) + `@jsvision/ui` (`Slider`, shared track math, ScrollBar refactor).

## Overview

A reusable, focusable value control for `@jsvision/ui`: a horizontal or vertical groove with a draggable
thumb bound to a numeric `Signal`. It is the first interactive value slider in the framework and the
building block for the designer's R/G/B channels. Its value↔position math is **shared** with `ScrollBar`
through one extracted pure helper (AR-9), so both stay consistent by construction.

Turbo Vision has no slider/trackbar class (`TScrollBar` is the nearest analog), so `Slider` is a
**documented new component** — its glyphs and colors are a fresh design, not a TV decode (AR-18). No
TV/C++ provenance appears in shipped code or JSDoc.

## Architecture

### Proposed changes

1. **`packages/ui/src/controls/track.ts`** — a pure, view-free module owning the value↔position math both
   controls need (no rendering, no `Signal`, no events — just numbers). This is the DRY seam (AR-9).
2. **`packages/ui/src/scroll/scroll-bar.ts`** — refactor its inline value/position/clamp arithmetic to call
   `track.ts`. Public API and rendered output unchanged; its existing tests are the regression oracle.
3. **`packages/ui/src/controls/slider.ts`** — the new `Slider` view built on `track.ts`.
4. **`packages/core/src/engine/color/{theme.ts,roles.ts,presets.ts}`** — add `sliderTrack` + `sliderThumb`
   roles (AR-18).
5. **`packages/ui/src/index.ts`** — export `Slider`, `SliderOptions`.

## Implementation Details

### New pure helper — `track.ts`

Pure functions (integer-cell correct, clamped). Names indicative; math is the owning spec (ST-1…ST-4).

```ts
/** Geometry of a value track laid along `length` cells. All pure; no view, no Signal. */
export interface TrackSpec {
  readonly min: number;
  readonly max: number;      // max > min required by callers; degenerate ⇒ thumb at start
  readonly length: number;   // cells available for the groove
  readonly thumbSize?: number; // default 1 (Slider); ScrollBar passes a proportional size
}

/** Clamp a value into [min, max]. */
export function clampValue(spec: TrackSpec, value: number): number;

/** Map a value → the thumb's leading cell offset within `length` (0-based, integer). */
export function valueToOffset(spec: TrackSpec, value: number): number;

/** Map a cell offset (e.g. a click/drag position along the groove) → the nearest value. */
export function offsetToValue(spec: TrackSpec, offset: number): number;

/** Step a value by ±delta, clamped (arrow/page/wheel). */
export function stepValue(spec: TrackSpec, value: number, delta: number): number;
```

The proportional thumb size ScrollBar uses is passed via `thumbSize`; Slider uses the default `1`. The
existing ScrollBar behavior is reproduced by these functions (ST-10 pins it).

### New view — `Slider`

```ts
export interface SliderOptions {
  /** Two-way numeric value; reading renders, writing (external) repaints + clamps. */
  value: Signal<number>;
  min?: number;               // default 0
  max?: number;               // default 100
  step?: number;              // arrow step, default 1
  pageStep?: number;          // PgUp/PgDn step, default max(1, round((max-min)/10))
  orientation?: 'horizontal' | 'vertical'; // default 'horizontal'
  onInput?: (v: number) => void;  // live: every change (drag move, key, wheel)
  onChange?: (v: number) => void; // commit: pointer-up, and each discrete key/wheel step
}

export class Slider extends View {
  constructor(opts: SliderOptions);
  select(value: number): void;   // programmatic set → onInput + onChange
  measure(): Size2D;             // advertises 1 across the cross-axis, a sensible min along-axis
}
```

**Rendering:** a groove drawn in `sliderTrack` (a light run, e.g. `─`/`│` or a shaded cell) with the thumb
cell(s) in `sliderThumb` (a solid block, e.g. `█`/a marker). No end-arrows (that is ScrollBar's look). The
exact glyphs are pinned at implementation and asserted by the spec via a composed-buffer check (ST-5/ST-6).

**Interaction (AR-17):** `focusable = true`. Keyboard — along-axis arrows ±`step`, `Home`/`End` → `min`/`max`,
`PgUp`/`PgDn` ±`pageStep`. Mouse — click on the groove positions the thumb (`offsetToValue`), press-drag with
pointer capture tracks continuously, wheel steps ±`step`. Callback convention matches `ColorSwatch`: live
changes fire `onInput`; a commit (pointer-up, each discrete key/wheel step) fires `onChange`.

### New core roles (AR-18)

`sliderTrack` and `sliderThumb` added to the `Theme` interface + `defaultTheme` (literal DOS-16 bytes,
pinned at GATE-1 by analogy to `scrollBar*`/`progress*`), to `rolesFromAliases` (derive from
`border`/`accent` aliases so generated presets get sensible values), and to the hand-authored
`monochromeTheme` (attr-driven). A `slider-theme.spec` freezes the two `defaultTheme` bytes (like
`feedback-theme.spec`).

## Integration Points

- `Slider` uses the existing `DrawContext.role` paint + `ev.setCapture`/`releaseCapture` pointer-capture seam
  (same as `ScrollBar`/`ColorSwatch`).
- The designer inspector composes three horizontal `Slider`s (min 0, max 255) for R/G/B (03-03).

## Code Examples

```ts
import { Slider, signal } from '@jsvision/ui';
const g = signal(170);
const green = new Slider({ value: g, min: 0, max: 255, step: 1, orientation: 'horizontal',
  onInput: (v) => repaintSwatch(), onChange: (v) => commit() });
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `value` outside `[min,max]` (external write) | clamp via `clampValue` on read/render; never throw | AR-17 |
| `max <= min` (degenerate range) | thumb pinned at start; control inert, no divide-by-zero | AR-17 |
| non-integer `value` | rendered at the nearest cell; value signal left as-is unless stepped | AR-17 |

> **Traceability:** every strategy above references the Ambiguity Register. See `00-ambiguity-register.md`.

## Testing Requirements

- Pure `track.ts` unit tests (value↔offset, clamp, step) — ST-1…ST-4.
- `Slider` spec: horizontal + vertical render (ST-5/6), keyboard (ST-7), drag-with-capture (ST-8), wheel (ST-9).
- ScrollBar regression: its existing suite unchanged + an explicit "value↔thumb identical after refactor" assertion — ST-10.
- `sliderTrack`/`sliderThumb` byte-freeze — ST-11.
- Kitchen-sink `controls/slider` smoke — ST-30.
