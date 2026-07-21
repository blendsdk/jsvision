# Plan: Containers, Scrolling & Lists (RD-11)

> **Implements**: jsvision-ui/RD-11
> **Feature**: jsvision-ui · **Plan**: containers-scrolling-lists
> **Status**: Ready for execution (Zero-Ambiguity Gate ✅ · Preflight ✅ PASSED — [report](00-preflight-report.md), 8 findings resolved)
> **CodeOps Skills Version**: 3.1.0

The implementation plan for RD-11 — the container/scrolling/list tier of `@jsvision/ui`: `ScrollBar`,
`Scroller`, a generic single-column virtual-scroll `ListView<T>` (+ `ListBox`, sorted + type-ahead), and
the rich modal/modeless `Dialog` (hosts RD-06 controls; terminating-command result + a `valid()`
close-gate that realizes DEF-16; OK/Cancel/Yes/No helpers). Every component is TV-derived, so each phase
carries the **NON-NEGOTIABLE fidelity gate** (GATE-1 BEFORE-decode + GATE-2 AFTER-diff), and every visual
component ships a **kitchen-sink story** (the showcase gate) with the navigator itself upgraded to a
`ListView` sidebar (dogfooding).

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Plan decisions PA-1…PA-15 over inherited AR-103…AR-114 (✅ gate passed) |
| [00-preflight-report.md](00-preflight-report.md) | Preflight audit — 8 findings (1🔴 1🟠 4🟡 2🔵), all resolved ✅ |
| [01-requirements.md](01-requirements.md) | Scope, ACs, and the RD-11 → plan mapping |
| [02-current-state.md](02-current-state.md) | The seams RD-11 builds on (recon, `file:line`) + the TV decode summary |
| [03-01-foundations.md](03-01-foundations.md) | Phase 0 — theme roles, `Commands`, the `attachModalHost` loop seam |
| [03-02-scrollbar.md](03-02-scrollbar.md) | `ScrollBar` — TV decode + spec |
| [03-03-scroller.md](03-03-scroller.md) | `Scroller` — TV decode + spec |
| [03-04-listview.md](03-04-listview.md) | `ListView<T>` / `ListBox` (+ sorted, type-ahead) — TV decode + spec |
| [03-05-dialog.md](03-05-dialog.md) | `Dialog` + standard buttons + the `valid()` gate — TV decode + spec |
| [03-06-kitchen-sink.md](03-06-kitchen-sink.md) | Stories per component + the navigator sidebar + `demo:containers` |
| [07-testing-strategy.md](07-testing-strategy.md) | Spec test cases ST-01…ST-16 ↔ AC-1…AC-15 + impl-test plan |
| [99-execution-plan.md](99-execution-plan.md) | Phases, sessions, task checklist (spec-first + gate tasks) |

## Source

- Requirement: [RD-11](../../requirements/RD-11-containers-scrolling-lists.md)
- TV source of truth: `/home/gevik/workdir/github/tvision` (`source/tvision/t*.cpp`, `include/tvision/*.h`)
- Fidelity gate: [`codeops/tv-fidelity-gate.md`](../../../../tv-fidelity-gate.md) · Showcase gate: [`codeops/kitchen-sink-gate.md`](../../../../kitchen-sink-gate.md)

## Shape

6 phases (0–5) · spec-first per component (spec oracles RED → implement → GREEN → impl tests) · one
additive intra-package loop seam (`attachModalHost`, PA-1) · additive core edits only (theme roles +
`Commands`). See [99-execution-plan.md](99-execution-plan.md) for the task breakdown.
