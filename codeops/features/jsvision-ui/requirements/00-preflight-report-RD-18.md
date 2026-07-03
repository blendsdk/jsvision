# Preflight Report: RD-18 — Feedback (ProgressBar + Spinner)

> **Status**: ✅ PASSED — all 5 findings resolved (user accepted every recommendation; fixes applied to the RD + Ambiguity Register)
> **Iteration**: 1 (first scan)
> **Artifact**: Requirements doc at `codeops/features/jsvision-ui/requirements/RD-18-feedback.md`
> **Codebase Grounded**: 5 source files examined, all code references verified
> **Last Updated**: 2026-07-03
> **Same-session review?** No — RD-18 was drafted in a prior session (commit `a3a87eb`). Note: the
> two MAJOR findings both trace to a stale reuse assumption that is *repeated verbatim in the
> Ambiguity Register* (AR-189), so it survived the creation gate — an independent challenger
> confirmed both against the code.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), zero runtime deps; yarn + Turborepo monorepo;
vitest. `@jsvision/ui` widgets over `@jsvision/core` engine.
**Architecture:** Retained widget tree (`View`/`Group`) + Solid-style signals; serialize-time
capability glyph fallback; injectable `RuntimeAdapter` OS seam. Additive `Theme` roles per subsystem.
**Key Files Examined:**
- `packages/core/src/engine/render/glyphs.ts` — `fallbackGlyph` + `BLOCK_SHADE`/`BOX_FALLBACK`/`AMBIGUOUS_FALLBACK`
- `packages/core/src/engine/host/types.ts:111-144` — `RuntimeAdapter.setTimer`/`clearTimer` (lines 126-129)
- `packages/core/src/engine/color/theme.ts:154-344` — additive role pattern (`tabActive`/`tableHeader`/…)
- `packages/ui/src/view/view.ts` — `bind`/`invalidate`/`onMount`
- `codeops/features/jsvision-ui/requirements/00-ambiguity-register.md:241-249` — AR-186…AR-194

**Reference verification:** `fallbackGlyph` ✅ exists · `RuntimeAdapter.setTimer/clearTimer` ✅ exists
(126-129, RD cites 126-128) · additive `Theme` role pattern ✅ matches AR-192 · `View.bind/invalidate`
✅ exists · eighth-block partials in fallback tables ❌ **6 of 7 missing** (see PF-001).

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 2 | Implicit / Stale Assumptions | PF-001 | 🟠 |
| 3 | Logical Contradictions | PF-002 | 🟠 |
| 1 | Ambiguities | PF-003 | 🟡 |
| 12 | Consistency | PF-004 | 🔵 |
| 13 | Codebase Alignment | PF-001, PF-005 | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | ✅ all resolved |
| 🟡 MINOR | 1 | ✅ resolved |
| 🔵 OBSERVATION | 2 | ✅ resolved |

---

### PF-001: The bar's ASCII fallback cannot come from the shipped `fallbackGlyph` path 🟠 MAJOR

**Dimension:** 2 (Stale Assumption) + 13 (Impact Blindness) + 4 (Completeness of cross-package edits)
**Location:** RD-18 lines 37-38, 74-80, 174-184; AC-3 (line 274); AR-189.
**Codebase Evidence:** `packages/core/src/engine/render/glyphs.ts:61-70` (`BLOCK_SHADE`) + `:97-104`.

**The Problem:** RD-18 states the bar's full block `█` (U+2588) + eighth-block partials `▏▎▍▌▋▊▉`
(U+258F…U+2589) over the `░` track (U+2591) "route through the shipped `fallbackGlyph` capability
path … **exactly as the frame/scrollbar glyphs already do**", yielding "`#`/`=` fill, `-`/space
track", with "**no new core primitive**". The shipped code refutes this on two counts:

1. **6 of the 7 partials are absent.** `BLOCK_SHADE` (glyphs.ts:61-70) contains only U+2588, U+2580,
   U+2584, **U+258C**, U+2590, U+2591, U+2592, U+2593. The partials U+2589/258A/258B/258D/258E/258F
   are in **no** table, so with `halfBlocks` off they fall through to `?` (utf8 off) or render as raw
   Unicode (utf8 on) — never the assumed ASCII.
2. **Fill and track collapse to the same glyph.** Both `█` and `░` are in `BLOCK_SHADE` → `fallbackGlyph`
   returns `'#'` for *both* (glyphs.ts:97-98). There is no path to `-`/space/`=` anywhere in the file.
   An ASCII bar would be all `#` — fill indistinguishable from track. `░→#` is also **global** (shared
   with `TScrollBar`), so it can't simply be remapped for the bar.

Because a per-glyph 1:1 map has no notion of "fill vs track" and lacks widget context, the desired
whole-cell ASCII bar is inherently a **widget-level** decision — the same shape as the Spinner's
caps-driven preset swap (AR-191). The RD's "Cross-package edits (additive only)" list (lines 174-179)
names only theme roles and asserts the fallback path "already exist[s]", so the scoping is incomplete.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | ProgressBar renders its **own** caps-driven ASCII (whole-cell `#` fill / `-` or space track) — mirroring the Spinner's caps-driven preset selection; do NOT route the bar through serialize-time `fallbackGlyph`. Correct the RD's reuse sentences + AC-3. | Keeps core untouched (RD's "no new primitive" stays *true*); correctly distinguishes fill/track; unifies both widgets under "widget reads caps". | Rewrites the lines 37-38/74-80/182-184 reuse framing; widget reads `caps`. |
| B | Extend `glyphs.ts` (add the 6 partials + a bar track substitute). | Partials stop rendering as `?`. | Still can't separate fill (`█→#`) from track (`░→#`) — `░` is global; adds an unlisted core edit; doesn't actually solve it. |

**Recommendation:** **Option A** — the serialize-time `fallbackGlyph` fundamentally cannot express
"fill vs track" (1:1 global map), so widget-level ASCII rendering is the only correct mechanism, and
it makes the RD's "no new core primitive" claim *actually true*. Rewrite lines 37-38 / 74-80 / 182-184
and AC-3 to say the bar selects its ASCII whole-cell form from `caps` (as the Spinner selects its
preset), and remove the "exactly as frame/scrollbar already do" claim.
**Confidence:** High. **Hardening:** independent challenger CONFIRMED against glyphs.ts:61-70/97-104.

**User Decision:** Resolved — User accepted recommendation; fix applied.

---

### PF-002: The fill-math "spec oracle" is internally inconsistent and underspecified 🟠 MAJOR

**Dimension:** 3 (Contradiction) + 7 (Testability)
**Location:** RD-18 line 72 / AR-189 (FR rounding rule) vs. **AC-2** (lines 271-273, the declared
"immutable oracle", line 262).
**Codebase Evidence:** Document-internal; no code dependency (verified by reading both statements).

**The Problem:** Two conflicting fill-math specs describe the same behavior:
- FR / AR-189: width-in-eighths = **`round(value·width·8)`**, then split into full cells + partial.
- AC-2: **`floor(value·width·8 / 8)`** full `█` cells (= `floor(value·width)`, **no rounding**) + "the
  correct eighth-block partial for the fractional edge cell" — with **no formula** for which partial.

They diverge at rounding boundaries: at `value·width ≈ 2.98`, FR → `round(23.84)=24` = **3** full cells,
no partial; AC-2 → `floor(2.98)=2` full cells + a ~⁷⁄₈ partial. At `value=0.99, width=1`, FR → **1** full
cell; AC-2 → **0** full + a partial. AC-2 is the artifact's own "pinned spec oracle", yet it (a)
contradicts the FR rounding rule and (b) omits the 1..7-eighths→glyph mapping — so a spec test cannot be
encoded deterministically.

**Options:** Single viable resolution (make the two consistent and fully specify AC-2). The only sub-choice
is round-first vs floor-first at the boundary.

**Recommendation:** Make **AC-2 the single authoritative formula** and align line 72 to it:
`v = clamp(value,0,1); e = round(v·width·8); full = floor(e/8); part = e mod 8;` draw `full`×`█`, then
if `part∈1..7` one `PARTIAL[part]` (`PARTIAL = [▏,▎,▍,▌,▋,▊,▉]` for 1..7), then `░` for the rest. Choose
**round-first** (matches the FR sentence and is more visually accurate). Replace AC-2's
`floor(value·width·8 / 8)` phrasing and add the explicit mod-8→glyph table.
**Confidence:** High. **Hardening:** challenger CONFIRMED the divergence with the same worked examples.

**User Decision:** Resolved — User accepted recommendation; fix applied.

---

### PF-003: `blocks` preset unpinned; non-`dots` presets have no defined ASCII-off behavior 🟡 MINOR

**Dimension:** 1 (Ambiguity) + 9 (Edge Cases)
**Location:** RD-18 lines 94-98 (AR-191), AC-7 (line 286), AC-8 (line 289).
**Codebase Evidence:** `packages/core/src/engine/render/glyphs.ts:61-70` — block glyphs → `#` under `halfBlocks` off.

**The Problem:** `dots` (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) and `line` (`|/-\`) are pinned inline, but `blocks` is only "a
block-cycle set" — unspecified. And AC-8 defines ASCII fallback **only** for `dots`→`line`. If a caller
selects `blocks` (or any block-glyph preset) with glyphs off, every frame collapses to `#` via
`fallbackGlyph` (BLOCK_SHADE) → a *static* "animation" (no visible motion), which no AC forbids.

**Recommendation:** (single viable) In the RD, (a) mark `blocks`' exact glyphs as pinned at plan GATE-1
consistently (or pin them inline like `dots`/`line`), and (b) generalize AC-8: **any** non-`line` preset
falls back to `line` when Unicode/glyphs are off (not just `dots`), so no preset degrades to a static glyph.
**Confidence:** High.

**User Decision:** Resolved — User accepted recommendation; fix applied.

---

### PF-004: "the glyph-capability path" conflates two different mechanisms 🔵 OBSERVATION

**Dimension:** 12 (Consistency)
**Location:** RD-18 lines 38, 96-98, 182-184, 229.
**The Problem:** The doc calls both the bar's fallback and the spinner's fallback "the (shipped)
`fallbackGlyph`/glyph-capability path", but they are different: the bar (as designed) does per-glyph
substitution; the spinner does a caps-driven **preset swap** (widget picks a different frozen array).
Lumping them obscures PF-001.

**Recommendation:** Once PF-001 (Option A) lands, describe both as "the widget reads `caps` and selects
its ASCII form" and reserve "`fallbackGlyph` path" for genuine serialize-time per-glyph substitution.
**User Decision:** Resolved — User accepted recommendation; fix applied.

---

### PF-005: `RuntimeAdapter` timer-seam line cite is off by one 🔵 OBSERVATION

**Dimension:** 13 (Codebase Alignment — minor)
**Location:** RD-18 lines 7, 40, 108, 186 — cites `host/types.ts:126-128`.
**Codebase Evidence:** `setTimer` is at 126-127, `clearTimer` at 128-129 → the pair spans **126-129**.
**Recommendation:** Update the cite to `126-129` (or `126-127` for `setTimer` alone). Trivial.
**User Decision:** Resolved — User accepted recommendation; fix applied.

---

## Outcome

✅ **PASSED** — user accepted all 5 recommendations; fixes applied to `RD-18-feedback.md` (header, fidelity table, FR fill/fallback bullets, spinner presets/fallback, reuse + cross-package sections, Scope-Decision summaries, AC-2/AC-3/AC-8, and the Next-step note) and to `00-ambiguity-register.md` (AR-186/189/191 mechanism phrasing). No CRITICAL findings; security (AC-14: clamp + sanitize + width-clip + timer-clear) is sound.

**Net requirement changes:** (1) the bar/spinner ASCII fallback is a widget-level `caps`-driven selection, NOT the serialize-time `fallbackGlyph` map — keeping "no new core primitive/no `glyphs.ts` edit" true; (2) AC-2 is now the single `round`-first fill-math oracle (`e=round(v·width·8)`, `floor(e/8)` full + `PARTIAL[e mod 8]`); (3) any non-`line` spinner preset falls back to `line`; `blocks` glyphs pinned at plan GATE-1.
