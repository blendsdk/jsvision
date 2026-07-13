# @blendsdk/tui — Roadmap

> **Project**: `@blendsdk/tui` — Phase 1: terminal-aware renderer + input + host **foundation**.
> **Created**: 2026-06-27
> **Last Updated**: 2026-06-28 (foundation RD-01…RD-10 implemented; remote live + CI green on 9 cells → 7 RDs promoted 🔒 Verified)
> **Source**: [requirements/](../../../requirements/README.md) (RD-01…RD-10)
> **CodeOps Skills Version**: 2.0.0

This roadmap is the cross-session source of truth at the RD/plan altitude. It tracks
every requirements document and its implementation plan across the lifecycle. Update
it as RDs move stages (the **roadmap** skill owns the full protocol).

## Stage Legend

| Stage | Meaning |
| ----- | ------- |
| 📝 Requirements Drafted | RD exists in `requirements/`; no plan yet |
| 📋 Plan Created | `plans/<feature>/` exists (make_plan done); not yet executing |
| 🔬 Plan Preflighted | preflight passed against the codebase; plan cleared for execution |
| 🔨 In Progress | exec_plan running; some tasks complete |
| ✅ Implemented | All plan tasks complete; `verify` green locally |
| 🔒 Verified | Cross-platform / acceptance gate met (incl. CI cells once a remote exists) |

## Roadmap

| RD | Title | Depends On | Stage | Plan |
| -- | ----- | ---------- | ----- | ---- |
| RD-01 | [Scaffolding & Toolchain](requirements/RD-01-scaffolding-and-toolchain.md) | — | 🔒 Verified | [rd-01-scaffolding-and-toolchain](rd-01-scaffolding-and-toolchain/00-index.md) |
| RD-02 | [Capability Model & Auto-Config](requirements/RD-02-capability-model.md) | RD-01 | 🔒 Verified | [rd-02-capability-model](rd-02-capability-model/00-index.md) |
| RD-03 | [Capability Probe & Survey Harness](requirements/RD-03-capability-probe.md) | RD-02, RD-04, RD-06, RD-07 | ✅ Implemented | [rd-03-capability-probe](rd-03-capability-probe/00-index.md) |
| RD-04 | [Rendering Engine](requirements/RD-04-rendering-engine.md) | RD-01, RD-02 | 🔒 Verified | [rd-04-rendering-engine](rd-04-rendering-engine/00-index.md) |
| RD-05 | [Color & Styling](requirements/RD-05-color-and-styling.md) | RD-02 | 🔒 Verified | [rd-05-color-and-styling](rd-05-color-and-styling/00-index.md) |
| RD-06 | [Input System](requirements/RD-06-input-system.md) | RD-01 | 🔒 Verified | [rd-06-input-system](rd-06-input-system/00-index.md) |
| RD-07 | [Host & Lifecycle](requirements/RD-07-host-and-lifecycle.md) | RD-02, RD-04, RD-06 | ✅ Implemented | [rd-07-host-and-lifecycle](rd-07-host-and-lifecycle/00-index.md) |
| RD-08 | [Essentials Gate, Logging, Errors & Security](requirements/RD-08-essentials-logging-security.md) | RD-02, RD-07 | 🔒 Verified | [rd-08-essentials-logging-security](rd-08-essentials-logging-security/00-index.md) |
| RD-09 | [Testing Strategy & Acceptance Gate](requirements/RD-09-testing-and-acceptance.md) | all | ✅ Implemented | [rd-09-testing-and-acceptance](rd-09-testing-and-acceptance/00-index.md) |
| RD-10 | [Non-Functional Requirements](requirements/RD-10-non-functional.md) | all | 🔒 Verified | [rd-10-non-functional](rd-10-non-functional/00-index.md) |

## Suggested Implementation Order

Per the requirements set's phased plan:

| Phase | Documents | Description |
| ----- | --------- | ----------- |
| **A: Gate MVP** | RD-01 → RD-02 → RD-06 → RD-04 → RD-07 → RD-08 → RD-09 | Minimum to prove the go/no-go gate: detect, render, input, host, essentials, acceptance harness. **✅ Met** — `npm run gate` exits 0 (9 PASS, 2 DEFERRED). |
| **B: Full foundation** | RD-03 → RD-05 → OSC/notifications (RD-04) → progressive enhancements | Full probe/survey harness, color/styling, OSC features, CSI-u/Kitty enhancement, perf tuning |
| **C: Cross-platform verification** | CI matrix on a remote (macOS + Windows + Linux) | **✅ Met (2026-06-28)** — CI green on 9 cells (3 OS × Node 18/20/22): lint · verify · build · check:deps · audit · pack · residual: POSIX-only signal-restore e2e · Tier-4 sensory matrix. |
| **Cross-cutting** | RD-10 | Non-functional requirements enforced throughout |
