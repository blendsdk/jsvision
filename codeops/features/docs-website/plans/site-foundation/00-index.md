# Site Foundation & Delivery Pipeline — Implementation Plan

> **Feature**: Stand up the JSVision documentation website as a VitePress workspace and ship it to
> GitHub Pages via CI/CD (production on merge + live per-PR previews), with the IA/nav skeleton,
> local search, theming, SEO, a meta-CSP, and the existing `docs/` techdocs absorbed in.
> **Implements**: docs-website/RD-01
> **Source**: [RD-01](../../requirements/RD-01-site-foundation.md)
> **Status**: Planning Complete
> **Created**: 2026-07-09
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

## Overview

The foundational slice of the docs-website feature-set (Phase A). It creates a new private Turborepo
workspace `packages/docs-site` running VitePress, wires a GitHub Pages delivery pipeline that deploys
production on every merge to `master` and a **live preview URL per pull request**, establishes the
site's information architecture / navigation / branding / local search / SEO surface / meta-CSP, and
**absorbs the existing repo-root `docs/`** website content (architecture, ADRs, guides) into one
unified site — while leaving the load-bearing `docs/acceptance-gate.md` in place.

It contains **no live demos, no component pages, and no API reference** — those land in RD-02/03/05/06
on top of this shell. The deliverable is a deployed, navigable site with the section skeleton and
placeholder pages, testable end-to-end so the pitch can be built up slice by slice.

Everything above a shipped package's runtime dependency graph stays untouched: the docs-site
toolchain is dev-only and `yarn check:deps` stays green for `@jsvision/core`/`ui`/`files`/`web`. The
docs-site build is **isolated** from `yarn verify` (its own `yarn docs:build` + a dedicated CI job).

## Document Index

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — 11/11 resolved (3 new + 8 imported) |
| [01-requirements.md](01-requirements.md) | Scope, in/out, success criteria (from RD-01) |
| [02-current-state.md](02-current-state.md) | Monorepo wiring, existing `docs/`, CI — what exists today |
| [03-01-workspace-and-vitepress.md](03-01-workspace-and-vitepress.md) | The `packages/docs-site` scaffold, VitePress config, IA/nav, theme, search, code-UX, SEO, CSP |
| [03-02-deploy-pipeline.md](03-02-deploy-pipeline.md) | GitHub Actions: prod `gh-pages` deploy + live PR previews |
| [03-03-content-migration.md](03-03-content-migration.md) | Absorbing `docs/` website content + redirects; keeping `acceptance-gate.md` |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-1…ST-14) |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, ordering, progress |

## Key Decisions (see the register for full traceability)

| Decision | Choice | AR |
|----------|--------|----|
| PR previews + prod deploy model | Live per-PR URLs via the `gh-pages` branch model (peaceiris + pr-preview-action) | AR-1 |
| `docs/` absorption | Move website content into `packages/docs-site`; keep `acceptance-gate.md` in place | AR-2 |
| Verify coupling | docs-site isolated from `yarn verify` (`yarn docs:build` + dedicated CI job) | AR-3 |
| SSG / placement / host / search / security | VitePress · `packages/docs-site` · GitHub Pages `base:'/jsvision/'` · local search · meta-CSP | AR-5…9 (imported) |

## Verify

- **Docs build**: `yarn docs:build` (VitePress production build).
- **Shipped-package integrity** (migration phase): `yarn verify` stays green (esp. `gate.spec` + `check:deps`).
- Commits via `/gitcm` / `/gitcmp` — never raw git in plan docs.
