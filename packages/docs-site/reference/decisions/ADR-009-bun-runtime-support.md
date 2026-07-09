# ADR-009: First-class Bun runtime support (runtime + compile target only)

> **Date**: 2026-07-02
> **Status**: Proposed (per bun-runtime/RD-01, drafted)
> **Source**: `codeops/features/bun-runtime/requirements/RD-01-bun-runtime-support.md` (AR-1…AR-10)

## Context

jsvision apps should be shippable as single self-contained executables (the Claude
Code distribution model), which requires `bun build --compile` and therefore the
Bun runtime. An empirical analysis (2026-07-02, Bun 1.3.14) showed the whole stack
already runs on Bun unmodified: all 1,105 unit tests pass on the Bun runtime, the
interactive host lifecycle (raw mode, alt-screen, mouse, SIGWINCH resize,
SIGTSTP/SIGCONT suspend/resume, restore-on-every-exit-path, `/dev/tty` stream
construction, exit-hook `fs.writeSync`) was verified under a real PTY, and
compiled binaries behave byte-identically to interpreted runs. This works because
the runtime surface is deliberately small and seam-guarded (ADR-003's injectable
`RuntimeAdapter`; ADR-001's zero dependencies) and Bun implements every touched
Node API compatibly. But nothing guaranteed it: no CI ran Bun, no version was
supported, no consumer-facing surface declared it.

## Options Considered

### Option A: First-class runtime — merge-blocking Bun CI lane

- **Pros**: Real guarantee; regressions caught at merge time; matches the goal of
  shipping binaries.
- **Cons**: CI cost (3 extra jobs); exposure to upstream Bun regressions
  (mitigated by a triage policy + temporary pin escape hatch).

### Option B: Best-effort — non-blocking informational lane

- **Pros**: Cheaper; immune to Bun-release flakiness.
- **Cons**: A Bun regression can land silently, defeating the shipping story.

### Option C: Compile-target only — Node stays the sole supported runtime

- **Pros**: Minimal surface.
- **Cons**: Weakest promise; the compile target still needs the runtime to work,
  so the coverage gap is illusory.

### (Sub-decision) Bun-native APIs: adopt now vs benchmarked spike vs never

Full adoption (`Bun.stdin`, `bun:ffi`, Bun test runner) would fork the codebase
and violate ADR-001/`check:deps`'s spirit; never-investigate leaves potential
wins unknown.

## Decision

**Option A** — Bun is a first-class, merge-blocking runtime and compile target,
scoped strictly to _runtime_: yarn 1.x stays the package manager, vitest the test
runner, tsc the build. Supported floor **Bun ≥ 1.3**; CI runs latest stable on
3 OSes (unit suites on the Bun runtime + per-OS compile smokes + 5-target
cross-build verification + a PTY-driven compiled-binary acceptance e2e wired into
`yarn gate`). Bun-native fast paths only via a **benchmarked spike** behind the
`RuntimeAdapter` seam with a ≥ 20% median-improvement adoption bar (pure JS,
runtime-detected, behavior-identical); `bun:ffi` and the Bun test runner are
excluded outright.

## Rationale

The empirical result made Option A cheap: first-class support needs zero code
changes, only guarantees. Shipping binaries is the stated product goal, and a
non-blocking lane (B) or compile-only promise (C) cannot back that goal — a
silent runtime regression breaks every shipped executable. The single-codebase
constraint (one I/O path, Node canonical) preserves ADR-001/ADR-003; the ≥ 20%
bar ensures a second codepath is only ever bought with real performance rent.

## Consequences

### Positive

- "Runs on Bun" and "compiles to a self-contained binary" become continuously
  proven properties, not dev-box anecdotes.
- The restore/signal safety oracles (the properties that keep terminals usable)
  gain a second-runtime execution, a net coverage gain.
- The recipe is dogfooded: the docs quote the same script the e2e executes.

### Negative

- Three more required CI jobs; a latest-stable policy means upstream Bun
  regressions can redden CI until triaged (pin escape hatch documented).
- Windows interactive-TTY behavior remains manually verified (ConPTY cannot be
  driven under the no-new-deps rule, ADR-004) — a documented checklist, not CI.

### Risks

- Bun's Node-API compatibility could drift in a subtle, untested corner — bounded
  by running the full unit suites + restore e2es on Bun every merge.
- The ~90–100 MB binary size (embedded runtime) may surprise adopters — stated in
  the shipping guide with the embedded-source and unsigned-binary caveats.
