# Roadmap: DSL Hardening

> **Feature-Set**: DSL Hardening
> **Status**: In Progress
> **Created**: 2026-07-18
> **Last Updated**: 2026-07-19
> **Progress**: 0 / 1 plans (0%)
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
| dsl-hardening | Layout DSL hardening (S1/S2/S3/S5/S7 + `dsl/` module split + split-view min proof) | — (direct, GH #113) | [dsl-hardening](plans/dsl-hardening/00-index.md) | Executing | 🔄 | 2026-07-19 | Standalone plan (no RD), created from GH #113. 6 phases / 32 tasks, spec-first; Zero-Ambiguity Gate PASSED (14 ARs incl. runtime AR-14, 18 ST-cases). Preflighted 2026-07-18→19 (PF-001…007) — PASSED, all 7 resolved. **exec_plan in progress (`--auto-commit`): Phase 1 ✅ (`dsl/` split + packaging-oracle repath) · Phase 2 ✅ (S1 `grow` `min` + `Flex.grow` object form + S7 falsy children; ST-3 corrected to a binding scenario, AR-14 runtime signed off) · Phase 3 ✅ (S2 `at()` merge-preserving absolute + out-of-flow container child (S4) + S3 standalone `cover()`/`center()`; new `dsl/absolute.ts`, +{at,cover,center} on the barrel). 20/32 tasks, full `yarn verify` green each phase.** S6 (`flex()`) + S8 (Group-subclass) deferred — no consumer. |
