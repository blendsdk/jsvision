# 03-02 — `Spinner` (indeterminate) + `runSpinner` helper

> **Document**: 03-02-spinner.md
> **Parent**: [Index](00-index.md)
> **Implements**: AC-6, AC-7, AC-8, AC-9, AC-10, AC-14 · PA-2/PA-5/PA-7/PA-8

## GATE-1 decode (BEFORE)

No TV counterpart (AR-186). Pinned pieces (recorded in the code JSDoc):

- **`SPINNERS` presets** (frozen `readonly string[]`s), PA-5:
  | preset | frames | glyphs | needs |
  |--------|--------|--------|-------|
  | `dots` *(default)* | `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` | U+2800 Braille Patterns | `utf8` |
  | `line` | `\| / - \` | ASCII | — (safe everywhere) |
  | `blocks` | `▏▎▍▌▋▊▉█` | U+258F…U+2588 Block Elements | `utf8` + `halfBlocks` |
  `blocks` deliberately reuses the bar's eighth-block set (cohesive decode). `dots`/`blocks` are the
  acknowledged extension (modern `ora`/Ink convention; no TV precedent). `SPINNERS` is
  `Object.freeze({ dots, line, blocks })`; each array is frozen.
- **ASCII fallback** (PA-2): when `asciiOnly(caps)`, **any** non-`line` preset → `line` (widget-level
  preset swap, never a static glyph). `line` is pure ASCII → always safe.

## Public API

```ts
export type SpinnerName = 'dots' | 'line' | 'blocks';
export const SPINNERS: Readonly<Record<SpinnerName, readonly string[]>>;

export interface SpinnerOptions {
  /** Reactive frame index (caller-owned; reduced mod n, negative-safe). Advancing it repaints. */
  readonly frame: Signal<number>;
  /** Named preset. Default 'dots'. Falls back to 'line' when asciiOnly(caps). */
  readonly preset?: SpinnerName;
  /** Optional trailing label, literal or reactive getter. */
  readonly label?: string | (() => string);
}

export class Spinner extends View {
  constructor(opts: SpinnerOptions);
  override draw(ctx: DrawContext): void;
}
```

- **Leaf**, no `onEvent`. `onMount(() => { this.bind(() => this.frame()); if (label is getter)
  this.bind(label); })` → advancing `frame` (or a reactive label) repaints (the `Text` idiom).

## `draw(ctx)` algorithm

```
const preset = asciiOnly(ctx.caps) && this.preset !== 'line' ? 'line' : (this.preset ?? 'dots');  // AC-8
const frames = SPINNERS[preset];
const n = frames.length;                                   // > 0 for every preset
const i = (((this.frame() % n) + n) % n);                  // AC-6: negative-safe mod
ctx.text(0, 0, frames[i], ctx.color('staticText'));        // spinner glyph (reuses staticText)
const label = typeof this.label === 'function' ? this.label() : this.label;
if (label) ctx.text(2, 0, label, ctx.color('label'));      // AC-9: to the right, gap of 1 cell
```

- **Negative-safe mod** — `(((frame % n) + n) % n)` maps any integer (incl. negatives) into `0..n-1`
  (AC-6/AC-14): no OOB index.
- **Label** at column 2 (glyph width 1 + a 1-cell gap); routes through `ctx.text` → `sanitize` +
  width-clip (AC-9/AC-14). Reuses `staticText` (glyph) + `label` (text) roles — no new roles (PA-3).
- The widget **never imports a timer** — purity (AR-190). Animation is caller-driven.

## `runSpinner` helper (AC-10) — `run-spinner.ts`

```ts
export type TimerSeam = Pick<RuntimeAdapter, 'setTimer' | 'clearTimer'>;

export interface RunSpinnerOptions {
  /** Advance cadence in ms. Default 80. */
  readonly intervalMs?: number;
  /** Injectable OS-timer seam (real: the running app's RuntimeAdapter; tests: a fake). */
  readonly timer: TimerSeam;
}

/** Advance `frame` every intervalMs; returns stop() which clears the timer (no leak). */
export function runSpinner(frame: Signal<number>, opts: RunSpinnerOptions): () => void {
  const ms = opts.intervalMs ?? 80;
  let handle: TimerHandle | undefined;
  const tick = () => { frame.set(frame() + 1); handle = opts.timer.setTimer(tick, ms); };  // re-arm
  handle = opts.timer.setTimer(tick, ms);
  return () => { if (handle !== undefined) { opts.timer.clearTimer(handle); handle = undefined; } };
}
```

- **Self-re-arming** `setTimer` (matches the `RuntimeAdapter` one-shot-timer contract, `host/types.ts:126`)
  rather than an interval — so a fake that fires the pending callback steps time deterministically.
- **`stop()`** clears the pending timer and nulls the handle → **idempotent**, no further advance, no
  leak (AC-10/AC-14). Holds no global state; interprets no caller data as code.
- Split into its own file (PA-6) so `spinner.ts` stays a pure widget with no timer dependency.

## Security (AC-14)

- Frame reduced mod `n` (negative-safe) → no OOB. Label sanitized + width-clipped via `ctx.text`.
- `runSpinner.stop()` clears its timer (no dangling timer / resource leak).

## GATE-1 AFTER (diff task)

After implementation, assert: each preset renders its exact frozen code points at successive `frame`
values; under `asciiOnly` caps every non-`line` preset yields the `line` glyphs (animation preserved,
not a static glyph). Record in code/commit (execution plan task 3.1.1).

## Files

`packages/ui/src/feedback/spinner.ts` (`Spinner` + `SPINNERS` + preset-swap; imports `asciiOnly` from
`progress-bar.ts`), `packages/ui/src/feedback/run-spinner.ts` (`runSpinner` + `TimerSeam`). Both ≤ 500.
