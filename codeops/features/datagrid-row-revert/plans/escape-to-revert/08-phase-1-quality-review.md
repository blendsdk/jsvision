# Phase 1 quality review

> **Scope**: Phase 1 Data Grid row-recovery diff from baseline tree
> `d639765bf9dd0c6abb837670a40c5eabcb5eb573`
>
> **Profile**: Strict defaults — independent correctness and concurrency/security review
>
> **Status**: PASS — every accepted major finding and the one-time re-review rejection are corrected

## Findings and rulings

| Finding | Severity | Ruling | Resolution |
|---|---|---|---|
| RV-001 / SA-001 | Major | Accepted by auto-design | Resolve windowed settlement identity from the exact focused row without whole-array operations or source scans; add real windowed accept/veto coverage with bounded source access |
| RV-002 | Major | Accepted by auto-design | Publish optimistic apply and live compensation as atomic display/cursor stages, re-anchoring eager client-sorted grids by the captured row key while preserving stale-focus invalidation |
| SA-002 | Major | Accepted by auto-design | Treat focus in any current left, center, or right body panel as body focus and refresh the panel set after body rebuilds |
| SA-003 | Major | Accepted by auto-design | Guard every grid-owned header, funnel, quick-filter, selection-header, resize, auto-fit, and reorder sink while a row revert is pending |

No reviewer reported a critical or minor finding. Major findings were not waived or dismissed.

## Auto-design decision

**Authority:** AI — delegated by `--auto-design`.

**Eligibility:** Internal identity, reactive ordering, focus ownership, and input-serialization
mechanisms inside the confirmed row-revert behavior; no product behavior, public compatibility, or
scope change.

**Objective:** Preserve the exact captured row and its focus while a rollback settles, including
windowed and frozen layouts, and serialize every grid-owned input until settlement completes.

**Decision:** Use an exact focused-row resolver on windowed sources; replace the transaction's raw
version bump with a publication hook that may atomically re-anchor a live eager row by key; retain all
current body panels for focus ownership; and centralize the pending predicate at every container-owned
input sink.

**Evidence:** Windowed display proxies deliberately reject `.find()` and whole-array traversal;
client sort derives synchronously from the version signal; frozen bodies expose every panel from
`buildGridBody`; and header/quick-filter sinks currently bypass the body-level pending guard.

**Rejected alternatives:** Scanning a windowed source violates its bounded access contract. Re-anchoring
after an unsuppressed version write is too late because reactive reconciliation has already invalidated
the session. Treating only the center panel as body focus contradicts the existing shared frozen-panel
cursor. Guarding individual view classes duplicates transaction knowledge and leaves future container
sinks inconsistent.

**Strongest counterargument:** A more general interaction lock object could centralize serialization
across every view. It adds a new abstraction and broader modification set without improving this
single pending predicate, so direct container guards are the safer proportional correction.

**Confidence:** High — reopen if windowed sources gain a key lookup seam, row-revert mutation becomes
structural, or grid-owned actions are moved outside the container dependency bridge.

**Hardening:** Independent correctness and concurrency/security reviewers found the same windowed
failure and complementary focus/input failures; their evidence was reconciled into the four corrections
above.

**Policy version:** 1.

**Root invocation ID:** `exec-datagrid-row-revert-20260804`.

**Reopen triggers:** A correction still performs a whole-array windowed operation, a sort-controlled
revert loses the captured key, a frozen-side attempt settles stale, or any grid-owned action mutates
state while the callback is pending.

## One-time fix re-review

The permitted fix re-review closed RV-001/SA-001, RV-002, and SA-002. It rejected the initial SA-003
closeout because the quick-filter callback guard prevented the model update only after the grid-owned
`Input` signal had already changed, leaving visible text that did not correspond to an active filter.

| Finding | Severity | Ruling | Resolution |
|---|---|---|---|
| RV-003 / SA-003 | Major | Accepted by auto-design | Restore each blocked quick-filter signal to its last accepted text before it can diverge from the filter model; cover accepted and vetoed settlement |

The correction passed focused and full verification. In accordance with the quality policy, no third
review was dispatched after the one-time fix re-review.

## Verification evidence

- Regression oracles failed in the intended windowed, client-sort, frozen-panel, and non-body input
  paths; the windowed failure also produced two unhandled rejections before correction.
- Focused correction matrix: 138/138 tests passed.
- Full Data Grid suite before re-review: 766/766 tests passed across 115 files.
- Data Grid typecheck and JSDoc checks passed.
- Locale completeness and all 45 digest-bound translation reviews passed.
- Repository `yarn verify:local` passed after the package gates.
- Re-review correction oracle observed both accepted and vetoed quick-filter text failures red, then
  passed 29/29 focused tests with typecheck.
- Final Data Grid suite: 767/767 tests passed across 115 files.
- Final Data Grid typecheck, JSDoc, locale completeness, 45 translation reviews, and
  `yarn verify:local` passed.
