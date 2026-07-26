# Execution plan: translated layout and multilingual QA

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-26 11:31 UTC
> **Progress**: 0/27 tasks (0%)
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

- [ ] 1.1.1 `[spec-author]` Write immutable public metric/composition specifications for empty, minimum, widest, accelerator, Unicode, horizontal, wrapped, vertical, and hard-bound cases — `packages/ui/test/button-group.spec.test.ts`
- [ ] 1.1.2 Extend Datagrid compatibility specifications for historical cell width, row minimum, gap, equal cells, and multi-row reuse — `packages/datagrid/test/aux-composition.spec.test.ts`
- [ ] 1.1.3 Run focused Phase 1 specifications and record expected red failures before production changes
- [ ] 1.2.1 Implement and export documented pure Button-group metrics and horizontal/wrapped/vertical composition in UI
- [ ] 1.2.2 Delegate Datagrid helpers to the UI contract without changing historical behavior; add invalid-option and ownership implementation coverage
- [ ] 1.3.1 Confirm Phase 1 specifications green, run UI/Datagrid package checks and `yarn verify`, then complete reviewer/auditor quality loop

**Deliverables**: Public cell-correct geometry, stable composition, compatible Datagrid delegates.

**Verify**: `yarn verify`

## Phase 2: Complete translated-surface migration

> **Phase baseline tree**: Phase 1 verified commit plus unrelated `yarn.lock`
> **Expected modification set**: UI dialogs/editor/date/dropdown surfaces, Forms, Files, Datagrid,
> and their specification/implementation tests

**Reference**: 03-02 · AC-5 through AC-8 · AR-8 through AR-12, AR-17, AR-18

- [ ] 2.1.1 `[spec-author]` Write UI dialog/surface and Forms requirements specifications covering intrinsic cells, requested minima, wrapping, focus, hit bounds, and English compatibility
- [ ] 2.1.2 `[spec-author]` Write Files vertical-action/error-dialog and Calendar/DatePicker localized geometry specifications for all locales and Unicode overrides
- [ ] 2.1.3 `[spec-author]` Write Datagrid filter/value-list/personalization desired-size, clamp, reflow, group-width, header, and right-edge specifications
- [ ] 2.1.4 Run focused Phase 2 specifications and record expected red failures before production changes
- [ ] 2.2.1 Migrate UI dialogs/editor surfaces and Forms to shared metrics, display-cell body sizing, intrinsic expansion, and stable component-owned wrapping
- [ ] 2.2.2 Migrate Files vertical actions/error sizing and Calendar/DatePicker to one localized cell-geometry result
- [ ] 2.2.3 Migrate Datagrid filter/value-list/personalization desired sizing, two-axis anchoring clamp, and complete-group action widths; finish catalog-call-site sweep
- [ ] 2.3.1 Confirm Phase 2 specifications green, add infeasible/invalid/lifecycle implementation edges, run affected package checks and `yarn verify`, then complete reviewer/auditor quality loop

**Deliverables**: Every translated framework surface migrated or explicitly certified cell-correct.

**Verify**: `yarn verify`

## Phase 3: Multilingual QA application and matrix

> **Phase baseline tree**: Phase 2 verified commit plus unrelated `yarn.lock`
> **Expected modification set**: Examples registry/supervisor/stories/command and multilingual
> specification/implementation tests

**Reference**: 03-03 · AC-9 through AC-12 · AR-13 through AR-17

- [ ] 3.1.1 `[spec-author]` Expand the existing multilingual layout oracle for five catalogs, all required story categories, 80×24, declared narrow boundaries, long overrides, Unicode, focus/hit bounds, and caller-data preservation
- [ ] 3.1.2 `[spec-author]` Add fresh-reconstruction and registry/command specifications proving identity, disposal, state allowlisting, fallback validation, and Code Editor integration
- [ ] 3.1.3 Run focused Phase 3 specifications and record expected red failures before harness changes
- [ ] 3.2.1 Implement typed registry, five-catalog loader, headless story construction, and complete UI/Forms/Files/Datagrid/formatting/override/Unicode/Code Editor stories
- [ ] 3.2.2 Implement the serializable supervisor transition and deterministic modal/application teardown with fresh `I18n`, Application, registry, and story state
- [ ] 3.2.3 Add the interactive `demo:i18n` entry command and terminal-native locale/story selection shell
- [ ] 3.3.1 Confirm Phase 3 specifications green, add invalid selection/repeated transition implementation edges, run examples/package checks and `yarn verify`, then complete reviewer/auditor quality loop

**Deliverables**: Interactive multilingual kitchen sink and reusable headless registry/matrix.

**Verify**: `yarn verify`

## Phase 4: Documentation, plugin, and release closure

> **Phase baseline tree**: Phase 3 verified commit plus unrelated `yarn.lock`
> **Expected modification set**: package/docs-site guidance/examples/API, canonical skill and impact
> mapping, generated plugin, traceability/plan evidence

**Reference**: 03-04 · AC-13, AC-14 · AR-19, AR-20

- [ ] 4.1.1 `[spec-author]` Add documentation and canonical-skill specifications for the public API, localized examples, `demo:i18n`, viewport policy, and five-package composition
- [ ] 4.1.2 Run focused Phase 4 specifications and record expected red failures before documentation changes
- [ ] 4.2.1 Document the Button-group API and multilingual QA workflow; migrate localized docs examples and refresh generated API pages
- [ ] 4.2.2 Update every impacted canonical skill reference/recipe and impact mapping, run `yarn plugin:update`, and inspect/include generated output
- [ ] 4.3.1 Confirm focused docs/skill suites green; run locale generation/check, `yarn plugin:check`, and report the external proficient-review gate truthfully
- [ ] 4.3.2 Run final `yarn verify`, synchronize traceability/plan evidence, complete reviewer/auditor quality loop, and close #184/#185 implementation acceptance without claiming excluded external attestations

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
