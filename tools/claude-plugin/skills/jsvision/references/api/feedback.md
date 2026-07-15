<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->

# API — Feedback

Progress bars and spinners.

Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.

## LabelPosition

Where an optional ProgressBarOptions.label sits relative to the bar.

```ts
type LabelPosition = 'left' | 'right' | 'top' | 'top-left'
```

## ProgressBar

A determinate progress bar.

```ts
new ProgressBar(opts: ProgressBarOptions)   // extends View
// methods & signals:
set(value: number): void
percent: number
```

## ProgressBarOptions

Construction options for ProgressBar.

```ts
interface ProgressBarOptions {
  value: Signal<number>;   // Reactive progress in `[0,1]` (caller-owned; clamped on read). Writing it repaints.
  caption?: boolean;   // Show a centred `NN%` knockout caption over the bar. Default `false`.
  label?: string | (() => string);   // Optional text placed around the bar (literal or reactive accessor). Repaints on change. A `left`/`right` label reserves `width(label)+1` columns beside the bar, so a **variable-width** label reflows the bar as its text grows/shrinks (e.g. `9%`→`10%`→`100%` retreats the bar a cell). Pad such a label to a stable width — e.g. `` () => `${pct}%`.padStart(4) `` — to keep the bar fixed.
  labelPosition?: LabelPosition;   // Where label sits. Default `'left'` — the only position that fits on a one-row bar.
}
```

## runSpinner

Advance `frame` by one every `intervalMs`, using the injectable one-shot timer (re-armed each tick).

```ts
runSpinner(frame: Signal<number>, opts: RunSpinnerOptions): () => void
```

## RunSpinnerOptions

Options for runSpinner.

```ts
interface RunSpinnerOptions {
  intervalMs?: number;   // Advance cadence in ms. Default `80`.
  timer: TimerSeam;   // Injectable OS-timer seam (real: the running app's `RuntimeAdapter`; tests: a fake).
}
```

## Spinner

An indeterminate spinner.

```ts
new Spinner(opts: SpinnerOptions)   // extends View
```

## SpinnerName

The named spinner presets.

```ts
type SpinnerName = 'dots' | 'line' | 'blocks'
```

## SpinnerOptions

Construction options for Spinner.

```ts
interface SpinnerOptions {
  frame: Signal<number>;   // Reactive frame index (caller-owned; negative-safe). Advancing it repaints. It is mapped to a glyph per preset — looping for `dots`/`line`, ping-pong for `blocks`.
  preset?: SpinnerName;   // Named preset. Default `dots`. Falls back to `line` when `asciiOnly(caps)`.
  label?: string | (() => string);   // Optional trailing label, a literal string or a reactive getter.
}
```

## SPINNERS

The frozen frame tables for each preset.

```ts
const SPINNERS: Readonly<Record<SpinnerName, readonly string[]>>
```

## TimerSeam

The injectable OS-timer subset `runSpinner` needs (real: the app's `RuntimeAdapter`; tests: a fake).

```ts
type TimerSeam = Pick<RuntimeAdapter, 'setTimer' | 'clearTimer'>
```
