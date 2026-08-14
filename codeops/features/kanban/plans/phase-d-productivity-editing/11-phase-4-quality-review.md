# Phase 4 Quality Review

> **Phase baseline tree**: `9b1f2452cf2b10edb13c1e96def5089c315a2678`
> **Scope mode**: strict
> **Status**: PASS — accepted Major findings fixed and final fix-scoped re-review residuals verified; no finding waived

## Independent findings

| ID | Severity | Finding | Auto-design ruling | Status |
|---|---|---|---|---|
| SA4-001 / RV4-008 / RV4C-006 | Major | Provisional create claims share the persisted-card coordinator namespace. | Accept; split provisional and persisted claims into distinct maps while retaining one coordinator. | Fixed · verification passed |
| SA4-002 | Major | Throwing host mount/removal can bypass unsubscribe, control, session, and claim cleanup. | Accept; move all acquired resources under one failure-contained finalizer with independent cleanup steps. | Fixed · verification passed |
| SA4-003 / RV4C-002 | Major | Cancel/reload/close can race validation, dispatch, or publication wait and report cancellation while a mutation commits. | Accept; serialize terminal actions and keep cancellation inert during unacknowledged submission ownership. | Fixed · verification passed |
| SA4-004 | Major | A custom control created successfully is not disposed when later binding setup throws. | Accept; retain partial instance/subscription locals and release each independently on failure. | Fixed · verification passed |
| SA4-005 | Major | Editor translations and default confirmation are not failure-contained or bounded before measurement/presentation. | Accept; use one bounded terminal-safe message resolver and fail default confirmation closed. | Fixed · verification passed |
| RV4-001 | Major | The standard adapter rejects create input and can only produce update proposals. | Accept; add explicit typed standard-create defaults and placement while preserving edit correlation. | Fixed · verification passed |
| RV4-002 | Major | Standard assignee, label, and checklist fields mount empty placeholder groups. | Accept; implement context-bound visible collection controls and stable checklist mutation operations. | Fixed · verification passed |
| RV4-003 | Major | The default dialog does not visibly project validation, rejection, pending, stale, deleted, Reload, or Close states. | Accept; add one reactive lifecycle/status/action projection and seal controls/actions coherently. | Fixed · verification passed |
| RV4-004 | Major | Content width, action wrapping, and custom measurements retain construction-time geometry after resize. | Accept; move content/actions under live DSL measurement and provide horizontal reachability when needed. | Fixed · verification passed |
| RV4-005 | Major | Control echo synchronization overwrites correctable invalid input and can retain rejected sealed writes. | Accept; classify set outcomes, retain only correctable local invalid text, and restore authoritative state for sealed/read-only outcomes. | Fixed · verification passed |
| RV4-006 | Major | Result-only prepare invokes proposal construction, and detachment failure closes and loses the draft. | Accept; split validated-result preparation from proposal construction and retain the modal with safe feedback on detachment failure. | Fixed · verification passed |
| RV4-007 | Major | Field-row visibility and progressive section metadata are ignored by dialog composition. | Accept; bind complete row visibility/extent and implement the configured collapsible/tab progressive contract. | Fixed · verification passed |
| RV4C-001 | Major | Authority-backed create has no persisted-identity/publication correlation seam. | Accept; add an application-owned create publication resolver that maps the provisional claim to the created card, or make authority create unavailable until supplied. | Fixed · verification passed |
| RV4C-003 | Major | Unscoped global modal completion can close a nested confirmation rather than the editor. | Accept; bind completion to the exact editor modal and invalidate nested confirmation continuations after terminal state changes. | Fixed · verification passed |
| RV4C-004 | Major | Base `Dialog` replacement exits bypass package dirty/pending policy, and mutable modes expose unguarded Close. | Accept; install a package-owned exit guard over replacement dialogs and expose only mode-valid guarded actions. | Fixed · verification passed |
| RV4C-005 | Major | `already-open` exposes the owner session's destructive `dispose` capability. | Accept; return a borrowed non-disposable session facade to repeat callers while the opener retains the owned lease. | Fixed · verification passed |
| RV4C-007 | Major | Board editor microtasks and mounted dialogs are not tied to board disposal. | Accept; thread a board lifetime signal through activation and initial dialog acquisition and re-check it before mounting. | Fixed · verification passed |
| RV4C-008 | Major | View replacement and live i18n/theme presentation seams are absent from the public invoker API. | Accept; add mode-correct view replacement plus live presentation getters without weakening completion typing. | Fixed · verification passed |

## Remediation evidence

The accepted fixes add distinct create/card claim namespaces; non-owning repeat-session facades; exact-modal completion; correlated authority-backed create publication; standard create and collection controls; responsive progressive dialog composition; reactive lifecycle actions/status; terminal-safe localized text; board lifetime cancellation; and independent host, subscription, custom-control, and session cleanup.

Final focused verification passed 33 editor specification/implementation tests and the exact-modal UI
specification. The complete functional run passed 928 Kanban unit tests, 29 Kanban E2E tests with two
declared skips, and 2,059 UI unit tests; builds, typechecks, documentation checks, plugin integrity, and
`yarn verify:local` also passed. The calibrated Kanban performance specification passes alone; its
full-suite run remains unsuitable timing evidence on this contended workstation, matching the review-entry
calibration policy.

## Review evidence

The entry gate passed Kanban build/typecheck, 910 serial unit tests, 29 E2E tests with two declared
skips, dependency and documentation checks, 116 Forms tests, 2,058 UI tests, plugin integrity, and
`yarn verify:local`. The calibrated performance test passed independently and in the serialized full
suite; the default parallel runner was rejected as timing evidence after repeat workstation contention.

Correctness, security, and API/concurrency reviewers independently inspected the complete phase diff.
No Critical finding was reported. All Major findings above are necessary corrections inside the
confirmed Phase 4 editor/dialog/integration scope. Auto-design accepts every correction without waiver.
One fix-scoped re-review is required after remediation; no third review is permitted.

## Final fix-scoped re-review

The one permitted re-review closed 13 findings and identified five residual Major gaps: constructor-time
cleanup after a throwing custom measurement, visible field validation, authoritative rebase after retained
invalid text, visible result-detachment failure, and mode-correct replacement actions/title-bar handling.
All five were fixed without expanding scope. Regression coverage now proves independent measurement cleanup,
visible safe validation and detachment feedback, forced authoritative rebase, exact create/edit/view action
sets, and close-box-only mouse interception. Per policy, no third review was run.

## Auto-design provenance

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal lifecycle, API-shape, validation, responsive composition, concurrency,
  cleanup, and security corrections required to satisfy already approved Phase 4 behavior.
- **Objective:** Make the generic and standard editor surfaces complete, responsive, bounded, and
  single-authority while preserving application-owned records, persistence, modal hosting, and docking.
- **Rejected alternatives:** Waiving findings is prohibited; deferring them would falsely complete the
  phase; moving editor state into the viewport breaks the approved read-only projection boundary.
- **Strongest counterargument:** The remediation is materially larger than the initial implementation.
  The independent reviews demonstrate that smaller patches would leave advertised mainstream workflows
  absent or retain known mutation/resource races.
- **Confidence:** High for the accepted direction; each correction receives focused regression coverage
  and the complete phase gate before the one allowed re-review.
- **Hardening:** Three independent lenses converged on the ownership and lifecycle failures, with exact
  duplication on provisional claims and pending cancellation.
- **Policy version:** 1.
- **Root invocation ID:** `EP-PHASE-D-20260814T1443CEST`.
- **Reopen triggers:** A correction requires new product behavior, application data ownership, or files
  outside the approved Phase 4 prerequisite surface.
