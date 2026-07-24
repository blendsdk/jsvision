# Phase 6 Quality Review Findings

> **Phase**: 6 — Quality and security closure
> **Baseline tree**: `621e560eb54f3a5c5c6b15eaf41b7f249f305db7`
> **Review status**: Closed after final parent verification
> **Authority**: AI — delegated by `--auto-design`
> **Root invocation ID**: `AD-CODE-EDITOR-EXEC-20260724-06`
> **Policy version**: 1

All critical and major findings require correction. No finding is waived or dismissed.

| ID | Severity | Decision | Required correction |
|---|---|---|---|
| RV-001 / SA-001 / PE-005 | Major | Accept | Thread one resolved limits, degradation, and observability policy through real controller and UI paths and derive older ceilings from it. |
| RV-002 / SA-002 | Major | Accept | Replace predetermined probe results with observations from real document, controller, UI, theme, protocol, package, and lifecycle surfaces. |
| RV-003 / SA-003 / PE-003 | Major | Accept | Snapshot hostile options safely, use bounded single-drain callback delivery, contain scheduling/callback failures, and make disposal settle waiters. |
| SA-004 | Major | Accept | Runtime-allowlist degradation features, avoid hostile property reads, and use trusted fixed notice labels. |
| PE-001 | Major | Accept | Benchmark actual document transaction plus controller-backed viewport projection with release-sized samples. |
| PE-002 | Major | Accept | Exercise production language scheduling, cancellation, editor commands, and bounded flood ingestion rather than a toy queue. |
| PE-004 | Major | Accept | Populate and dispose real editor-owned resources and report observed owner counters and isolated heap evidence. |

## Auto-design ruling

- **Eligibility**: Internal architecture, validation, performance, recovery, benchmark, and test
  mechanisms within the approved behavior and hard security ceilings.
- **Objective**: Make the quality closure measure and protect the production editor rather than a
  parallel model of it.
- **Decision**: Consolidate overlapping findings into one per-controller policy, production-backed
  probes, bounded callback delivery, and real edit/projection/scheduling/disposal evidence.
- **Evidence**: Three independent reviewers found that green tests were backed by disconnected
  policies, constant success fields, synthetic counters, and an unbounded callback set.
- **Rejected alternatives**: Waiver is prohibited; narrowing immutable specifications would hide
  the defect; a second wrapper policy would preserve the same split-brain architecture.
- **Strongest counterargument**: Threading the policy through already-built layers increases the
  Phase 6 correction surface and may expose older lifecycle gaps.
- **Confidence**: High on consolidation and safety; Medium-High until the permitted re-review
  accepts the production-backed evidence.
- **Hardening**: Correctness, security, and performance reviewers independently converged on the
  same integration and evidence defects.
- **Reopen triggers**: Re-review rejection, a production path bypassing the resolved policy, a
  callback flood retaining unbounded work, or benchmarks no longer exercising real projection.

## Closure

The single permitted re-review accepted the bounded observability correction, hostile degradation
validation, and real edit/projection benchmark. It rejected the first policy integration,
production-probe, scheduler-flood, and retained-resource corrections as incomplete. No third
review was requested. The parent then closed those groups by making the controller configure the
real document, LSP, popup, and telemetry owners from one resolved policy before use; recording
actual interactive/background ordering while driving real completion and diagnostic floods; and
populating then disposing real history, diagnostics, completions, symbols, popup rows,
protocol/host requests, folds, and telemetry. Late-callback and hostile accessor/evaluation counts
are now observed through instrumented production boundaries rather than returned as constants.

Final evidence is 159 passing package tests, a serial 20-sample real transaction/projection
benchmark with p95 3.280 ms and 3.276 ms, 34/34 passing repository tasks, documentation checks, and
plugin integrity. No finding was waived.
