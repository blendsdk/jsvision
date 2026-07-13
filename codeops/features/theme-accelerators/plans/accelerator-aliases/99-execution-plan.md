# Execution Plan: Accelerator Aliases

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-13 13:16
> **Progress**: 10/19 tasks (53%)
> **CodeOps Skills Version**: 3.6.0

## Overview

Add the `accelerator` / `menuAccelerator` aliases to `@jsvision/core`, re-point all hotkey/shortcut
role references onto them, pin them in curated presets for byte-parity, free `danger`/`warning` as
app-reserved tokens, and mark them "(reserved)" in the theme-designer rail. Spec-first throughout.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Core aliases, roles & preset parity | 10 |
| 2 | Designer annotation & docs | 9 |

**Total: 19 tasks across 2 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` — `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** and Last Updated stamp after EVERY task — never batch.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'`. The immutable-oracle rule binds executors: a failing
> spec test means fix the code, never the test. ST-1 is an intentional requirement-driven update to
> the spec, performed in the spec-test step — that is the one sanctioned oracle change.

---

## Phase 1: Core aliases, roles & preset parity

### Step 1.1: Specification Tests (BEFORE implementation)

**Reference**: `03-01` · `07-testing-strategy.md` ST-1…ST-8 · AR-01,02,04,06,07,08,11
**Objective**: Encode the 18-token vocabulary, the role re-point, the decouple, and preset parity as
failing oracles.

- [x] 1.1.1 Update the alias-tier spec: replace `SAMPLE` with an 18-token `SAMPLE18` (distinct `accelerator`/`menuAccelerator`), change the count oracle 16→18, add ST-2…ST-5, ST-7, ST-8 — `packages/core/test/create-theme.spec.test.ts` ✅ (completed: 2026-07-13 13:05)
- [x] 1.1.2 Add ST-6 — a **data-driven** curated-preset hotkey-parity loop over `PRESET_SEEDS` (for each preset with `overrides`: its accelerator-fed roles `=== overrides.warning` and its menuAccelerator-fed roles `=== overrides.danger`; `slate` skipped), spot-anchored by name for nord/dracula. This is the complete parity guard for all 10 curated presets — `packages/core/test/presets.spec.test.ts` ✅ (completed: 2026-07-13 13:05)
- [x] 1.1.3 Run the core `unit` project — verify the new count / re-point / decouple assertions FAIL (red phase); document any that pass early ✅ (completed: 2026-07-13 13:05) — RED confirmed: 5 failed exactly as predicted (control-hotkey/chrome-hotkey re-point, warning-danger-move, aliasesFromSeeds defaults, decouple byte-identity). Early passers (expected): ST-5 (warning default coincides with accelerator default), ST-6 (regression guard — byte-parity holds pre-change), the 18-token count (test-side literal; the true red for R1's required fields surfaces in `tsc`)

### Step 1.2: Implementation

**Reference**: `03-01 §Implementation Details` · AR-01,02,03,07,08,11,15
**Objective**: Add the aliases, re-point the roles, pin the presets — byte-identical output.

- [x] 1.2.1 Add required `accelerator` + `menuAccelerator` to `ThemeColors` (own `accelerator (2)` group right after the `accent (2)` group + JSDoc); rewrite `danger`/`warning` field docs (drop the hotkey claim); update "16"→"18" wording — `packages/core/src/engine/color/aliases.ts` ✅ (completed: 2026-07-13 13:10)
- [x] 1.2.2 Add optional `accelerator?`/`menuAccelerator?` to `ThemeOptions`; return both from `aliasesFromSeeds` with independent defaults (`#f59e0b`/`#ef4444`); update "16"→"18" wording — `packages/core/src/engine/color/create-theme.ts` ✅ (completed: 2026-07-13 13:10)
- [x] 1.2.3 Re-point the 10 hotkey references (6→`c.accelerator`, 4→`c.menuAccelerator`); update the `rolesFromAliases` `@example` literal to 18 tokens; fix the three "16" JSDoc mentions → "18" — `packages/core/src/engine/color/roles.ts` ✅ (completed: 2026-07-13 13:10) — grep-verified 6× `c.accelerator`, 4× `c.menuAccelerator`, 0 stray `c.warning`/`c.danger`
- [x] 1.2.4 Pin `accelerator`/`menuAccelerator` in the 10 curated presets' `overrides` (mirror each one's `warning`/`danger`); update the "16"→"18" JSDoc — `packages/core/src/engine/color/preset-seeds.ts` ✅ (completed: 2026-07-13 13:10) — cross-checked all 10 mirror; slate skipped
- [x] 1.2.5 Run the core `unit` project — ST-1…ST-8 PASS (green phase) AND `presets.impl.test.ts` round-trip passes UNCHANGED. **ST-6 is the parity guard**: if an ST-6 preset assertion fails, a pin is wrong or transposed — fix the pin, not the test. (The round-trip only proves serialization is lossless and will **not** flag a mis-pin — it compares each preset to itself.) ✅ (completed: 2026-07-13 13:10) — 740/740 core unit tests pass

### Step 1.3: Implementation Tests & Hardening

**Reference**: `07-testing-strategy.md §Implementation Tests`
**Objective**: Cover seed precedence and prove `danger`/`warning` inertness exhaustively.

- [x] 1.3.1 Write seed-precedence + all-role-fields inertness edge tests — `packages/core/test/accelerator-aliases.impl.test.ts` ✅ (completed: 2026-07-13 13:16) — 4 tests: accelerator/menuAccelerator seed drives the right hotkeys, override beats seed, aliasesFromSeeds default/seed precedence, sentinel danger/warning absent from every role in both modes
- [x] 1.3.2 Full verification ✅ (completed: 2026-07-13 13:16) — `yarn verify` green (22/22 turbo tasks: lint, typecheck, build, test [core 740 · ui 1585 · examples 161 · …], check:docs; check-plugin PASS)

**Deliverables**:
- [x] 18-token alias tier; 10 roles re-pointed; 10 curated presets pinned; byte-identical output
- [x] All Phase-1 verification passing

**Verify**: `yarn verify`

---

## Phase 2: Designer annotation & docs

### Step 2.1: Specification Tests (BEFORE implementation)

**Reference**: `03-02` · `07-testing-strategy.md` ST-9 · AR-09
**Objective**: Encode the rail's "(reserved)" annotation and the two new alias rows as failing
oracles.

- [ ] 2.1.1 Write the rail-label spec: `aliasRailLabel` reserved/plain cases + `buildRolesPanel(model).targets` include `accelerator`/`menuAccelerator` — `packages/theme-designer/test/roles-panel.spec.test.ts`
- [ ] 2.1.2 Run the theme-designer `unit` project — verify ST-9 FAILS (red phase)

### Step 2.2: Implementation

**Reference**: `03-02 §Implementation Details` + `§Docs & Governance` · AR-09,10,15,17
**Objective**: Add the annotation and complete the doc-accuracy sweep.

- [ ] 2.2.1 Add `RESERVED_ALIASES` + `aliasRailLabel`; use it for the alias rows in `buildRolesPanel` (raw key stays in `targets`) — `packages/theme-designer/src/view/roles-panel.ts`
- [ ] 2.2.2 Run the theme-designer `unit` project — ST-9 PASSES (green phase)
- [ ] 2.2.3 Update the barrel doc comment "16 aliases → 63 roles" → "18 aliases → 63 roles" — `packages/core/src/engine/color/index.ts`
- [ ] 2.2.4 Add a `CHANGELOG` entry: two accelerator aliases + the `warning`/`danger` hotkey-decouple behavior change — `CHANGELOG.md`
- [ ] 2.2.5 Update the theming story copy "16 aliases" → "18" (`blurb` + in-canvas `Text`) — `packages/examples/kitchen-sink/stories/theming.story.ts`
- [ ] 2.2.6 Update the theme-designer "16 aliases" JSDoc → "18" (4 mentions: `model/types.ts:32`, `view/roles-panel.ts:2` & `:17`, `model/model.ts:41`) — `check-jsdoc` won't flag a stale count, so this is a hand edit — `packages/theme-designer/src/`

> `CLAUDE.md`'s "16 aliases" mentions are **not** hand-edited here — they live in auto-generated
> sections and are refreshed by `/analyze_project` (the exec_plan post-completion re-analysis).

### Step 2.3: Hardening

- [ ] 2.3.1 Full verification (incl. `check:docs` + kitchen-sink smoke + designer walkthrough e2e)

**Deliverables**:
- [ ] `danger`/`warning` marked "(reserved)"; `accelerator`/`menuAccelerator` rows present
- [ ] JSDoc / CHANGELOG / kitchen-sink / CLAUDE.md accurate at 18 aliases
- [ ] All verification passing

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (core)
    ↓  (theme-designer builds against core's dist)
Phase 2 (designer + docs)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ Both phases completed
2. ✅ `yarn verify` passing (lint + typecheck + build + test + check:docs across packages)
3. ✅ `presets.impl.test.ts` round-trip green **unchanged** (serialization losslessness) **and** ST-6 green — the data-driven byte-parity guard across every curated preset
4. ✅ No warnings/errors; `check:deps` + `check-jsdoc` green
5. ✅ No dead code — `danger`/`warning` intentionally role-free but documented as reserved
6. ✅ Security — no new input path; serialize/parse unchanged (AR-18)
7. ✅ Documentation updated (JSDoc, CHANGELOG, kitchen-sink, CLAUDE.md)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
