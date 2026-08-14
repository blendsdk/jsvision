# Phase 2 Quality Review

> **Phase baseline tree**: `0a0571f0a3c6a066040cd3a7368e149ea5434232`
> **Scope mode**: strict
> **Status**: RE-REVIEW COMPLETE — all Major findings corrected and verified; zero Critical findings

## Independent findings

| ID | Severity | Finding | Auto-design ruling | Status |
|---|---|---|---|---|
| RV2-001 | Major | Preserve capture could restore old structure order, lose unavailable presentation IDs, and invalidate directive provenance as a whole facet. | Accept; merge every directive by stable identity, keep current available order, and retain only genuinely unavailable raw identities and raw geometry. | Fixed; provenance and reorder specifications green |
| RV2-002 | Major | Reconciliation could accept a quick filter whose applicability or parameter codec could not produce the active query. | Accept; contain and validate the same current registry callbacks during reconciliation while leaving the single transformation at query derivation. | Fixed; applicability, codec-failure, and transforming-codec specifications green |
| RV2-003 | Major | More than 256 optional missing references converted an otherwise valid reconciliation into a fatal result. | Accept; truncate the deterministic diagnostic result while continuing optional drops. | Fixed; aggregate-drop specification green |
| SA2-001 | Major | A forged reconciled artifact could throw while reading provenance after the controller had already mutated. | Accept; detach and cross-check exact raw/resolved provenance before controller replacement. | Fixed; hostile-accessor atomicity specification green |
| SA2-002 / PF2-003 | Major | Independently bounded nested registry lists permitted more than two million identities despite the documented 1,024-identity ceiling. | Accept; consume one shared counter across fields, operators, comparators, card fields, summaries, and grouping variants. | Fixed; cumulative-budget security specification green |
| SA2-003 | Major | Persisted legacy JSON text could not use migration without application-owned `JSON.parse`, bypassing the package byte guard. | Accept; share the bounded text/object detachment boundary between current parsing and migration. | Fixed; persisted-text migration specification green |
| PF2-001 | Major | Oversized saved-view text reached `TextEncoder` before a cheap code-unit length rejection. | Accept; reject impossible oversized text before UTF-8 allocation, then retain the exact encoded-byte check. | Fixed; bounded input path verified |
| PF2-002 | Major | Semantic arrays and records copied all descriptors, and records sorted all keys, before enforcing container limits. | Accept; reject array length before key enumeration and reject record key count/size before sorting or bounded per-key descriptor reads. | Fixed; hostile proxy allocation test green |

## Review evidence

The entry gate passed the saved-view specification, security, property, migration, and store suites;
Kanban build/typecheck/dependency/documentation checks; plugin synchronization/parity; and
`yarn verify:local`. The complete functional package run passed 843 tests; its timing benchmark was
separately green on an uncontended host. Correctness/API, security, and performance/resource reviewers
then inspected the complete committed baseline diff independently. The security and performance
reviewers independently identified the cumulative registry-budget amplification.

Auto-design accepted every Major as a bounded technical correction. No behavior was waived and no
optional scope was added.

## Remediation verification

The correction suite adds provenance/order, quick-filter, diagnostic truncation, atomic apply,
cumulative identity, persisted-text migration, and hostile-container allocation evidence. The focused
contract/saved-view/security set passes 83 tests. Kanban build/typecheck/dependency/documentation checks,
plugin synchronization/parity, and `yarn verify:local` pass after the correction.

## Fix-scoped re-review

The one permitted fix-scoped re-review inspected the exact remediation worktree. The performance/resource
reviewer reported clear. The correctness and security reviewers found three remaining Major edge cases;
auto-design accepted all three without waiver.

| ID | Severity | Finding | Auto-design ruling | Status |
|---|---|---|---|---|
| FR2-001 | Major | Raw structure entries that were present in the resolved baseline were resurrected after a deliberate current removal. | Append an absent raw structure only when it was also absent from the resolved baseline. | Fixed; deliberate-removal specification green |
| FR2-002 | Major | A manually reintroduced formerly-missing directive could be emitted beside its stale raw predecessor. | Suppress raw-only entries whose stable identity is present in current state, regardless of value equality. | Fixed; reintroduction specification green |
| FR2-003 | Major | Reconciliation stored transformed quick-filter codec output that controller query derivation transformed a second time. | Validate and discard codec output during reconciliation; retain the parsed parameter for the established single query transformation. | Fixed; transforming-codec specification green |

No second fix-scoped re-review is permitted. Deterministic package, documentation, plugin, and
changed-file gates provide the final correction evidence.
