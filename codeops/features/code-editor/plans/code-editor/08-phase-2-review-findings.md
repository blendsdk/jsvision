# Phase 2 Quality Review Findings

> **Date**: 2026-07-24
> **Status**: Resolved — final re-review corrections verified
> **Scope**: Document engine and lifecycle

## Consolidated Rulings

| Finding | Severity | Ruling | Required correction |
| ------- | -------- | ------ | ------------------- |
| SA-001 untrusted transaction shapes were copied before validation | Major | Fix; no waiver | Normalize through a guarded, bounded, single-read boundary and reject forged transactions |
| SA-002 repeated getter reads created accessor and proxy TOCTOU gaps | Major | Fix; no waiver | Copy each external field once and mutate only from immutable normalized records |
| SA-003 document-size rejection occurred after storage/result allocation | Major | Fix; no waiver | Preflight bytes, lines, retained content, and confirmation before storage or ChangeSet allocation |
| RV-001 property tests were outside Vitest discovery | Major | Fix; no waiver | Include `*.property.test.ts` in the existing unit project and verify the increased test count |
| RV-002 replacement retained stale limits and tab size | Major | Fix; no waiver | Adopt the complete replacement policy and metadata with the new lineage |
| RV-003 Unicode case folding could return foreign offsets | Major | Fix; no waiver | Preserve original UTF-16 coordinates during expanding case folds |
| RV-004 CR metadata and logical-line indexing disagreed | Major | Fix; no waiver | Index CR, LF, CRLF, and mixed separators while preserving exact text |
| RV-005 trusted coordinates used unrestricted numbers | Major | Fix; no waiver | Add branded offsets/revisions/positions and validating factories at public boundaries |
| RV-006 insertion-boundary selection mapping left the caret behind text | Major | Fix; no waiver | Apply explicit association rules for collapsed and directed selections |
| RV-007 public model members lacked complete API documentation | Minor | Fix | Document non-trivial state and operations with practical examples |
| PE-001 history retained complete document roots without a byte ceiling | Major | Fix; no waiver | Store forward/inverse changes and enforce retained-history and replacement byte ceilings |
| PE-002 accepted edits rescanned and serialized the whole document | Major | Fix; no waiver | Cache document byte counts and update exact deltas before applying changes |
| PE-003 visual-column lookup rescanned arbitrarily long logical lines | Major | Fix; no waiver | Cache bounded visual checkpoints with an ASCII fast path and binary checkpoint lookup |
| PE-004 byte/line hard ceilings ran after allocation | Major | Fix; no waiver | Preflight initial and edit byte/line counts before split, ChangeSet, or replacement storage |
| PE-005 the unit timing assertion was incomplete performance evidence | Major | Fix; no waiver | Add an isolated Node benchmark with warmups, raw p50/p95 samples, two fixtures, and retained memory |
| PE-006 search serializes and folds the full document | Minor | Fix | Replace the quadratic Unicode fallback with linear source-offset mapping; move cancellable chunked search into the UI scheduling phase |

All major corrections are eligible internal safety, data-structure, validation, and performance
decisions under the active auto-design delegation. No product behavior, acceptance budget, public
compatibility promise, or security policy is weakened. Search chunk scheduling remains coupled to
the later cooperative scheduler; the current pure document search is bounded by result count and
returns exact source offsets.

## Correction Evidence

- Transactions are normalized once into hidden immutable records; forged or malformed objects
  return typed rejections without mutation.
- Initial loads and edits preflight UTF-8 bytes, logical lines, edit count, replacement bytes, and
  retained-history bytes before constructing new storage.
- History retains reversible change sets and bounded changed content rather than complete document
  snapshots.
- The document benchmark runs in an isolated `--expose-gc` process for 1 MiB and 50,000-line
  fixtures and records raw edit/query samples plus retained heap and history bytes.
- The unit project discovers specification, implementation, property, and dedicated security
  suites.

## Closure

The permitted final re-review confirmed every original major finding except PE-004 and identified
two remaining minor corrections. The line ceiling now uses the exact logical-line delta of removed
and inserted text, including CRLF boundary edits. Case-insensitive search now builds a linear
folded-to-source offset map, and all branded-coordinate examples use validating factories.

The focused package suite passes 61 tests. The full repository verification gate passes after
these corrections. Per the quality-loop review cap, no third independent review was dispatched;
the remaining corrections were verified directly through focused regression cases and the full
gate.
