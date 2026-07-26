# Execution Plan: JSVision i18n

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-26 02:36
> **Progress**: 65/66 tasks (98%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement the JSVision-owned i18n package and secure source boundary first, then inject it into UI
foundations, migrate dependent packages and official locales, and finish with documentation, Codex
plugin generation, performance, and digest-bound translation review.

**Update this document immediately after each completed task.**

## Implementation phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Browser-safe engine | 18 |
| 2 | Secure sources and Node loader | 11 |
| 3 | Application and UI foundations | 12 |
| 4 | Consumer packages and official locales | 15 |
| 5 | Documentation, plugin, quality, and release | 10 |

**Total: 66 tasks across 5 phases**

> **Execution rule — applies to every executor**
>
> The phase checkboxes below are the single progress source. A task appears exactly once. On
> implementation, mark it `[~]` with the actual `date '+%Y-%m-%d %H:%M'`; after verification,
> promote it to `[x]` with the actual completion timestamp. Update the header progress and timestamp
> after every task. Resume the first `[~]`, otherwise the first `[ ]`. In `--auto-commit` mode each
> verified task is committed and pushed; `yarn verify` is the mandatory pre-commit gate in addition
> to the focused command shown.

## Phase 1: Browser-safe engine

> **Phase baseline tree**: 540e03aa0d50b6c851f69946ec748214bbac85c3

### Step 1.1: Specification tests

**Reference**: [03-01](03-01-engine-and-catalog.md) · AR-31, AR-33, AR-34, AR-40

- [x] 1.1.1 [spec-author] Add public construction, lookup, fallback, and interpolation tests for ST-01–ST-08 — `packages/i18n/test/engine.spec.test.ts`, `packages/i18n/test/fixtures/catalogs.ts` ✅ (completed: 2026-07-25 07:47)
- [x] 1.1.2 [spec-author] Add plural, select, formatter, overlay, diagnostics, and warm-path tests for ST-09–ST-16 — `packages/i18n/test/engine.spec.test.ts`, `packages/i18n/test/fixtures/catalogs.ts` ✅ (completed: 2026-07-25 07:56)
- [x] 1.1.3 Run the Phase 1 spec suite and record the expected missing-package/API failures — `codeops/features/i18n/plans/i18n/99-execution-plan.md` — red confirmed: public entry absent ✅ (completed: 2026-07-25 08:00)

### Step 1.2: Implementation

**Reference**: [03-01](03-01-engine-and-catalog.md) · AR-31, AR-33, AR-34

- [x] 1.2.1 Scaffold package metadata, TypeScript/Vitest configuration, and browser-safe public entry — `packages/i18n/package.json`, `packages/i18n/tsconfig.json`, `packages/i18n/vitest.config.ts`, `packages/i18n/src/index.ts` (mechanical correction: public-entry path made explicit) ✅ (completed: 2026-07-25 08:05)
- [x] 1.2.2 Define documented public types, stable errors, diagnostics, and exports — `packages/i18n/src/types.ts`, `packages/i18n/src/errors.ts`, `packages/i18n/src/index.ts` ✅ (completed: 2026-07-25 08:12)
- [x] 1.2.3 Implement canonical locale parsing and deterministic catalog fallback chains — `packages/i18n/src/locale.ts` ✅ (completed: 2026-07-25 08:20)
- [x] 1.2.4 Implement text safety, placeholder compilation, plural/select constructors, and evaluation — `packages/i18n/src/messages.ts` ✅ (completed: 2026-07-25 08:26)
- [x] 1.2.5 Implement schema/completeness/accelerator validation and stable issue formatting — `packages/i18n/src/validation.ts`, `packages/i18n/src/issue-format.ts` (mechanical correction: isolated CI formatting from validation policy) ✅ (completed: 2026-07-25 08:37)
- [x] 1.2.6 Implement copied catalog snapshots, ordered merge, and the bounded diagnostic store — `packages/i18n/src/catalog.ts`, `packages/i18n/src/diagnostics.ts` ✅ (completed: 2026-07-25 08:42)
- [x] 1.2.7 Implement stable formatter-option keys and four 64-entry LRU caches — `packages/i18n/src/cache.ts` ✅ (completed: 2026-07-25 08:47)
- [x] 1.2.8 Implement `createI18n`, lookup/format/introspection, and atomic runtime overlays — `packages/i18n/src/service.ts`, `packages/i18n/src/index.ts` ✅ (completed: 2026-07-25 08:54)
- [x] 1.2.9 Run Phase 1 spec tests green; fix implementation only — `packages/i18n/test/engine.spec.test.ts` — 45/45 specification tests green ✅ (completed: 2026-07-25 08:59)

### Step 1.3: Hardening and verification

**Reference**: [07-testing-strategy](07-testing-strategy.md) ST-01–ST-16 · AR-41, AR-42

- [x] 1.3.1 Add locale and compiled-message implementation coverage — `packages/i18n/test/locale.impl.test.ts`, `packages/i18n/test/messages.impl.test.ts` — 37 implementation tests green ✅ (completed: 2026-07-25 09:03)
- [x] 1.3.2 Add validation and catalog-copy implementation coverage — `packages/i18n/test/validation.impl.test.ts`, `packages/i18n/test/catalog.impl.test.ts` — 21 implementation tests green ✅ (completed: 2026-07-25 09:08)
- [x] 1.3.3 Add diagnostic-bound and formatter-cache implementation coverage — `packages/i18n/test/diagnostics.impl.test.ts`, `packages/i18n/test/cache.impl.test.ts` — 17 implementation tests green ✅ (completed: 2026-07-25 09:13)
- [x] 1.3.4 Add adversarial coercion and snapshot atomicity implementation coverage — `packages/i18n/test/security.impl.test.ts`, `packages/i18n/test/service.impl.test.ts` — 18 hardening tests plus 12 cache regressions green ✅ (completed: 2026-07-25 09:22)
- [x] 1.3.5 Document package API, compatibility, and initial changelog — `packages/i18n/README.md`, `packages/i18n/CHANGELOG.md`, `packages/i18n/LICENSE` ✅ (completed: 2026-07-25 09:29)
- [x] 1.3.6 Verify Phase 1 with package build/typecheck/test/docs/dependency checks and root `yarn verify` — `packages/i18n/package.json`, `packages/i18n/tsconfig.typecheck.json`, `codeops/features/i18n/plans/i18n/99-execution-plan.md` (mechanical correction: activated the package-local gates) — package-local gates and 34-task root verification green ✅ (completed: 2026-07-25 09:40)

**Phase quality review**: PASS — all initial and re-review major findings were corrected; 159
package tests, 34/34 root tasks, and plugin integrity passed. See
[08-phase-1-quality-review](08-phase-1-quality-review.md).

## Phase 2: Secure sources and Node loader

> **Phase baseline tree**: de0c4fb57d8b46e15ca4dad46d893649a40e3fc7

### Step 2.1: Specification tests

**Reference**: [03-02](03-02-sources-and-security.md) · AR-32, AR-40, AR-43, AR-45

- [x] 2.1.1 [spec-author] Add ordered, optional/required, abort, and caller-owned transport tests for ST-17–ST-20 — `packages/i18n/test/sources.spec.test.ts`, `packages/i18n/test/fixtures/sources.ts` — six public source tests observed red on the missing orchestrator ✅ (completed: 2026-07-25 10:41)
- [x] 2.1.2 [spec-author] Add rooted-path, strict JSON, UTF-8, limit, race, and completeness tests for ST-21–ST-29 — `packages/i18n/test/node-loader.spec.test.ts`, `packages/i18n/test/fixtures/node.ts` — Node entry absence confirmed before collection ✅ (completed: 2026-07-25 10:41)
- [x] 2.1.3 Run the Phase 2 spec suites and record expected missing-source/loader failures — `codeops/features/i18n/plans/i18n/99-execution-plan.md` — red confirmed: six missing `loadI18n` failures plus missing Node entry ✅ (completed: 2026-07-25 10:41)

### Step 2.2: Implementation

**Reference**: [03-02](03-02-sources-and-security.md) · AR-32, AR-45

- [x] 2.2.1 Implement deterministic `loadI18n` orchestration and sanitized optional-source diagnostics — `packages/i18n/src/source.ts`, `packages/i18n/src/index.ts`, `packages/i18n/test/source.impl.test.ts` — six public and ten implementation tests green ✅ (completed: 2026-07-25 10:47)
- [x] 2.2.2 Implement the bounded duplicate-detecting recursive-descent JSON parser — `packages/i18n/src/node/strict-json.ts`, `packages/i18n/test/strict-json.impl.test.ts` — 28 grammar, duplicate, Unicode, and bound tests green ✅ (completed: 2026-07-25 10:50)
- [x] 2.2.3 Implement relative-path grammar, immediate glob expansion, canonical containment, and handle checks — `packages/i18n/src/node/paths.ts`, `packages/i18n/test/paths.impl.test.ts` — 18 path, ordering, containment, and handle tests green ✅ (completed: 2026-07-25 10:54)
- [x] 2.2.4 Implement fatal UTF-8 bounded file loading and `jsonFileSource` publication — `packages/i18n/src/node/json-file-source.ts`, `packages/i18n/src/node/index.ts`, `packages/i18n/test/json-file-source.impl.test.ts` — 119 focused Node tests and 340 package tests green ✅ (completed: 2026-07-25 21:31)
- [x] 2.2.5 Expose the isolated `./node` package subpath and prove main-entry browser isolation — `packages/i18n/package.json`, `packages/i18n/test/package-exports.impl.test.ts` — three entry-isolation tests and emitted Node entry green ✅ (completed: 2026-07-25 21:35)
- [x] 2.2.6 Run Phase 2 spec tests green; fix source/loader implementation only — `packages/i18n/test/sources.spec.test.ts`, `packages/i18n/test/node-loader.spec.test.ts` — 120 source and Node loader specification tests green ✅ (completed: 2026-07-25 21:36)

### Step 2.3: Hardening and verification

**Reference**: [03-02](03-02-sources-and-security.md) · AR-32, AR-43

- [x] 2.3.1 Add upstream MIT attribution and validate its inclusion in the packed package — `packages/i18n/THIRD_PARTY_NOTICES.md`, `packages/i18n/README.md`, `packages/i18n/CHANGELOG.md`, `packages/i18n/test/package-exports.impl.test.ts` — four entry/packing tests and documentation gate green ✅ (completed: 2026-07-25 21:38)
- [x] 2.3.2 Verify Phase 2 with parser/security tests, package gates, packed artifact inspection, and root `yarn verify` — `codeops/features/i18n/plans/i18n/99-execution-plan.md` — 344 package tests, packed notice inspection, 34/34 root tasks, and plugin integrity green ✅ (completed: 2026-07-25 21:41)

**Phase quality review**: PASS — all initial and one-time re-review findings were corrected; 359
package tests, 34/34 root tasks, and plugin integrity passed. See
[08-phase-2-quality-review](08-phase-2-quality-review.md).

## Phase 3: Application and UI foundations

> **Phase baseline tree**: 86ff4ff35f7b842e7df1d29482aa8f1910cf865b

### Step 3.1: Specification tests

**Reference**: [03-03](03-03-framework-integration.md) · AR-36–AR-40

- [x] 3.1.1 [spec-author] Add application identity, compatibility, dependency, and host tests for ST-30–ST-34 — `packages/ui/test/i18n.spec.test.ts`, `packages/ui/test/fixtures/i18n.ts` — expected red confirmed on missing UI direct dependency ✅ (completed: 2026-07-25 22:31)
- [x] 3.1.2 [spec-author] Add calendar, DatePicker, switch, dialog, message, and editor tests for ST-35–ST-38 — `packages/ui/test/i18n.spec.test.ts`, `packages/ui/test/fixtures/i18n.ts` — expected red confirmed on missing UI direct dependency ✅ (completed: 2026-07-25 22:39)
- [x] 3.1.3 Run the Phase 3 spec suite and record expected missing-injection/catalog failures — `codeops/features/i18n/plans/i18n/99-execution-plan.md` — red confirmed: missing direct UI dependency ✅ (completed: 2026-07-25 22:39)

### Step 3.2: Implementation

**Reference**: [03-03](03-03-framework-integration.md) · AR-36, AR-38

- [x] 3.2.1 Add all four direct i18n dependencies and inject the exact/default service through Application — `packages/ui/package.json`, `packages/forms/package.json`, `packages/files/package.json`, `packages/datagrid/package.json`, `packages/ui/src/app/application.ts`, `packages/ui/src/index.ts`, `yarn.lock` — source build and dependency/Application/export specifications green ✅ (completed: 2026-07-25 22:43)
- [x] 3.2.2 Define UI English catalog keys, accelerator scopes, and service-aware standard buttons — `packages/ui/src/i18n/catalog.ts`, `packages/ui/src/i18n/scopes.ts`, `packages/ui/src/dialog/buttons.ts` — English catalog, validation manifests, source build, and focused specifications green ✅ (completed: 2026-07-25 22:47)
- [x] 3.2.3 Localize calendar headings/Today and explicit-locale week conventions without changing ISO values — `packages/ui/src/date/calendar.ts`, `packages/ui/src/date/calendar-grid.ts`, `packages/ui/src/date/calendar-metrics.ts` — source build and real Calendar/DatePicker specifications green ✅ (completed: 2026-07-25 22:51)
- [x] 3.2.4 Localize default switch labels while preserving explicit labels — `packages/ui/src/controls/switch.ts`, `packages/ui/test/switch.impl.test.ts` — source build, localized spec, and 15 existing Switch tests green ✅ (completed: 2026-07-25 22:52)
- [x] 3.2.5 Thread i18n through modal hosts and localize message-box defaults — `packages/ui/src/dialog/dialog.ts`, `packages/ui/src/dialog/message-box.ts`, `packages/ui/src/dialog/index.ts` — source build, existing dialogs, hosted localization, and accelerator specs green ✅ (completed: 2026-07-25 22:54)
- [x] 3.2.6 Localize package-owned editor dialog text and preserve caller text — `packages/ui/src/editor/dialogs.ts`, `packages/ui/src/editor/editor-dialog.ts`, `packages/ui/test/editor-dialogs.impl.test.ts` — UI typecheck and ten targeted editor-dialog tests green ✅ (completed: 2026-07-25 22:59)
- [x] 3.2.7 Run Phase 3 spec tests green; fix UI implementation only — `packages/ui/test/i18n.spec.test.ts` — 12/12 specification tests green ✅ (completed: 2026-07-25 23:00)

### Step 3.3: Hardening and verification

**Reference**: [03-03](03-03-framework-integration.md) · AR-37, AR-39, AR-42

- [x] 3.3.1 Add the checked UI literal-ownership manifest and conservative scanner — `tools/i18n-literals.json`, `scripts/check-i18n-literals.mjs`, `package.json` — scanner, JSON, lint, formatting, and 27-candidate inventory green ✅ (completed: 2026-07-25 23:03)
- [x] 3.3.2 Verify Phase 3 with UI gates, compatibility snapshots, literal scan, and root `yarn verify` — `codeops/features/i18n/plans/i18n/99-execution-plan.md` — 5,118 tests and all repository gates green ✅ (completed: 2026-07-25 23:25)

Phase 3 passed independent correctness, API, security, and performance review after the mutable
standalone-fallback finding was corrected and re-reviewed once. Final verification passed 5,120
tests and all repository/plugin gates. See
[08-phase-3-quality-review](08-phase-3-quality-review.md).

## Phase 4: Consumer packages and official locales

> **Phase baseline tree**: b2a753c0d4a154e0cc6684d902d1b00f0d2ebd8c

### Step 4.1: Specification tests

**Reference**: [03-03](03-03-framework-integration.md), [03-04](03-04-locales-docs-plugin.md) · AR-35, AR-38–AR-40

- [x] 4.1.1 [spec-author] Add Forms, Files, and Datagrid behavior tests for ST-39–ST-42 — `packages/forms/test/i18n.spec.test.ts`, `packages/files/test/i18n.spec.test.ts`, `packages/datagrid/test/i18n.spec.test.ts` — expected red confirmed across all three consumers ✅ (completed: 2026-07-25 23:55)
- [x] 4.1.2 [spec-author] Add ten-locale layout and 40-subpath catalog/package tests for ST-43–ST-48 — `packages/examples/test/i18n-layout.spec.test.ts`, `packages/i18n/test/locales.spec.test.ts`, `packages/i18n/test/fixtures/reviews.ts` — expected red confirmed for 40 subpaths, parity, scopes, layout, and fallback; the cross-package layout oracle lives in the integration package so clean-checkout typechecking follows declared workspace dependencies ✅ (completed: 2026-07-25 23:55)
- [x] 4.1.3 Run the Phase 4 spec suites and record expected missing-integration/locale failures — `codeops/features/i18n/plans/i18n/99-execution-plan.md` — parent checkpoint confirmed 73 expected failures across five suites ✅ (completed: 2026-07-25 23:56)

### Step 4.2: Implementation

**Reference**: [03-03](03-03-framework-integration.md) · AR-36, AR-38

- [x] 4.2.1 Add the Forms catalog and localize FormDialog defaults — `packages/forms/src/i18n/catalog.ts`, `packages/forms/src/form-dialog.ts` — Forms specification 2/2, typecheck, and JSDoc checks green ✅ (completed: 2026-07-25 23:58)
- [x] 4.2.2 Add the Files catalog and localize dialog action labels — `packages/files/src/i18n/catalog.ts`, `packages/files/src/dialog/file-dialog.ts` — Files i18n specification, typecheck, and JSDoc checks green ✅ (completed: 2026-07-26 00:07)
- [x] 4.2.3 Localize Files metadata, change-directory, and error dialogs without touching path data — `packages/files/src/list/file-info-pane.ts`, `packages/files/src/dialog/chdir-dialog.ts`, `packages/files/src/dialog/error-dialog.ts` — metadata localization preserves caller path/name bytes; Files specification 4/4 green ✅ (completed: 2026-07-26 00:07)
- [x] 4.2.4 Add the Datagrid catalog and localize default formatting/empty/filter text — `packages/datagrid/src/i18n/catalog.ts`, `packages/datagrid/src/format.ts` — focused i18n oracle, formatter/lifecycle regression tests, and JSDoc checks green ✅ (completed: 2026-07-26 00:10)
- [x] 4.2.5 Localize Datagrid filter/personalization surfaces and explicit-i18n collation — `packages/datagrid/src/filter-popup.ts`, `packages/datagrid/src/personalize-dialog.ts`, `packages/datagrid/src/filter.ts` — six i18n oracles, 25 personalization regressions, typecheck, and JSDoc checks green ✅ (completed: 2026-07-26 00:15)
- [x] 4.2.6 Add canonical ten-locale catalog data and accelerator-scope manifests for all four packages — `packages/ui/src/i18n/locales.ts`, `packages/forms/src/i18n/locales.ts`, `packages/files/src/i18n/locales.ts` — strict parity, placeholder, accelerator, and isolation contracts green ✅ (completed: 2026-07-26 00:27)
- [x] 4.2.7 Complete Datagrid locale data and implement deterministic locale entry/export generation — `packages/datagrid/src/i18n/locales.ts`, `scripts/update-i18n-locales.mjs`, `tools/i18n-locale-exports.json` — generator update/check, package builds/typechecks, and 52 locale tests green ✅ (completed: 2026-07-26 00:27)
- [x] 4.2.8 Generate/check explicit locale entry points and package exports in bounded batches — `packages/ui/src/locales/`, `packages/forms/src/locales/`, `packages/files/src/locales/` — thirty runtime/declaration subpaths generated and verified ✅ (completed: 2026-07-26 00:27)
- [x] 4.2.9 Generate/check Datagrid locale entries, dependency metadata, and root lockfile — `packages/datagrid/src/locales/`, `packages/datagrid/package.json`, `yarn.lock` — ten Datagrid subpaths and direct dependency metadata verified ✅ (completed: 2026-07-26 00:27)
- [x] 4.2.10 Run Phase 4 spec tests green; fix consumer/catalog implementation only — `packages/forms/test/i18n.spec.test.ts`, `packages/files/test/i18n.spec.test.ts`, `packages/datagrid/test/i18n.spec.test.ts` — twelve consumer i18n specifications green without oracle changes ✅ (completed: 2026-07-26 00:28)

### Step 4.3: Hardening and verification

**Reference**: [07-testing-strategy](07-testing-strategy.md) ST-39–ST-48 · AR-37, AR-39

- [x] 4.3.1 Complete literal classifications and add display-cell layout/invalid-override implementation coverage — `tools/i18n-literals.json`, `packages/ui/test/i18n-layout.impl.test.ts`, `packages/i18n/test/locales.impl.test.ts` — localized layout/locale implementation suites and four-package literal inventory green ✅ (completed: 2026-07-26 00:36)
- [x] 4.3.2 Verify Phase 4 with all consumer gates, locale generation/check, layout tests, package builds, and root `yarn verify` — all 34 Turbo tasks and repository/plugin gates passed ✅ (completed: 2026-07-26 00:46)

Phase 4 passed independent correctness and public-API review after all six initial Major findings
were corrected. The one-time re-review found one canonical-English accelerator edge, which was
corrected and covered without a third review. Final `yarn verify` passed all 34 Turbo tasks and
repository/plugin gates. See [08-phase-4-quality-review](08-phase-4-quality-review.md).

## Phase 5: Documentation, plugin, quality, and release

> **Phase baseline tree**: 93861d173212caaee94cf80e5d5a02d797c58bf2

### Step 5.1: Specification tests

**Reference**: [03-04](03-04-locales-docs-plugin.md) · AR-42–AR-44

- [x] 5.1.1 [spec-author] Add review-evidence, docs/API, plugin recipe, and benchmark tests for ST-49–ST-55 — `packages/i18n/test/reviews.spec.test.ts`, `packages/docs-site/test/i18n-docs.spec.test.ts`, `tools/jsvision-skill/test/i18n-plugin.spec.test.ts` ✅ (completed: 2026-07-26 01:25)
- [x] 5.1.2 Run Phase 5 spec suites and record expected missing docs/plugin/review failures — `codeops/features/i18n/plans/i18n/99-execution-plan.md` ✅ (completed: 2026-07-26 01:28)
  - Red evidence: review evidence 5 failed; docs/API 3 failed; plugin/recipe 3 failed; performance integration 1 failed and the standalone measurement oracle passed.

### Step 5.2: Implementation

**Reference**: [03-04](03-04-locales-docs-plugin.md) · AR-43, AR-44

- [x] 5.2.1 Implement normalized catalog digests and strict translation-review manifest verification — `scripts/check-i18n-reviews.mjs`, `tools/i18n-translation-reviews.json`, `package.json` ✅ (completed: 2026-07-26 01:36)
- [x] 5.2.2 Add the consumer i18n guide, Theme Designer recipe, and executable snippet fixtures — `packages/docs-site/guide/i18n.md`, `packages/docs-site/examples/i18n-theme-designer.ts`, `packages/docs-site/.vitepress/config.ts` ✅ (completed: 2026-07-26 01:42)
- [x] 5.2.3 Add i18n API generation/navigation and package migration/attribution documentation — `packages/docs-site/scripts/gen-api.mjs`, `packages/docs-site/reference/i18n.md`, `packages/i18n/README.md` ✅ (completed: 2026-07-26 01:48)
- [x] 5.2.4 Teach the canonical JSVision skill i18n decisions, API, and recipes — `tools/jsvision-skill/SKILL.md`, `tools/jsvision-skill/references/i18n.md`, `tools/jsvision-skill/references/app-lifecycle.md`, `tools/jsvision-skill/references/recipes/index.md`, `tools/jsvision-skill/references/recipes/i18n-app.md` ✅ (completed: 2026-07-26 01:56)
- [x] 5.2.5 Map SDK impact, add localized app recipe validation, and regenerate the distributed plugin — `tools/jsvision-plugin-impact.json`, `scripts/gen-plugin-api.mjs`, `tools/jsvision-skill/test/i18n-plugin.spec.test.ts`, `plugins/jsvision-plugin/skills/jsvision/` ✅ (completed: 2026-07-26 02:02)
- [x] 5.2.6 Add fixed cold/warm benchmarks and run Phase 5 non-review spec tests green — `packages/i18n/bench/i18n-bench.mjs`, `packages/i18n/test/performance.spec.test.ts`, `scripts/check-performance.mjs`, `package.json` ✅ (completed: 2026-07-26 02:03)

### Step 5.3: Hardening and release verification

**Reference**: [03-04](03-04-locales-docs-plugin.md) · AR-42, AR-44

- [x] 5.3.1 Run docs snippets/API generation, `yarn plugin:update`, `yarn plugin:check`, package gates, and root `yarn verify` — `codeops/features/i18n/plans/i18n/99-execution-plan.md` — clean-runner follow-up moved the unchanged cross-package layout oracle to `@jsvision/examples`; focused dependency-order verification and root `yarn verify` passed ✅ (completed: 2026-07-26 02:36)
- [ ] 5.3.2 Obtain proficient-speaker approvals for every non-English catalog digest and pass the review verifier — `tools/i18n-translation-reviews.json`
  - External blocker: 36 package/locale catalogs still need digest-bound proficient approval; the verifier reports one `MISSING_REVIEW` issue for each.

## Dependencies

```text
Phase 1 engine
    ↓
Phase 2 sources/Node boundary
    ↓
Phase 3 Application/UI seams
    ↓
Phase 4 consumers/locales
    ↓
Phase 5 docs/plugin/review/release
```

Within every phase the order is specification tests → red verification → implementation → green
verification → implementation hardening → full verification. The external review task depends on
stable final catalog digests and may remain the sole release blocker.

## Success criteria

The feature is complete only when all 66 tasks are verified, `yarn verify` and plugin drift checks
pass, main-entry browser isolation and security suites pass, no dead code or undocumented public
surface remains, and every non-English catalog has current proficient-speaker approval.
