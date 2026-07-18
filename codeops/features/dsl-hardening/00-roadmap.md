# Roadmap: DSL Hardening

> **Feature-Set**: DSL Hardening
> **Status**: Done
> **Created**: 2026-07-18
> **Last Updated**: 2026-07-19
> **Progress**: 1 / 1 plans (100%)
> **CodeOps Skills Version**: 3.9.0

Harden the `@jsvision/ui` layout DSL so the codebase-wide adoption (epic GH #108) can land: **S1**
`size.min` on `grow`/`fixed`, **S2** a blessed absolute `at()` builder (+ **S4** absolute-child-in-
container for free), **S3** standalone `cover()`/`center()`, **S5** placement offsets, **S7** falsy
children — plus the `dsl.ts` → `dsl/` module split and a `split-view` migration proving S1. Additive
and behavior-preserving; zero runtime deps. Prerequisite to the layout-DSL adoption. Tracks GH #113.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| dsl-hardening | Layout DSL hardening (S1/S2/S3/S5/S7 + `dsl/` module split + split-view min proof) | — (direct, GH #113) | [dsl-hardening](plans/dsl-hardening/00-index.md) | Done | ✅ | 2026-07-19 | Standalone plan (no RD), from GH #113. 6 phases / 32 tasks, spec-first; Zero-Ambiguity Gate PASSED (15 ARs incl. runtime AR-14/AR-15, 18 ST-cases). Preflighted (PF-001…007) — PASSED. **exec_plan COMPLETE 2026-07-19 (`--auto-commit`), 32/32 tasks / 6 phases, full `CI=1 yarn verify` green each phase + `check:deps` green, zero regression: Phase 1 (`dsl/` split + packaging-oracle repath) · Phase 2 (S1 `grow`/`Flex.grow` `min`; S7 falsy children; ST-3 corrected → binding, AR-14 runtime) · Phase 3 (S2 `at()` merge-preserving + out-of-flow child (S4); S3 `cover()`/`center()`; new `dsl/absolute.ts`) · Phase 4 (S5 `Placement` `hOffset`/`vOffset` directional inset+clamp [AR-15 runtime]; orphan-tagger `devWarn`) · Phase 5 (R9 proof — `split-view.ts` → `grow(min)`/`fixed`, additive-merge, ST-16 red→green) · Phase 6 (docs + surface locked at +{at,cover,center}). Commits 0b9b1198·1646f21d·838cdf64·c85e3573·a17e5d4a + final.** S6 (`flex()`) + S8 (Group-subclass) deferred — no consumer (GH #113). Unblocks the layout-DSL adoption (epic GH #108). |
