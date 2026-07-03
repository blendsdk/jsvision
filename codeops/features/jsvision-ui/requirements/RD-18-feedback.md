# RD-18: Feedback — ProgressBar + Spinner (documented new components, no TV counterpart)

> **Document**: RD-18-feedback.md
> **Status**: Draft
> **Created**: 2026-07-03 (`make_requirements --continue` — RD-12+ high-value-controls set, sibling 5 of 6; **Later** phase)
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-03 (View/Group spine — done; `View`/`Group`/`DrawContext`, per-view `bind`/`invalidate`), RD-01 (Reactive core — done; `Signal`/`computed` drive the bar `value` + the spinner `frame`), RD-02 (Layout engine — done; both widgets size/place via the normal layout pass), RD-05 (App shell — done; the disabled-greying + caption conventions; a `Window`/`Dialog` hosts them), `@jsvision/core` (done; the additive feedback theme roles land here at plan GATE-1; both widgets select an ASCII fallback **at the widget level** from the resolved `caps` (RD-02 capability model — the sub-cell fill degrades to a whole-cell `#`/`-` bar, the braille spinner to the `line` preset; no `glyphs.ts` edit); the shipped **`RuntimeAdapter.setTimer`/`clearTimer`** seam (`host/types.ts:126-129`) backs the optional spinner-timer helper)
> **Set**: RD-12+ high-value controls (AR-125…AR-129) — sliced by mechanism into 6 sibling RDs; this is **RD-18 (Feedback)**, the second **Later**-phase RD (after the RD-14/15/16 MVP, AR-129; RD-17 Tabs preceded it).
> **CodeOps Skills Version**: 3.2.0

---

## Feature Overview

Two **feedback** widgets for `@jsvision/ui` that report ongoing work to the user:

- **`ProgressBar`** — a **determinate** horizontal bar showing fractional progress (0 → 1) as a
  filled block over a track, optionally with a centred percentage caption. The idiomatic way to show
  "45% of a copy / install / scan complete".
- **`Spinner`** — an **indeterminate** busy indicator: a single animated glyph that cycles through a
  frame set (braille dots by default), optionally with a trailing label ("Loading…"). The idiomatic
  way to show "working, no ETA".

**GATE-1 fidelity finding (whole-tree search, `magiblot/tvision`).** Turbo Vision has **no** progress
bar, gauge, meter, spinner, throbber, or any busy-indicator class. A full-tree search of `source/` +
`include/` for `progress` / `gauge` / `spinner` / `meter` / `throbber` / `T*Progress` returns
**nothing**. Turbo Vision reported long operations only through its `TApplication::idle` repaint hook +
ad-hoc app drawing; it shipped no reusable widget.

So RD-18 has **no TV counterpart to decode** — the same situation as RD-17 (Tabs). Per the
**NON-NEGOTIABLE TV-fidelity directive**, RD-18 is therefore a pair of **documented new components**
(AR-186). The directive still binds every **piece** that has a TV/CP437 precedent, and RD-18 grounds
each in an already-shipped facility or the DOS-16 palette / CP437 glyph conventions rather than inventing:

| Piece | Grounded in |
|-------|-------------|
| Determinate bar glyphs — full block `█` (U+2588) + eighth-block partials `▏▎▍▌▋▊▉` (U+258F–U+2589) at the fill edge + light-shade track `░` (U+2591) | Unicode **Block Elements**; the same CP437 shade/block convention TV itself uses (`TScrollBar` `▒`/`■`, the button/window shadow `▄█▀`) |
| ASCII fallback for the bar (`#` fill / `-` or space track, whole-cell) **and** the spinner (braille `dots` → the `line` preset `\|/-\`) | a **widget-level `caps`-driven selection** — each widget reads `caps.glyphs`/`caps.unicode` and picks its ASCII form (the bar drops the sub-cell partials; the spinner swaps preset). **Not** the serialize-time per-glyph `fallbackGlyph` map (`render/glyphs.ts`), which is a 1:1 global substitution with no fill-vs-track notion (`░` is shared with `TScrollBar` → both `█` and `░` collapse to `#`) and does not carry the eighth-block partials |
| Spinner frame sets — braille dots `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` (U+2800 Braille Patterns), line `\|/-\`, blocks | Unicode Braille / ASCII; the modern `ora`/Ink busy-spinner convention (no TV precedent — the extension) |
| Optional animation timer | the shipped **`RuntimeAdapter.setTimer`/`clearTimer`** seam (`host/types.ts:126-129`) — TV had no equivalent (it repainted on its idle event); extension via the injectable timer, no new core primitive |
| Fill / track / spinner colours | decoded through the **`cpAppColor`** chain at **plan GATE-1**, grounded in TV's bright-on-dim gauge-like convention; pinned to exact attribute bytes |

This is exactly the extension latitude the directive permits ("behavior the original couldn't have may
extend TV, but the visual shapes/sizes/colors must still match") — the same class as reactive binding,
truecolor, and async modality. The *glyphs and colours* stay CP437/DOS-faithful even though the
*components* are new.

The components in scope:

| Component | Basis | Role |
|-----------|-------|------|
| `ProgressBar` | *(new, extension — AR-186)* | A `View` bound to `value: Signal<number>` in `[0,1]`; draws a smooth sub-cell block fill over a track, with an optional centred `%` caption; horizontal, no interaction. |
| `Spinner` | *(new, extension — AR-186)* | A `View` bound to `frame: Signal<number>`; draws `frames[frame() mod n]` from a selectable preset (braille default), with an optional trailing label; pure — the caller advances `frame`. |
| *(optional helper)* `runSpinner` | RD-07 `RuntimeAdapter.setTimer` seam | A tiny caller-side helper that advances a `frame` signal on a timer and returns a stop handle; injectable timer seam so it is headless-testable. |

**Behavior may extend TV** (the widgets themselves, reactive binding, the animation timer) but the
**glyphs/geometry/colour of every piece must match TV/CP437 conventions** — decoded/confirmed at plan
GATE-1.

---

## Functional Requirements

### Must Have

#### `ProgressBar` — determinate fractional bar (AR-187/AR-188/AR-189)
- A **`View`** (a leaf — no children, mirroring `Text`/`Label`, AR-193) bound to a **reactive
  `value: Signal<number>` normalized to `[0,1]`** (the house reactive-value idiom — `Input`'s text
  signal, `RadioGroup`'s `Signal<number>`, AR-188). Writing `value` repaints the bar.
- **Value is clamped** to `[0,1]` on read (out-of-range or `NaN` → clamped to `0`/`1`), so no caller
  input can overflow the bar or index out of range.
- **Smooth sub-cell fill (AR-189):** clamp `value` to `[0,1]`, then let `e = round(value · width · 8)`
  be the bar's width in eighths; it draws `floor(e / 8)` fully-covered **`█`** cells (U+2588), then —
  when `e mod 8 ∈ 1..7` — one matching **eighth-block partial** `PARTIAL[e mod 8]` where
  `PARTIAL = [▏,▎,▍,▌,▋,▊,▉]` (U+258F…U+2589, indexed `1..7`; no partial when `e mod 8 == 0`), then the
  remaining cells as the **`░` track** (U+2591). This gives sub-cell precision at any width (grounded
  in the Unicode Block Elements; the exact `round`-first formula + partial-glyph table pinned as the
  AC-2 spec oracle).
- **ASCII fallback (AR-189):** under a capability profile without Unicode/glyphs, the bar itself reads
  `caps` and renders a **whole-cell** ASCII form directly — a distinct `#` fill and `-` (or space)
  track, dropping the sub-cell partials — the same **widget-level `caps`-driven selection** the Spinner
  uses to swap presets. It does **not** rely on the serialize-time `fallbackGlyph` per-glyph map (a 1:1
  global substitution that collapses both `█` and `░` to `#` and does not carry the eighth-block
  partials, `render/glyphs.ts`). The bar renders correctly (whole-cell only) with no throw. *(exact
  ASCII fill/track chars confirmed at plan GATE-1.)*
- **Optional percentage caption:** an opt-in centred label (e.g. ` 45% `) overlaid on the bar,
  showing `round(value·100)`; off by default. When on, the caption text is drawn over the fill/track
  in the caption role and is width-clipped.
- **Horizontal only** for this RD (vertical deferred); the bar fills its laid-out width × 1 row (a
  taller bar repeats the row — confirmed at plan time).

#### `Spinner` — indeterminate busy indicator (AR-187/AR-190/AR-191)
- A **`View`** (leaf) bound to a **reactive `frame: Signal<number>`**; it draws
  **`frames[((frame() mod n) + n) mod n]`** — a **pure** render of the current frame with **no
  internal clock** (AR-190). The caller advances `frame` (by any cadence: a timer, a tick counter, a
  test stepping it by hand), which repaints the next glyph. This keeps the widget deterministic and
  **fully headless-testable** with no wall-clock dependency.
- **Selectable frame presets (AR-191):** ship named presets — **`dots`** (braille
  `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`, U+2800 block), **`line`** (`| / - \`), **`blocks`** (a block-cycle set, exact glyphs
  pinned at plan GATE-1 alongside `dots`/`line`) — each a documented frozen array; **default = `dots`**.
- **ASCII fallback (AR-191):** under a capability profile without Unicode/glyphs, **any** non-`line`
  preset (the braille `dots`, the `blocks` set) automatically falls back to the ASCII **`line`** preset
  — a **widget-level `caps`-driven preset swap** (the Spinner reads `caps.glyphs`/`caps.unicode` and
  selects the `line` array), so the spinner animates everywhere with no throw and never degrades to a
  static glyph.
- **Optional trailing label:** an opt-in text (e.g. `Loading…`) drawn to the right of the spinner
  glyph in the spinner/label role, width-clipped and sanitized.

#### Optional animation-timer helper (AR-190)
- A tiny **`runSpinner(frame, { intervalMs, timer })`** helper (name/signature confirmed at plan
  time) that advances a `frame` signal every `intervalMs` and returns a **stop handle**
  (`() => void`). It takes an **injectable timer seam** — the shipped `RuntimeAdapter` (or a minimal
  `{ setTimer, clearTimer }` subset, `host/types.ts:126-129`) — so real apps pass the live runtime
  and tests pass a fake that steps time deterministically (no wall-clock in tests). The `Spinner`
  widget itself never imports a timer; the helper is a separable convenience. `stop()` clears the
  timer (no leak).

#### Theme roles — additive faithful feedback colours (AR-192)
- Add a small set of **additive feedback roles** to core `@jsvision/core` `Theme` + `defaultTheme` —
  the bar **fill**, the bar **track** (and, if the plan GATE-1 decode shows they are needed, the
  caption and the spinner glyph) — each decoded through the **`cpAppColor`** chain at **plan GATE-1**
  and pinned to an exact attribute byte per the fidelity directive. Since TV has no gauge palette,
  these are **documented extension colours** grounded in TV's bright-on-dim convention. Additive,
  non-breaking — the same cross-package pattern as the RD-06/07/11/15/16/17 control roles
  (AR-97/112/122/149/159/180). **The exact role count + attribute bytes are pinned at plan GATE-1.**

#### Kitchen-sink stories + headless demo (AR-194)
- Per the **kitchen-sink showcase (NON-NEGOTIABLE)** rule, add a **`ProgressBar` story** (a bar driven
  across 0→100% with a live percentage echo, showing the sub-cell fill and the caption) and a
  **`Spinner` story** (an animating spinner with a label + a preset switcher), each passing the
  headless smoke test; plus a headless **`demo:feedback`** walkthrough (an ASCII frame per step:
  bar at 0% → 33% → 66% → 100%, then the spinner stepped through several frames), matching
  `demo:tabs`/`demo:tree`/`demo:table`.

### Should Have

- **`ProgressBar.set(value)`** / a `percent` convenience getter — drive/read the bar without touching
  the raw signal.
- **A `value === undefined` "indeterminate bar" is *not* here** — indeterminate feedback is the
  `Spinner`'s job (kept as a clean split; the marquee-bar variant is out of scope, see below).
- **Spinner `speed`/`interval` default** baked into `runSpinner` (a sensible default `intervalMs`,
  e.g. 80ms, overridable).
- **A frozen public `SPINNERS` map** of the named presets so callers can pick/inspect them.

### Won't Have (Out of Scope) — and Deferred (tracked)

**Out of scope (this RD):**
- `Surface`/`SurfaceView` (RD-19), `Tabs` (RD-17), `Table`/`DataGrid` (RD-16), `Tree` (RD-15),
  `History`/`ComboBox` (RD-14) — the other RD-12+ siblings (AR-126).
- **Indeterminate / marquee ProgressBar** (a bouncing block with no known fraction) — the user chose
  the clean split (determinate bar + spinner); a marquee bar mode is deferred.
- **Vertical ProgressBar** — horizontal only this RD.
- **A self-timed `Spinner`** that owns its own clock — the widget is pure (AR-190); animation is
  caller-driven via the `runSpinner` helper or the app's own tick.
- **Multi-bar / stacked progress, ETA/rate text, sparklines** — a single fractional bar + optional
  percentage is the MVP.

**Deferred (tracked) — explicit register so nothing is lost (AR-99 convention):**

| Deferred item | From decision | Target | Rationale |
|---------------|---------------|--------|-----------|
| Indeterminate / marquee ProgressBar mode | AR-187 | later (post-set) | The Spinner covers indeterminate feedback; a marquee bar is a separable animation variant. |
| Vertical ProgressBar orientation | AR-188 | later (post-set) | Horizontal is the common case; vertical is a geometry variant on the same fill math. |
| Self-timed Spinner (owns a clock) | AR-190 | later (post-set) | Purity + headless testability win now; a convenience self-timed wrapper can layer on the helper later. |
| Rate/ETA caption, multi-bar | out-of-scope | later (post-set) | Beyond the single-fraction MVP. |

---

## Technical Requirements

### New subsystem (AR-193)
- One new subsystem dir `packages/ui/src/feedback/` (dir-per-concern, AR-133/148/160/181):
  `progress-bar.ts` (the `ProgressBar` `View` + the clamp + sub-cell fill math + optional caption),
  `spinner.ts` (the `Spinner` `View` + the `SPINNERS` presets + the ASCII-fallback selection), a
  small helper file (`runSpinner` over the injectable timer seam — kept out of `spinner.ts` if it
  would push it past 500), and one barrel `index.ts`; per-file ≤ 500 lines. **Explicit named
  re-exports** from `src/index.ts` (the layout-convention rule, AR-81/AR-102/AR-113/AR-181).
  *(Exact file split confirmed at plan time.)*
- Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps (`check:deps` holds).

### Cross-package edits (additive only, AR-192)
- `@jsvision/core` `Theme` + `defaultTheme` gain the additive **feedback roles** (bar fill / track,
  optionally caption + spinner), decoded from `cpAppColor` at plan GATE-1 (exact attribute bytes
  pinned per the fidelity directive). Same additive pattern as AR-97/112/122/149/159/180; **no
  existing role changes, no new core primitive** — the ASCII fallback is a widget-level `caps`-driven
  selection (no `glyphs.ts` edit) and the `RuntimeAdapter` timer seam already exists.

### Reuse (no new engine primitives)
- **Capability-driven ASCII form (core RD-02/RD-04):** both widgets read the resolved `caps` and
  select an ASCII form at the **widget level** when Unicode/glyphs are off — the bar renders a
  whole-cell `#`/`-` bar, the Spinner swaps to the `line` preset. This is a `caps`-driven selection,
  **not** the serialize-time per-glyph `fallbackGlyph` map (a 1:1 global substitution with no
  fill-vs-track notion and no eighth-block partials, `render/glyphs.ts`); no new core primitive and no
  `glyphs.ts` edit.
- **Timer seam (core RD-07):** the optional `runSpinner` helper builds on `RuntimeAdapter.setTimer`/
  `clearTimer` (`host/types.ts:126-129`), the same injectable OS-timer boundary the ESC-disambiguation
  timer uses; a fake runtime drives it deterministically in tests.
- **Reactivity/draw (RD-01/RD-03):** RD-01 `Signal`/`computed` (`value`/`frame` drive repaint),
  RD-03 `bind`/`invalidate`, RD-03 `DrawContext` (all writes via `ScreenBuffer` + `sanitize`).
- **Layout (RD-02):** both widgets size/place through the normal layout pass; no special geometry.
- **Caption/label rendering (RD-06):** the optional caption/label reuse the existing text-draw path;
  no new text primitive.

---

## Integration Points

- **View/Group (RD-03):** `ProgressBar` and `Spinner` are ordinary leaf `View`s — drop them into any
  `Group`/`Window`/`Dialog`; they self-draw and repaint on their bound signals.
- **Reactive (RD-01):** `value`/`frame` are plain signals — an app computes them from real work
  (bytes copied, ticks elapsed) and the widgets react; no polling.
- **App shell + host (RD-05/RD-07):** `runSpinner` takes the live `RuntimeAdapter` from a running
  app (`createHost`/`run()`), so a spinner animates while the app is idle; `stop()` on completion.
- **Core theme (core):** the additive feedback roles extend the same `Theme` the
  frame/menu/status/controls/list/outline/table/tab roles read; `defaultTheme` stays the single
  source of truth.
- **Kitchen-sink (examples):** `ProgressBar` + `Spinner` each get a story; `demo:feedback` is the
  headless walkthrough.

---

## Scope Decisions

All decisions trace to the Ambiguity Register (`00-ambiguity-register.md`):

- **AR-186** — RD-18 is a pair of **documented new components** (GATE-1: TV has no progress/gauge/
  spinner class — whole-tree search returns nothing); the pieces (block/braille glyphs, glyph
  fallback, timer seam, fill/track colour) are grounded in shipped facilities + CP437/DOS conventions.
- **AR-187** — **scope = both** a **determinate** `ProgressBar` (0→1) **and** an **indeterminate**
  `Spinner` (clean split; no marquee-bar mode). *(user choice)*
- **AR-188** — `ProgressBar` value model = reactive **`value: Signal<number>` in `[0,1]`**, clamped;
  horizontal-only; optional centred `%` caption. *(idiom/dominant)*
- **AR-189** — **smooth sub-cell fill** — `e = round(value·width·8)`, `floor(e/8)` full `█` cells + one
  eighth-block partial `PARTIAL[e mod 8]` (`▏▎▍▌▋▊▉`) at the edge over a `░` track; **widget-level
  whole-cell ASCII fallback** (`#` fill / `-` track) from `caps`, not the per-glyph `fallbackGlyph` map.
  *(user choice)*
- **AR-190** — `Spinner` is **caller-driven** — a pure `View` rendering `frames[frame() mod n]`, no
  internal clock; an optional `runSpinner` helper advances the signal over the injectable
  `RuntimeAdapter` timer seam (headless-testable), returning a stop handle. *(user choice)*
- **AR-191** — **spinner glyph presets** = `dots` (braille), `line`, `blocks`; **default `dots`**
  with automatic **ASCII fallback to `line`** via a widget-level `caps`-driven preset swap (any
  non-`line` preset → `line`). *(user choice)*
- **AR-192** — additive **feedback theme roles** (bar fill/track, optionally caption + spinner),
  decoded through `cpAppColor` and pinned to exact bytes at **plan GATE-1**. *(dominant — additive-role
  fidelity pattern)*
- **AR-193** — new `src/feedback/` subsystem, explicit named re-exports. *(AR-133 subsystem convention)*
- **AR-194** — kitchen-sink `ProgressBar` + `Spinner` stories + headless `demo:feedback`.
  *(AR-98/114/161/182 demo pattern)*

> **Traceability:** AR-187/AR-189/AR-190/AR-191 are explicit user choices (RD-18
> `make_requirements --continue` gate, 2026-07-03); AR-186 is the GATE-1 source-determined finding (no
> TV counterpart); AR-188/AR-192/AR-193/AR-194 are single-dominant / source-determined decisions
> (the reactive-value idiom, the additive-role fidelity pattern, the AR-133 subsystem convention, the
> demo pattern) recorded for traceability.

---

## Security Considerations

> RD-18 adds two **feedback widgets** over the existing in-process TUI. No network, no persistence, no
> new untrusted external surface. The input boundaries are a numeric value / frame index → view state
> and an optional caption/label → screen:
- The bar `value` and the spinner `frame` are **bounds-checked / clamped** on every read (`value` to
  `[0,1]`, `NaN`→0; `frame` reduced mod `n` with a negative-safe formula), so no caller number can
  overflow the fill, index out of range, or produce a negative/oversized draw.
- The optional percentage caption and spinner label route through the RD-03 `DrawContext` →
  `ScreenBuffer` + core `sanitize` boundary and are **width-clipped**, so no raw escape sequence or
  over-long text from a caller reaches the terminal or overflows the widget/viewport.
- The `runSpinner` helper's `stop()` **clears its timer** (no dangling timer / resource leak); the
  helper holds no global state and interprets no caller data as code.

---

## Acceptance Criteria

Each AC is the immutable oracle a spec test will encode. There is no TV component to diff against
(GATE-1); the fidelity ACs (AC-2 fill glyphs, AC-3/AC-8 ASCII fallback, AC-7 presets, AC-11 colours)
encode the **grounded-in-TV-pieces** requirement — the Block-Element/braille glyphs, the capability
fallback, and the `cpAppColor`-decoded bytes pinned at plan GATE-1.

- **AC-1** (determinate bar) — a `ProgressBar` bound to `value: Signal<number>` renders a fractional
  fill over a track; writing `value` repaints so the filled proportion tracks the value. *(AR-187/AR-188)*
- **AC-2** (smooth sub-cell fill, faithful glyphs) — for a clamped `value` and a `width`, let
  `e = round(value·width·8)`; the bar draws `floor(e / 8)` full `█` cells, then — when `e mod 8 ∈ 1..7`
  — one **eighth-block partial** `PARTIAL[e mod 8]` where `PARTIAL = [▏,▎,▍,▌,▋,▊,▉]` (U+258F…U+2589,
  index `1..7`), then `░` for every remaining cell (no partial when `e mod 8 == 0`); asserted
  cell-by-cell against the buffer pre-`serialize` (the `round`-first fill-math oracle). *(AR-189)*
- **AC-3** (bar ASCII fallback) — under a capability profile with Unicode/glyphs **off**, the bar reads
  `caps` and renders a **whole-cell** ASCII form directly (`#` fill / `-` or space track, distinct from
  each other; sub-cell partials dropped) — a widget-level selection, **not** the serialize-time
  `fallbackGlyph` map; it renders correctly and does **not** throw. *(AR-189)*
- **AC-4** (percentage caption) — with the caption enabled, a centred ` NN% ` (= `round(value·100)`)
  is drawn over the bar in the caption role, clamped to `0..100` and width-clipped; disabled by
  default. *(AR-188)*
- **AC-5** (value clamp / safety) — `value` outside `[0,1]` (including `NaN`, `-1`, `2`) is clamped to
  `0`/`1` before drawing; the bar never overflows its width or indexes out of range. *(AR-188/security)*
- **AC-6** (spinner frame render) — a `Spinner` bound to `frame: Signal<number>` draws
  `frames[((frame() mod n)+n) mod n]`; advancing the signal repaints the next glyph; a negative frame
  is handled safely. *(AR-190)*
- **AC-7** (spinner presets) — the named presets `dots` (braille), `line`, `blocks` are each a frozen
  glyph array selectable by the caller; the **default is `dots`**; a public `SPINNERS` map exposes
  them. *(AR-191)*
- **AC-8** (spinner ASCII fallback) — under a capability profile with Unicode/glyphs **off**, **any**
  non-`line` preset (`dots`, `blocks`) falls back to the ASCII `line` preset via a widget-level
  `caps`-driven preset swap (never degrading to a static glyph); the spinner animates and does **not**
  throw. *(AR-191)*
- **AC-9** (spinner label) — with a label set, it is drawn to the right of the spinner glyph in the
  spinner/label role, width-clipped and sanitized. *(AR-190)*
- **AC-10** (timer helper, injectable + no leak) — `runSpinner(frame, { intervalMs, timer })` advances
  the `frame` signal every `intervalMs` using the injected timer seam and returns a `stop()` that
  clears the timer; driven by a **fake runtime** it steps deterministically with **no wall-clock**,
  and after `stop()` no further advances occur. *(AR-190)*
- **AC-11** (theme roles) — `defaultTheme` exposes the additive feedback roles (bar fill/track, +
  caption/spinner if the GATE-1 decode needs them, `cpAppColor`-decoded); `encode()` of each does not
  throw; no existing role changes. *(AR-192)*
- **AC-12** (packaging) — `ProgressBar`/`Spinner`/`runSpinner`/`SPINNERS` live in
  `packages/ui/src/feedback/` with explicit named re-exports from `src/index.ts`; `yarn check:deps`
  passes (zero runtime deps); files ≤ 500 lines. *(AR-193)*
- **AC-13** (stories + demo) — `ProgressBar` and `Spinner` each have a kitchen-sink story (category
  `Feedback`; the bar driven across 0→100% with a live echo + caption, the spinner animating with a
  label + preset switch) passing the headless smoke test; `demo:feedback` runs headless with an ASCII
  frame per step (bar 0→33→66→100%, then the spinner stepped through frames). *(AR-194)*
- **AC-14** (security) — the bar `value` and spinner `frame` are bounds-checked/clamped; the caption
  and label are sanitized to the screen and width-clipped so nothing overflows the widget or viewport;
  `runSpinner.stop()` clears its timer (no leak). *(security standard)*

---

> **Next step:** run the make_plan skill on RD-18 to produce the implementation plan (spec-first: spec
> oracles RED → implement → GREEN → impl tests). Because RD-18 has **no TV counterpart** (GATE-1), the
> plan's GATE-1 work is narrower but still mandatory: **pin the feedback theme-role attribute bytes
> through the `cpAppColor` chain**, **confirm the `round`-first eighth-block fill formula + partial-glyph
> table (AC-2)** and the bar's **widget-level whole-cell ASCII form** (`#` fill / `-` track), and **pin
> the three spinner presets** (braille `dots` / `line` / `blocks`; `blocks` glyphs at GATE-1) and the
> non-`line`→`line` ASCII preset swap, recording the decode + the two BEFORE/AFTER gate tasks in
> `99-execution-plan.md`. Optionally preflight (`preflight RD-18`), then exec_plan. RD-18 is sibling 5
> of the RD-12+ set (AR-126) and the second **Later**-phase RD (AR-129); **RD-19 (Surface/SurfaceView)**
> — which *does* have a TV counterpart (`include/tvision/surface.h`) — is the last in the drafting queue.
