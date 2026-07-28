# Phase D Quality Findings

**Baseline:** `69674504bfd357fd83b20aefba9e78e6cad8e6b2`
**Review scope:** T-04.18 through T-04.22

## Ruling

Auto-design accepts every technical correction below. No major finding is waived or dismissed.
Two immutable test expectations conflict with the approved requirements and therefore require
explicit authorization before they can be corrected.

| ID | Severity | Finding | Ruling |
| --- | --- | --- | --- |
| RV-D-001 / SA-D-001 | Major | Nested theme and application proxy traps can escape the resolver or draw boundary. | Correct with guarded fixed-schema reads and a safe-default outer boundary. |
| RV-D-002 | Major | Real language-service lifecycle states are not projected into shared degradation state. | Map plain, connecting, degraded, and ready states into suspended, pending, degraded, and recovered records. |
| RV-D-003 / SA-D-004 | Major | A rejected live source can clear the active source, and accepted sources retain caller-owned mutable data. | Validate and deeply snapshot atomically before replacing the last valid source. |
| RV-D-004 | Major | Contrast repair can replace an inherited background and break the continuous editor surface. | Preserve the inherited background and repair the foreground. The conflicting immutable expectation awaits authorization. |
| RV-D-005 / SA-D-007 | Minor | The active layer reports mere layer presence rather than an accepted contribution. | Report the highest layer that contributed at least one valid known field. |
| PE-D-001 / SA-D-003 | Major | Unknown override width is enumerated and sorted before caps, creating attacker-controlled repaint work. | Traverse only the fixed public schema and ignore unknown fields without enumeration. The conflicting immutable expectation awaits authorization. |
| SA-D-002 | Major | Attacker-controlled key names can be copied into inspectable reports. | Emit only fixed-schema paths and bounded internal reason labels. |
| SA-D-005 / SA-D-006 | Major | Structurally forged reports can invoke caller-owned arrays and masquerade as trusted resolution evidence. | Brand resolver reports internally and snapshot only trusted reports. |
| SA-D-008 | Major | Invalid degradation detail objects can enter the limit transition through a compatibility fallback. | Accept only the fixed reason vocabulary and validated own-data limit fields. |
| SA-D-009 | Major | Synchronous degradation observers can recursively publish and allocate without a bound. | Coalesce publication into a microtask and suppress observer reentrancy. |

## Auto-design decision

Theme input now crosses one fixed-schema snapshot boundary. Resolution reads only known sections,
roles, and style fields; unknown keys are ignored without enumeration. Reports are bounded,
content-free, and accepted as resolution evidence only when created by the resolver. Live sources
are installed atomically from immutable snapshots and application-derived resolution is cached
until a source, application-role identity, or capability identity changes.

Contrast correction preserves inherited backgrounds to keep one continuous editor surface.
Degradation publication uses the existing controller presentation seam, maps real language-service
lifecycle states, and coalesces observer delivery without permitting reentrant publication.

## Immutable-oracle gate

| Test | Existing expectation | Approved behavior requiring correction |
| --- | --- | --- |
| `theme/live-theme.spec.test.ts` | Keep `#111111` even when it fails minimum contrast. | Preserve the inherited background and adjust the foreground to meet the contrast policy. |
| `ui/code-editor.spec.test.ts` ST-36 | Enumerate arbitrary unknown keys into `report.rejected`. | Ignore unknown additive fields without enumerating attacker-controlled object width or copying attacker labels. |

The implementation-test updates do not alter requirements. The user explicitly authorized both
specification corrections on 2026-07-25. The single permitted re-review and final verification
gates remain pending.

## Re-review

The single permitted re-review confirmed all original correctness and performance findings
resolved. It also confirmed seven of the nine original security findings resolved and found two
remaining major boundary cases:

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| SA-D-006 | Major | A genuine resolver report could be paired with an unrelated complete palette. | Trust now brands the complete immutable resolver result, so evidence is accepted only with the exact palette that produced it. |
| SA-D-008 | Major | Malformed or accessor-backed limit counters could be accepted as zero-valued transitions. | Both counters must now be own-data, non-negative safe integers before any state or notification changes. |

No new Critical or Major correctness or performance finding was reported. Because CodeOps permits
only one re-review, these accepted re-review corrections are closed through dedicated hostile
regressions, focused verification, package verification, and the authoritative repository gate
rather than a second review cycle.

## Verification

| Gate | Result |
| --- | --- |
| Phase D focused specifications and regressions | PASS — 40/40 |
| Complete `@jsvision/code-editor` package | PASS — 45 files, 334 tests |
| Generated plugin integrity | PASS |
| Authoritative `yarn verify` | PASS — 34/34 tasks |
