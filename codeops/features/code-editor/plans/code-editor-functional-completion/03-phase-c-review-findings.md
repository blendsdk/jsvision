# Phase C Quality Findings

**Baseline:** `a5d402b782bda146dbfb7394b55ea0ac08c68dbb`
**Review scope:** T-04.13 through T-04.17

## Ruling

Auto-design accepts every major correction below. No major finding is waived or
dismissed. Minor findings remain report-only unless they can be corrected safely
inside the same focused changes.

| ID | Severity | Finding | Ruling |
| --- | --- | --- | --- |
| RV-C-001 | Major | A close authorization can accept a newer, unconfirmed revision. | Correct by binding the result to the requested identity. |
| RV-C-002 / PE-C-004 | Major | External reload notification waits behind language-service resynchronization and can be reordered after a later edit. | Queue the reload event synchronously and resynchronize in the background. |
| RV-C-003 | Major | Replace-current accepts any manually selected matching range rather than the search-owned active result. | Require search ownership and the exact active match; revoke ownership after non-search selection changes. |
| RV-C-004 | Minor | Query and replacement bounds can split an astral character. | Correct with code-point-safe bounded helpers. |
| RV-C-005 | Minor | External reload orchestration contributes to controller size. | Report-only; avoid adding further controller responsibilities. |
| PE-C-001 / SA-C-003 | Major | Case-insensitive search folds the entire document and builds two per-code-unit maps before honoring the result limit. | Replace it with a streaming source-offset-aware matcher bounded by query size. |
| PE-C-002 | Major | Search retains more matches than the renderer can project and normalizes unchanged spans every frame. | Use the renderer ceiling for retained matches and cache normalized immutable span arrays. |
| PE-C-003 | Major | A host callback that never settles permanently blocks later queued host actions. | Add a bounded host-effect deadline with late-result suppression. |
| PE-C-005 | Minor | Oversized replacement and external text can be scanned in full; replacement backspace copies the entire field. | Correct with early bounded byte checks and constant-space final-code-point removal. |
| SA-C-001 | Major | Save can pair pre-await text with a post-await identity and mark newer work clean. | Carry text and identity as one prepared snapshot and advance the checkpoint only for that exact pair. |
| SA-C-002 | Major | Some terminal formatting-request outcomes never resolve the save preparation promise. | Resolve every non-completed terminal outcome idempotently. |
| SA-C-004 | Major | Hostile runtime query, replacement, and key text values can invoke unexpected accessors or unbounded work. | Accept primitive strings only and bound work before allocation or complete scans. |

## Auto-design decision

Host-owned effects receive a configurable deadline with a conservative five-second
default. The deadline covers save, close, compare, and navigation effects, releases
the editor queue on timeout, and ignores late completion. The callback signature
remains backward-compatible; cancellation support can be added later without
weakening this safety boundary.

## Re-review

The single permitted re-review found the original correctness majors resolved and
confirmed the save, search-allocation, hostile-field-input, decoration-retention,
host-queue, and bounded-input corrections. It also found four major boundary cases
that are accepted and corrected:

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| SA-C-005 | Major | Direct public search accepted hostile options and an unbounded query. | Primitive/own-data validation and a 4,096-code-point allocation ceiling now precede search work. |
| PE-C-001 | Major | Large-document terminal search still scanned synchronously. | Non-full-size documents now scan immutable snapshots in cancellable 256-KiB turns with stale-generation suppression. |
| PE-C-004 | Major | A stalled protocol notification could retain the synchronization barrier. | Notifications now have generation-aware deadlines and every terminal path releases the coordinator gate. |
| PE-C-006 | Major | Direct controller calls could create unbounded, disposal-independent host timers. | The controller owns an eight-operation registry, rejects excess concurrency, and settles all deadlines on disposal. |

The re-review also repeated the controller-size observation and found a shallow-frozen
decoration-cache trust issue. Controller extraction remains a minor report-only
follow-up; the cache now requires every retained span object to be frozen and has a
mutable-span regression test.

No Critical finding was reported. Because CodeOps permits only one re-review, the
accepted re-review corrections are closed through focused regression coverage,
package verification, and the authoritative repository gate rather than a second
review cycle.
