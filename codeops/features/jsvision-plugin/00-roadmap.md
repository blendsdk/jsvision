# Roadmap: jsvision-plugin

> **Feature-Set**: jsvision-plugin
> **Status**: Done
> **Created**: 2026-07-11
> **Last Updated**: 2026-07-11
> **Progress**: 2 / 2 plans (PL-01 done; PL-02 plugin-self-sync done)
> **CodeOps Skills Version**: 3.3.2

A Claude Code plugin that makes Claude an expert jsvision TUI application developer — able to
scaffold, compose, run, verify, and extend jsvision apps. Ships a knowledge skill (`jsvision`) with
progressive-disclosure references (lifecycle · reactivity · layout · component catalog · the ~12
gotchas · run/verify loop · theming · widget authoring), a deterministic scaffolder skill
(`jsvision-new-app`), four verified recipe apps spanning the app spectrum (data-driven · forms ·
file tools · live/dashboard), and a widget-authoring path — all guarded by a `check-plugin.mjs`
integrity gate in `yarn verify`. Used inside this monorepo (apps built as `packages/<app>/`), with
publish-agnostic knowledge so a future standalone/published path is a one-spot change. Standalone
plan (no upstream RD); the plan's `01-requirements.md` owns the requirements.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| PL-01 | jsvision Claude Code plugin (skill + scaffolder + recipes + widget authoring) | — (standalone plan) | [plugin-v1](plans/plugin-v1/00-index.md) | Done | ✅ | 2026-07-11 | Done — Claude Code plugin: jsvision knowledge skill (8 refs incl. 12 gotchas) · jsvision-new-app scaffolder · 4 recipe modules + example widget · check-plugin.mjs gate in yarn verify (37 tasks). |
| PL-02 | Plugin self-sync — AI-assisted auto-update of stale plugin content on SDK change | — (standalone plan) | [plugin-self-sync](plans/plugin-self-sync/00-index.md) | Done | ✅ | 2026-07-11 | Done — plugin-self-sync: detectDrift(roots) reusing checkBarrelCoverage · deterministic snippet --fix · AI catalog-entry draft (manual skill + injected-client script) · verify-gated (30 tasks). |
