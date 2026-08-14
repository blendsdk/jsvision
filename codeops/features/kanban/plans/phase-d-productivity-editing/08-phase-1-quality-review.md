# Phase 1 Quality Review

> **Phase baseline tree**: `255ab1bfbc757111cedfe9b7c902e36a64994bf1`
> **Scope mode**: strict
> **Status**: RE-REVIEW COMPLETE — all Major findings corrected and verified; zero Critical findings

## Independent findings

| ID | Severity | Finding | Auto-design ruling | Status |
|---|---|---|---|---|
| RV-001 / SA-001 / PE-004 | Major | Quick-filter selections are retained in controller state but bypass registry validation and never enter the source query. | Accept; map each registry entry declaratively to one ordinary source-owned field/operator filter after bounded parameter validation. | Fixed; focused verification green |
| RV-002 / PE-005 | Major | Controller-owned card-field and checklist presentation facets do not affect the rendered board, and binding drops the legacy presentation budget. | Accept; compose controller presentation with the legacy budget and record-dependent selection without dropping visual state. | Fixed; focused verification green |
| RV-006 | Major | RD-09 requires ordered summary presentation, but `KanbanViewPresentation` omits summary identities entirely. | Accept as a necessary scope correction; add bounded ordered summary IDs to state, transitions, binding, tests, and later saved-view encoding. | Fixed; focused verification green |
| RV-003 | Major | A sorted query does not disable within-cell manual card order through drag and programmatic move routes. | Accept; compose committed query ordering into package eligibility before application policy. | Fixed; focused verification green |
| RV-004 / PE-006 | Major | Controller width preferences expand application minimum/maximum constraints instead of clamping within them. | Accept; preserve policy limits and clamp only the effective preferred width. | Fixed; focused verification green |
| PE-001 | Major | Candidate preparation refreshes once, but reactive activation performs a second fallible source refresh. | Accept; consume the prepared snapshot exactly once during the activation effect and verify generation/revision evidence. | Fixed; focused verification green |
| PE-002 | Major | External subscriber delivery permits recursively nested transitions without a bound. | Accept; keep the transition guard active through subscriber delivery and reject nested application with the typed active-transition result. | Fixed; focused verification green |
| PE-003 | Major | Committed subscribers can observe the new state/query with summary evidence from the previous query. | Accept; stage and commit source-count summary evidence before external delivery, then refresh visible/selected evidence after draw without mixing revisions. | Fixed; focused verification green |
| SA-002 | Minor | The public transition envelope reads caller properties directly and accepts unknown members. | Report only under the strict quality policy. | Open (report-only) |
| RV-005 | Minor | Clear Filters updates the search draft before checking whether the committed transition succeeded. | Report only under the strict quality policy. | Open (report-only) |

## Review evidence

The pre-review gate passed 24 Phase 1 specification and implementation tests, Kanban typecheck,
Kanban documentation checks, plugin parity, and `yarn verify:local`. The phase reviewer, security
auditor, and performance/concurrency/API auditor reviewed the complete baseline-tree diff independently.
Three reviewers independently confirmed the quick-filter gap; two independently confirmed the card-
presentation and width-clamping gaps. Primary consolidation also found the required summary-ID facet
missing from the public model; it remains inside RD-09 and the Phase 1 expected modification set.

The accepted Major corrections require the one permitted fix-scoped re-review before Phase 2 may start.

## Remediation verification

The correction suite passes the Phase 1 specification/security set plus the new projection and
transaction implementation tests, Kanban typecheck, documentation checks, plugin synchronization,
and plugin parity. `yarn verify:local` is rerun after formatting immediately before the guarded commit.

## Fix-scoped re-review

The one permitted fix-scoped re-review inspected exact commit `aab0c836e` against parent
`1d0180817`. The performance/concurrency/API reviewer reported clear. The correctness and security
reviewers reported three additional Major findings; auto-design accepted all three without waiver.

| ID | Severity | Finding | Auto-design ruling | Status |
|---|---|---|---|---|
| FR-001 | Major | Query derivation and candidate preparation invoked application callbacks before the transition reentrancy guard became active. | Extend the guard across derivation, preparation, activation, and delivery; abort if a callback disposes the controller. | Fixed; hostile applicability, participant, source-evaluator, and disposal tests green |
| FR-002 | Major | Application eligibility could change the committed sort after package ordering validation and still return an allowed move. | Snapshot the query before and after the callback; fail unavailable on any change and reapply package ordering afterward. | Fixed; TOCTOU specification green |
| FR-003 | Major | Candidate source geometry used the prior rich-card presentation because prospective presentation was not passed through the bridge. | Compose prospective presentation before prepare, stage with it, and verify its revision during reactive consumption. | Fixed; prospective-presentation implementation test green |

The corrected suite passes the complete Phase 1 focused specification/security/implementation set and
Kanban typecheck. No second fix-scoped re-review is permitted; deterministic package, docs, plugin, and
changed-file gates provide the final correction evidence.
