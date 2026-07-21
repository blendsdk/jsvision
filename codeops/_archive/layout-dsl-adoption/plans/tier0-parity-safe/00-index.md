# Plan: Tier-0 Parity-Safe DSL Adoption

> **Implements**: layout-dsl-adoption/RD-01 (Tier-0 slice)
> **Verification contract**: layout-dsl-adoption/RD-02
> **Type**: Feature phase (refactor / idiom adoption) · **Status**: Plan Created
> **Created**: 2026-07-19
> **CodeOps Skills Version**: 3.9.0

## What this plan is

The first, deliberately **parity-safe** slice of the layout-DSL flex-elimination epic (GH #108).
It adopts the hardened layout DSL (`center` / `at` / `cover`) at the set of sites where the swap
changes **no rendered geometry and edits no spec oracle** — proving the direction before any of the
Tier-2 dialog-body rebuilds re-derive their oracles. It also lands the durable CLAUDE.md
"deliberately non-faithful" record (RD-01 FR-7) ahead of the first real divergence.

Nothing here diverges from Turbo Vision geometry. Every existing behavioral and witness oracle must
pass **unedited** — that is the acceptance bar (RD-02 NFR-1).

## Scope at a glance

**In (this plan):**
1. Base `Dialog` self-centering → `center()` / `at()` composition (padding + branch-preserving).
2. `formDialog` body → `cover(body)` (byte-identical to today's `position:'fill'`).
3. Menu outside-click catcher → `cover()` + drop its manual resize re-anchor.
4. Dropdown popup catcher → `cover()`.
5. The enumerated walkthrough / demo-shell canvases → `cover()` / `center()`.
6. CLAUDE.md "Turbo Vision fidelity" carve-out naming the non-faithful dialog set.

**Out (deferred — see `01-requirements.md` §Out of scope):**
- The **app overlay** (`application.ts:335/435`) `cover()` conversion — deferred (PA-1) because it
  breaks a spec-test locator; moves to #115 with an RD-02 recorded re-derivation.
- All Tier-2 dialog-body rebuilds and `grow-dialog.ts`/`grow.ts` deletion (#115/#120).
- The maximal ~470-site Tier-3 example/story/docs pass (#110/#112).

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — 8 plan-level decisions resolved (inherits the 13 requirements-level ones) |
| [01-requirements.md](01-requirements.md) | Scope, in/out, success criteria, RD trace |
| [02-current-state.md](02-current-state.md) | Grounded current-state map (file:line + verbatim code) of every target site |
| [03-01-base-dialog.md](03-01-base-dialog.md) | Component spec — base `Dialog` `center()`/`at()` adoption |
| [03-02-overlays-and-body.md](03-02-overlays-and-body.md) | Component spec — menu + dropdown catchers `cover()` and `formDialog` body `cover()` |
| [03-03-demos-and-carveout.md](03-03-demos-and-carveout.md) | Component spec — demos/demo-shell conversions + the CLAUDE.md carve-out |
| [07-testing-strategy.md](07-testing-strategy.md) | Witness/characterization ST cases + verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, progress checklist |

## Execution order

Phase 1 (base Dialog) → Phase 2 (catchers + formDialog body) → Phase 3 (demos) → Phase 4 (carve-out
+ final verify). Phases are independent and could reorder; this order lands the core-framework proof
first and the doc record last. Per-package PRs (repo ground rule): ui in one PR, forms folded with ui
or its own, examples in one PR, the CLAUDE.md carve-out with the ui PR.

**To execute:** use the exec_plan skill on `tier0-parity-safe`.
