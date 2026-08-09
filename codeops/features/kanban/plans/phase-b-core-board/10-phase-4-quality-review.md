# Phase 4 Quality Review

> **Phase baseline**: `54ffd6bc61a1d6be7f6dbaddc4c6ab6b13e420d5`
> **Scope mode**: strict
> **Status**: PASS — all critical/major findings remediated and verified

## Independent findings

| ID | Severity | Finding | Auto-design ruling | Status |
|---|---|---|---|---|
| RV-010 | Major | Missing-card focus was published before acquisition, and supersession could leave pending state behind. | Retain current focus; make the pending marker generation-owned; clear it on stale, failed, unavailable, or superseded settlement. | Resolved; re-review confirmed |
| RV-011 | Major | Cursor-unload reconciliation returned `acquire` without starting bounded acquisition. | Route both absent programmatic focus and unload reconciliation through one acquisition path that confirms current visible evidence before moving focus. | Resolved; mounted regression verified |
| RV-012 | Major | Mounted boards did not automatically reconcile query, structure, source, deletion, and responsive geometry changes. | Notify only after a stable draw; classify policy, source, deletion, and assigned-geometry evidence independently; never consume a new source snapshot against an old projection. | Resolved after re-review; regression verified |
| RV-013 | Major | Navigation evidence made hidden headers and cursor-resident offscreen cards actionable. | Derive enabled targets only from clipped projection; retain hidden responsive headers solely as disabled reveal evidence and reveal them before publication. | Resolved after re-review; regression verified |
| RV-014 | Major | Retained reconciliation incremented semantic revisions and invalidated on no-op. | Compare focus and complete selection state before publication and return the exact prior snapshot when unchanged. | Resolved; re-review confirmed |
| RV-015 | Major | Injected controller `changed`/`unchanged` discriminators were not checked against their snapshots. | Validate `unchanged` against the pre-transition snapshot and require `changed` to advance revision with a semantic state change. | Resolved; re-review confirmed |
| RV-016 | Major | Stable facade reads repeatedly detached and serialized large immutable selection snapshots. | Cache only frozen raw snapshot identities and use allocation-free bounded field comparison for new publications. | Resolved; re-review confirmed |
| SA-005 | Major | Deletion pruning removed all currently unloaded selection instead of exact authoritative deletions. | Carry exact deleted card, column, and swimlane identities and prune only matching stored selection entries. | Resolved; re-review confirmed |
| SA-006 | Major | Revision-changed focused-column completion could move focus, while stale focus acquisition could leave pending state. | Recheck pending identity and captured revisions after every refresh yield and immediately before publication. | Resolved after re-review; regression verified |
| SA-009 | Major | Query/visibility pruning treated every card outside the clipped projection as hidden. | Prune only selected keys that were previously visible and are now proven absent; preserve already-offscreen or unloaded membership. | Resolved after re-review; regression verified |
| SA-007 | Minor | Standalone viewport bindings accept regressive or equal-conflicting revisions. | Report only under strict scope. | Open (report-only) |
| SA-008 | Minor | Public transition objects are not runtime-snapshotted as a closed union. | Report only under strict scope. | Open (report-only) |
| RV-017 | Minor | The controller module exceeds the preferred file size and one transient comment uses phase terminology. | Report only under strict scope. | Open (report-only) |

## Auto-design decision record

- **Authority:** AI — delegated by `--auto-design`.
- **Eligibility:** Internal lifecycle, evidence classification, cancellation, validation, and performance
  mechanisms within the confirmed Phase 4 behavior; no product behavior or scope changed.
- **Objective:** Preserve visible-only interaction, exact deletion authority, immutable semantic
  revisions, and late-result safety while keeping the stable public facade responsive at configured
  selection limits.
- **Rejected alternatives:** Application-driven reconciliation remained incomplete and duplicated
  board internals; pruning all non-visible keys conflated deletion with virtualization; accepting
  disabled targets as actionable recreated hidden focus; serializing snapshots retained avoidable
  render-path allocation.
- **Strongest counterargument:** Automatic reconciliation adds another board-to-viewport lifecycle
  connection. The listener is therefore internal, non-owning, idempotently cleared, and guarded by
  bounded evidence equality.
- **Confidence:** High; both independent reviews converged on the core lifecycle failures and the
  correction is covered at controller, facade, mounted board, and viewport boundaries.
- **Hardening:** Correctness and selection-safety reviewers independently converged. The single
  permitted fix-diff re-review reopened RV-012, RV-013, and SA-006 and added SA-009; all four were
  corrected and verified. The quality profile forbids a third review pass.
- **Policy version:** 1.
- **Root invocation ID:** `exec-kanban-phase-b-20260809`.
- **Reopen triggers:** Interaction targets cease to derive from clipped projection, a new reconcile
  reason changes prune authority, controller snapshots become mutable by contract, or acquisition
  gains more than one active generation.

## Fix-diff re-review

The single permitted fix-diff re-review completed with zero critical and four distinct major findings:
RV-012, RV-013, and SA-006 remained incomplete, and SA-009 identified clipped-scene pruning as unsafe.
The final remediation separates stable draw evidence from intermediate refreshes, distinguishes source
and application structure changes, reveals disabled responsive headers, performs post-yield ownership
checks, preserves unloaded selection, coordinates source relocation with focused anchors, and lets
explicit scrolling supersede pending automatic acquisition without altering selection.

## Verification evidence

- Package build and typecheck pass.
- Unit project: 52 files, 459 assertions passed.
- E2E project: 1 file, 9 assertions passed.
- Package dependency and JSDoc checks pass.
- `yarn verify:local` passes after formatting 18 changed files.
- `yarn plugin:update` refreshed mapped API/impact artifacts and `yarn plugin:check` passes.
- Focused regression coverage passes for controller, reconciliation, navigation, selection, mounted
  board lifecycle, specification boundaries, and viewport actionability.
