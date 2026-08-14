# Phase 5 quality review: board configuration

> **Baseline:** `39e5c755b3321251ccc758f1c96c96620eaafc6a`
> **Reviewed head:** `eb9cccd03`
> **Status:** PASS
> **Reviewed:** 2026-08-14 23:26 CEST

## Gate result

Three independent reviews covered API/concurrency, UX/correctness, and security. They found no
Critical issue. The findings below are all Major. The user's standing `--auto-design` authority
accepts correction of every in-scope finding; no risk is waived.

| ID | Consolidated finding | Decision | Status |
|---|---|---|---|
| P5-Q01 | Authority acceptance can close before a matching authoritative publication | Correlate acceptance to exact revision evidence and keep the session open until publication | Corrected |
| P5-Q02 | Apply, reload, and draft mutation can race or dispatch twice | Serialize transitions, seal pending state, and cancel superseded work | Corrected |
| P5-Q03 | Dispatch omits immutable board/entity revision and cancellation context | Pass a detached authority context with base revisions and an abort signal | Corrected |
| P5-Q04 | Dirty close is optional and frame-close bypasses confirmation | Supply package default confirmation and guard every close route | Corrected |
| P5-Q05 | Column `between` positions do not prove exact adjacency and boundaries | Validate the resulting order after removing the moving identity | Corrected |
| P5-Q06 | Structural snapshots do not enforce normalized name/disambiguator uniqueness | Enforce one collision key per visible label/disambiguator pair | Corrected |
| P5-Q07 | Configuration dialogs omit operation-specific fields and useful diagnostics | Render operation-specific controls and retain bounded field/form diagnostics | Corrected |
| P5-Q08 | Delete UI hides eligibility, occupancy, and destination context | Present those facts and disable Apply with an explicit reason | Corrected |
| P5-Q09 | Reorder interaction uses a synthetic end action instead of real stable neighbors | Provide selectable start/end/neighbor destinations with keyboard and pointer parity | Corrected |
| P5-Q10 | Focus reconciliation is column-only and accepts unbounded hostile arrays | Add exact bounded column/swimlane reconciliation and integrate publication focus | Corrected |
| P5-Q11 | Session/source/authority work has no caller lifetime signal and can remain pending | Thread cancellation through resolve/request/dialog and settle disposal deterministically | Corrected |
| P5-Q12 | Delete policy and operation input retain mutable caller-owned values | Snapshot the selected operation and policy once before evaluation and dispatch | Corrected |
| P5-Q13 | Initial-resolution cleanup can throw and leak application error text | Isolate cleanup and expose only fixed package failures | Corrected |
| P5-Q14 | Command/header configuration activation is not yet connected | Retain the explicit Phase 6 deferral from task 5.1.3; verify there with the unified router | Deferred |

## Closure protocol

After remediation, run focused configuration/security/E2E tests, affected package checks,
`yarn plugin:update`, `yarn plugin:check`, and `yarn verify:local`. Then perform the single permitted
fix-scoped independent re-review against this table. The phase passes only when every non-deferred
finding is closed without a waiver.

## Fix-scoped re-review

The single permitted re-review found no Critical issue and five residual Major clusters. All were
corrected under the standing `--auto-design` authority; none was waived.

| Residual | Correction | Evidence |
|---|---|---|
| Accepted work could be cancelled while awaiting publication | Disable Cancel/Esc/frame close and every draft input until publication commits or contradicts | Rendered awaiting-publication test keeps the modal mounted and all inputs disabled |
| Committed sessions could mutate, reload, or dispatch again | Make commit terminal across publication, mutation, reload, and apply paths | Reentrant/direct post-commit assertions retain one authority call after a later publication |
| Pre-mount abort or nested confirmation could strand the modal | Retry exact terminal completion and use an abortable package confirmation plus signal-raced replacement callbacks | Nested-confirmation E2E aborts and removes both modal frames with a `disposed` result |
| Presentation reused mutable caller-owned operation input | Expose and consume the session's detached operation snapshot | Policy mutation test preserves the original frozen operation and proposal |
| Operation-specific fields and clear semantics were incomplete | Add typed WIP/style drafts, preserve application metadata baselines, retain diagnostics, and encode optional removal as `null` | Focused policy/edit test verifies WIP/style/data baselines and exact clear patch |

Width, visibility, collapse, grouping selection, and presentation remain view-only saved-view state
under the Phase 5 confirmed scope baseline and AR-D41. Moving those facets into a structural request
would create a second authority; their standard entry points remain in the completed RD-09 layer.

## Remediation evidence

- Configuration authority now receives detached board/entity/neighbor revisions and a live abort
  signal. One serialized session transitions through dispatch, awaiting publication, commit, stale,
  rejection, reload, and disposal.
- Matching accepted publication evidence is mandatory. Dialogs remain open while awaiting it and
  close only after the source publishes the expected structural revision.
- Builders enforce exact envelopes, normalized name/disambiguator uniqueness, current-neighbor
  adjacency, and custom deletion destinations against the current snapshot.
- Dialogs expose operation-specific name, qualifier, WIP, definition-of-done, semantic-style, application-data, reorder,
  occupancy, policy, and reassignment controls. Stable destinations are exercised through real
  keyboard and pointer hit-testing.
- Column and swimlane focus reconciliation use exact bounded envelopes and publish a stable focus
  target only after authoritative deletion commit.
- Focused configuration/security/implementation tests pass 33/33; configuration E2E passes 7/7.
  The package functional matrix passes 961 behavior tests with only its timing case exceeding budget
  under the 118-file worker load; that benchmark passes in its required isolated run. Kanban E2E
  passes 36 with 2 intentional skips. Package build/typecheck/docs/dependency checks and plugin
  integrity pass. `yarn verify:local` passes.
