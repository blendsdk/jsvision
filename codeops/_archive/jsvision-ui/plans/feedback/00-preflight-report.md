# Preflight Report: Feedback (`ProgressBar` + `Spinner`) — plan `feedback`

> **Status**: ✅ **PASSED** — 1 finding (1 major), resolved
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/feedback/` (9 docs)
> **Codebase Grounded**: 10 source/test files examined; ~20 references verified
> **Last Updated**: 2026-07-03
> **Independence note**: plan files dated today (likely recent-session authorship). Same-agent bias
> risk mild; every finding grounded in grep/read output, not memory.

### Codebase Context Summary

**Tech Stack:** TS ESM monorepo (yarn 1.x + Turborepo), vitest, zero runtime deps. `@jsvision/ui` on `@jsvision/core`.
**Architecture:** retained `View`/`Group` tree + Solid-style signals; leaf widgets (`Text`/`Label`) subscribe via `bind` + a single `draw(ctx)`; one `RenderRoot` composes.
**Key Files Examined:** `view/types.ts`, `view/draw-context.ts`, `view/render-root.ts`, `color/theme.ts`, `host/types.ts`, `capability/profile.ts`, `event/event-loop.ts`, `kitchen-sink/story.ts`, `tab-strip.spec.test.ts`, and all 5 `makeDrawContext` test callers.

**Verified against code (held up):**
- `DrawContext` (types.ts:39-57) has no `caps`; already imports `CapabilityProfile` (types.ts:7).
- `makeDrawContext(buffer,viewRect,clip,theme)` — 4 params; sole **production** caller `render-root.ts:134`; `this.caps` held :196/:211, used by `serialize()` :307.
- `progressFill 0x1B` (brightCyan-on-blue) / `progressTrack 0x13` (= `scrollBarPage`, theme.ts:316); palette `brightCyan`/`cyan`/`blue` present; `tableHeader` extension-colour precedent :322.
- `RuntimeAdapter.setTimer/clearTimer` are one-shot (real: setTimeout/clearTimeout, host/types.ts:127-129) → validates the self-re-arming `runSpinner`.
- `CapabilityProfile.unicode.utf8` + `glyphs.halfBlocks` (profile.ts:31,56); `createEventLoop({w,h},{caps})` + `resolveCapabilities(...).profile` idiom (tab-strip.spec:19,36); `StoryContext.caps` (story.ts:23).
- No existing widget reads `ctx.caps` (additive safe); the one annotated `Theme` literal spreads `...defaultTheme` (drawcontext-role.impl:41) → +2 required roles won't break it.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 0 | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 0 | — |
| 13 | Codebase Alignment | 1 | 🟠 MAJOR |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 1 | ✅ resolved (PF-001) |
| MINOR | 0 | — |
| OBSERVATION | 0 | — |

---

### PF-001: `DrawContext.caps` caller inventory undercounts test sites and misses `view.hardening.spec.test.ts` 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Impact Blindness / Scope vs. Reality)
**Location:** `02-current-state.md` §Paint facade; `03-03-theme-packaging.md` §caps seam; `00-ambiguity-register.md` PA-1; `99-execution-plan.md` task 1.1.2 + checklist.
**Codebase Evidence:** `makeDrawContext(` is called at **12 test sites across 5 files** + 1 production site:
- `view.drawcontext.spec.test.ts` (4), `view.drawcontext.impl.test.ts` (5), `view.drawcontext-role.spec.test.ts` (1), `view.drawcontext-role.impl.test.ts` (1) — 11 sites, matched by the `view.drawcontext*` glob;
- **`view.hardening.spec.test.ts:119`** (1) — **NOT matched by that glob**.

**The Problem:** The plan makes `caps` a **required** 5th `makeDrawContext` parameter, but stated the blast radius as "~2" / "~3" test call sites and scoped task 1.1.2's file list to the `view.drawcontext*` glob — which excludes `view.hardening.spec.test.ts:119`. An executor following the task literally would hit a typecheck failure on the missed caller. Self-healing at the task verify gate, but an inaccurate impact analysis on the plan's only structural change.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Correct the inventory to ~11 sites across 5 files, add `view.hardening.spec.test.ts` to task 1.1.2, instruct "grep `makeDrawContext(` to enumerate", reconcile 2-vs-3 wording. | Accurate; all callers updated in one pass; no surprise failure. | ~4 doc edits. |
| B | Make `caps` optional (`caps?`) with a default. | Existing callers untouched. | Reverses the deliberate "keep the type honest" design; risks stale/undefined caps; re-opens a settled decision. |

**Recommendation:** Option A — the required-param design is sound; only the caller count and task glob were wrong.

**Confidence:** High — count and missed file confirmed by grep, not judgment. No hardening challenger spawned (single code-verified finding with a dominant factual fix; disproportionate ceremony).

**User Decision:** ✅ Resolved — User accepted recommendation: Option A. Fixes applied 2026-07-03 to `02-current-state.md`, `03-03-theme-packaging.md`, `00-ambiguity-register.md` (PA-1), and `99-execution-plan.md` (task 1.1.2 + master checklist): inventory corrected to ~11 sites across 5 files, `view.hardening.spec.test.ts` added, "grep to enumerate" instruction added.

---

## Outcome

✅ **PREFLIGHT PASSED** — all 1 finding resolved. The plan is cleared for execution. The only
structural change (the additive `DrawContext.caps` seam) now carries an accurate, grep-verifiable
caller inventory. All fidelity pins (glyph tables, `0x1B`/`0x13` colour bytes, one-shot timer
contract, negative-safe mod, sanitize-backed caption/label) and the spec-first task ordering verified
against the code and RD-18's ACs.
