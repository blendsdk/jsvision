# Requirements & Scope — Feedback (`ProgressBar` + `Spinner`)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-18](../../requirements/RD-18-feedback.md) · [Preflight](../../requirements/00-preflight-report-RD-18.md)
> **Implements**: jsvision-ui/RD-18

## Goal

Ship two feedback widgets + one helper in a new `packages/ui/src/feedback/` subsystem, plus 2 additive
core theme roles and the `DrawContext.caps` seam, with kitchen-sink stories and a headless
`demo:feedback`. Spec-first (spec oracles RED → implement → GREEN → impl tests).

## In Scope

### `ProgressBar` (determinate) — AR-187/188/189

1. A leaf `View` bound to **`value: Signal<number>` in `[0,1]`**, clamped on read (`NaN`/`<0`/`>1`
   → `0`/`1`). Writing `value` repaints. (AC-1, AC-5)
2. **Smooth sub-cell fill** (PA-4): `v = clamp(value,0,1); e = round(v·width·8); full = floor(e/8);
   part = e mod 8;` → `full`×`█` (U+2588), then, when `part ∈ 1..7`, one `PARTIAL[part]`
   (`▏▎▍▌▋▊▉`, U+258F…U+2589), then `░` (U+2591) for every remaining cell (no partial when
   `part == 0`). Cell-by-cell oracle, asserted pre-`serialize`. (AC-2)
3. **Widget-level ASCII fallback** (PA-2): when `asciiOnly(ctx.caps)`, render a **whole-cell** form —
   `#` fill / `-` track (distinct) — dropping the sub-cell partials. No throw. (AC-3)
4. **Optional centred `%` caption** (off by default): ` NN% ` = `round(v·100)`, clamped `0..100`,
   drawn over the fill/track in the caption role (reuses `staticText`), width-clipped. (AC-4)
5. Horizontal only; fills laid-out `width × 1`; a taller bar repeats the row.
6. Should-Have: `set(value)` writes the signal; `percent` getter reads `round(clamp(value)·100)`. (PA-8)

### `Spinner` (indeterminate) — AR-190/191

7. A leaf `View` bound to **`frame: Signal<number>`**, drawing **`frames[((frame() mod n) + n) mod n]`**
   — pure, no internal clock; a negative frame is handled safely. (AC-6)
8. **Selectable frozen presets** (PA-5): `dots` (braille `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, default), `line` (`| / - \`),
   `blocks` (`▏▎▍▌▋▊▉█`); exposed via a public frozen `SPINNERS` map. (AC-7)
9. **Widget-level ASCII fallback** (PA-2): when `asciiOnly(ctx.caps)`, **any** non-`line` preset →
   `line` (never a static glyph). No throw. (AC-8)
10. **Optional trailing label** (`string` or `() => string`): drawn to the right of the glyph in the
    label role (reuses `staticText`/`label`), width-clipped + sanitized. (AC-9)

### `runSpinner` helper — AR-190 / PA-7

11. `runSpinner(frame, { intervalMs = 80, timer })` advances `frame` every `intervalMs` via the
    injected `timer` (`Pick<RuntimeAdapter,'setTimer'|'clearTimer'>`) and returns `stop()`, which
    clears the timer (no leak). Fake-timer-driven, deterministic, no wall-clock. (AC-10, AC-14)

### Cross-package additive edits

12. **2 core theme roles** (PA-3): `progressFill` (`0x1B` brightCyan-on-blue) + `progressTrack`
    (`0x13` cyan-on-blue) added to `Theme` + `defaultTheme`; no existing role changes; `encode()` of
    each does not throw. (AC-11)
13. **`DrawContext.caps` seam** (PA-1): additive `readonly caps: CapabilityProfile` on `DrawContext`,
    populated by `makeDrawContext` from the render root's caps.

### Packaging + showcase

14. New `src/feedback/` subsystem, files ≤ 500 lines, **explicit named re-exports** from
    `src/index.ts`; `yarn check:deps` clean (zero runtime deps). (AC-12)
15. Kitchen-sink stories `feedback/progress-bar` + `feedback/spinner` (category `Feedback`) passing
    the headless smoke test + a headless `demo:feedback` walkthrough (ASCII frame per step). (AC-13)

## Out of Scope (deferred — tracked in RD-18)

- Indeterminate/marquee ProgressBar mode (the Spinner covers indeterminate feedback).
- Vertical ProgressBar orientation.
- A self-timed Spinner that owns its own clock (purity + headless testability win now).
- Rate/ETA caption, multi-bar/stacked progress, sparklines.
- Editing `render/glyphs.ts` or adding any new **core** primitive (the ASCII fallback is widget-level;
  the timer seam already exists).

## Success Criteria

Definition of done = **all 14 ACs** (RD-18 lines 274-326) encoded as passing spec oracles, `yarn verify`
green across packages, `yarn check:deps` clean, GATE-1 pins recorded in code/commit (PA-2…PA-5), both
stories passing smoke, `demo:feedback` running headless + e2e, files ≤ 500 lines, no dead code.

**Verify command:** `yarn verify` (PA-9).
