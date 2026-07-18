# Plan: non-functional-closeout

> **Implements**: datagrid/RD-14
> **Feature**: datagrid · **Type**: Feature plan · **CodeOps Skills Version**: 3.9.0
> **Progress**: 0/24 tasks (0%) — see [99-execution-plan.md](99-execution-plan.md) for the live count.

## Purpose

Close out RD-14 (non-functional requirements) by shipping its **remaining forward work** — the
parts that did not land incrementally with the capability RDs. Roughly half of RD-14 already
shipped (theme roles, deps/docs/no-eval, renderer isolation, O(visible)@100k); this plan delivers
what's left, plus two accepted Should-Haves.

## What ships here

| Area | RD-14 AC | Deliverable |
|------|----------|-------------|
| Golden-screen + a11y | AC-3 (bulk) | One representative-grid golden fixture asserted across truecolor/256/16/mono, NO_COLOR/mono, and ASCII-fallback caps — reusing core's emulator harness. Adds `@xterm/headless` dev-dep. |
| Representative perf bench | AC-1 | A 60×22 editable-grid compose+diff median (≤16 ms off-CI) + p95, reusing core's `frame-bench.mjs` helpers. |
| Bytes ∝ damage | AC-2 (2nd half) | A grid-level single-edit-diff-≪-full-repaint assertion. |
| Callback isolation *(Should-Have)* | extends AC-7 | Small guards so a throwing on-screen **formatter** degrades one cell and a throwing **comparator** degrades to default order — neither crashes the frame/sort. |
| API governance | — | Update `CHANGELOG.md` `[Unreleased]` + a "Versioning & stability" note. |

## Explicitly out of scope (see [01-requirements.md](01-requirements.md) §Out of scope)

- Already-done ACs: AC-4 theme roles, AC-5 deps/docs/no-eval, AC-7 renderer path.
- AC-6 paste/CSV-**import** sanitize — the surface does not exist (export-only package); rides the
  import follow-up.
- The treeshake check (RD-14 Should-Have) — deferred to a roadmap follow-on (AR-3).

## Documents

- [00-ambiguity-register.md](00-ambiguity-register.md) — Zero-Ambiguity Gate (✅ passed; AR-1…AR-12).
- [01-requirements.md](01-requirements.md) — scope, in/out, success criteria (Source: RD-14).
- [02-current-state.md](02-current-state.md) — what exists today, cited to code.
- [03-01-golden-screen-a11y.md](03-01-golden-screen-a11y.md) — the golden/a11y component.
- [03-02-perf-and-bytes.md](03-02-perf-and-bytes.md) — the bench + bytes∝damage component.
- [03-03-callback-isolation.md](03-03-callback-isolation.md) — formatter/comparator guards.
- [07-testing-strategy.md](07-testing-strategy.md) — ST-1…ST-7 + impl coverage.
- [99-execution-plan.md](99-execution-plan.md) — phases, sessions, task checklist.

## Verify

`yarn verify` (AR-10). Perf assertions auto-skip under `CI` / `TUI_SKIP_PERF`.
