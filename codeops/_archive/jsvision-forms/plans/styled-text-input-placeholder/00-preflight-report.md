# Preflight Report: Styled Text Severity & Input Placeholder (plan)

> **Status**: ✅ PASSED — all 4 findings resolved and applied (iteration 2 re-scan clean; 0 open)
> **Iteration**: 2 (fixes applied + verified)
> **Artifact**: Implementation Plan at `codeops/features/jsvision-forms/plans/styled-text-input-placeholder/` (9 docs)
> **Codebase Grounded**: ~30 source + test files examined; every `file:line` claim in the plan verified
> **Last Updated**: 2026-07-15

> ℹ️ **Fresh-session review.** The plan and its owning RD-09 were authored in an earlier session
> (the plan is untracked, created 2026-07-15; this scan runs after a `/clear`). Same-model-family
> bias is still possible, so every claim below is grounded in the actual code via direct reads +
> grep, and the one MAJOR finding was run past an independent challenger (converged) before its
> recommendation was recorded.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest (spec/impl/e2e), zero runtime deps in core/ui.
**Architecture:** `@jsvision/core` (theme model: 65 required roles behind `Theme`, `defaultTheme`/`monochromeTheme` literals + `rolesFromAliases` generator) → `@jsvision/ui` (Text/Input controls, `ctx.color(role)` via `ThemeRoleName = keyof Theme`) → `@jsvision/examples` (kitchen-sink stories) + `@jsvision/theme-designer` (alias/role editor). Guard tests: 5 UI inventory-tripwire specs + 4 auto-adapting coupling guards + per-role own-guards.
**Key Files Examined:** `color/{theme,roles,create-theme,aliases,presets,serialize,index}.ts`; `controls/{text,input,input-render}.ts`; `date/date-picker.ts`, `dropdown/combo-box.ts`, `dialog/message-box.ts`; `view/types.ts`, `controls/index.ts`, `ui/src/index.ts`; the 5 tripwire specs + 4 coupling guards; `theme-designer/{view/roles-panel.ts, model/model.ts, test/roles-panel.spec.test.ts}`; `scripts/check-jsdoc.mjs`; the 3 stories + smoke test.

**Reference Verification:** The plan's grounding is unusually accurate. Verified TRUE: 65-role count; all three full `:Theme` literals; `staticText`@theme.ts:293; `c.success→indicatorDragging`@roles.ts:107 (danger/warning/info dropped); every control `file:line` thread-point (text.ts:96/114/102, input.ts:33-40/180-188/132-147, input-render.ts:78-105/14-27, date-picker:133, combo-box:148, message-box:161); `ThemeRoleName`@view/types.ts:30; exactly 5 inventory tripwires (incl. the inline one @editor-theme.spec:159) — none missed; all 4 coupling guards self-adapt (no golden role list/count); check:docs exempts interfaces; exactly the 10 "63" strings the plan lists (no 11th); no palette-only guard that raw hex `#ef4444` would break; no `dangerText`/`warningText`↔alias name collision. The defects below are the residue.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 (PF-001) | 🟠 |
| 4 | Completeness Gaps | 1 (PF-002) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 1 (PF-004) | 🔵 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-004) | 🔵 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 (PF-003) | 🟡 |
| 13 | Codebase Alignment | 1 (PF-001) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 1 | ✅ resolved (applied) |
| MINOR | 2 | ✅ resolved (applied) |
| OBSERVATION | 1 | ✅ resolved (applied) |

---

### PF-001: Plan contradicts RD-09 AC #7 — theme-designer `RESERVED_ALIASES` + `roles-panel.spec.test.ts` left unchanged 🟠 MAJOR

**Dimension:** 3 (Logical Contradictions) / 13 (Codebase Alignment — Convention/Consistency)
**Location:** plan `02-current-state.md:64-69` + `07-testing-strategy.md:92-93,121` (says "no edit"); vs owning `requirements/RD-09-...md:57-58,110-112,229-230` (AC #7 says "update") + `requirements/00-preflight-report-rd-09.md` PF-002/PF-003.
**Codebase Evidence:** `theme-designer/src/model/model.ts:84-85` (`createTheme({...seeds, overrides: aliasOverrides})` in derive mode) + `setAlias`@155-164 (forces derive mode); `roles.ts:107` (the sole status-alias→role today); `roles-panel.spec.test.ts:4-6,16-17`; `roles-panel.ts:12,15,19`; `aliases.ts:65,67` + `create-theme.ts:31,33`.

**The Problem:** RD-09 (a passed-preflight Must-Have + Acceptance Criterion #7) requires that theme-designer's `RESERVED_ALIASES` **and** `roles-panel.spec.test.ts` be updated "because the `danger`/`warning` aliases now drive roles." The plan explicitly does the opposite ("needs **no** edit — the aliases stay `(reserved)`"), on the rationale that the alias names differ from the new role names. Three problems:

1. **The `(reserved)` label becomes actively false.** Traced: `setAlias('danger', c)` → derive mode → `createTheme({overrides:{danger:c}})` → `rolesFromAliases` (post-change) writes `c.danger` into `dangerText.fg`. So editing the `danger` alias in the designer now recolors every `Text severity:'error'`. The label exists (per the spec's own docstring) to say editing danger "changes no widget / nothing happened" — now the inverse of the truth.
2. **The spec oracle's premise is invalidated.** `roles-panel.spec.test.ts` is a `.spec.test.ts` immutable oracle whose docstring asserts danger/warning "**drive no built-in role**." This change makes that premise false. An oracle is immutable against implementation drift, **not** against a deliberate RD-sanctioned requirement change — updating it here is bringing the oracle to the new spec, exactly what AC #7 mandates.
3. **The plan is internally self-contradictory.** It corrects the *identical* "drives no built-in role" phrasing in core (`create-theme.ts:31,33`, and `aliases.ts:65,67` — see PF-003) but preserves it in the designer. The same claim cannot be false-in-core and true-in-designer. (The "separately named" rationale is a non-sequitur: `accent` is also separately-named from the roles it drives yet correctly *not* reserved — what makes an alias reserved is "drives no role," and post-change danger/warning become exactly like `success`@roles.ts:107.)

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Follow the RD: remove `danger`/`warning` from `RESERVED_ALIASES` and revise `roles-panel.spec.test.ts` (docstring + the two `(reserved)` assertions) to reflect that danger/warning now drive `dangerText`/`warningText`; update the `roles-panel.ts:12,19` docstrings. Add the tasks to Phase 1. | Satisfies AC #7; removes the false label; internally consistent with the corrected core docs; ships accurate UX | Small extra scope in Phase 1 (one src edit + one spec edit) |
| B | Keep the plan's position (no designer edit). | No extra work; tests stay green | Silently drops part of AC #7; ships a false `(reserved)` label + a spec oracle asserting a now-false premise; contradicts the plan's own core-doc corrections. Requires formally amending RD-09 — which the plan cannot do unilaterally |

**Recommendation:** **Option A** — the only viable path. B is not merely riskier; it leaves the codebase self-contradictory and an acceptance criterion unmet, and would require re-opening a passed-preflight RD. The designer's reserved mechanism is a hand-maintained set (note `info` also drives no role yet is not in the set), so the executor's sub-choice when applying A is `RESERVED_ALIASES = new Set([])` (or `{'info'}` if the concept is kept honest) — an implementation detail below this decision.
**Confidence: High** — grounded in the traced `setAlias`→`createTheme`→`rolesFromAliases` propagation and the verbatim AC #7 text. **Hardening:** independent challenger **converged** on A (raised the `accent` non-sequitur and the `info` observation); recommendation unchanged. **Challenger: converged.**

**User Decision:** Resolved — User accepted recommendation (Option A). Applied: new task `1.2.5` (drop `danger`/`warning` from `RESERVED_ALIASES`, correct the `roles-panel.ts:12,19` docstrings, revise `roles-panel.spec.test.ts:4-6,16-17`); rewrote `02-current-state.md` theme-designer bullet + Relevant Files rows; `03-01` Integration Points; `07` "Existing specs edited" table/note + AC #7 map; green phase `1.2.6` runs `@jsvision/theme-designer test`; index Key Decisions + counts (30→31 tasks, Phase 1 7→8).

---

### PF-002: `TextOptions` / `TextSeverity` never barrel-exported (every sibling Options type is) 🟡 MINOR

**Dimension:** 4 (Completeness Gaps) / 13 (Convention Violation)
**Location:** plan `03-02-ui-text-input.md:24-34,47` (adds `export type TextSeverity` + `export interface TextOptions` to `text.ts`) + `99-execution-plan.md` task 2.2.1 — no task adds a barrel re-export.
**Codebase Evidence:** `controls/index.ts:14-26` re-exports `ButtonOptions`, `InputOptions`, `SliderOptions`, `SwitchOptions`, `CheckGroupOptions`, `RadioGroupOptions`, `MultiCheckGroupOptions`; `ui/src/index.ts:102-111` re-exports the same. `controls/index.ts:11` re-exports `Text` but no `Text*Options`.

**The Problem:** Every control's public options type is re-exported from both `controls/index.ts` and `ui/src/index.ts`. The plan adds `TextOptions`/`TextSeverity` but adds no re-export task, so a consumer cannot `import type { TextSeverity }` to type their own severity variable — an inconsistency with the established convention and a public-API completeness gap. Secondary: the RD's PF-004 and plan `03-02` claim "`TextOptions` is an `export type` (`controls/index.ts:16`)"; line 16 is **`InputOptions`**, and `TextOptions` is exported nowhere today. (The *conclusion* — that check:docs needs no per-option `@example` — still holds, because check-jsdoc.mjs Check B exempts all interfaces/types regardless of export.)

**Options:** Add `export type { TextOptions, TextSeverity } from './text.js';` to `controls/index.ts` and to the `export type {…}` block in `ui/src/index.ts` (one line each; task under Phase 2), and fix the stale `controls/index.ts:16` citation. — This is the only viable resolution; the alternative (leave `TextOptions` unexported) breaks the sibling convention for no benefit.
**Recommendation:** Add the two barrel re-exports. **Confidence: High.**

**User Decision:** Resolved — User accepted recommendation. Applied: task `2.2.1` now re-exports `TextOptions`/`TextSeverity` from `controls/index.ts` + `ui/src/index.ts`; `03-02` "Docs & barrel" note rewritten (corrects the `controls/index.ts:16` mis-citation, states the check-jsdoc exemption accurately); `02` Relevant Files + `00-index` Modify/Key-Decisions updated.

---

### PF-003: `aliases.ts` "drives no built-in role" correction is hedged ("if present") when the lines definitively exist 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** plan `99-execution-plan.md` task 1.2.3 ("+ matching `aliases.ts` phrasing **if present**") + `03-01-core-theme-roles.md:44-45` / `03-03-stories-and-counts.md:57-59`.
**Codebase Evidence:** `aliases.ts:65` ("Danger / destructive signal … Reserved for app content; drives no built-in role.") and `aliases.ts:67` ("Warning / attention signal. Reserved for app content; drives no built-in role.") — both definitively present.

**The Problem:** The plan pins every other doc/string edit to an exact `file:line`, but hedges the `aliases.ts` alias-doc correction as conditional ("if present"). The phrasing definitively exists at `aliases.ts:65,67` and becomes false once danger/warning drive roles. The hedge risks an executor leaving two now-false doc-comments — and these are the same statements whose designer twins PF-001 is about, so consistency across all four sites matters.
**Recommendation:** Replace the hedge with the pinned target: correct `aliases.ts:65,67` alongside `create-theme.ts:31,33`. **Confidence: High.**

**User Decision:** Resolved — User accepted recommendation. Applied: task `1.2.3` now pins `aliases.ts:65,67`; `03-01` (prose + Error-Handling row, which now names all four identical-phrase sites) and `03-03` de-hedged.

---

### PF-004: Focused empty field — the caret reverses column 1 and blanks the first placeholder glyph 🔵 OBSERVATION

**Dimension:** 7 (Testability) / 9 (Edge Cases)
**Location:** plan `03-02-ui-text-input.md:72-86` (placeholder paint + caret note) + `07-testing-strategy.md:61` (ST-S1 "the placeholder text is visible over the empty field").
**Codebase Evidence:** `input-render.ts:98-104` (caret draws last: `glyphAt(caretCol, v, …)` returns `' '` when `v` is empty since the placeholder is not in `v`, so the reversed caret cell overwrites placeholder column 1); a headless mount may auto-focus the first focusable.

**The Problem:** The plan correctly notes the caret "reverses col 1 over the placeholder's first glyph," but the visible result on a *focused* empty field is a reversed **blank** over column 1 (the placeholder char is hidden, not merely inverted). If the kitchen-sink Input demo is auto-focused when mounted, an ST-S1 assertion that matches the full placeholder string from column 1 would be brittle. Not a defect — the paint behavior is intended and acknowledged.
**Recommendation:** Make ST-S1 / the story robust — assert the placeholder on an **unfocused** field, or assert a substring from column 2, or assert cells rather than the exact leading glyph. Optionally add an impl-test case pinning the focused-empty caret-over-placeholder behavior (the plan already lists a related impl case). **Confidence: High** (mechanism traced).

**User Decision:** Resolved — User accepted recommendation. Applied: `07` ST-S1 now assert on an unfocused field / substring-from-col-2; `03-03` placeholder demo carries a smoke-assertion note citing `input-render.ts:98-104`.

---

## Adversarial checklist (bias safeguard)
- **External standard?** None — all claims are codebase-internal and cited to `file:line`.
- **Verified against code, not memory?** Yes — direct reads + grep for every claim; the MAJOR ran past an independent challenger (converged).
- **What did I confirm rather than test?** The plan's line-number density invited rubber-stamping; instead each was checked (all accurate), which is why the finding count is low and precise rather than padded.
- **Biggest residual risk:** whether the user *wants* the designer to keep labeling danger/warning `(reserved)` for product reasons — if so, that is an RD-09 amendment decision (PF-001 Option B), not a plan-local call, and must round-trip through the RD.

---

## Iteration 2 — fixes applied & re-scanned (2026-07-15)

> **Previous iteration:** 4 findings (1 major, 2 minor, 1 observation) — all resolved via "apply all per recommendations."
> **This iteration:** 0 new findings.
> **Carried forward:** none.

**Fix verification (each resolved finding confirmed in the plan docs):**
- **PF-001** ✅ — `02`, `03-01`, `07`, `99`, `00-index` now uniformly require the theme-designer update; the "needs no edit / still true / separately named" language is gone from every plan body (grep-confirmed — surviving "no edit" hits are the legitimately-unedited coupling guards and unrelated placeholder comments). New task `1.2.5` + green `1.2.6` sequence the src + spec revision; the plan now matches RD-09 AC #7.
- **PF-002** ✅ — barrel re-export folded into task `2.2.1`; `03-02` note corrected (accurate check-jsdoc scope, `controls/index.ts:16`=`InputOptions` no longer mis-cited); Related Files + Modify list + Key Decisions updated.
- **PF-003** ✅ — `aliases.ts:65,67` pinned in task `1.2.3`, `03-01`, `03-03`; no "if present/if any" hedge remains in any plan body.
- **PF-004** ✅ — ST-S1 hardened (unfocused / substring-from-col-2); demo note added citing `input-render.ts:98-104`.

**Regression check:** task numbering coherent (`1.2.1`→`1.2.6`; Phase 1 count 7→8; total 30→31; phases sum 8+7+8+8=31); no doc references a now-renumbered task by a stale number; no new contradiction introduced (the plan and RD-09 AC #7 now agree; the four identical "drives no built-in role" sites — `create-theme.ts:31,33`, `aliases.ts:65,67`, `roles-panel.ts:12,19`, and the roles-panel spec — are all slated for correction consistently).

**Codebase re-check:** the applied edits reference only already-verified `file:line` anchors (`roles-panel.ts:12,15,19`; `roles-panel.spec.test.ts:4-6,16-17`; `model.ts:84-85`; `aliases.ts:65,67`; `controls/index.ts`/`ui/src/index.ts` barrels) — all confirmed against the code during iteration 1.

## Pass/fail

✅ **PREFLIGHT PASSED — all 4 findings resolved.** 0 critical, 1 major, 2 minor, 1 observation — every one applied to the plan docs; iteration-2 re-scan surfaced no new findings and no regressions. The plan is internally consistent, aligned with its owning RD-09 (including AC #7), and grounded in verified code. Ready for `exec_plan`.
