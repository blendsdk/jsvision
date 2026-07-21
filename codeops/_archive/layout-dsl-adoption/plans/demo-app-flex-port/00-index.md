# demo-app-flex-port Implementation Plan

> **Feature**: Retire the local absolute-placement helpers that shadow the layout DSL across
> `@jsvision/examples` (the reachable slice of GH #114)
> **Status**: Planning Complete · re-scoped 2026-07-20 after preflight
> **Created**: 2026-07-20 12:31 · **Re-scoped**: 2026-07-20
> **Implements**: layout-dsl-adoption/RD-01 (FR-6, Tier 3) · verification RD-02
> **CodeOps Skills Version**: 3.10.0

## Overview

This plan takes the highest-leverage item in the whole epic. Two one-line local functions —
`kitchen-sink/story.ts:69` and `datagrid-showcase/story.ts:68` — export an `at()` that **411 call
sites across 84 files** depend on. They predate #113's blessed `at()` builder and are now
name-identical but **semantically different**: the locals do `view.layout = layout` (a **replace**),
while the real builder **merges** and requests a reflow. Retiring them via a re-export converts all
411 sites in two lines — but the replace→merge delta is exactly the trap #117 walked through, so it
gets the same audit-before-migration treatment rather than a blind swap.

Four smaller local placers and DSL-name-shadowing `row` helpers go with them, in the four example
demos that still carry one.

Everything here is behaviour-preserving by intent. The proof is the audit table, a before/after
full-screen buffer diff per touched demo (AR-7), and the existing `*.e2e.test.ts` and smoke suites,
which stay unedited throughout.

### Scope note — #110 and #111 are owned by PR #127

An earlier draft of this plan also converted five example demos, `drill-down.story.ts`, and the
theme-designer panels + 3-pane workspace. **Preflight found that work already implemented in
PR #127** (`feat/canvas-flex-adoption`, plan set `plans/canvas-flex-adoption/`), against the same
base branch, and since merged there. Those phases were dropped rather than duplicated (AR-15). This plan now covers the
#114 reachable slice only, and its six files are verified untouched by #127.

## Document Index

| #   | Document                                          | Description                                        |
| --- | ------------------------------------------------- | -------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)    | Zero-Ambiguity Gate decisions (16 items, all resolved) |
| 00  | [Index](00-index.md)                              | This document — overview and navigation             |
| 00  | [Preflight Report](00-preflight-report.md)        | The audit that re-scoped this plan                  |
| 01  | [Requirements](01-requirements.md)                | Scope delta against RD-01/RD-02                     |
| 02  | [Current State](02-current-state.md)              | The measured surface                                |
| 03-01 | [Shadow Retirement](03-01-shadow-retirement.md) | The `at()` re-export + the four local placers       |
| 07  | [Testing Strategy](07-testing-strategy.md)        | ST-cases + the buffer-diff protocol                 |
| 99  | [Execution Plan](99-execution-plan.md)            | Phases, tasks, verification                         |

## Quick Reference

### Usage Examples

The shadow retirement — two lines standing in for 411 call sites:

```ts
// packages/examples/kitchen-sink/story.ts
// before: a local at() that REPLACES view.layout
// after:
export { at } from '@jsvision/ui';
```

### Key Decisions

| Decision | Outcome | AR |
|---|---|---|
| Plan ceiling within Tier 3 | The #114 reachable slice only; the FR-6 maximal (411 `at()` canvases) is a follow-up plan | AR-1 |
| `at()`-idiom absolute canvases | Out of scope | AR-2 |
| `.layout.rect =` window placement | Out of scope (already FR-4 keep-absolute) | AR-3 |
| `@jsvision/docs-site` | Out — belongs to #112 | AR-5 |
| Shadow `at()` retirement | Audit, then re-export the real `at()` from `story.ts` (411 call sites unchanged) | AR-6 |
| "Renders identically" proof | One-shot before/after buffer diffs; no new permanent golden files | AR-7 |
| Verify command | `yarn verify` | AR-8 |
| `tabs-demo`'s `placed()` | Converted, despite not literally shadowing a DSL name | AR-13 |
| #110 / #111 (demos + theme-designer) | **Dropped — owned by PR #127** | AR-15 |
| Surviving `at()`/`row` shadows outside `@jsvision/examples` | Deferred to the follow-up issue, not silently ignored | AR-16 |

## Related Files

**Modified — shadow retirement:**
`packages/examples/kitchen-sink/story.ts` · `packages/examples/datagrid-showcase/story.ts` ·
`packages/examples/wizard-demo/main.ts` · `packages/examples/themes-demo/main.ts` ·
`packages/examples/tabs-demo/main.ts` · `packages/examples/kitchen-sink/stories/wizard.story.ts`

**Created:** `packages/examples/test/story-at.spec.test.ts`

**Unedited by contract:** every existing `*.e2e.test.ts`, `kitchen-sink.smoke.spec.test.ts`,
`datagrid-showcase.smoke.spec.test.ts`, `datagrid-showcase.walkthrough.spec.test.ts`.

**Verified untouched by PR #127:** all six modified files above (`git diff --name-only
origin/feat/dsl-adoptation...origin/feat/canvas-flex-adoption` intersects this set at zero paths).
