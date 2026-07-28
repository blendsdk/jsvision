# Execution plan: translated layout and multilingual QA

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-26 16:11 UTC
> **Progress**: 27/27 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement the shared geometry contract first, migrate translated framework surfaces second, build
the multilingual QA registry third, then close documentation/plugin/release surfaces. Tasks follow
specification-first ordering and each phase receives independent reviewer and auditor scrutiny.

**🚨 Update this document immediately after each task changes state.**

## Implementation phases

| Phase | Title | Tasks |
|---|---|---|
| 1 | Shared Button geometry | 6 |
| 2 | Complete translated-surface migration | 8 |
| 3 | Multilingual QA application and matrix | 7 |
| 4 | Documentation, plugin, and release closure | 6 |

**Total: 27 tasks across 4 phases**

> **Execution rule**
>
> Mark the active task `[~]` with a real timestamp, then `[x]` only after its stated verification.
> Resume the first `[~]`, otherwise the first `[ ]`. Phase baselines exclude the unrelated
> pre-existing `yarn.lock` modification.

## Phase 1: Shared Button geometry

> **Phase baseline tree**: `f956b22497fee2392dd5d0f23b4895f8031b5dee` plus the approved plan
> **Expected modification set**: UI Button-group source/exports/docs, Datagrid delegates, and focused
> specification/implementation tests

**Reference**: 03-01 · AC-1 through AC-4 · AR-3 through AR-7, AR-18

- [x] 1.1.1 `[spec-author]` Write immutable public metric/composition specifications for empty, minimum, widest, accelerator, Unicode, horizontal, wrapped, vertical, and hard-bound cases — `packages/ui/test/button-group.spec.test.ts` *(completed 2026-07-26 11:55 UTC)*
- [x] 1.1.2 Extend Datagrid compatibility specifications for historical cell width, row minimum, gap, equal cells, and multi-row reuse — `packages/datagrid/test/aux-composition.spec.test.ts` *(completed 2026-07-26 11:57 UTC)*
- [x] 1.1.3 Run focused Phase 1 specifications and record expected red failures before production changes *(verified 2026-07-26 11:58 UTC: all six UI contract cases failed because the planned exports were absent; all three Datagrid compatibility cases remained green)*
- [x] 1.2.1 Implement and export documented pure Button-group metrics and horizontal/wrapped/vertical composition in UI *(completed 2026-07-26 12:01 UTC)*
- [x] 1.2.2 Delegate Datagrid helpers to the UI contract without changing historical behavior; add invalid-option and ownership implementation coverage *(verified 2026-07-26 12:03 UTC: UI contract 14/14 and Datagrid compatibility/composition 9/9 focused cases pass; both package typechecks pass)*
- [x] 1.3.1 Confirm Phase 1 specifications green, run UI/Datagrid package checks and `yarn verify`, then complete reviewer/auditor quality loop *(verified 2026-07-26 12:22 UTC: UI Button-group 19/19 and Datagrid compatibility/composition 9/9 focused cases pass; package typechecks, `yarn plugin:check`, and full `yarn verify` pass; independent challenger and auditor report no critical or major findings)*

**Deliverables**: Public cell-correct geometry, stable composition, compatible Datagrid delegates.

**Verify**: `yarn verify`

## Phase 2: Complete translated-surface migration

> **Phase baseline tree**: Phase 1 verified commit plus unrelated `yarn.lock`
> **Expected modification set**: UI dialogs/editor/date/dropdown surfaces, Forms, Files, Datagrid,
> and their specification/implementation tests

**Reference**: 03-02 · AC-5 through AC-8 · AR-8 through AR-12, AR-17, AR-18

- [x] 2.1.1 `[spec-author]` Write UI dialog/surface and Forms requirements specifications covering intrinsic cells, requested minima, wrapping, focus, hit bounds, and English compatibility *(completed 2026-07-26 12:32 UTC: six immutable cases; English compatibility and hard-bound focus pass, while feasible translated expansion fails as planned in UI and Forms)*
- [x] 2.1.2 `[spec-author]` Write Files vertical-action/error-dialog and Calendar/DatePicker localized geometry specifications for all locales and Unicode overrides *(completed 2026-07-26 12:35 UTC: 24 cases cover all ten official locales plus Unicode overrides; official geometry and DatePicker parity pass, while FileDialog/errorBox and wide-month expansion fail as planned)*
- [x] 2.1.3 `[spec-author]` Write Datagrid filter/value-list/personalization desired-size, clamp, reflow, group-width, header, and right-edge specifications *(completed 2026-07-26 12:39 UTC: five immutable cases cover translated desired width, two-axis viewport clamping, between reflow, five-action shared widths, and flexible translated headers; all fail against the planned fixed geometry)*
- [x] 2.1.4 Run focused Phase 2 specifications and record expected red failures before production changes *(verified 2026-07-26 12:47 UTC: 39 focused cases ran; 26 compatibility/official-locale cases pass and 13 fail only at the planned translated expansion, clamp, reflow, uniform-width, and header boundaries)*
- [x] 2.2.1 Migrate UI dialogs/editor surfaces and Forms to shared metrics, display-cell body sizing, intrinsic expansion, and stable component-owned wrapping *(verified 2026-07-26 12:53 UTC: translated UI/Forms and editor compatibility suites pass; UI typecheck, 14 focused dialog/editor cases, and all 116 Forms cases pass; the only remaining UI package failure is the planned Calendar oracle owned by 2.2.2)*
- [x] 2.2.2 Migrate Files vertical actions/error sizing and Calendar/DatePicker to one localized cell-geometry result *(verified 2026-07-26 12:58 UTC: all 18 focused Files cases, 44 focused Calendar/DatePicker/packaging cases, Files typecheck, all 178 Files cases, and UI typecheck pass; Calendar localization was split to preserve the enforced 500-line source limit)*
- [x] 2.2.3 Migrate Datagrid filter/value-list/personalization desired sizing, two-axis anchoring clamp, and complete-group action widths; finish catalog-call-site sweep *(verified 2026-07-26 13:02 UTC: five translated popup/personalization oracles and all 704 Datagrid cases pass; Datagrid typecheck and catalog/layout call-site sweep pass; reactive desired sizing now re-clamps between/distinct changes without altering custom-popup sizing)*
- [x] 2.3.1 Confirm Phase 2 specifications green, add infeasible/invalid/lifecycle implementation edges, run affected package checks and `yarn verify`, then complete reviewer/auditor quality loop *(verified 2026-07-26 13:46 UTC: UI 1,929, Forms 116, Files 181, and Datagrid 709 cases pass; `yarn plugin:check` and the 246.67-second authoritative `yarn verify` pass; independent review found no critical findings, and every major/minor finding plus the single re-review's residual Files/frame findings was fixed and recorded in `08-phase-2-quality-review.md`)*

**Deliverables**: Every translated framework surface migrated or explicitly certified cell-correct.

**Verify**: `yarn verify`

## Phase 3: Multilingual QA application and matrix

> **Phase baseline tree**: `a316c917344167160365daed56d8bfa4316cd597`
> **Expected modification set**: Examples registry/supervisor/stories/command and multilingual
> specification/implementation tests

**Reference**: 03-03 · AC-9 through AC-12 · AR-13 through AR-17

- [x] 3.1.1 `[spec-author]` Expand the existing multilingual layout oracle for five catalogs, all required story categories, 80×24, declared narrow boundaries, long overrides, Unicode, focus/hit bounds, and caller-data preservation *(completed 2026-07-26 13:54 UTC: the existing package oracle composes all five catalogs, and the new registry-driven matrix covers ten locales, declared narrow/infeasible bounds, five action arrangements, long/malformed overrides, Unicode, focus/hit geometry, and caller-byte preservation)*
- [x] 3.1.2 `[spec-author]` Add fresh-reconstruction and registry/command specifications proving identity, disposal, state allowlisting, fallback validation, and Code Editor integration *(completed 2026-07-26 13:54 UTC: immutable registry/lifecycle cases cover required metadata and surfaces, five-catalog identity, strict supervisor allowlisting, saved-ID fallback, fresh locale/story reconstruction, deterministic disposal, Code Editor coverage, and the interactive command)*
- [x] 3.1.3 Run focused Phase 3 specifications and record expected red failures before harness changes *(verified 2026-07-26 13:56 UTC: 37 focused cases ran; 11 existing five-catalog dialog cases pass and 26 fail only because the planned harness module and `demo:i18n` command do not yet exist; examples typecheck and diff validation pass)*
- [x] 3.2.1 Implement typed registry, five-catalog loader, headless story construction, and complete UI/Forms/Files/Datagrid/formatting/override/Unicode/Code Editor stories *(verified 2026-07-26 14:04 UTC: all 17 registry-driven layout cases pass across ten locales, narrow/infeasible bounds, overrides, Unicode, and action arrangements; examples typecheck passes)*
- [x] 3.2.2 Implement the serializable supervisor transition and deterministic modal/application teardown with fresh `I18n`, Application, registry, and story state *(verified 2026-07-26 14:04 UTC: all eight registry/reconstruction cases pass for strict state allowlisting, saved-ID fallback, fresh five-catalog/application/story identity, repeated transition disposal, and caller-byte preservation)*
- [x] 3.2.3 Add the interactive `demo:i18n` entry command and terminal-native locale/story selection shell *(verified 2026-07-26 14:05 UTC: `demo:i18n` is published with the established TS runner, the terminal status line exposes locale/story/quit commands, all 37 focused specifications and examples typecheck pass)*
- [x] 3.3.1 Confirm Phase 3 specifications green, add invalid selection/repeated transition implementation edges, run examples/package checks and `yarn verify`, then complete reviewer/auditor quality loop *(verified 2026-07-26 15:34 UTC: 46 focused multilingual cases, all 376 Examples cases, all 1,932 UI cases, package typechecks/docs, interactive 80×24 shell, plugin update/check, and the 248-second authoritative `yarn verify` pass; final reviewer and auditor report no unresolved critical or major findings, with all rulings recorded in `09-phase-3-quality-review.md`)*

**Deliverables**: Interactive multilingual kitchen sink and reusable headless registry/matrix.

**Verify**: `yarn verify`

## Phase 4: Documentation, plugin, and release closure

> **Phase baseline tree**: `dea40365ee31bbabf6cb99e1e73eccfdd5f2da76`
> **Expected modification set**: package/docs-site guidance/examples/API, canonical skill and impact
> mapping, generated plugin, traceability/plan evidence

**Reference**: 03-04 · AC-13, AC-14 · AR-19, AR-20

- [x] 4.1.1 `[spec-author]` Add documentation and canonical-skill specifications for the public API, localized examples, `demo:i18n`, viewport policy, and five-package composition ✅ (completed: 2026-07-26 15:46)
- [x] 4.1.2 Run focused Phase 4 specifications and record expected red failures before documentation changes ✅ (completed: 2026-07-26 15:47; 10 expected failures confirmed across 11 cases: four missing consumer guidance/example paths and six missing canonical/impact/generated paths, while the fixed-English exclusion guard passes)
- [x] 4.2.1 Document the Button-group API and multilingual QA workflow; migrate localized docs examples and refresh generated API pages — completed 2026-07-26 15:52 UTC; focused docs 5/5, docs-site typecheck 0 errors, docs-site unit 101/101, `yarn docs:api` 0 errors
- [x] 4.2.2 Update every impacted canonical skill reference/recipe and impact mapping, run `yarn plugin:update`, and inspect/include generated output — completed 2026-07-26 15:55 UTC; focused skill 6/6, plugin integrity PASS, examples typecheck 0 errors and unit 376/376
- [x] 4.3.1 Confirm focused docs/skill suites green; run locale generation/check, `yarn plugin:check`, and report the translation-review gate truthfully — completed 2026-07-26 15:56 UTC; focused docs/skill 11/11, 50 locale entry points updated and verified, plugin integrity PASS; review follow-up completed 2026-07-28 with disclosed AI-assisted evidence for all 45 package/locale pairs
- [x] 4.3.2 Run final `yarn verify`, synchronize traceability/plan evidence, complete reviewer/auditor quality loop, and close #184/#185 implementation acceptance without claiming excluded external attestations — completed 2026-07-26 16:11 UTC; review fixes accepted with no unresolved critical/major findings, focused 12/12, docs-site 102/102, plugin integrity PASS, final `yarn verify` PASS in 101.78 seconds

**Deliverables**: Supported SDK docs/plugin surface and verified release-ready implementation.

**Verify**: `yarn verify`

## Dependencies

```text
Phase 1 shared contract
    ↓
Phase 2 framework migrations
    ↓
Phase 3 QA registry consumes stable surfaces
    ↓
Phase 4 docs/plugin/release closure
```

## Success criteria

1. All 27 tasks are verified in specification-first order.
2. AC-1 through AC-14 pass without weakening existing immutable specifications.
3. Reviewer and auditor report no unresolved critical or major finding in any phase.
4. `yarn plugin:check` and `yarn verify` pass.
5. The unrelated `yarn.lock` modification remains unstaged and unchanged by this work.
