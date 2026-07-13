# Execution Plan: UI Small Batch

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-09
> **Progress**: 27/27 tasks (100%) — ✅ COMPLETE
> **CodeOps Skills Version**: 3.3.2

## Overview

Three additive `@jsvision/ui` enhancements, spec-first, one phase each, plus a docs/gate phase.
Phase 1 = Tree `markerStyle` (GH #17). Phase 2 = duplicate-accelerator dev-warning across all tilde
scopes (GH #6). Phase 3 = the `Switch` control (GH #11). Phase 4 = docs + full gate. The phases are
independent and may ship in separate commits.

**🚨 Update this document after EACH completed task!**

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Tree markers — `markerStyle` (GH #17) | 7 |
| 2 | Duplicate-accelerator warning (GH #6) | 9 |
| 3 | `Switch` / toggle control (GH #11) | 8 |
| 4 | Docs, CHANGELOG & final gate | 3 |

**Total: 27 tasks across 4 phases.**

> **⚠️ EXECUTION RULE:** the task checkboxes are the single source of truth for progress. Mark `[~]`
> with a timestamp on implementation, promote to `[x]` only after its verify passes, update the Progress
> header after every task. Resume at the first `[~]` then the first `[ ]`. Timestamps via `date '+%Y-%m-%d %H:%M'`.
> Specification-first: spec tests → red → implement → green → impl tests → verify.
> **Verify** (every task): `yarn verify`. **Never** put raw git in this doc — commit via `/gitcm` / `/gitcmp`.

---

## Phase 1: Tree markers (GH #17)

**Reference**: [03-01](03-01-tree-markers.md) · [07](07-testing-strategy.md) ST-1…ST-8 · AR-2…AR-6

### Step 1.1: Spec tests (RED)

- [x] 1.1.1 Spec tests for `createGraph`/`graphWidth` per style + no-Unicode fallback + `Tree` render — a **new** `packages/ui/test/tree-markers.spec.test.ts` (own ST-1…ST-8; kept separate so its ST IDs don't collide with the existing `tree-graph.spec` ST-1…ST-7). The `'tv'` oracles in `tree-graph.spec.test.ts` + `fidelity.tree.spec.test.ts` stay byte-unchanged. _(impl 2026-07-09 13:33)_
- [x] 1.1.2 Verify RED: new cases fail; the existing `'tv'` oracle still passes _(RED confirmed: 7 fail, ST-1 tv-default passes)_

### Step 1.2: Implementation (GREEN)

- [x] 1.2.1 Add `MarkerStyle` + style-aware marker/`endWidth` in `createGraph`/`graphWidth` (default `'tv'`) — `packages/ui/src/tree/graph.ts` _(impl 2026-07-09 13:36)_
- [x] 1.2.2 Add `TreeOptions.markerStyle` (default `'tv'`); thread the effective style (caps fallback for `triangle`) through `tree.ts` → `tree-rows.ts` for both draw + `graphWidth` hit-zone; export `MarkerStyle` from `tree/index.ts` + `packages/ui/src/index.ts` _(impl 2026-07-09 13:36)_
- [x] 1.2.3 Verify GREEN: ST-1…ST-8 pass; existing Tree fidelity + golden/a11y suites unchanged _(1464 ui tests pass; typecheck clean)_

### Step 1.3: Impl tests & story

- [x] 1.3.1 Impl tests — deep-level bracket geometry, alignment, leaf blanks, mouse toggle at the 5-cell graphic — `packages/ui/test/tree-markers.impl.test.ts` _(impl 2026-07-09 13:38; 5 tests pass)_
- [x] 1.3.2 Update the kitchen-sink `tree` story to show a non-`tv` `markerStyle`; smoke green — `packages/examples/kitchen-sink/stories/tree.story.ts` _(markerStyle: 'brackets')_
- [x] 1.3.3 Full `yarn verify` green for Phase 1 _(16/16 turbo tasks; 1469 ui tests; the flaky off-CI editor-perf wall-clock assertion passes in isolation)_

---

## Phase 2: Duplicate-accelerator warning (GH #6)

**Reference**: [03-02](03-02-duplicate-accelerators.md) · [07](07-testing-strategy.md) ST-9…ST-18 · AR-7…AR-13

### Step 2.1: Spec tests (RED)

- [x] 2.1.1 Spec tests for pure `findDuplicateAccelerators()` (ST-9…ST-13) — `packages/ui/test/accelerators.spec.test.ts` _(impl 2026-07-09 13:50)_
- [x] 2.1.2 Spec tests for scope warnings (ST-14…ST-18) — **consolidated into the new `accelerators.spec.test.ts`** (the existing menu/dialog/tabs specs already use ST-16…18 / ST-09…12 / ST-14…18, so folding these in would collide — same isolation as PF-002; AR-25 runtime note) _(impl 2026-07-09 13:50)_
- [x] 2.1.3 Verify RED _(module missing → import fails, no tests run)_

### Step 2.2: Implementation (GREEN)

- [x] 2.2.1 Pure `findDuplicateAccelerators()` + `DuplicateAccelerator` + `reportDuplicateAccelerators()` — `packages/ui/src/menu/accelerators.ts`; exported from barrel with `@example` _(impl 2026-07-09 13:58)_
- [x] 2.2.2 Shared scope-tagged `devWarn(scope, message)` — `packages/ui/src/shared/warnings.ts` (reactive keeps its own `reactive`-prefixed devWarn, untouched); exported from barrel with `@example` _(impl 2026-07-09 13:58)_
- [x] 2.2.3 Additive `View.accelerators()` seam (default `[]`) + `acceleratorScope` boundary flag + overrides on `Button`/`Label`/`Cluster` — `view/view.ts`, `controls/*`. Tabs use the data-level `tabs()` check (no view override) _(impl 2026-07-09 13:58)_
- [x] 2.2.4 Wired the auto (dev-gated) checks: **submenu items** at `subMenu()` in `menu/builders.ts`; **bar titles** at `menuBar()` in `menu/menubar.ts`; **Dialog** focus scope via a mount-time `collectAccelerators` walk stopping at `acceleratorScope` boundaries; **TabView** via a mount-time data-level check over `tabs()` (strip only) _(impl 2026-07-09 13:58)_
- [x] 2.2.5 Verify GREEN: ST-9…ST-18 pass; 1480 ui tests pass; typecheck clean; production-silent (ST-15) _(2026-07-09 13:59)_

### Step 2.3: Impl tests & hardening

- [x] 2.3.1 Impl tests — validator multi-group ordering, disabled-cluster-item counts, nested-`Dialog`/`TabView` scope isolation, real within-dialog Label+Button collision — `packages/ui/test/accelerators.impl.test.ts` _(impl 2026-07-09 14:00; 8 tests pass)_
- [x] 2.3.2 Full `yarn verify` green for Phase 2 _(16/16 turbo tasks; 1488 ui tests; check:docs clean — `devWarn` kept internal to avoid a public duplicate-name collision with the reactive `devWarn`)_

---

## Phase 3: `Switch` / toggle (GH #11)

**Reference**: [03-03](03-03-switch-toggle.md) · [07](07-testing-strategy.md) ST-19…ST-27 · AR-14…AR-19

### Step 3.1: Spec tests (RED)

- [x] 3.1.1 Spec tests — toggle via Space/Enter/click/Alt-hotkey, on/off/focus/disabled render, caps fallback, `measure()` (ST-19…ST-26) — `packages/ui/test/switch.spec.test.ts` _(impl 2026-07-09 14:08)_
- [x] 3.1.2 Verify RED _(Switch not exported → import fails)_

### Step 3.2: Implementation (GREEN)

- [x] 3.2.1 Implement `Switch extends View` + `SwitchOptions` (bind, keyboard/click/Alt-hotkey, track+knob draw with role reuse, caps fallback, `measure()`, `accelerators()` override for #6 consistency) with `@example` — `packages/ui/src/controls/switch.ts` _(impl 2026-07-09 14:08)_
- [x] 3.2.2 Export `Switch` + `SwitchOptions` from `controls/index.ts` + `packages/ui/src/index.ts` _(impl 2026-07-09 14:08)_
- [x] 3.2.3 Verify GREEN: ST-19…ST-26 pass (no new `@jsvision/core` role) _(1496 ui tests; typecheck clean)_

### Step 3.3: Impl tests & story

- [x] 3.3.1 Impl tests — Enter toggle, disabled ignores click/Alt-hotkey, wheel ignored, `onLabel`/`offLabel` omission, `accelerators()`, `select()` — `packages/ui/test/switch.impl.test.ts` _(impl 2026-07-09 14:09; 7 tests pass)_
- [x] 3.3.2 Kitchen-sink `controls/switch` story (Wi-Fi/Sound/Locked, hotkeys + disabled, bound echo) + registered in `stories/index.ts`; smoke green (ST-27) — `packages/examples/kitchen-sink/stories/switch.story.ts` _(impl 2026-07-09 14:10)_
- [x] 3.3.3 Full `yarn verify` green for Phase 3 _(16/16 turbo tasks; 1503 ui tests incl. the `controls/switch` smoke story; check:docs clean)_

---

## Phase 4: Docs, CHANGELOG & final gate

- [x] 4.1 Updated `CHANGELOG.md` `[Unreleased]` (three additive entries: Switch, Tree markerStyle, duplicate-accelerator warning) + a `CLAUDE.md` `switch.ts` note on the controls line (the structure block is otherwise stale pre-tree/table — a full refresh is deferred to `/analyze_project`) _(2026-07-09 14:14)_
- [x] 4.2 Roadmap: B-01 → Done; cascaded to the portfolio roadmap _(2026-07-09 14:15)_
- [x] 4.3 Final gate: full `yarn verify` green (16/16 turbo tasks; lint + typecheck + build + test + check:docs + kitchen-sink smoke) _(2026-07-09 14:15)_

---

## Notes / deviations

- Record any runtime ambiguity here with an `AR-NN (runtime)` row added to [00-ambiguity-register.md](00-ambiguity-register.md).
- StatusLine chord-collision (GH #6 fast-follow) and a Tree per-node marker override are explicitly out of scope.
