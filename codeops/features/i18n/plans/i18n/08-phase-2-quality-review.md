# Phase 2 quality review

> **Scope**: Phase 2 secure-source and Node-loader diff from baseline tree
> `de0c4fb57d8b46e15ca4dad46d893649a40e3fc7`
>
> **Profile**: Strict defaults — independent correctness, security/concurrency, and performance
> review
>
> **Status**: PASS — all review findings corrected and the full repository gate passed

## Findings and rulings

| Finding | Severity | Ruling | Resolution |
|---|---|---|---|
| RV-001 / SA-001 | Major | Accepted by auto-design | Retain canonicalization-time device/inode identity and require the opened handle to match it |
| SA-002 | Major | Accepted by auto-design | Add POSIX non-blocking/no-follow open before regular-handle and identity validation |
| SA-003 | Major | Accepted by auto-design | Validate signals and inspect state/listeners through captured platform intrinsics |
| RV-002 | Major | Accepted by auto-design | Apply the portable literal grammar to glob entries and canonical target paths |
| SA-004 / PE-001 / PE-002 | Major | Accepted by auto-design | Stream and cache glob scans; cap scans, files, sources, catalogs, and aggregate source bytes |
| PE-003 | Major | Accepted by auto-design | Thread cancellation through path resolution, opening, and bounded-read checkpoints |
| PE-004 | Major | Accepted by auto-design | Allocate only the checked file size plus one growth-detection byte |
| PE-005 | Major | Accepted by auto-design | Weak-brand validated catalog identities to avoid repeated validation and deep copies |
| SA-005 / PE-006 | Major / Minor | Accepted by auto-design | Replace per-escape Map allocation with a direct switch |
| RV-003 | Minor | Fixed opportunistically | Use `fileURLToPath` in the portable Node source example |

No reviewer reported a critical finding. No major finding was waived or dismissed.

## Auto-design decision

AR-48 records the delegated technical correction: identity-bound fail-closed file handles,
non-blocking POSIX opens, intrinsic cancellation, and consistent aggregate ceilings. One load
starts at most 256 sources and publishes at most 10,000 catalogs. One JSON source expands at most
10,000 files, scans at most 100,000 entries per unique glob, and retains at most 16 MiB of checked
file bytes. The existing public option fields remain unchanged.

## Correction evidence

- Parent-directory replacement, pre-open FIFO replacement, unsafe glob names, excessive repeated
  expansions, revoked signals, listener overrides, source count, aggregate catalogs, and dense
  escape parsing have focused regression coverage.
- Initial corrected focused suites: 70/70 tests passed.
- Initial corrected package suite: 353/353 tests passed with typecheck and JSDoc checks.

## One-time fix re-review

The required re-review confirmed RV-002–RV-003, SA-002, SA-005, and PE-003–PE-006 as resolved. It
rejected the initial closeout of RV-001/SA-001, SA-003–SA-004, and PE-001–PE-002, and identified
SA-006:

| Finding | Severity | Final correction |
|---|---|---|
| RV-001 / SA-001 | Major | On Linux, resolve `/proc/self/fd/<fd>` and prove that the opened object remains under the canonical root |
| SA-003 | Major | Use Node's built-in proxy detector before any AbortSignal operation; retain intrinsic state/listener access |
| SA-004 / PE-001 | Major | Share one 100,000-entry/10,000-file/16-MiB budget across built-in sources and cache by canonical directory |
| SA-004 / PE-002 | Major | Charge validated catalog identities against 10,000 catalogs, 100,000 compilation units, and 16 MiB of message text |
| SA-006 | Major | Re-check cancellation after successful and failed filesystem awaits so `ABORTED` wins races |

The final correction added deterministic realpath/stat-gap, canonical-alias scan, live-proxy,
shared-byte-budget, compilation-budget, and inter-operation cancellation regressions. Per the
quality policy, no third review was dispatched after the one-time re-review.

## Final verification evidence

- Focused final correction suites: 76/76 tests passed.
- Package final suite: 359/359 tests passed.
- Package build, typecheck, JSDoc, dependency, and packaging gates passed.
- Root `yarn verify` passed: lint/formatting, 34/34 Turbo tasks, and Codex plugin integrity.
