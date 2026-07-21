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
| dsl-hardening | Layout DSL hardening (S1/S2/S3/S5/S7 + `dsl/` module split + split-view min proof) | — (direct, GH #113) | [dsl-hardening](plans/dsl-hardening/00-index.md) | Done | ✅ | 2026-07-19 | Shipped `min` on `grow`/`Flex.grow` · falsy children · `at()` · `cover()`/`center()` · `Placement` offsets · the `dsl/` split — surface locked at +{at,cover,center} · S6/S8 deferred (no consumer) |
