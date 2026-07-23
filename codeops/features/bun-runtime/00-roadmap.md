# Roadmap: Bun Runtime

> **Feature-Set**: Bun Runtime
> **Status**: In Progress
> **Created**: 2026-07-02
> **Last Updated**: 2026-07-03
> **Progress**: 0 / 1 (0%)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.1.0

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
| RD-01 | Bun runtime support & self-contained executables | [RD-01](requirements/RD-01-bun-runtime-support.md) | — | RD Drafted | ✏️ | 2026-07-02 | Drafted — Bun CI lane (3-OS, floor ≥1.3) · compile + cross-build smokes · PTY compiled-binary e2e + gate · Bun-children e2e · engines/docs declarations · Windows manual TTY · native-perf spike. |
