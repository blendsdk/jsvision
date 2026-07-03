# Feedback (`ProgressBar` + `Spinner`) Implementation Plan

> **Feature**: Two feedback widgets for `@jsvision/ui` — a determinate `ProgressBar` (smooth sub-cell fill) + an indeterminate `Spinner` (caller-driven animated glyph), plus an optional `runSpinner` timer helper.
> **Status**: Planning Complete
> **Created**: 2026-07-03
> **Implements**: jsvision-ui/RD-18
> **CodeOps Skills Version**: 3.2.0

## Overview

RD-18 adds the two idiomatic ways to report ongoing work in a TUI:

- **`ProgressBar`** — a determinate horizontal bar bound to `value: Signal<number>` in `[0,1]`,
  drawing a **smooth sub-cell block fill** (`█` + eighth-block partials `▏▎▍▌▋▊▉` over a `░` track)
  with an optional centred `%` caption. Writing `value` repaints; the value is clamped on read.
- **`Spinner`** — an indeterminate busy indicator bound to `frame: Signal<number>`, drawing
  `frames[frame() mod n]` from a selectable preset (braille `dots` default) with an optional trailing
  label. The widget is **pure** (no internal clock); the caller advances `frame`.
- **`runSpinner(frame, { intervalMs, timer })`** — an optional helper that advances a `frame` signal
  over the injectable `RuntimeAdapter` timer seam and returns a `stop()` handle (headless-testable).

**No TV counterpart (GATE-1, AR-186).** A whole-tree search of `magiblot/tvision` proved Turbo Vision
ships **no** progress/gauge/meter/spinner/throbber class — it reported long operations only through the
`TApplication::idle` repaint hook + ad-hoc app drawing. RD-18 is therefore a pair of **documented new
components** under the extension latitude of the NON-NEGOTIABLE TV-fidelity directive. Every *piece*
that has a CP437/DOS precedent is still grounded: the block/shade glyphs (Unicode Block Elements — the
same convention TV uses for `TScrollBar` `▒`/`■` + the `▄█▀` shadow), the animation timer (the shipped
`RuntimeAdapter.setTimer`/`clearTimer` seam, `host/types.ts:126-129`), and the fill/track colours
(documented extension colours grounded in TV's bright-on-dim gauge convention, PA-3). Braille spinner
frames are the acknowledged extension. The *glyphs and colours* stay CP437/DOS-faithful even though the
*components* are new.

Both widgets are ordinary **leaf `View`s** (no children, no `onEvent` — mirroring `Text`/`Label`).
The one architectural addition is the **`DrawContext.caps` seam** (PA-1): the widgets pick their ASCII
form at draw time from the resolved capabilities, which the render root already holds.

## Document Index

| #   | Document                                          | Description                                     |
| --- | ------------------------------------------------- | ----------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)    | Zero-Ambiguity Gate decisions (audit trail)     |
| 00  | [Index](00-index.md)                              | This document — overview and navigation         |
| 01  | [Requirements](01-requirements.md)                | Feature requirements and scope                  |
| 02  | [Current State](02-current-state.md)              | Analysis of the code RD-18 builds on            |
| 03-01 | [ProgressBar](03-01-progress-bar.md)            | Determinate bar — fill math, caption, ASCII, clamp |
| 03-02 | [Spinner + runSpinner](03-02-spinner.md)        | Presets, preset-swap fallback, label, timer helper |
| 03-03 | [Theme roles, seam & packaging](03-03-theme-packaging.md) | 2 `progress*` roles, `DrawContext.caps`, subsystem, story/demo |
| 07  | [Testing Strategy](07-testing-strategy.md)        | ST-cases and verification                       |
| 99  | [Execution Plan](99-execution-plan.md)            | Phases, sessions, and task checklist            |

## Quick Reference

### Usage Examples

```ts
import { signal, ProgressBar, Spinner, runSpinner, SPINNERS } from '@jsvision/ui';

// Determinate bar with a percentage caption:
const progress = signal(0);
const bar = new ProgressBar({ value: progress, caption: true });
bar.set(0.45);          // → " 45% " centred over a 45%-filled track
bar.percent;            // → 45

// Indeterminate spinner, caller-advanced:
const frame = signal(0);
const spin = new Spinner({ frame, preset: 'dots', label: 'Loading…' });

// Optional timer helper (real app passes the live RuntimeAdapter; tests pass a fake):
const stop = runSpinner(frame, { intervalMs: 80, timer: runtime });
// … on completion:
stop();                 // clears the timer (no leak)
```

Under a capability profile with Unicode/glyphs off, the bar renders a whole-cell `#`/`-` form and the
spinner swaps any non-`line` preset to `line` — both **at the widget level**, reading `ctx.caps` (PA-1/PA-2).

### Key Decisions

| Decision | Outcome | AR/PA Ref |
| -------- | ------- | --------- |
| Component basis | Two leaf `View`s (like `Text`/`Label`); no `onEvent` | AR-186/193 |
| Bar value model | `value: Signal<number>` in `[0,1]`, clamped on read; horizontal | AR-188 / PA-8 |
| Bar fill math | `round`-first: `e=round(v·w·8)`, `floor(e/8)`×`█` + `PARTIAL[e mod 8]` over `░` | AR-189 / PA-4 |
| Caps draw-time seam | **Additive `DrawContext.caps`** (render root already holds caps) | **PA-1 (user)** |
| ASCII selection | Unified `asciiOnly = !utf8 \|\| !halfBlocks`; bar `#`/`-`; spinner non-`line`→`line` | AR-189/191 / PA-2 |
| Spinner drive | Pure widget renders `frames[frame() mod n]`; optional `runSpinner` over the timer seam | AR-190 / PA-7 |
| Spinner presets | `dots`(braille, default) / `line` / `blocks`(`▏▎▍▌▋▊▉█`); frozen `SPINNERS` map | AR-191 / PA-5 |
| Theme roles | 2 additive: `progressFill 0x1B` / `progressTrack 0x13`; caption/label reuse text roles | AR-192 / PA-3 |
| File split | `progress-bar.ts` + `spinner.ts` + `run-spinner.ts` + `index.ts` | AR-193 / PA-6 |
| Story ids / demo | `feedback/progress-bar` + `feedback/spinner` (cat. `Feedback`); `demo:feedback` | AR-194 / PA-10 |

## Related Files

**New (`packages/ui/src/feedback/`):** `progress-bar.ts`, `spinner.ts`, `run-spinner.ts`, `index.ts`.
**Edited (additive):**
- `packages/core/src/engine/color/theme.ts` (+2 `progress*` roles in `Theme` + `defaultTheme`).
- `packages/ui/src/view/types.ts` + `view/draw-context.ts` + `view/render-root.ts` (the `DrawContext.caps` seam, PA-1).
- `packages/ui/src/index.ts` (explicit named re-exports).
**New tests (`packages/ui/test/`):** `progress-bar.spec.test.ts`, `progress-bar.impl.test.ts`, `spinner.spec.test.ts`, `spinner.impl.test.ts`, `run-spinner.impl.test.ts`, `feedback-theme.spec.test.ts`, `feedback.packaging.spec.test.ts`.
**New examples:** `packages/examples/feedback-demo/main.ts` (`demo:feedback`), `packages/examples/kitchen-sink/stories/progress-bar.story.ts` + `spinner.story.ts` (+ 2 `stories/index.ts` lines), `packages/examples/test/feedback-demo.e2e.test.ts`.
