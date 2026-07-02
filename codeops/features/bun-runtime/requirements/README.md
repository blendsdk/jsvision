# Bun Runtime — Requirements Documents

> **Project**: jsvision (`@jsvision/core` + `@jsvision/ui` + `@jsvision/examples`) — Bun runtime support & self-contained executables
> **Status**: Draft (RD-01 drafted)
> **Created**: 2026-07-02
> **Architecture**: TypeScript (ESM-only, NodeNext, `strict`), zero runtime dependencies; Bun adopted as a **runtime and compile target** (yarn 1.x stays the package manager, vitest stays the test runner)
> **CodeOps Skills Version**: 3.1.0

---

## Overview

This feature-set makes **Bun a first-class, CI-guaranteed runtime** for jsvision and makes
**shipping a TUI app as a single self-contained executable** (`bun build --compile` — the Claude
Code distribution model) a documented, continuously verified capability.

It was scoped from a completed empirical analysis (2026-07-02, Bun 1.3.14): the entire stack
already runs on Bun unmodified — all 1,105 unit tests pass on the Bun runtime, the interactive
host lifecycle (raw mode, alt-screen, mouse, resize, suspend/resume, restore-on-exit) was verified
under a real PTY, and compiled binaries behave byte-identically to interpreted runs. The single RD
therefore adds **guarantees, not fixes**: a merge-blocking 3-OS Bun CI lane, a supported-version
policy (Bun ≥ 1.3), packaging/docs declarations, a dogfooded compile recipe with a PTY-driven
acceptance gate + `yarn gate` criterion, Bun-children e2e coverage, a Windows manual-verification
protocol, and a benchmarked (≥ 20%-bar) decision on Bun-native fast paths.

## Domain Glossary

| Term | Definition |
|------|-----------|
| **Bun lane** | The merge-blocking CI job family that runs the unit suites on the Bun runtime + the compile smokes (RD-01 FR-1…FR-3). |
| **Compile smoke** | Building a headless demo with `bun build --compile` and executing the binary non-interactively (rc 0 + final output line). |
| **PTY e2e** | The acceptance test that drives the compiled interactive `tvision-demo` binary under a real pseudo-terminal and asserts alt-screen/cursor/mouse restore bytes + rc 0. |
| **Dogfooded recipe** | The `compile:*` script in `@jsvision/examples` that both the docs guide quotes and the PTY e2e executes — the recipe cannot rot. |
| **Runtime-detected fast path** | A pure-JS Bun-specific optimization selected by feature detection at runtime (never a separate build), permitted only past the ≥ 20% bench bar (AR-9/AR-10). |
| **Supported floor** | The oldest Bun version the guarantees apply to: **≥ 1.3** (empirically verified line: 1.3.14). CI tracks latest stable. |

## Document Index

| # | Document | Description | Depends On |
|---|----------|-------------|------------|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions AR-1…AR-10 (audit trail) | — |
| **RD-01** | [Bun runtime support & self-contained executables](RD-01-bun-runtime-support.md) | Merge-blocking Bun CI lane (3 OS × latest stable), compile smokes + cross-compile build verification, PTY-driven compiled-binary e2e + `yarn gate` criterion, Bun-children e2e variants, engines/README/docs/CHANGELOG declarations, Windows manual-verification checklist, benchmarked Bun-native spike (≥ 20% bar) | foundation (archived), jsvision-ui RD-01…RD-11 (all shipped) |

## Dependency Graph

```
foundation (archived @jsvision/core RD-01…RD-10) ──┐
jsvision-ui RD-01…RD-07/RD-10/RD-11 (shipped) ─────┴──► RD-01 Bun runtime support
                                                         (guarantees over shipped code;
                                                          no open RD blocks it)
```

## Suggested Implementation Order

| Phase | Documents | Description |
|-------|-----------|-------------|
| **A** | RD-01 | Single-RD feature-set; run `make_plan bun-runtime RD-01` and execute. |

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Bun's role | Runtime + compile target only | yarn stays the package manager, vitest the runner — smallest delta, one codebase (AR-2/AR-9) |
| Guarantee strength | Merge-blocking CI lane, 3 OS × latest stable Bun | shipping binaries demands a hard guarantee; latest-stable tracking catches Bun drift within days (AR-2/AR-3/AR-5) |
| Binary acceptance | PTY-driven e2e + `yarn gate` criterion | the shipping story is continuously executed, not documented prose (AR-4/AR-7) |
| Bun-native code | Benchmarked spike behind the `RuntimeAdapter` seam, ≥ 20% adoption bar | evidence before a permanent second I/O codepath; `bun:ffi`/Bun-test excluded (AR-9/AR-10) |

## How to Use These Documents

1. Pick the requirements document (RD-01).
2. Run the make_plan skill — it uses the RD as input to create an implementation plan.
3. Run the exec_plan skill and implement iteratively (spec tests first).
