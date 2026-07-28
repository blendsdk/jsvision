# Execution plan: Code Editor internationalization

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-26 11:21 UTC
> **Progress**: 21/21 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement the independently deliverable Code Editor localization from GitHub issue #184, then hand
complete localized surfaces to the #185 translated-layout and QA-harness plan. Tasks follow
specification-first ordering and preserve external content, stable semantics, browser isolation,
and additive compatibility.

**🚨 Update this document after each completed task.**

## Implementation phases

| Phase | Title | Tasks |
|---|---|---|
| 1 | Catalog, injection, and package contract | 6 |
| 2 | Structured presentation and search chrome | 7 |
| 3 | Locale tooling, docs, plugin, and release closure | 8 |

**Total: 21 tasks across 3 phases**

> **Execution rule**
>
> Phase task checkboxes are the single progress source. On implementation, mark `[~]` with a real
> timestamp; on verification, promote to `[x]`. Update the progress header and timestamp after every
> task. Resume the first `[~]`, otherwise the first `[ ]`.

## Phase 1: Catalog, injection, and package contract

> **Phase baseline tree**: `ac83f9cd26cb4a28a2a29689f6494d9e804d024b` plus the approved
> Code Editor i18n plan set and pre-existing `yarn.lock` modification
> **Expected modification set**: Code Editor catalog/locale modules, package manifest/lockfile,
> public injection types, and Phase 1 specification/implementation tests

**Reference**: 03-01 · ST-1 through ST-8 · AR-4, AR-6, AR-9, AR-10, AR-15

- [x] 1.1.1 `[spec-author]` Write immutable catalog, injection, override, locale-export, and entry-isolation specifications for ST-1 through ST-8 — `packages/code-editor/test/i18n-catalog.spec.test.ts`, `packages/i18n/test/locales.spec.test.ts` *(verified 2026-07-26 09:49 UTC)*
- [x] 1.1.2 Run the focused Phase 1 specifications and record expected red failures before production changes *(verified 2026-07-26 09:49 UTC: Code Editor suite could not resolve the planned catalog module; locale suite passed all 52 existing assertions and failed all 13 new Code Editor export assertions)*
- [x] 1.2.1 Add the canonical English catalog, official typed locale catalogs, accelerator manifest, and isolated English service — `packages/code-editor/src/i18n/catalog.ts`, `packages/code-editor/src/i18n/locales.ts` *(verified 2026-07-26 09:54 UTC)*
- [x] 1.2.2 Add optional exact service injection and localized default window/status chrome while preserving caller titles and numeric status — `packages/code-editor/src/ui/code-editor.ts`, `packages/code-editor/src/ui/code-editor-window.ts`, `packages/code-editor/src/ui/index.ts` *(verified 2026-07-26 09:56 UTC)*
- [x] 1.2.3 Add the direct dependency, public exports, generated locale entry modules, and browser/Node isolation contract — `packages/code-editor/package.json`, `packages/code-editor/src/index.ts`, `packages/code-editor/src/locales/` *(verified 2026-07-26 09:53 UTC)*
- [x] 1.3.1 Confirm Phase 1 specifications green, add fallback/invalid-input implementation coverage, run package checks and `yarn verify` — `packages/code-editor/test/i18n-catalog.impl.test.ts` *(verified 2026-07-26 10:15 UTC; focused suites 74/74 green; `yarn verify` passed 38/38 Turbo tasks, all performance gates, and plugin integrity)*

**Deliverables**:

- Canonical catalog and ten locale constants
- Exact optional injection with isolated English compatibility
- Public locale/package contract ready for shared tooling registration

**Verify**: `yarn verify`

## Phase 2: Structured presentation and search chrome

> **Phase baseline tree**: `5cfe67a50` plus the pre-existing `yarn.lock` modification
> **Expected modification set**: Code Editor presentation, overlay, degradation, invisible-warning,
> assistance/search/status modules, and focused specification/implementation tests

**Reference**: 03-02 · ST-9 through ST-19 · AR-2, AR-3, AR-5, AR-7, AR-8, AR-11

- [x] 2.1.1 `[spec-author]` Write immutable wrapper, external-content, search, display-cell, hostile-input, and reconstruction specifications for ST-9 through ST-19 — `packages/code-editor/src/ui/i18n-presentation.spec.test.ts` *(completed 2026-07-26 10:20 UTC)*
- [x] 2.1.2 Run the focused Phase 2 specifications and record expected red failures before production changes *(verified red 2026-07-26 10:20 UTC: suite failed because the planned presentation module did not exist)*
- [x] 2.2.1 Add additive structured diagnostic metadata and pure diagnostic/degradation/invisible-warning projectors while retaining legacy English fields — `packages/code-editor/src/presentation.ts`, `packages/code-editor/src/controller-overlay.ts`, `packages/code-editor/src/i18n/presentation.ts` *(completed 2026-07-26 10:29 UTC)*
- [x] 2.2.2 Route localized diagnostic rows and cell-aware assistance sizing/clipping through the final view seam — `packages/code-editor/src/ui/code-editor.ts`, `packages/code-editor/src/ui/assistance.ts` *(completed 2026-07-26 10:29 UTC)*
- [x] 2.2.3 Implement bounded localized one-/two-row search presentation and reserve its viewport rows without changing search state or commands — `packages/code-editor/src/ui/search-presentation.ts`, `packages/code-editor/src/ui/code-editor.ts` *(completed 2026-07-26 10:29 UTC)*
- [x] 2.2.4 Localize and cell-clip status/degradation/invisible accessible presentation, export host projectors, and verify clean locale reconstruction/disposal — `packages/code-editor/src/ui/code-editor-window.ts`, `packages/code-editor/src/degradation.ts`, `packages/code-editor/src/languages/invisibles.ts`, `packages/code-editor/src/index.ts` *(completed 2026-07-26 10:29 UTC)*
- [x] 2.3.1 Confirm Phase 2 specifications green, add boundary/priority/invalid-input implementation coverage, run regression suites and `yarn verify` — `packages/code-editor/src/ui/i18n-presentation.impl.test.ts` *(verified 2026-07-26 10:47 UTC after independent review corrections; focused Phase 2 suites 15/15 green; Code Editor 364/364 green; `yarn verify` passed 38/38 Turbo tasks, all performance gates, and plugin integrity)*

**Deliverables**:

- Locale-neutral structured state with compatible English fields
- Localized diagnostic/degradation/invisible wrappers
- Visible localized search/replace chrome
- Cell-correct bounded Code Editor assistance/search/status output

**Verify**: `yarn verify`

## Phase 3: Locale tooling, docs, plugin, and release closure

> **Phase baseline tree**: `b99918145` plus the pre-existing `yarn.lock` modification
> **Expected modification set**: shared i18n generator/check configuration and tests, ownership and
> review manifests, docs, canonical skill/impact mapping, generated plugin, plan/roadmap/traceability

**Reference**: 03-03 · ST-20 through ST-24 · AR-8, AR-9, AR-12, AR-13

- [x] 3.1.1 `[spec-author]` Extend immutable package-registration, locale, docs, and canonical-skill specifications for ST-20 through ST-24 — `packages/i18n/test/i18n-package-registration.spec.test.ts`, `packages/docs-site/test/i18n-docs.spec.test.ts`, `tools/jsvision-skill/test/i18n-plugin.spec.test.ts` *(completed 2026-07-26 10:49 UTC)*
- [x] 3.1.2 Run the focused Phase 3 specifications and record expected red failures before tooling/documentation changes *(verified red 2026-07-26 10:49 UTC: package config/counts, docs entry, impact mapping, plugin copy, and five-catalog recipe expectations failed)*
- [x] 3.2.1 Register Code Editor in locale configuration and make locale generation/check counts configuration-derived and path-safe — `tools/i18n-locale-exports.json`, `scripts/update-i18n-locales.mjs` *(completed 2026-07-26 10:54 UTC)*
- [x] 3.2.2 Make literal ownership, locale validation, review loading, and cross-package catalog checks configuration-aware; classify Code Editor literals without fabricating reviews — `scripts/check-i18n-literals.mjs`, `scripts/check-i18n-reviews.mjs`, `tools/i18n-literals.json`, `packages/i18n/test/` *(completed 2026-07-26 10:54 UTC)*
- [x] 3.2.3 Document Code Editor injection, locale subpaths, application overrides, and external-content ownership in package and docs-site guidance — `packages/code-editor/README.md`, `packages/docs-site/guide/code-editor.md`, `packages/docs-site/guide/i18n.md`, `packages/docs-site/reference/i18n-entry-points.md` *(completed 2026-07-26 10:54 UTC)*
- [x] 3.2.4 Update canonical skill references and overlapping impact mapping, run `yarn plugin:update`, and inspect/include generated plugin output — `tools/jsvision-skill/`, `tools/jsvision-plugin-impact.json`, `plugins/jsvision-plugin/skills/jsvision/` *(completed 2026-07-26 10:54 UTC)*
- [x] 3.3.1 Confirm Phase 3 specifications green, run locale/plugin/package documentation checks, and report translation-review plus #185 harness gates *(verified 2026-07-26 11:21 UTC after independent review corrections; focused registration 5/5 and docs 5/5 green; generated Code Editor main/locale API targets confirmed; review follow-up completed 2026-07-28 with disclosed AI-assisted approval for all 45 catalogs; #185 demo/viewport gate remains pending)*
- [x] 3.3.2 Run final `yarn verify`, synchronize traceability/roadmaps, and record implementation/verification evidence without closing #185-owned acceptance work *(verified 2026-07-26 11:21 UTC; reviewer and auditor report no remaining critical/major findings; `yarn verify` passed 38/38 Turbo tasks, all performance budgets, and plugin integrity)*

**Deliverables**:

- Configuration-driven five-package locale/review/literal quality tooling
- Complete consumer documentation and canonical/generated plugin support
- Passing repository gate and explicit external follow-up evidence

**Verify**: `yarn verify`

## Dependencies

```text
Phase 1: catalog and service contract
    ↓
Phase 2: presentation consumes that contract
    ↓
Phase 3: shared tooling/docs/plugin register the stable public surface
    ↓
#185: comprehensive geometry sweep, demo:i18n registry, Code Editor story, viewport certification
```

## Success criteria

1. All 21 tasks are verified in order.
2. ST-1 through ST-24 pass without weakening immutable expectations.
3. Existing Code Editor search, controller, LSP, lifecycle, and packaging regressions pass.
4. `yarn plugin:check` and `yarn verify` pass.
5. No dead code, unsafe casts, plan references in shipped comments, or hidden locale state.
6. Translation-review methods and #185-owned integration gates are reported, never fabricated.
