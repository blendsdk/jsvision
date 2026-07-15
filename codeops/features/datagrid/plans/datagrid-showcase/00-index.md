# DataGrid Showcase App — Implementation Plan

> **Feature**: A standalone, datagrid-centric kitchen-sink showcase for `@jsvision/datagrid` — granular one-per-capability demos for the shipped RD-01…06 surface + per-RD "coming soon" panels for RD-07…14
> **Status**: Planning Complete
> **Created**: 2026-07-15
> **Implements**: datagrid/RD-15
> **CodeOps Skills Version**: 3.7.0

## Overview

RD-15 adds a **runnable, interactive showcase** — a Storybook-for-TUI dedicated to `@jsvision/datagrid`
— at `packages/examples/datagrid-showcase/`, launched by a new `demo:datagrid` script. Each shipped
capability is its own navigable demo you can test one at a time; the app is the datagrid's **living
acceptance surface**, growing one demo cluster per future RD.

The architecture reuses the proven `packages/examples/kitchen-sink` machinery: the same `Story`
contract (`{ id, category, title, blurb, rd?, build(ctx): Group }`) and a **dedicated shell** copied
and focused from `kitchen-sink/shell.ts` — a persistent sidebar `ListBox` navigator, a per-category
menu bar, clickable status hints, `Ctrl`+←/→ cycling, and a welcome catalog (AR #7, RD AR #35). Demos
consume only the datagrid public barrel (`packages/datagrid/src/index.ts`), exactly as a consumer
would; `@jsvision/examples` gains a dependency on `@jsvision/datagrid` (no cycle — datagrid → ui/core).

The content is the ~38-demo inventory across six clusters (Foundation · Editing · Cell editors ·
Formatting · Sorting · Filtering) plus eight per-RD "coming soon" description panels (RD-07…14),
authored one `*.story.ts` per demo under `stories/<cluster>/` (AR #3). Two push-down demos (Sorting
§5.5, Filtering §6.6) use a small bespoke in-memory `GridDataSource` — a spy exposing the optional
`setSort`/`setFilter` seams that `fromRows` omits (AR #5, PF-020).

Per the user's **big-bang** phasing (AR #1), the plan is **two phases**: Phase 1 builds the scaffold,
the dedicated shell, the package wiring, the two headless test tiers as the **spec oracle**, the eight
placeholder panels, and a single Foundation seed demo — going green with a real grid proven in the
shell (AR #8). Phase 2 lands all 38 demos + the push-down source + the kitchen-sink-gate reconciliation
(AR #9, PF-022), then full verify. The showcase is added to the examples typecheck include so every
demo is `tsc`-checked (AR #2).

## Document Index

| #   | Document                                          | Description                                                |
| --- | ------------------------------------------------- | ---------------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)    | Plan-level Zero-Ambiguity decisions (audit trail)          |
| 00  | [Index](00-index.md)                              | This document — overview and navigation                    |
| 01  | [Requirements](01-requirements.md)                | Scope, sourced from RD-15                                   |
| 02  | [Current State](02-current-state.md)              | The reusable substrate + the delta this plan adds          |
| 03-01 | [App, Shell & Wiring](03-01-app-and-shell.md)   | Scaffold, dedicated shell, package/tsconfig wiring         |
| 03-02 | [Demos & Inventory](03-02-demos-and-inventory.md) | The 38 demos, placeholder factory, bespoke push-down source |
| 07  | [Testing Strategy](07-testing-strategy.md)        | Smoke oracle + walkthrough spec cases (ST-*)               |
| 99  | [Execution Plan](99-execution-plan.md)            | Two phases, task checklist (single source of truth)        |

## Source

> **Source**: [RD-15](../../requirements/RD-15-showcase-app.md) · preflight
> [Iteration 3](../../requirements/00-preflight-report.md) (PF-020…PF-023, applied)

## Key Decisions (traceability)

| Decision | Choice | AR |
|----------|--------|----|
| Location | `packages/examples/datagrid-showcase/` + `demo:datagrid` | RD AR #33 |
| Shell | Dedicated copy from kitchen-sink | AR #7 / RD AR #35 |
| Phasing | Big-bang — 2 phases | AR #1 |
| Typecheck | Added to examples `tsconfig.json` include | AR #2 |
| File layout | One `*.story.ts` per demo | AR #3 |
| Push-down demos | Bespoke in-memory spy `GridDataSource` | AR #5 / PF-020 |
| Test tiers | Smoke + walkthrough, `*.spec.test.ts` unit | AR #6 / RD AR #40 |
| Gate | Reconcile `kitchen-sink-gate.md`; retain ui grid story | AR #9 / PF-022 |

**To begin implementation:** use the exec_plan skill on `datagrid-showcase`.
