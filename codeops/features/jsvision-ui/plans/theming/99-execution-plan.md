# Execution Plan: Theming

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-08 21:10
> **Progress**: 36/46 tasks (78%)
> **CodeOps Skills Version**: 3.3.2

## Overview

Implement RD-22 theming across `@jsvision/core` (model), `@jsvision/ui` (hot-swap), and
`@jsvision/examples` (designer + story). Additive-only; `defaultTheme` output stays byte-unchanged.
Each feature phase follows specification-first ordering: **spec tests → red → implement → green →
impl tests → verify**.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Aliases, Ramp & Contrast (core, pure) | 7 |
| 2 | createTheme & rolesFromAliases (core) | 6 |
| 3 | Attrs & Serialize (core + ui) | 7 |
| 4 | Presets & Governance (core) | 8 |
| 5 | Hot-swap (ui) | 6 |
| 6 | Designer & Story (examples) | 7 |
| 7 | Final hardening & gate | 5 |

**Total: 46 tasks across 7 phases** (scope bounded by the task-size criteria in the quality checklist).

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line appears
> exactly once. The executing agent MUST:
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated** after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]`, else first `[ ]`.
>
> Timestamps from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1: Aliases, Ramp & Contrast

### Step 1.1: Spec tests (red)
**Reference**: `03-01` · ST-1…ST-6 (`07-testing-strategy.md`) · AR-268, AR-273, AR-283

- [x] 1.1.1 Write OKLab ramp spec (ST-1…ST-4) — `packages/core/test/ramp.spec.test.ts` ✅ (completed: 2026-07-08 20:15)
- [x] 1.1.2 Write contrast spec (ST-5, ST-6) — `packages/core/test/contrast.spec.test.ts` ✅ (completed: 2026-07-08 20:15)
- [x] 1.1.3 Verify both FAIL (red phase — no implementation yet) ✅ (completed: 2026-07-08 20:15)

### Step 1.2: Implement (green)
**Reference**: `03-01 §Implementation Details`

- [x] 1.2.1 `ThemeColors` interface + per-token doc comments — `packages/core/src/engine/color/aliases.ts` ✅ (completed: 2026-07-08 20:20)
- [x] 1.2.2 OKLab conversions (internal) + `ramp`/`lighten`/`darken`/`mix` with `@example` each — `packages/core/src/engine/color/ramp.ts` ✅ (completed: 2026-07-08 20:20)
- [x] 1.2.3 `contrastRatio` with `@example` — `packages/core/src/engine/color/contrast.ts` ✅ (completed: 2026-07-08 20:20)
- [x] 1.2.4 Re-export `ramp`/`lighten`/`darken`/`mix`/`contrastRatio` + type `ThemeColors` — `color/index.ts` + `engine/index.ts` ✅ (completed: 2026-07-08 20:20)

**Deliverables**:
- [x] ST-1…ST-6 pass (green) ✅ (completed: 2026-07-08 20:20)

### Step 1.3: Impl tests & verify

- [x] 1.3.1 Impl tests (gamut-clamp edges, ramp step-count boundaries, `mix` endpoints ST-3) — `*.impl.test.ts` ✅ (completed: 2026-07-08 20:20)

**Verify**: `yarn verify`

---

## Phase 2: createTheme & rolesFromAliases

### Step 2.1: Spec tests (red)
**Reference**: `03-02` · ST-7…ST-11 · AR-267, AR-269, PA-2

- [x] 2.1.1 Write builder + 63-role mapping spec (ST-7…ST-11) — `packages/core/test/create-theme.spec.test.ts` ✅ (completed: 2026-07-08 20:24)
- [x] 2.1.2 Verify FAIL (red) ✅ (completed: 2026-07-08 20:24)

### Step 2.2: Implement (green)
**Reference**: `03-02 §Implementation Details` (the full 63-role mapping table)

- [x] 2.2.1 `ThemeOptions` + `createTheme` (`@example`) + `rolesFromAliases` (`@example`) — the 63-role semantic-collapse map — `packages/core/src/engine/color/create-theme.ts` (split `rolesFromAliases` → `roles.ts` per PA-8) ✅ (completed: 2026-07-08 20:44)
- [x] 2.2.2 Re-export `createTheme`/`rolesFromAliases` + type `ThemeOptions` — `color/index.ts` + `engine/index.ts` ✅ (completed: 2026-07-08 20:44)

**Deliverables**:
- [x] ST-7…ST-11 pass (green) ✅ (completed: 2026-07-08 20:44)

### Step 2.3: Impl tests & verify

- [x] 2.3.1 Impl tests (neutral-omitted default per mode, `overrides` alias-step merge, `roleOverrides` deep-merge depth) — `*.impl.test.ts` ✅ (completed: 2026-07-08 20:44)

**Verify**: `yarn verify`

---

## Phase 3: Attrs & Serialize

### Step 3.1: Spec tests (red)
**Reference**: `03-03` · ST-12…ST-20 · AR-271, AR-281, AR-282, PA-4, PA-5

- [x] 3.1.1 Write `themeRoleToStyle` attrs + attr-free-invariance spec (ST-12) — `packages/ui/test/theme-style.spec.test.ts` ✅ (completed: 2026-07-08 20:47)
- [x] 3.1.2 Write serialize/parse spec incl. the rejection matrix (ST-13…ST-20) — `packages/core/test/serialize-theme.spec.test.ts` ✅ (completed: 2026-07-08 20:47)
- [x] 3.1.3 Verify FAIL (red) ✅ (completed: 2026-07-08 20:47)

### Step 3.2: Implement (green)
**Reference**: `03-03 §Implementation Details`

- [x] 3.2.1 Add optional `attrs?: AttrMask` to `ThemeRole` (`Theme`/`defaultTheme` untouched) — `packages/core/src/engine/color/theme.ts` ✅ (completed: 2026-07-08 20:53)
- [x] 3.2.2 `themeRoleToStyle` copies `attrs` only when present (attr-free → exactly `{fg,bg}`) — `packages/ui/src/view/theme-style.ts` ✅ (completed: 2026-07-08 20:53)
- [x] 3.2.3 `serializeTheme`/`parseTheme`/`InvalidThemeError` (`@example`; `{version,roles}` envelope; field-kind validation; single-cell `pattern` per PA-5; shape derived from `defaultTheme`) — `packages/core/src/engine/color/serialize.ts` ✅ (completed: 2026-07-08 20:53)
- [x] 3.2.4 Re-export `serializeTheme`/`parseTheme`/`InvalidThemeError` — `color/index.ts` + `engine/index.ts` ✅ (completed: 2026-07-08 20:53)

**Deliverables**:
- [x] ST-12…ST-20 pass (green) ✅ (completed: 2026-07-08 20:53)

### Step 3.3: Impl tests & verify

- [x] 3.3.1 Impl tests (serialize key-order stability; round-trip on a `createTheme` output) — `*.impl.test.ts` ✅ (completed: 2026-07-08 20:53)

**Verify**: `yarn verify`

---

## Phase 4: Presets & Governance

### Step 4.1: Spec tests (red)
**Reference**: `03-04` · ST-21…ST-27 · AR-270, AR-272, PA-4, PA-6

- [x] 4.1.1 Write presets spec (ST-21, ST-22, ST-24) + `defaultTheme`-invariance reference (ST-23) — `packages/core/test/presets.spec.test.ts` ✅ (completed: 2026-07-08 20:58)
- [x] 4.1.2 Write depth-robustness golden (ST-25) — `packages/core/test/presets-depth.spec.test.ts` ✅ (completed: 2026-07-08 20:58)
- [x] 4.1.3 Write `theme-packaging.spec` (ST-27) + preset-absence tree-shake sibling (ST-26) — `packages/core/test/theme-packaging.spec.test.ts`, `theme-treeshake.spec.test.ts` ✅ (completed: 2026-07-08 20:58)
- [x] 4.1.4 Verify FAIL (red) ✅ (completed: 2026-07-08 20:58)

### Step 4.2: Implement (green)
**Reference**: `03-04 §Implementation Details`

- [x] 4.2.1 7 presets — `monochrome` (hand-authored, attr-driven), `turboVision` (= `defaultTheme`), `slate` (generated), `nord`/`dracula`/`solarizedDark`/`gruvboxDark` (generated + canonical-hex overrides + `/* @__PURE__ */` for tree-shaking) — `packages/core/src/engine/color/presets.ts` ✅ (completed: 2026-07-08 21:02)
- [x] 4.2.2 Re-export the 7 presets — `color/index.ts` + `engine/index.ts` ✅ (completed: 2026-07-08 21:02)
- [x] 4.2.3 CHANGELOG `[Unreleased]` entry naming the new exports — root `CHANGELOG.md` ✅ (completed: 2026-07-08 21:02)

**Deliverables**:
- [x] ST-21…ST-27 pass (green); existing `*-theme.spec` oracles still pass (ST-23) ✅ (completed: 2026-07-08 21:02)

### Step 4.3: Impl tests & verify

- [x] 4.3.1 Impl tests (each curated preset round-trips; `monochrome` state-distinction-by-attrs matrix) — `*.impl.test.ts` ✅ (completed: 2026-07-08 21:02)

**Verify**: `yarn verify`

---

## Phase 5: Hot-swap

### Step 5.1: Spec tests (red)
**Reference**: `03-05` · ST-28, ST-29 · AR-276, AR-279, PA-3

- [x] 5.1.1 Write `RenderRoot.setTheme` spec (ST-28) — `packages/ui/test/render-theme-swap.spec.test.ts` ✅ (completed: 2026-07-08 21:08)
- [x] 5.1.2 Write `EventLoop`/`Application.setTheme` out-of-tick push spec (ST-29) — `packages/ui/test/app-theme-swap.spec.test.ts` ✅ (completed: 2026-07-08 21:08)
- [x] 5.1.3 Verify FAIL (red) ✅ (completed: 2026-07-08 21:08)

### Step 5.2: Implement (green)
**Reference**: `03-05 §Implementation Details`

- [x] 5.2.1 `RenderRoot.setTheme` — mutable `theme` field + `markRelayout()`; add to the `RenderRoot` interface (`@example`) — `packages/ui/src/view/render-root.ts` ✅ (completed: 2026-07-08 21:10)
- [x] 5.2.2 `EventLoop.setTheme` (runTick-wrapped) on the interface + impl — `packages/ui/src/event/{types,event-loop}.ts` ✅ (completed: 2026-07-08 21:10)
- [x] 5.2.3 `Application.setTheme` forwards to `loop.setTheme` (interface + returned object) — `packages/ui/src/app/application.ts` ✅ (completed: 2026-07-08 21:10)

**Deliverables**:
- [x] ST-28, ST-29 pass (green) ✅ (completed: 2026-07-08 21:10)

### Step 5.3: Impl tests & verify

- [x] 5.3.1 Impl test (re-entrant `setTheme` from an `onCommand` handler coalesces to one frame) — `*.impl.test.ts` ✅ (completed: 2026-07-08 21:10)

**Verify**: `yarn verify`

---

## Phase 6: Designer & Story

### Step 6.1: Spec tests (red)
**Reference**: `03-06` · ST-30…ST-35 · AR-278, AR-273, AR-283, Kitchen-sink gate

- [ ] 6.1.1 Write pure-designer spec (ST-30…ST-33) — `packages/examples/test/themes-designer.spec.test.ts`
- [ ] 6.1.2 Extend the kitchen-sink smoke for the `Theming` story + every-preset mount (ST-35) — `packages/examples/test/kitchen-sink.smoke.spec.test.ts`
- [ ] 6.1.3 Verify FAIL (red)

### Step 6.2: Implement (green)
**Reference**: `03-06 §Implementation Details`

- [ ] 6.2.1 Pure `designer.ts` — state machine + `currentTheme`/`exportJson`/`contrastWarnings`/cycles — `packages/examples/themes-demo/designer.ts`
- [ ] 6.2.2 Real-TTY `main.ts` (`createApplication` + `app.setTheme` live repaint + export panel + depth toggle + `loadTheme`) — `packages/examples/themes-demo/main.ts`
- [ ] 6.2.3 `theming.story.ts` + registry line + `"demo:themes"` script — `kitchen-sink/stories/{theming.story,index}.ts`, `packages/examples/package.json`

**Deliverables**:
- [ ] ST-30…ST-33, ST-35 pass (green)

### Step 6.3: Impl tests & verify

- [ ] 6.3.1 Designer walkthrough e2e (ST-34) — `packages/examples/test/themes-demo.e2e.test.ts`

**Verify**: `yarn verify` (+ `yarn workspace @jsvision/examples test:e2e`)

---

## Phase 7: Final hardening & gate

**Reference**: PA-1 (verify command) · RD-22 AC-17, AC-18 · JSDoc directive

- [ ] 7.1.1 `yarn lint` (+ `yarn lint:fix`) clean across the repo
- [ ] 7.1.2 Per-package `yarn typecheck` (core, ui, examples) clean
- [ ] 7.1.3 `check-jsdoc` passes — `@example` on every new public function/class; no banned refs in shipped `src`
- [ ] 7.1.4 Full `yarn verify` clean; confirm NO regressions in the existing `*-theme.spec` / `golden-screen` / `a11y-golden` suites (ST-23)
- [ ] 7.1.5 Commit via **/gitcm** (or **/gitcmp**) — do not run raw git

**Verify**: `yarn verify` **+ `yarn lint` + per-package `yarn typecheck`** (the final done-gate, PA-1)

---

## Dependencies

```
Phase 1 (ramp/contrast/aliases)
    ↓
Phase 2 (createTheme/roles) ──────┐
    ↓                             │
Phase 3 (attrs/serialize)         │
    ↓                             │
Phase 4 (presets ← needs 2+3) ────┘
    ↓
Phase 5 (hot-swap ← needs a preset for ST-28/29)
    ↓
Phase 6 (designer/story ← needs 1–5)
    ↓
Phase 7 (final gate)
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 7 phases completed
2. ✅ `yarn verify` + `yarn lint` + per-package `yarn typecheck` all pass (PA-1)
3. ✅ No warnings/errors; no regressions in existing `*-theme`/`golden-screen`/`a11y-golden` suites
4. ✅ No dead code — no unused parameters, functions, classes, or modules
5. ✅ Security hardened — `parseTheme` rejection matrix (ST-15…ST-20) passes; core does no fs (AC-18)
6. ✅ Documentation updated — `@example` on every new public function/class; CHANGELOG `[Unreleased]`
7. ✅ `defaultTheme` output byte-unchanged (the `*-theme.spec` `toStrictEqual` oracles pass, ST-23)
8. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
