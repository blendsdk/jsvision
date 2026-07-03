# Ambiguity Register — Feedback (`ProgressBar` + `Spinner`)

> **Feature**: jsvision-ui/RD-18 — Feedback (`ProgressBar` + `Spinner`)
> **Gate status**: ✅ **GATE PASSED** — every item Resolved with an explicit decision; user confirmed.
> **CodeOps Skills Version**: 3.2.0

This register is the audit trail for the **plan-level** Zero-Ambiguity Gate. RD-18 itself passed
`make_requirements` + a `preflight` (see `../../requirements/00-preflight-report-RD-18.md`), so its
scope decisions (AR-186…AR-194) are already user-confirmed and are **not** re-litigated here. This
register captures only the decisions the **plan** must make — the ones RD-18 left as "confirmed at
plan time" / "pinned at plan GATE-1", plus the one genuinely-new architectural decision the RD's
"the widget reads `caps`" wording left implicit (the caps draw-time seam, PA-1).

Decisions carry `PA-n` ids (plan ambiguities); each cites the RD `AR-n` it descends from.

## How the gate was run

All 12 categories were swept against RD-18 + the real code. Most categories were already closed by
the RD/preflight (scope, fill-math oracle, presets, fallback semantics, packaging, demo). The open
items clustered in: **Codebase Alignment** (the caps seam — PA-1), **Ambiguities/Unstated Assumptions**
(the GATE-1 pins the RD deferred to plan time — PA-2…PA-8, PA-10), and **Config** (the verify command —
PA-9). Zero items deferred.

## Register

| # | Category | Ambiguity | Options considered | Decision | Status |
|---|----------|-----------|--------------------|----------|--------|
| **PA-1** | Codebase Alignment / Architecture | RD-18 says both widgets "read `caps.glyphs`/`caps.unicode`" at the widget level, but **no widget receives `caps` at draw time today**: `DrawContext` (view/types.ts:39-57) has no `caps` field, and `RenderRoot` holds `caps` only for `serialize()` (render-root.ts:196,211,307). What seam delivers `caps` to `draw()`? | (A) **Add `caps` to `DrawContext`** — additive `readonly caps: CapabilityProfile`, populated by `makeDrawContext` from the render root's caps; only **1** production call site changes (render-root.ts:134, already holds `this.caps`) + **~11 mechanical drawcontext-test call sites across 5 files** (the 4 `view.drawcontext*` files + `view.hardening.spec.test.ts:119`, which is outside that glob — grep `makeDrawContext(` to enumerate); (B) pass `caps` to each **widget constructor** — no spine change, but threads caps a second, redundant way (the render pipeline already flows caps to the draw ctx) through every construction site | **(A) additive `DrawContext.caps`** — the natural home (draw-time is where the glyph decision lives), reuses the caps the render root already holds, keeps widget option APIs clean. Additive RD-03-spine edit; "no new **core** primitive / no `glyphs.ts` edit" stays true (`DrawContext` is ui-side). *(user-selected)* | ✅ Resolved (user) |
| **PA-2** | Unstated Assumption / Edge cases | RD-18 says the ASCII form is a "widget-level `caps`-driven selection" but does not pin the **predicate** or the ASCII glyphs. When exactly is ASCII chosen, and to what? | (a) **unified predicate** `asciiOnly(caps) = !caps.unicode.utf8 \|\| !caps.glyphs.halfBlocks`, shared by both widgets; bar → whole-cell **`#` fill / `-` track** (distinct, per PF-001); spinner → **any non-`line` preset → `line`**; (b) per-preset predicates (dots needs only utf8, blocks needs halfBlocks) — rejected: two predicates, harder oracle, and `line` is pure-ASCII so the conservative unified predicate is always safe | **(a) unified `asciiOnly = !utf8 \|\| !halfBlocks`; bar `#`/`-`; spinner non-`line`→`line`** — grounded: `█`/`░`/eighth-blocks are Block Elements needing utf8 **and** halfBlocks; braille needs utf8. Conservative + single AC-3/AC-8 oracle. *(source/convention, from AR-189/AR-191 + PF-001)* | ✅ Resolved (source) |
| **PA-3** | Ambiguity (GATE-1) | RD-18 AR-192 defers the feedback theme **role count + exact attribute bytes** to plan GATE-1. TV has **no** gauge/progress palette (GATE-1 whole-tree search, AR-186), so there is no `getColor` chain to decode — these are **documented extension colours** (same class as `tableHeader`, theme.ts:147-154). | (a) **2 additive roles** `progressFill` + `progressTrack`, bytes grounded in TV's bright-on-dim gauge convention + the shipped scrollbar cyan-on-blue family: **fill `0x1B` brightCyan-on-blue**, **track `0x13` cyan-on-blue** (= `scrollBarPage`); caption/label/spinner-glyph **reuse existing text roles** (`staticText`/`label`) — no extra roles; (b) 4 roles (add `progressCaption` + `spinner`) — rejected: unnecessary surface; reusing `staticText`/`label` matches how the bar/spinner sit in a dialog/window | **(a) 2 roles `progressFill 0x1B` / `progressTrack 0x13`; caption/label/spinner reuse `staticText`/`label`** — minimal additive surface, grounded in the shipped cyan-on-blue gauge family (fill brighter than track). Recorded as a documented extension (no `getColor` decode exists). *(source-determined, AR-192)* | ✅ Resolved (source) |
| **PA-4** | Testability (GATE-1) | RD-18 AC-2 pins the fill math as `round`-first (`e=round(v·width·8)`, `floor(e/8)` full `█` + `PARTIAL[e mod 8]` over `░`). Confirm the exact `PARTIAL` table + code points as the immutable oracle. | Single viable — pin `PARTIAL = ['▏','▎','▍','▌','▋','▊','▉']` = U+258F,258E,258D,258C,258B,258A,2589 indexed **1..7**; full `█`=U+2588, track `░`=U+2591 | **`PARTIAL[1..7]` = U+258F…U+2589; `█`=U+2588; `░`=U+2591; `round`-first** — the AC-2 cell-by-cell oracle, asserted pre-`serialize`. *(from AR-189/AC-2, PF-002 resolution)* | ✅ Resolved (source) |
| **PA-5** | Ambiguity (GATE-1) | RD-18 AR-191/PF-003 pins `dots` + `line` inline but leaves the **`blocks`** preset glyphs "at plan GATE-1". Pin `blocks` + the frozen `SPINNERS` map. | (a) **`blocks` = the eighth-block growth cycle** `['▏','▎','▍','▌','▋','▊','▉','█']` (U+258F…U+2588) — cohesive with the bar's own partial set, needs utf8+halfBlocks, falls back to `line`; (b) quadrant rotation `▖▘▝▗` — viable but a second unrelated glyph family; the growth cycle reuses the bar's decode | **(a) `blocks = ▏▎▍▌▋▊▉█`; `dots = ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`; `line = \| / - \`; default `dots`; frozen `SPINNERS = {dots,line,blocks}`** — extension glyphs (no TV precedent, acknowledged), cohesive with the bar. *(source/convention, AR-191)* | ✅ Resolved (source) |
| **PA-6** | File structure | RD-18 AR-193 leaves the exact `src/feedback/` file split "confirmed at plan time" (≤500 lines/file). | (a) **`progress-bar.ts` + `spinner.ts` + `run-spinner.ts` + `index.ts`** — bar (+ fill math + caption + `asciiOnly` helper, exported), spinner (+ `SPINNERS` + preset-swap, imports `asciiOnly`), the timer helper split out (AR-193 "split if `spinner.ts` would exceed 500"), barrel; (b) fold `runSpinner` into `spinner.ts` — rejected: keeps the pure widget free of the timer seam + keeps files small | **(a) 4 files; `asciiOnly(caps)` defined once in `progress-bar.ts`, imported by `spinner.ts`** *(AR-193)* | ✅ Resolved (dominant) |
| **PA-7** | Interface (GATE-1) | RD-18 AR-190 leaves the `runSpinner` name/signature "confirmed at plan time". | Single viable — `runSpinner(frame: Signal<number>, opts: { intervalMs?: number; timer: TimerSeam }): () => void`; `TimerSeam = Pick<RuntimeAdapter, 'setTimer' \| 'clearTimer'>`; default `intervalMs = 80`; the returned `stop()` clears the timer (no leak, AC-14) | **`runSpinner(frame, { intervalMs = 80, timer })` → `stop()`; `TimerSeam = Pick<RuntimeAdapter,'setTimer'\|'clearTimer'>`** *(AR-190)* | ✅ Resolved (source) |
| **PA-8** | Interface | RD-18 leaves the widget **option shapes** + Should-Have surface to plan time (`.set`/`percent`, caption opt, spinner label/preset). | Single viable, matching the house caller-owned-signal idiom (`Input`/`RadioGroup`/`TabView`): `new ProgressBar({ value: Signal<number>, caption?: boolean })` + `.set(v)` + `percent` getter (`round(clamp(value)·100)`); `new Spinner({ frame: Signal<number>, preset?: SpinnerName, label?: string \| (() => string) })`; both leaf `View`s (no `onEvent`) | **`ProgressBar({value,caption?})` + `.set`/`percent`; `Spinner({frame,preset?,label?})`; `SpinnerName='dots'\|'line'\|'blocks'`** *(AR-188/AR-191 Should-Haves — all included)* | ✅ Resolved (dominant) |
| **PA-9** | Config | Which command fills every plan "Verify" line? | Detected from CLAUDE.md: **`yarn verify`** (= `turbo run typecheck build test`). | **`yarn verify`** *(project CLAUDE.md — confirmed)* | ✅ Resolved (config) |
| **PA-10** | Consistency | RD-18 AR-194 leaves the kitchen-sink **story ids** to plan time (DataGrid drifted to a bare id; tabs pinned `containers/tabs` to avoid that). | (a) **`feedback/progress-bar` + `feedback/spinner`**, category `Feedback` — the `category/name` registry convention (tabs precedent AR-185); demo script **`demo:feedback`**; (b) bare ids — rejected: repeats the DataGrid drift | **`feedback/progress-bar` + `feedback/spinner`, category `Feedback`; `demo:feedback`** *(AR-194)* | ✅ Resolved (dominant) |

## Traceability

- **PA-1** is the sole **user-gated** plan decision (the caps draw-time seam; Option A `DrawContext.caps`).
- **PA-2/PA-4/PA-5/PA-7** are **source/convention-determined** GATE-1 pins descending from AR-189/191/192
  (glyph tables, predicate, `runSpinner` signature) — decoded + recorded here + in the code JSDoc +
  the ST oracles, per the NON-NEGOTIABLE TV-fidelity directive (RD-18 has no TV component to diff, so
  the fidelity work is "pin the grounded-in-TV pieces", not a cell-by-cell `.cpp` diff).
- **PA-3** is **source-determined** (AR-192): a documented **extension colour** set — TV has no gauge
  palette, so, like `tableHeader`, the bytes are a grounded design choice (bright-on-dim, cyan-on-blue
  gauge family), pinned + recorded, not a `getColor` decode.
- **PA-6/PA-8/PA-10** are single-dominant (subsystem convention, caller-owned-signal idiom, registry id
  convention); **PA-9** is config.

> **GATE PASSED** — 10/10 items Resolved, zero deferred, user confirmed the caps-seam decision (PA-1).
