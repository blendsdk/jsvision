# Execution Plan: API Reference (TypeDoc)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-11 11:40
> **Progress**: 16/16 tasks (100%) ✅
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

## Overview

Wire TypeDoc → `typedoc-plugin-markdown` + `typedoc-vitepress-theme` to emit a deterministic,
gitignored, symbol-level API reference for the four packages' public entries into the VitePress site,
cross-linked bidirectionally with the RD-05 component pages, and kept drift-proof by unit-spec'd pure
helpers (in `yarn verify`) plus e2e checks in `check-docs-build.mjs`.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Generation pipeline + pure barrel extractor | 5 |
| 2 | Site integration & cross-linking | 5 |
| 3 | Anti-drift gate & CI | 3 |
| 4 | Finalize | 3 |

**Total: 16 tasks across 4 phases.**

> **⚠️ EXECUTION RULE:** the checkboxes below are the single source of truth for progress. Marks are
> two-stage: `[ ]` → `[~]` (implemented, unverified, with an `implemented:` timestamp) → `[x]` (verified,
> `completed:` timestamp). Update the Progress header + Last Updated after every task. Resume by scanning
> top-to-bottom: first `[~]`, else first `[ ]`. Timestamps from `date '+%Y-%m-%d %H:%M'` — never invented.

> **Spec-first ordering** (per phase): spec tests → red → implement → green → impl tests → verify. The
> **pure helpers** (ST-1/2/7/12) get real red→green vitest cycles. The **e2e gate checks** (ST-3…ST-11)
> are AC-derived oracles authored in Phase 3; their red is demonstrated by pointing a check at an empty
> tree once, then confirming green against the real build.

---

## Phase 1 — Generation pipeline + pure barrel extractor
Reference: [03-01](03-01-generation-pipeline.md) · AR-1/2/6/7/8/9/10/11/12/14/18 · ST-1, ST-2

- [x] 1.1 Spec: ST-1, ST-2 for `barrelExports` + the fixture barrel (`export {…}` + `export *` + a
  non-exported + an `@internal` export). Run red. — `packages/docs-site/test/api-barrel-exports.spec.test.ts`, `test/fixtures/api/barrel/**` (implemented: 2026-07-11 10:43 · completed: 2026-07-11 10:43 — red confirmed: missing module)
- [x] 1.2 Impl: `barrelExports(entryFilePath)` as **plain ESM** (`.mjs`, AR-18 — so the plain-`node`
  scripts can import it) via the TS compiler API (`import ts from 'typescript'` → `getExportsOfModule`,
  sorted, star-re-exports followed). Green ST-1/2. — `packages/docs-site/src/api/barrel-exports.mjs` (implemented: 2026-07-11 10:43 · completed: 2026-07-11 10:43 — ST-1/ST-2 green, 2/2)
- [x] 1.3 Impl: install a pinned-compatible `typedoc` + `typedoc-plugin-markdown` + `typedoc-vitepress-theme`
  + an explicit `typescript` (docs-site devDeps only); write `typedoc.json` (**shared flags only** —
  `excludeInternal`/`excludePrivate`/`excludeExternals`, `readme:none`, `hidePageHeader`; per-package
  entryPoints/out/tsconfig moved to `gen-api.mjs`, AR-22; `web/browser-stubs` excluded by only pointing
  at the main barrel; source links pin to HEAD SHA by TypeDoc default → determinism). Proved the trio on
  all four packages (0 errors). — `packages/docs-site/typedoc.json`, `packages/docs-site/package.json` (implemented: 2026-07-11 10:55 · completed: 2026-07-11 10:58 — trio typedoc 0.28.20/plugin-markdown 4.12.0/theme 1.1.3; core 153/ui 235/files 35/web 18 pages)
- [x] 1.4 Impl: `gen-api.mjs` stage-1 (TypeDoc **per package** → `api/<pkg>/**`, then merge the 4 per-package
  sidebars → `api/typedoc-sidebar.json`, AR-22); `docs:api` script + root `docs:api` passthrough + root
  `docs:build` = `docs:api && … vp:build`; gitignore `api/*/` + the sidebar json (keep `api/index.md`);
  add the generated trees to `.prettierignore`. — `packages/docs-site/scripts/gen-api.mjs`, root + docs-site `package.json`, `packages/docs-site/.gitignore`, `.prettierignore` (implemented: 2026-07-11 10:55 · completed: 2026-07-11 10:58 — `yarn docs:api` green in ~13.5s, clean URLs `/api/<pkg>/<kind>/<Symbol>`)
- [x] 1.5 Verify: `yarn docs:api` emits all four trees + the sidebar json; a manual second-run diff is
  clean; `yarn verify` green (helpers). — **Verify**: `yarn verify` (implemented: 2026-07-11 10:58 · completed: 2026-07-11 10:58 — ✅ 4 trees + merged sidebar; second-run byte-identical (ST-6 pre-check); `yarn verify` 22/22, docs-site 49 tests incl. barrelExports 2/2)

**Deliverables**: deterministic generation of all four barrels; `barrelExports` green; `docs:build` chained.

---

## Phase 2 — Site integration & cross-linking
Reference: [03-02](03-02-integration-cross-linking.md) · AR-4/6/13/18/19/20 · ST-7, ST-12

- [x] 2.1 Spec: ST-7 (`injectBackLink` inserts after frontmatter + idempotent) and ST-12
  (`validateApiMap` violations) + fixtures. Run red. — `packages/docs-site/test/api-back-links.spec.test.ts`, `test/api-map.spec.test.ts`, `test/fixtures/api/page.md` (implemented: 2026-07-11 11:04 · completed: 2026-07-11 11:07 — red confirmed, then green)
- [x] 2.2 Impl: `inject-back-links.mjs`, `validate-api-map.mjs`, and `api-map.mjs` (plain ESM, AR-18;
  the map co-located under `src/api/`, AR-20; seeded comprehensively — **29 rows**, one per component
  page with a clear primary symbol; form-dialog/preset-gallery left unmapped). Green ST-7/12. — `packages/docs-site/src/api/*.mjs` (incl. `api-map.mjs`) (implemented: 2026-07-11 11:07 · completed: 2026-07-11 11:07 — ST-7/ST-12 green, 4/4; all 29 apiPaths + component pages verified to exist)
- [x] 2.3 Impl: `gen-api.mjs` stage-2 — `import` `injectBackLink` + `API_MAP` from `src/api/*.mjs`, walk
  `API_MAP`, inject the "Documented in →" back-link into each `apiPath` page (fails loud on a missing page). — `packages/docs-site/scripts/gen-api.mjs` (implemented: 2026-07-11 11:09 · completed: 2026-07-11 11:10 — 29 back-links injected, determinism holds)
- [x] 2.4 Impl: rewrite `api/index.md` as the "how to read this" preface (+ pre-release note for
  ui/files/web); wire a **defensive fs-read** of `typedoc-sidebar.json` into `config.ts` for `/api/`
  (`existsSync ? … : []`, AR-19 — so `docs:dev` on a fresh checkout still starts); add a forward "API
  reference →" link to each mapped component page's `## Related` (29 pages, via a one-off codemod). — `packages/docs-site/api/index.md`, `.vitepress/config.ts`, `components/**/*.md` (implemented: 2026-07-11 11:12 · completed: 2026-07-11 11:24)
- [x] 2.5 Verify: `yarn docs:build` renders `/api/` with the generated sidebar; forward + back links
  present; VitePress dead-link check clean; `yarn verify` green. — **Verify**: `yarn verify` (implemented: 2026-07-11 11:24 · completed: 2026-07-11 11:24 — ✅ `docs:build` exit 0, docs gate 14/14 (fixed ST-8 via AR-23: srcExclude test/ + package-qualified titles), `yarn verify` 22/22, docs-site 53 tests)

**Deliverables**: `/api/` navigable in-site; bidirectional cross-links live.

---

## Phase 3 — Anti-drift gate & CI
Reference: [03-03](03-03-gating-anti-drift.md) · AR-15/16/18 · ST-3…ST-6, ST-8…ST-11, ST-13

- [x] 3.1 Impl: append the six API checks to `check-docs-build.mjs`, `import`ing `barrelExports` /
  `validateApiMap` / `API_MAP` (+ a new shared `packages.mjs` list, DRY with `gen-api.mjs`) from
  `src/api/*.mjs` (AR-18) — `API-COVERAGE` (ST-3), `API-LEAKAGE` (ST-4), `API-SYMBOL` (ST-5,
  `createApplication`), `API-LINKS` (ST-11), `API-DETERMINISM` (ST-6, re-runs `gen-api.mjs` + diffs),
  `API-SEARCH` (ST-8/9). Demonstrated red (removed `api/ui` → API-COVERAGE + API-SYMBOL failed). — `packages/docs-site/scripts/check-docs-build.mjs`, `packages/docs-site/src/api/packages.mjs` (implemented: 2026-07-11 11:34 · completed: 2026-07-11 11:37 — 6 checks green, red-demonstrated)
- [x] 3.2 Impl: fix anything the checks surface (determinism-flag corrections, coverage gaps, map path
  mismatches, ST-10 chain). — pipeline/config/map files as needed (implemented: 2026-07-11 11:34 · completed: 2026-07-11 11:37 — **no-op: nothing surfaced.** barrelExports exactly equals the generated set per package (core 152/ui 234/files 34/web 17; 0 missing, 0 leaked); determinism byte-identical)
- [x] 3.3 Verify: the full API gate `yarn docs:api && yarn docs:build && node
  packages/docs-site/scripts/check-docs-build.mjs` green; `yarn check:deps` green (ST-13); `yarn verify`
  green. — **Verify**: `yarn verify` + the API gate chain (AR-16) (implemented: 2026-07-11 11:37 · completed: 2026-07-11 11:37 — ✅ gate chain exit 0 (20/20); `yarn check:deps` green; `yarn verify` 22/22)

**Deliverables**: coverage/leakage/determinism/link/search all hard-gated; `check:deps` intact.

---

## Phase 4 — Finalize
Reference: [01 §Acceptance](01-requirements.md) · [00-index](00-index.md)

- [x] 4.1 Full clean-dist (`rm -rf packages/*/dist .turbo`) `yarn verify` + the API gate green. — **Verify**: `yarn verify` + API gate chain (implemented: 2026-07-11 11:37 · completed: 2026-07-11 11:39 — ✅ clean `yarn verify` 22/22 (0 cached) + API gate chain 20/20 + `check:deps` green, all from clean)
- [x] 4.2 Update the docs-site note in `AGENTS.md` (the `docs:api` generation, gitignored `api/<pkg>/`,
  `src/api/*.mjs` incl. `api-map.mjs`, the bidirectional cross-link mechanism) + the live-example/docs memory. — `AGENTS.md` (implemented: 2026-07-11 11:40 · completed: 2026-07-11 11:40 — Commands + docs-site structure entry updated; live-example memory note added)
- [x] 4.3 Roadmap sync: RD-06 → Done via the roadmap skill; cascade to the portfolio
  `codeops/00-roadmap.md`. — feature + portfolio roadmaps (implemented: 2026-07-11 11:40 · completed: 2026-07-11 11:40)

**Deliverables**: green from clean, docs current, roadmap advanced.

---

## Dependencies

```
Phase 1 (generation + extractor)
    ↓
Phase 2 (integration + cross-links)   ← needs the generated tree + sidebar json
    ↓
Phase 3 (gate + CI)                    ← asserts the whole pipeline
    ↓
Phase 4 (finalize)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 16 tasks completed.
2. ✅ `yarn verify` + the API gate chain (AR-16) green from a clean `dist/`.
3. ✅ No warnings/errors; VitePress dead-link check clean.
4. ✅ No dead code — no unused helpers/params.
5. ✅ Security: no symbol outside the public barrel appears (ST-4); TypeDoc devDeps only (ST-13).
6. ✅ Documentation updated (AGENTS.md docs-site note; the API preface).
7. ✅ RD-06 acceptance criteria 1–7 satisfied via ST-3…ST-13.
8. ✅ Post-completion project re-analysis (handled by the exec-plan skill).
