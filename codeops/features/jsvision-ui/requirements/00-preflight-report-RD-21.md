# Preflight Report: RD-21 — Color family (ColorSwatch + ColorPicker)

> **Status**: ✅ PASSED — all 6 findings resolved (0 critical, 2 major, 3 minor, 1 observation; all accepted + fixed 2026-07-04)
> **Iteration**: 1 (first scan)
> **Artifact**: Requirements doc at `codeops/features/jsvision-ui/requirements/RD-21-color-family.md`
> **Codebase Grounded**: 9 source files examined, 12 references verified (TV `colorsel.cpp` decode re-checked cell-by-cell)
> **Last Updated**: 2026-07-04
> **Review independence**: Fresh session (RD authored 2026-07-03; no same-session bias flag).

### Codebase Context Summary

**Tech Stack:** TypeScript ESM/NodeNext, yarn 1.x + Turborepo monorepo; `@jsvision/core` (zero-dep engine) + `@jsvision/ui` (TV-style widget framework). vitest (spec/impl/e2e).
**Architecture:** Retained view tree (RD-03) + fine-grained signals (RD-01) + host-agnostic event loop (RD-04); TV-fidelity decode-first for any component with a Turbo Vision counterpart.
**Key Files Examined:** `packages/core/src/engine/color/{color,palette,index}.ts`, `packages/core/src/engine/index.ts`, `packages/core/src/engine/render/types.ts`, `packages/ui/src/dropdown/popup.ts`, `packages/ui/src/date/date-picker.ts`, `packages/ui/src/view/view.ts`, `tvision/source/tvision/colorsel.cpp`, `tvision/source/tvision/tvtext1.cpp`, `00-ambiguity-register.md`, `00-roadmap.md`.

**Verified true (no finding):**
- TV decode facts: 3-wide cells `moveChar(j*3,icon,c,3)` (colorsel.cpp:131); `icon='\xDB'` = █ full block (tvtext1.cpp:88) → the RD's "solid block in the cell's own color" is a **faithful** decode; `◘` marker `putChar(j*3+1,8)` + black-cell `0x70` (:132-137); wrap-around nav (:179-217); click/drag hit `mouse.y*4+mouse.x/3` (:165-177); `ofFramed` (:114). All accurate.
- Core `Color` type (`render/types.ts:33`), `Ansi16Name`, `Rgb`, `PALETTE`, `encode()`, `InvalidColorError` are publicly exported.
- RD-20 is **Done**; `openAnchoredPopup` is generalized (`buildContent(commit)`/`contentSize`/`focusTarget`, `popup.ts:59-88`) — the AR-204 dependency is satisfied.
- Ambiguity Register backs AR-210…AR-219 with recorded user/source decisions.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 (PF-001) | 🟠 |
| 2 | Implicit Assumptions | 1 (PF-002) | 🟠 |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 2 (PF-003, PF-005) | 🟡 |
| 5 | Dependency Issues | 1 (PF-002) | 🟠 |
| 6 | Feasibility | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security | 0 | — |
| 9 | Edge Cases | 1 (PF-004) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering | 0 | — |
| 12 | Consistency | 1 (PF-005) | 🟡 |
| 13 | Codebase Alignment | 2 (PF-002 exports, PF-006 fidelity) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 2 | ✅ all resolved (Option A) |
| MINOR | 3 | ✅ all resolved (Option A) |
| OBSERVATION | 1 | ✅ resolved (Option A) |

---

### PF-001: Widget state model — `value` (Color) vs internal nav cursor is undefined 🟠 MAJOR

**Dimension:** 1 Ambiguities (+ 9 Edge Cases)
**Location:** RD-21 §`ColorSwatch` (lines 79–85), AC-3 (line 263), AC-4 (line 266)
**Codebase Evidence:** TV `TColorSelector` state is a single `uchar color` index — cursor and selection are the same thing (`colorsel.cpp:117,130-137,182-212`). The RD's extension binds `value: Signal<Color>` (a `Color`, possibly a truecolor not in `colors`, e.g. from the hex field, `render/types.ts:33`).
**The Problem:** AC-3 draws the marker on "the cell equal to `value`"; AC-4 commits "the focused cell to `value`"; line 81 says "moving the selection updates the focused cell." This implies a cursor index distinct from `value`, but the RD never defines (a) whether that internal cursor exists as separate state, (b) its **initial position when `value` ∉ `colors`** (a truecolor from `allowCustom`, or an empty palette), or (c) how commit reconciles cursor↔value. Two spec oracles (AC-3, AC-4) rest on this. This is the extension seam the TV decode explicitly *cannot* answer — it is a requirements-level decision, not a GATE drawing detail.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Specify the internal **cursor index** as the single source of truth for nav + marker; `value: Signal<Color>` is a derived two-way bind (commit ⇒ `value = colors[cursor]`; external `value` set ⇒ `cursor = indexOf(value)`, else unchanged). Define initial `cursor = indexOf(value)` if present, else `0`. Add an AC for the `value ∉ colors` case. | Deterministic oracles; matches TV's index-centric model; handles truecolor/empty cleanly | One added sentence + one AC |
| B | `value` is the sole state; derive `cursor = indexOf(value)` on the fly; when absent, nav starts at cell 0, no marker | No extra field | Nav origin silently jumps when `value` is a truecolor; couples nav to a possibly-absent value |
| C | Leave to plan GATE-1 | Defers work | Two immutable spec oracles would be authored against undefined behavior — wrong place to defer |

**Recommendation:** Option A — an internal cursor as nav SoT with `value` a derived bind is the TV-faithful mental model and makes AC-3/AC-4 deterministic for every palette/value combination. *Independent challenger: CONFIRMED-MAJOR, endorses A.*
**Confidence:** High. **Hardening:** 1 challenger (CONFIRMED); pick unchanged.

**User Decision:** Resolved — User accepted recommendation (Option A). Fix applied to RD-21 (2026-07-04).

---

### PF-002: Reused core color primitives (`ANSI16_ORDER`, `toRgb`, `HEX_RE`) are NOT on the public `@jsvision/core` entry 🟠 MAJOR

**Dimension:** 2 Implicit Assumptions / 5 Dependency Issues / 13 Dependency Reality
**Location:** RD-21 §"Reuse (no new engine primitives)" (lines 169–176), §"Cross-package edits (additive only)" (lines 160–163), AR-211/AR-213, AC-8, Security AC-13
**Codebase Evidence:**
- `packages/core/src/engine/index.ts` color re-exports = `encode, encodeStyle, styleKey, nearest256, nearest16, InvalidColorError, PALETTE, defaultTheme` + types. **`ANSI16_ORDER` and `toRgb` are absent.**
- `ANSI16_ORDER` is defined at `palette.ts:43` but not re-exported through `color/index.ts` (which exports only `PALETTE`).
- `toRgb` is `export`ed from `color.ts:42` but not re-exported through the barrel → not public.
- `HEX_RE` (`color.ts:32`) is a bare `const` with **no `export`** at all.
- `@jsvision/ui` imports `@jsvision/core` **by name** only (verified: `render-root.ts:14`, etc.) — it cannot reach non-barrel symbols.

**The Problem:** The RD frames the color model + validation as pure reuse ("no new engine primitives") and lists the *only* cross-package edit as "0 or 1 additive theme role." But the widget literally cannot import `ANSI16_ORDER` (its default palette), `toRgb()` (its hex-validation boundary — AC-8, AC-13), or `HEX_RE` from core today. RD-21 therefore requires **additive public re-exports** from `@jsvision/core`, which the cross-package edit inventory omits. This under-scopes the core surface RD-21 touches (still additive/non-breaking, `check:deps` unaffected — but real work the plan must account for).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add the missing additive re-exports to the RD's cross-package inventory: re-export `ANSI16_ORDER` + `toRgb` (and a public hex validator — export `HEX_RE`, or rely on `toRgb` throwing) through `color/index.ts` → `engine/index.ts`. Note them as required, pinned at plan GATE-1 alongside the theme role. | Honest scope; keeps the "reuse color math" decision (AR-211) intact; additive/non-breaking | Slightly widens the "minimal core edit" story (still additive) |
| B | Widget inlines/reimplements the palette order + hex parse | No core edit | Violates AR-211 (reuse core color math); duplicates the validation boundary — a security-relevant divergence |
| C | Dismiss — assume reachable | none | Factually false; blocks implementation |

**Recommendation:** Option A — the reuse decision (AR-211) is correct; the fix is to *acknowledge the additive re-exports* the reuse requires. Update the Cross-package section + AC-11 note (and it pairs naturally with the GATE-1 theme-role pin). *Independent challenger: CONFIRMED-MAJOR, endorses A.*
**Confidence:** High (grep-verified). **Hardening:** 1 challenger (CONFIRMED); pick unchanged.

**User Decision:** Resolved — User accepted recommendation (Option A). Fix applied to RD-21 (2026-07-04).

---

### PF-003: `ColorPicker` single-click-commit vs `ColorSwatch` drag-select interaction unspecified 🟡 MINOR

**Dimension:** 4 Completeness Gaps
**Location:** AC-5 (line 269, drag tracks selection), AC-7 (line 276, "single click on a swatch commits + closes"), §`ColorPicker` lines 99–102
**Codebase Evidence:** TV drives selection on `evMouseDown` and *loops* on `evMouseMove` (`colorsel.cpp:165-177`) — drag previews live. The RD keeps drag "faithful" (AR-215) *and* says a click in a picker "commits + closes" (AR-216).
**The Problem:** Inside the `ColorPicker` popup both apply to the same `ColorSwatch`. If a mouse-**down** commits+closes, a drag-preview is impossible (the popup is gone before the pointer moves). The RD never says whether the picker commits on mouse-**down** or on mouse-**up-without-drag**, nor whether drag-preview is even active inside a picker.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Commit-on-**release**: in a picker, drag previews the cell under the pointer; releasing over a cell commits+closes (down alone doesn't close). Standalone swatch keeps TV's down+drag select. | Preserves both faithful drag AND single-click-commit; matches how real pickers feel | One clarifying sentence + an AC nuance |
| B | Commit-on-**down**, no drag inside a picker (drag only in the standalone swatch) | Simplest | Loses drag-preview in the picker; a slightly surprising instant-close |

**Recommendation:** Option A — commit-on-release reconciles AC-5 and AC-7 without dropping either behavior; add one sentence to §`ColorPicker` and a clause to AC-7. (Confidence: Medium — a UX call; either is defensible, A preserves more.)

**User Decision:** Resolved — User accepted recommendation (Option A). Fix applied to RD-21 (2026-07-04).

---

### PF-004: Drag beyond the grid — RD says "clamp", TV reverts to the previous color 🟡 MINOR

**Dimension:** 9 Edge Cases / 13 Migration & fidelity
**Location:** AC-5 (line 271, "bounds-clamped"), Security AC-13 (line 297, "drag beyond the grid edge" bounds-checked)
**Codebase Evidence:** TV: when the pointer leaves the view during a drag, `mouseInView` is false ⇒ `color = oldColor` — it **reverts to the pre-drag color**, it does not clamp (`colorsel.cpp:167-173`).
**The Problem:** Drag-select is a *decoded* (faithful) behavior per AR-215, so its out-of-bounds semantics are a fidelity detail. The RD specifies "clamp to `[0, colors.length-1]`", which differs from TV's revert-to-old. Both are safe; they produce different UX. (Clamping is also needed for a *partial last row* in the generic palette — a case TV's full 4×4 never hits — so some clamp logic is genuinely new.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Pin at GATE-2: pointer **outside the grid** ⇒ revert to the pre-drag cell (TV-faithful); pointer **inside the grid but past the last cell of a partial row** ⇒ clamp to `colors.length-1` (generic-extension rule). Record both in the decode. | TV-faithful where TV speaks; defined extension where it doesn't | Two-clause rule |
| B | Keep "clamp everywhere" as a documented deviation | Simpler | A drawing/behavior deviation from the decode — must be explicitly recorded per the fidelity directive |

**Recommendation:** Option A — split the two cases; it honors the fidelity gate for the decoded path and only extends where the generic palette forces it. Note it for the plan's GATE-2 diff. (Confidence: High — grounded in the C++.)

**User Decision:** Resolved — User accepted recommendation (Option A). Fix applied to RD-21 (2026-07-04).

---

### PF-005: "Named swatches" (Should-Have) conflicts with the `Color[]` palette model 🟡 MINOR

**Dimension:** 12 Consistency / 4 Completeness
**Location:** §Should Have (lines 124–125), vs AR-211/AR-212 ("swatch sets are `Color[]`", lines 203–206)
**Codebase Evidence:** The RD fixes the palette type as `colors: Color[]` (AR-211, AR-212) — a `Color` is a bare string union (`render/types.ts:33`) with no label channel.
**The Problem:** The Should-Have "an optional `label` per cell surfaced in the chip caption" cannot be expressed as `Color[]`. Carrying per-cell labels needs either a parallel `labels?: string[]`, a richer `{ color, label }[]` cell type, or a `Map<Color,string>` — none specified, and a richer cell type would tension with the firm "sets are `Color[]`" decision.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Specify the label channel now (as Should-Have scope): an optional parallel `labels?: string[]` aligned to `colors`, or a `nameFor?: (c: Color) => string` accessor — keeping `colors: Color[]` intact | Resolves the tension; preserves AR-211/212 | Adds a small API note to a Should-Have |
| B | Defer "named swatches" to a tracked DEF row (like the MRU strip) until the data model is decided | Keeps v1 tight | Loses the feature from v1 scope |

**Recommendation:** Option A with `nameFor?: (c) => string` — a pure accessor adds naming without changing the `colors: Color[]` contract, so AR-211/212 stand. If the user prefers minimal v1, B is clean. (Confidence: Medium — a scope call.)

**User Decision:** Resolved — User accepted recommendation (Option A). Fix applied to RD-21 (2026-07-04).

---

### PF-006: Frame omission vs TV `ofFramed` — record as a deliberate fidelity deviation 🔵 OBSERVATION

**Dimension:** 13 Codebase Alignment (fidelity)
**Location:** §`ColorSwatch` "Framing" (lines 86–88); decode table row "Framing | ofFramed" (line 39)
**Codebase Evidence:** `TColorSelector` sets `options |= ofFramed` (`colorsel.cpp:114`) — it draws its own frame. The RD's `ColorSwatch` draws "only cells + marker" and delegates framing to the host.
**The Problem:** Minor wording: the RD frames this as "matching how `TColorSelector` is a framed view inside `TColorDialog`," but `ofFramed` means the selector renders a frame *around itself*, not merely that a container frames it. Omitting it is a reasonable extension (the popup/`Window` supplies the frame), but the NON-NEGOTIABLE fidelity directive wants drawing deviations recorded explicitly.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reword to state plainly: "TV's `TColorSelector` sets `ofFramed` (draws its own frame); RD-21's `ColorSwatch` **deliberately omits** it and delegates framing to the host popup/`Window` — a recorded extension, to be re-affirmed at GATE-2." | Honors the fidelity directive; no behavior change | One sentence |

**Recommendation:** Option A (sole viable) — a one-line wording fix that turns an implicit deviation into a recorded one. (Confidence: High.)

**User Decision:** Resolved — User accepted recommendation (Option A). Fix applied to RD-21 (2026-07-04).

---

> **Pass tier:** ✅ **PASSED — all 6 findings resolved.** Every finding accepted (Option A) and the fix applied to `RD-21-color-family.md` on 2026-07-04: PF-001 → new "State model (cursor vs `value`)" bullet + **AC-15**; PF-002 → new "public re-exports (additive)" cross-package bullet + reuse note + AC-11 clause; PF-003 → commit-on-release in §`ColorPicker` + AC-7; PF-004 → out-of-bounds revert/clamp split in AC-5; PF-005 → `nameFor?` accessor in Should-Have; PF-006 → framing reworded as a recorded deviation. RD-21 now carries **15 AC**.
