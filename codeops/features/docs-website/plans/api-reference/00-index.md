# API Reference (TypeDoc) Implementation Plan

> **Feature**: Generated symbol-level API reference emitted as markdown into the VitePress site
> **Status**: Planning Complete
> **Created**: 2026-07-10
> **Implements**: docs-website/RD-06
> **CodeOps Skills Version**: 3.3.2

## Overview

The generated API reference is complete, always-accurate, symbol-level documentation produced by
**TypeDoc** from the packages' public source and emitted as **markdown into the VitePress site**
(`typedoc-plugin-markdown` + `typedoc-vitepress-theme`). It shares one theme, one navigation, one
search box, and one dark/light mode with the rest of the docs, and is regenerated before every build
from each package's public entry point — so it can never drift from the shipped types.

Four packages are covered — `@jsvision/core` (entry `src/engine/index.ts`), `@jsvision/ui`,
`@jsvision/files`, and `@jsvision/web` (entry `src/index.ts`) — with the three `private` packages
badged pre-release. Generated output is gitignored and produced by `yarn docs:api`, which the root
`docs:build` chains ahead of the VitePress build. The hand-written [RD-05] component pages and the
generated reference cross-link bidirectionally through a single symbol↔page map: component pages carry
a forward "API reference →" link, and a post-generation step injects a "Documented in →" back-link
into the matching generated pages.

Drift is prevented in two layers: the pure helpers (barrel-export extraction, symbol→path mapping,
back-link injection) are unit-spec'd in the docs-site vitest project that runs in `yarn verify`, and
the end-to-end coverage, internal-leakage, cross-link-resolution, and determinism guarantees are
asserted by `check-docs-build.mjs` after the site builds.

## Document Index

| #   | Document                                                        | Description                                        |
| --- | -------------------------------------------------------------- | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)                 | Zero-Ambiguity Gate decisions (audit trail)        |
| 00  | [Index](00-index.md)                                           | This document — overview and navigation            |
| 01  | [Requirements](01-requirements.md)                             | Scope delta over RD-06                              |
| 02  | [Current State](02-current-state.md)                           | Docs-site + package-barrel analysis                |
| 03-01 | [Generation Pipeline](03-01-generation-pipeline.md)          | TypeDoc config, plugin stack, `docs:api`, determinism |
| 03-02 | [Site Integration & Cross-Linking](03-02-integration-cross-linking.md) | Sidebar wiring, preface, forward + back links |
| 03-03 | [Anti-Drift Gating & CI](03-03-gating-anti-drift.md)         | Pure helpers, gate placement, build chain          |
| 07  | [Testing Strategy](07-testing-strategy.md)                     | ST cases and verification                          |
| 99  | [Execution Plan](99-execution-plan.md)                         | Phases and task checklist                          |

## Quick Reference

### Usage Examples

```bash
# Generate the API markdown into packages/docs-site/api/<pkg>/ (deterministic).
yarn docs:api

# Full docs build (runs docs:api first, then VitePress).
yarn docs:build

# End-to-end API gate (coverage / leakage / link-resolution / determinism).
node packages/docs-site/scripts/check-docs-build.mjs
```

### Key Decisions

| Decision                     | Outcome                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| Tool → integration (AR-1/7)  | TypeDoc → `typedoc-plugin-markdown` + `typedoc-vitepress-theme`    |
| Symbol scope (AR-2)          | Public entry surface only (core `src/engine/index.ts`; rest `src/index.ts`) |
| Packages (AR-6)              | All four; ui/files/web badged pre-release                         |
| Generated output (AR-5)      | Gitignored; regenerated before build                              |
| Cross-linking (AR-4)         | Bidirectional via a symbol↔page map                              |
| Gate placement (AR-15)       | Pure helpers in vitest; e2e in `check-docs-build.mjs`             |

## Related Files

- **New:** `packages/docs-site/typedoc.json`, `packages/docs-site/src/api/*.mjs` (plain-ESM pure
  helpers + `api-map.mjs` symbol↔page map — `.mjs` so the plain-`node` scripts can import them, AR-18/20),
  `packages/docs-site/scripts/gen-api.mjs` (back-link injection wrapper), `packages/docs-site/test/api-*.spec.test.ts`.
- **Modified:** `packages/docs-site/package.json` (`docs:api` + `typedoc`/plugins/`typescript` devDeps),
  root `package.json` (`docs:api` + `docs:build` chain), `packages/docs-site/.vitepress/config.ts`
  (defensive fs-read of the generated `/api/` sidebar, AR-19), `packages/docs-site/.gitignore` (ignore
  generated `api/<pkg>/`), `packages/docs-site/scripts/check-docs-build.mjs`, the RD-05 component pages
  (forward links).
