# Task T-02: Isolate performance budgets from parallel verification

> **Type**: Task (lightweight) · **Feature**: _maintenance · **CodeOps Artifact Schema**: 1
> **Progress**: 5/5 tasks (100%)
> **Last Updated**: 2026-07-23 21:30
> **Phase baseline tree**: 01cacc7b5b7a40da57d41e42c5f9d642b540bb83

## Objective

Resolve GH #174 by making wall-clock performance budgets informational whenever tests execute as
part of Turbo's parallel task fan-out, while preserving an authoritative serial performance check
for core rendering, datagrid rendering, and the 1 MB editor workload.

## Scope and decisions

- `yarn verify` remains the deterministic correctness gate. Performance tests still execute there,
  but `TURBO_HASH` identifies the contended Turbo task environment and makes their timing results
  informational.
- CI remains informational because `CI` already selects log-only behavior.
- `yarn perf:check` runs the three existing budget specifications sequentially with one Vitest
  worker, outside Turbo.
- `yarn gate` invokes `yarn perf:check` after `yarn verify`, so a deliberate local acceptance-gate
  run retains enforceable performance coverage.
- The 16 ms budgets and benchmark workloads do not change.

## Tasks

- [x] T-02.1 Add specification tests for Turbo log-only mode, the three-test serial command, and
  acceptance-gate integration; run them and confirm they fail for the missing behavior.
  ✅ (completed: 2026-07-23 21:04; red: 3 expected failures)
- [x] T-02.2 Implement Turbo-aware log-only behavior in the shared core helper and editor budget;
  re-run the focused specifications until green. ✅ (completed: 2026-07-23 21:06)
- [x] T-02.3 Add the sequential `yarn perf:check` command and wire it into `yarn gate`; verify all
  three timing specifications pass in authoritative mode. ✅ (completed: 2026-07-23 21:09)
- [x] T-02.4 Add implementation-level edge coverage and update affected technical documentation.
  ✅ (completed: 2026-07-23 21:11)
- [x] T-02.5 Run `yarn plugin:update` if source-impact mapping requires it, then run focused checks,
  `yarn plugin:check`, and the authoritative full `yarn verify` gate.
  ✅ (completed: 2026-07-23 21:30; final quality fixes and full verification passed)

**Verify**: `yarn verify`

## Quality review

- **RV**: No findings.
- **PE-001 — Major, accepted**: `yarn perf:check` inherits environment flags, so a
  caller carrying `TURBO_HASH`, `CI`, or `TUI_SKIP_PERF` can make the supposedly authoritative
  serial command log-only. Add a cross-platform runner whose explicit marker overrides Turbo but
  never overrides CI or `TUI_SKIP_PERF`. User-approved 2026-07-23.
- **PE-002 — Major, accepted**: the runner selects `yarn.cmd` on Windows but launches
  it without command-shell handling. Mirror the existing acceptance-gate spawn pattern by enabling
  the shell only on Windows. User-approved 2026-07-23.
- **Final disposition**: PE-001 and PE-002 resolved; focused performance checks and `yarn verify`
  pass.
