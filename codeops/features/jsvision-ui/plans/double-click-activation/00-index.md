# double-click-activation — Plan Index

> **Feature-set**: jsvision-ui · **Type**: Follow-up task (GH-tracked, no RD) · **CodeOps Skills Version**: 3.3.0
> **Tracks**: GH [#39](https://github.com/blendsdk/jsvision/issues/39)
> **Status**: 📋 Plan Created (2026-07-07)

## What this is

A **framework-wide multi-click primitive** plus its first consumers. Today three widgets
(`Editor`, `Input`, and — proposed by #39 — the row family) each re-derive "double-click" locally
because core's `MouseEvent` carries no click-count. This plan computes the click-count **once**, at
the UI loop's single envelope-enrichment seam, and exposes it as `DispatchEvent.clickCount` so
**every** component reads it uniformly. Then the GH #39 row-widget work rides on top as thin
consumers, restoring Turbo Vision's double-click-to-activate across Lists / Grid / Tree / File dialog.

## Navigation

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — all 15 items Resolved (AR-1…AR-15) |
| [01-requirements.md](01-requirements.md) | Requirements, scope (IN/OUT), success criteria |
| [02-current-state.md](02-current-state.md) | Grounded current-code analysis + the TV GATE-1 decode |
| [03-01-multiclick-primitive.md](03-01-multiclick-primitive.md) | The loop-owned click-count + `DispatchEvent.clickCount` seam |
| [03-02-row-consumers.md](03-02-row-consumers.md) | `ListRows`/`GridRows`/`TreeRows` double-click; tree emit removal |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-1…ST-9) + verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, progress checklist |

## Key decisions (see the register)

- **AR-1** — the primitive lives in the **UI loop / envelope**, not core (zero `@jsvision/core` change) and not per-widget.
- **AR-2** — detection = **same screen cell within 500 ms** (TV-faithful, matches the editor).
- **AR-3** — the field is **`clickCount?: number`** (1/2/3…), not a boolean.
- **AR-5** — the **Tree drops its non-TV single-click text emit** (fidelity).
- **AR-6** — **row family only** this plan; editor/input converge later.
- **AR-15** — a **graph-zone double-click toggles, not activates** (accepted deviation; the two-down model can't reconstruct TV's single `meDoubleClick` — preflight PF-002).

## Non-negotiables carried in

- **TV fidelity** (row activation is TV-derived): GATE-1 BEFORE decode + GATE-2 AFTER diff, citing
  `tlstview.cpp:271-277` + `toutline.cpp:465-480`.
- **Kitchen-sink**: the affected stories' blurbs mention double-click (smoke stays green).
- **Additive-only**: no `@jsvision/core` change, no new theme role.
