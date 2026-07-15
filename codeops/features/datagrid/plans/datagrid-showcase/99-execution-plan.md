# Execution Plan: DataGrid Showcase App

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-15
> **Progress**: 0/22 tasks (0%)
> **CodeOps Skills Version**: 3.7.0

## Overview

Implements datagrid/RD-15 — a standalone `packages/examples/datagrid-showcase/` app (`demo:datagrid`)
with granular one-per-capability demos for the shipped RD-01…06 surface + eight per-RD "coming soon"
panels. Per the user's **big-bang** phasing (AR #1), **two phases**: Phase 1 builds the scaffold, the
dedicated shell (copied + focused from `kitchen-sink/shell.ts`), the package wiring, the two headless
test tiers as the **spec oracle**, the eight placeholders, the shared demo lib, and a single Foundation
**seed** demo — going green with a real `EditableDataGrid` proven in the shell (AR #8). Phase 2 adds the
full-inventory scope oracle (red), then lands all 38 demos + the kitchen-sink-gate reconciliation, then
full verify. Spec-first throughout (spec tests → red → implement → green → verify).

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Scaffold, shell, spec oracle & green skeleton | 12 |
| 2 | All 38 demos + scope oracle + gate reconciliation | 10 |

**Total: 22 tasks across 2 phases.**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Each task line appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** and Last Updated after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.
>
> **Commit granularity:** per-phase (spec-first cannot commit a red build). Verify: `yarn verify`;
> single-file loop: `yarn workspace @jsvision/examples vitest run --project unit <file>` (AR #4).

---

## Phase 1: Scaffold, shell, spec oracle & green skeleton

### Step 1.1: Specification tests (red)

**Reference**: `07 §Smoke oracle` (ST-1…ST-4, ST-6) · `07 §Walkthrough oracle` (ST-8…ST-10) · `07 §Lib spec` (ST-11/12) · AR #6/#8
**Objective**: Lock the harness behavior before the app exists. (ST-5 all-categories + ST-7 counts are Phase-2 scope oracles.)

- [ ] 1.1.1 Write `test/datagrid-showcase.smoke.spec.test.ts` — ST-1 (registry non-empty), ST-2 (metadata), ST-3 (unique ids), ST-4 (each story mounts + paints ≥1 cell), ST-6 (`Roadmap` = 8 panels). Red (no app yet).
- [ ] 1.1.2 Write `test/datagrid-showcase.walkthrough.spec.test.ts` — ST-8 (headless driver navigates every registry entry, paints on swap), ST-9 (previous view disposed on swap), ST-10 (Foundation seed demo mounts a real `EditableDataGrid`). Red.
- [ ] 1.1.3 Write the spy-source spec (ST-11/12) covering `setSort`/`setFilter` recording + `length()` reflecting the sorted/filtered set. Red.

### Step 1.2: Scaffold + shell + lib (implement → green)

**Reference**: `03-01 §Files` · `03-02 §Shared demo lib`, `§Placeholders` · AR #2/#5/#7/#8
**Objective**: The runnable skeleton, green against Step 1.1.

- [ ] 1.2.1 Create `datagrid-showcase/story.ts` + `window.ts` (dedicated copies of the kitchen-sink files).
- [ ] 1.2.2 Create `datagrid-showcase/shell.ts` (`createDatagridShowcase(caps)`, focused copy) + `main.ts` (TTY guard → `.run()`).
- [ ] 1.2.3 Create `stories/lib/data.ts` (typed demo rows as signals) + `stories/lib/spy-source.ts` (in-memory `GridDataSource` exposing `setSort`/`setFilter`/`distinct`); make ST-11/12 pass.
- [ ] 1.2.4 Create `stories/placeholders.ts` — `placeholderStory(rd,title,blurb)` factory + the 8 RD-07…14 panels.
- [ ] 1.2.5 Create `stories/foundation/sizing.story.ts` — the seed demo (a real read-only `EditableDataGrid` with mixed `auto`/fixed/`fr` + align).
- [ ] 1.2.6 Create `stories/index.ts` — register the seed demo + the 8 placeholders (`Foundation` + `Roadmap` categories).

### Step 1.3: Wiring + green + verify

**Reference**: `03-01 §Package & tooling wiring` · AR #2/#4
- [ ] 1.3.1 Wire `packages/examples/package.json`: add `demo:datagrid` script + `@jsvision/datagrid` dependency; add `datagrid-showcase` to `tsconfig.json` `include`.
- [ ] 1.3.2 Run the smoke + walkthrough + lib specs → green; fix until ST-1…ST-4, ST-6, ST-8…ST-12 pass.
- [ ] 1.3.3 Full `yarn verify` green (lint + typecheck incl. the demos + build + test). Phase-1 commit.

---

## Phase 2: All 38 demos + scope oracle + gate reconciliation

### Step 2.1: Scope oracle (red)

**Reference**: `07 §Smoke oracle` (ST-5, ST-7) · AR #3
**Objective**: Assert the full RD-15 inventory before it exists.

- [ ] 2.1.1 Extend `datagrid-showcase.smoke.spec.test.ts` with ST-5 (all 7 categories present) + ST-7 (per-cluster counts: Foundation 5 · Editing 5 · Cell editors 9 · Formatting 8 · Sorting 5 · Filtering 6). Red (only the seed demo exists).

### Step 2.2: Implement the demos (implement → green), one `*.story.ts` per demo

**Reference**: `03-02 §Cluster 1…6` · AR #3 · PF-023 (show overlay/cursor/dirty through a live grid)
**Objective**: Each cluster's demos land and are registered; the Step-1.1 + Step-2.1 oracles keep passing.

- [ ] 2.2.1 **Foundation** — the remaining 4 demos: `value-format-parse`, `data-source`, `read-only`, `theming` (seed `sizing` already exists). Register each.
- [ ] 2.2.2 **Editing** — 5 demos: `per-cell-edit`, `commit-veto`, `dirty-tracking`, `cursor-nav`, `overlay` (cursor/overlay shown through a live grid, PF-023). Register.
- [ ] 2.2.3 **Cell editors** — 9 demos, one per `CellEditorKind` (`text`/`integer`/`decimal`/`boolean`/`date`/`enum`/`lookup`+F4/`readonly`/`custom`). Register.
- [ ] 2.2.4 **Formatting** — 8 demos: `number`, `currency`, `percent`, `date`, `boolean`, `labels`, `parse-roundtrip` (+`PARSE_FAILED`), `render-style` (custom `render` + `cellStyle`). Register.
- [ ] 2.2.5 **Sorting** — 5 demos: `single`, `multi`, `value-aware`, `collator`, `push-down` (over `spy-source`, echoes `setSort`). Register.
- [ ] 2.2.6 **Filtering** — 6 demos: `quick-filter`, `condition-text`, `condition-num-date`, `value-list`, `n-of-m`, `push-down` (over `spy-source`, echoes `setFilter`). Register.

### Step 2.3: Governance + hardening + verify

**Reference**: `03-02 §Governance` · `07 §Walkthrough` · AR #9 / PF-022
- [ ] 2.3.1 Reconcile `codeops/kitchen-sink-gate.md`: route datagrid component stories to this app; record that `kitchen-sink/data-grid.story.ts` (ui read-only `DataGrid`, a different component) is intentionally retained.
- [ ] 2.3.2 Confirm the walkthrough drives all 47 entries and the smoke ST-5/ST-7 pass; fix any demo that clips text or fails to paint. Green.
- [ ] 2.3.3 Full `yarn verify` green. Phase-2 commit. (Optional techdocs/analyze_project re-run per exec_plan post-hooks.)

---

## Acceptance-criteria coverage

RD-15 AC #1 (runnable + dep) → 1.3.1/1.3.3 · AC #2 (navigation) → ST-8 · AC #3 (each demo renders + echo)
→ ST-4, all 2.2.x · AC #4 (placeholders) → ST-6, 1.2.4 · AC #5 (smoke) → 1.1.1/2.1.1 · AC #6 (walkthrough)
→ 1.1.2/2.3.2 · AC #7 (add-one-file + datagrid smoke unchanged) → ST-7, registry shape · AC #8 (gate) →
2.3.1 · AC #9 (full verify) → 1.3.3/2.3.3.
