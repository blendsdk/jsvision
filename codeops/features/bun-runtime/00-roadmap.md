# Roadmap: Bun Runtime

> **Feature-Set**: Bun Runtime
> **Status**: In Progress
> **Created**: 2026-07-02
> **Last Updated**: 2026-07-02 (RD-01 drafted ✏️ — Bun runtime support & self-contained executables; Zero-Ambiguity Gate PASSED, AR-1…AR-10)
> **Progress**: 0 / 1 done
> **CodeOps Skills Version**: 3.1.0

First-class Bun runtime support for jsvision + the self-contained-executable shipping story
(`bun build --compile`). Scoped from the 2026-07-02 empirical analysis (Bun 1.3.14): the stack
already runs on Bun unmodified (1,105/1,105 unit tests on the Bun runtime; interactive host
lifecycle PTY-verified; compiled binaries byte-equivalent), so this feature-set adds **guarantees,
not fixes** — CI lane, version policy, packaging/docs, a dogfooded compile recipe + PTY acceptance
gate, Bun-children e2e, Windows manual verification, and a benchmarked fast-path decision.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| RD-01 | Bun runtime support & self-contained executables | [RD-01](requirements/RD-01-bun-runtime-support.md) | — | RD Drafted | ✏️ | 2026-07-02 | Merge-blocking 3-OS Bun CI lane (latest stable, floor ≥ 1.3) · compile smokes + 5-target cross-build verification · PTY-driven compiled-binary e2e + `yarn gate` criterion · Bun-children e2e variants · engines/README/docs/CHANGELOG declarations · Windows manual TTY checklist · benchmarked Bun-native spike (≥ 20% bar, `bun:ffi`/Bun-test excluded). Gate: AR-1…AR-10 all resolved. Next: `make_plan` (or `preflight` the RD first). |

## Notes

- 2026-07-02: **RD-01 drafted** ✏️ via `add_requirement`, grounded in a same-day strict empirical
  analysis on Bun 1.3.14 (unit suites on Bun runtime, PTY-driven interactive + compiled-binary
  runs, real SIGWINCH resize, SIGSTOP/SIGCONT suspend/resume, `/dev/tty` stream construction,
  exit-hook `writeSync`, capability probe, `@xterm/headless` interop, Windows cross-build).
  Zero-Ambiguity Gate PASSED (AR-1…AR-10). New feature-set created per AR-1.
