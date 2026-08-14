# Phase 6 quality review: actions and capabilities

> **Baseline:** `5b138c4b3`
> **Reviewed head:** `ae95e2676`
> **Status:** PASSED AFTER REMEDIATION
> **Reviewed:** 2026-08-15 02:20 CEST

## Gate result

Independent correctness/API and security audits found no Critical issue. The user's standing
`--auto-design` authority accepts every in-scope correction below; no risk is waived. Board-wide
composition, complete locale overlays, and mounted responsive evidence remain in their already named
Phase 8 integration tasks rather than being duplicated in the headless command phase.

| ID | Consolidated Major finding | Decision | Status |
|---|---|---|---|
| P6-Q01 | The headless router is not yet owned by `KanbanBoard`, so real input, editor/configuration, move authority, and read-only hit targets do not use it | Keep the headless action layer in Phase 6; correct task wording and require real board binding plus mounted parity/read-only evidence in Phase 8 tasks 8.1.1, 8.1.2, and 8.2.1 | Deferred to Phase 8 |
| P6-Q02 | Browser `pointermove` rejects the standards-conforming `button: -1` value | Validate button by event kind, retain/derive the Core button value, and add Meta/drag/hover/capture/dedupe coverage | Closed |
| P6-Q03 | Keymaps do not reject host-reserved routes or support exact removal when remapping an unavailable default | Add a bounded host-unavailable chord seam, construction-time atomic remap, structured rejection, and exact runtime unbind/rebind | Closed |
| P6-Q04 | Target applicability, selection target shape, board identity, and query revision context are not enforced | Add bounded board/query evidence, selection scope, exact applicability validation, and least-authority capability metadata | Closed |
| P6-Q05 | DOM dedupe can suppress a future unrelated same-cell event and disposal does not release active captures | Expire dedupe after the originating DOM turn, consume mismatches safely, and release every active capture on disposal | Closed |
| P6-Q06 | Action catalogs and mounted 80×24/narrow reachability are absent while Phase 6 wording claims localized/mounted completion | Correct Phase 6 wording and README boundary; require complete English/all-locale action catalogs and mounted reachability in Phase 8 tasks 8.1.2, 8.2.2, and 8.2.3 | Deferred to Phase 8 |

## Closure protocol

Implement P6-Q02–Q05 with specification-preserving regression coverage, synchronize public docs and
plugin output, and rerun the focused Core/Web/Kanban plus package gates. Then perform the single
permitted fix-scoped independent re-review. Phase 7 may start only after every accepted finding is
closed and both deferrals are traceable to Phase 8 without a false current capability claim.

## Remediation evidence

| Finding | Implemented evidence | Verification |
|---|---|---|
| P6-Q02 | Web accepts real `pointermove` `button: -1`, retains or derives the Core drag/no-button value and modifiers, and deduplicates matching SGR drag and hover | Web DOM pointer specification and implementation suites |
| P6-Q03 | Bounded host-unavailable chords fail with redacted route evidence; initial and runtime atomic replacements support exact unbind/rebind while preserving the prior snapshot on mismatch | Kanban action-keymap specification suite |
| P6-Q04 | Invocations carry validated board/query evidence, selection is an explicit target, declared applicability fails before policy, and capability metadata excludes handlers | Kanban action/router and security suites |
| P6-Q05 | DOM dedupe expires after its originating event turn, mismatches consume stale state, and disposal releases every active pointer capture | Web DOM pointer specification and implementation suites |

Package evidence: Web build/typecheck/docs/dependencies, 15 files and 59 unit tests; Kanban
build/typecheck/docs/dependencies, 122 functional files and 987 tests, isolated performance oracle,
and 8 E2E files with 37 passing and 2 intentional skips. Generated plugin API references,
`yarn plugin:check`, and `yarn verify:local` pass.

The single fix-scoped re-review found construction-time unavailable-default remapping, hostile chord
bounds, Core no-button hover parity, and regenerated Web plugin references still incomplete. Every
finding was accepted and corrected under `--auto-design`; no waiver was used. The final security/API
audit reports no remaining Critical or Major issue. Gate closed 2026-08-15 01:41 CEST.
