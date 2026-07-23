# Roadmap: create-jsvision

> **Feature-Set**: create-jsvision
> **Status**: In Progress
> **Created**: 2026-07-22
> **Last Updated**: 2026-07-23
> **Progress**: 0 / 8 (0%)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.12.0

Publish a create-app scaffolder so `npm create jsvision my-app` (and the yarn/pnpm equivalents)
produces a standalone, runnable JSVision project outside this monorepo. Tracked as GH #169.

A **promotion of existing code**, not a greenfield build: a working generator already lives in the
Claude Code plugin, but it only emits in-monorepo packages. The work adds a second output mode to the
pure core, wraps it in a publishable CLI, and keeps the plugin skill working — without touching the
immutable spec oracles (ST-1…ST-8) that pin the existing mode.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Depends-on / Blocker |
|----|-------|----|------|-------|--------|--------------|----------------------|
| RD-01 | Dual-mode file generation | [RD-01](requirements/RD-01-dual-mode-generation.md) | — | RD Drafted | ✏️ | 2026-07-23 | approval + preflight pending |
| RD-02 | The `create-jsvision` CLI package | [RD-02](requirements/RD-02-cli-package.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01; approval pending |
| RD-03 | Template single source of truth | [RD-03](requirements/RD-03-single-source-of-truth.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01; approval pending |
| RD-04 | The generated standalone project | [RD-04](requirements/RD-04-generated-project.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01; approval pending |
| RD-05 | Verification strategy | [RD-05](requirements/RD-05-verification.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01/02/04; approval pending |
| RD-06 | Release & distribution | [RD-06](requirements/RD-06-release-and-distribution.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-02; npm name reserved |
| RD-07 | Documentation updates | [RD-07](requirements/RD-07-documentation.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-02/04; approval pending |
| RD-08 | Non-functional requirements | [RD-08](requirements/RD-08-non-functional.md) | — | RD Drafted | ✏️ | 2026-07-23 | depends on RD-01…07; approval pending |

## Gate

- **Zero-Ambiguity Gate**: ✅ PASSED — 25 / 25 resolved, 0 deferred
  ([register](requirements/00-ambiguity-register.md)). The ambiguity gate is complete; formal RD
  approval and requirements preflight remain pending, so every row stays at **RD Drafted**.

## Open follow-ons

| Item | Scope | Stage | Status |
|------|-------|-------|--------|
| `registry-smoke` | Scheduled post-publish scaffold/install/typecheck/smoke against the real npm registry | Backlog | ⬜ no plan yet |

## Deferred / out of scope

| Item | Reason |
|------|--------|
| Browser archetype | Blocked while `@jsvision/web` is internal and unpublished. |
