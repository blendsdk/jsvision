# Execution Plan: Styled Text Severity & Input Placeholder

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-15 19:18 (✅ COMPLETE — all phases green)
> **Progress**: 32/32 tasks (100%) — Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ · Phase 4 ✅ (stories · counts · gate)
> **CodeOps Skills Version**: 3.7.0

## Overview

Implement RD-09: two `@jsvision/core` theme roles (`dangerText`/`warningText`, from the existing
aliases), a `Text.severity` option, an `Input.placeholder` option forwarded to
`DatePicker`/`ComboBox`/`inputBox()`, the kitchen-sink demos, and the stale-role-count fixes. Core
stays zero-dep; `@jsvision/forms` is untouched. Spec-first per phase.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Core theme roles `dangerText`/`warningText` | 9 (8 + 1 runtime) |
| 2 | `Text.severity` | 7 |
| 3 | `Input.placeholder` + propagation | 8 |
| 4 | Stories, role-count fixes & gate | 8 |

**Total: 32 tasks across 4 phases** (31 planned + 1 runtime guard-revision AR-P7; no hour estimates)

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated** after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]` resumed first, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1: Core theme roles `dangerText` / `warningText`

### Step 1.1: Spec first — pin the roles before they exist

**Reference**: `03-01` · `07` ST-C1…C4 · AR-25/27, AR-P3/P4
**Objective**: A failing own-guard that pins the two roles' bytes, the count, and the override-flow.

- [x] 1.1.1 Write `severity-text-theme.spec.test.ts` (ST-C1 byte guard · ST-C2 `length === 67` + names + no-alias-clash · ST-C3 `createTheme` override-flow · ST-C4 monochrome achromatic) — `packages/core/test/severity-text-theme.spec.test.ts` ✅ (completed: 2026-07-15 18:25)
- [x] 1.1.2 Red phase: `yarn workspace @jsvision/core test` — confirmed ST-C1…C4 fail (4 failed: roles absent; count is 65) ✅ (completed: 2026-07-15 18:25)

### Step 1.2: Implement the roles + keep the inventory guards green

**Reference**: `03-01 §Implementation Details` · `07 §Existing specs edited`
**Objective**: The two roles present in all three `: Theme` literals, wired from the aliases, with every guard green.

- [x] 1.2.1 Add `dangerText`/`warningText` to the `Theme` interface + the `defaultTheme` literal (`{fg:'#ef4444'|'#f59e0b', bg:PALETTE.lightGray}`) — `packages/core/src/engine/color/theme.ts` ✅ (completed: 2026-07-15 18:39)
- [x] 1.2.2 Map the roles in `rolesFromAliases` (`{fg:c.danger|c.warning, bg:c.backgroundRaised}`) and add them to `monochromeTheme` (`{fg:W,bg:B}`) — `packages/core/src/engine/color/roles.ts`, `presets.ts` ✅ (completed: 2026-07-15 18:39)
- [x] 1.2.3 Correct the stale `danger?`/`warning?` "drives no built-in role" doc-comments — `packages/core/src/engine/color/create-theme.ts` (`:31,33`) + the matching `aliases.ts:65,67` alias-doc phrasing ✅ (completed: 2026-07-15 18:39)
- [x] 1.2.4 Extend the five UI inventory-tripwire allowlists with both role names (sanctioned additive path) — `packages/ui/test/{feedback,tabs,date,editor,color}-theme.spec.test.ts` ✅ (completed: 2026-07-15 18:39)
- [x] 1.2.5 Update theme-designer for the now-consumed aliases (RD-09 AC #7): drop `danger`/`warning` from `RESERVED_ALIASES` (`:15`) and correct the `(reserved)`/"drives no built-in role" docstrings (`:12,19`); revise `roles-panel.spec.test.ts` (its docstring premise + the two `(reserved)` assertions `:16-17`) so it asserts danger/warning are **no longer** reserved — they now drive `dangerText`/`warningText` (editing the alias re-drives the role: `model.ts:84-85` + `setAlias`). This is the sanctioned oracle-follows-requirement update, not a spec-immutability breach — `packages/theme-designer/src/view/roles-panel.ts`, `packages/theme-designer/test/roles-panel.spec.test.ts` ✅ (completed: 2026-07-15 18:39 — `RESERVED_ALIASES` left empty; `info` unchanged, pre-existing & out of scope)
- [x] 1.2.5a **(runtime, AR-P7 — user-approved)** Two more guards the recon missed encode the same now-overturned premise — revise both into scoped guards: `create-theme.spec.test.ts:180` → override moves **only** `dangerText`/`warningText`; `accelerator-aliases.impl.test.ts:69` → each sentinel lands in its role and leaks nowhere else (+ both docstrings) — `packages/core/test/{create-theme.spec,accelerator-aliases.impl}.test.ts` ✅ (completed: 2026-07-15 18:39)
- [x] 1.2.6 Green phase: `yarn workspace @jsvision/core test && yarn workspace @jsvision/ui test && yarn workspace @jsvision/theme-designer test` — ST-C1…C4 pass; the revised `roles-panel.spec` green; coupling guards (`create-theme.spec` ST-8, `presets.spec` ST-21, `serialize-theme.spec`, `view.drawcontext-role.impl`) + the 5 tripwires green ✅ (completed: 2026-07-15 18:39 — core 740, ui 1586, theme-designer 54 all pass)

**Deliverables**:
- [x] Two roles live in all three literals; `createTheme({danger,warning})` flows through; theme-designer no longer labels danger/warning `(reserved)`; all guards green

**Verify**: `yarn verify`

---

## Phase 2: `Text.severity`

### Step 2.1: Spec first

**Reference**: `03-02 §Text.severity` · `07` ST-U1…U3 · AR-26/27
**Objective**: A failing oracle for the severity→role mapping and back-compat.

- [x] 2.1.1 Write `text-severity.spec.test.ts` (ST-U1 unset→`staticText` · ST-U2 `'error'`→`dangerText` fg · ST-U3 `'warning'`→`warningText` fg) — `packages/ui/test/text-severity.spec.test.ts` ✅ (completed: 2026-07-15 18:42)
- [x] 2.1.2 Red phase: `yarn workspace @jsvision/ui test` — confirmed ST-U2/U3 fail (2 failed: no `severity` option; ST-U1 passes) ✅ (completed: 2026-07-15 18:42)

### Step 2.2: Implement

**Reference**: `03-02 §Text.severity`
**Objective**: `Text` paints via the mapped role; existing call sites unchanged.

- [x] 2.2.1 Add `TextSeverity`/`TextOptions`, the optional ctor arg, and the severity→role map in `draw()`; re-export `TextOptions`/`TextSeverity` from `controls/index.ts` + the `export type` block in `ui/src/index.ts` (sibling convention — every control's Options type is barrel-exported) — `packages/ui/src/controls/text.ts`, `packages/ui/src/controls/index.ts`, `packages/ui/src/index.ts` ✅ (completed: 2026-07-15 18:44)
- [x] 2.2.2 Update the `Text` class `@example` to demonstrate `severity` (keeps `check:docs` valid) — `packages/ui/src/controls/text.ts` ✅ (completed: 2026-07-15 18:44)
- [x] 2.2.3 Green phase: `yarn workspace @jsvision/ui test` — ST-U1…U3 pass ✅ (completed: 2026-07-15 18:44)

### Step 2.3: Impl tests & hardening

**Reference**: `07 §Implementation Tests`

- [x] 2.3.1 Write `text-severity.impl.test.ts` (reactive `() => string` + `severity`; full mapping incl. `undefined`) — `packages/ui/test/text-severity.impl.test.ts` ✅ (completed: 2026-07-15 18:45)
- [x] 2.3.2 Full verify — `yarn verify` (scoped: ui suite 1591 ✅ + typecheck 13/13 ✅ + check:docs ✅; full monorepo build/lint deferred to 4.4.1 per commit-at-end) ✅ (completed: 2026-07-15 18:45)

**Deliverables**:
- [x] `Text.severity` maps to the roles; back-compatible; verify green

**Verify**: `yarn verify`

---

## Phase 3: `Input.placeholder` + propagation

### Step 3.1: Spec first

**Reference**: `03-02 §Input.placeholder` + §Propagation · `07` ST-U4…U12 · AR-28/29/30, AR-22
**Objective**: A failing oracle for the muted placeholder, its invariants, sanitisation, and forwarding.

- [x] 3.1.1 Write `input-placeholder.spec.test.ts` (ST-U4 muted-when-empty · U5 gone-on-first-char · U6 never-in-value · U7 empty · U8 clip-to-width · U9 sanitisation of both strings · U10 DatePicker · U11 ComboBox · U12 inputBox) — `packages/ui/test/input-placeholder.spec.test.ts` ✅ (completed: 2026-07-15 18:51)
- [x] 3.1.2 Red phase: `yarn workspace @jsvision/ui test` — confirmed placeholder-presence cases fail (5 failed: U4/U8/U10/U11/U12; U5/U6/U7/U9 hold regardless) ✅ (completed: 2026-07-15 18:51)

### Step 3.2: Implement

**Reference**: `03-02 §Input.placeholder` + §Propagation (thread points `:133`/`:148`/`:161`)
**Objective**: The muted placeholder renders over an empty value and forwards to the three wrappers.

- [x] 3.2.1 Add `InputOptions.placeholder`, resolve + signal-subscribe on mount, thread into `paintInput`; add `InputPaintState.placeholder` + the muted-when-empty paint branch — `packages/ui/src/controls/input.ts`, `input-render.ts` ✅ (completed: 2026-07-15 19:07 — resolver extracted to `input-render.ts:resolvePlaceholder` to keep `input.ts` under the ≤500-line oracle; see AR-P8 runtime)
- [x] 3.2.2 Update the `Input` class `@example` to demonstrate `placeholder` — `packages/ui/src/controls/input.ts` ✅ (completed: 2026-07-15 19:07)
- [x] 3.2.3 Forward `placeholder` from `DatePickerOptions`→`:133`, `ComboBoxOptions`→`:148` (editable branch), `InputBoxOptions`→`:161` — `packages/ui/src/date/date-picker.ts`, `dropdown/combo-box.ts`, `dialog/message-box.ts` ✅ (completed: 2026-07-15 19:07)
- [x] 3.2.4 Green phase: `yarn workspace @jsvision/ui test` — ST-U4…U12 pass ✅ (completed: 2026-07-15 19:07 — 9/9 placeholder spec)

### Step 3.3: Impl tests & hardening

**Reference**: `07 §Implementation Tests` · AR-P5

- [x] 3.3.1 Write `input-placeholder.impl.test.ts` (`Signal<string>` placeholder repaints; caret over placeholder; focused vs unfocused muted bg; `maxLength`/`validator` unaffected) — `packages/ui/test/input-placeholder.impl.test.ts` ✅ (completed: 2026-07-15 19:07 — 4 impl tests)
- [x] 3.3.2 Full verify — `yarn verify` (scoped: ui suite 1604 ✅ + typecheck 13/13 ✅ + check:docs ✅; full monorepo build/lint deferred to 4.4.1 per commit-at-end) ✅ (completed: 2026-07-15 19:07)

**Deliverables**:
- [x] Placeholder renders + forwards to DatePicker/ComboBox/inputBox; never enters the value; verify green

**Verify**: `yarn verify`

---

## Phase 4: Stories, role-count fixes & gate

### Step 4.1: Spec first — the kitchen-sink demos

**Reference**: `03-03` · `07` ST-S1 · kitchen-sink gate
**Objective**: A failing smoke assertion for the placeholder + severity demos.

- [x] 4.1.1 Extend `kitchen-sink.smoke.spec.test.ts` with ST-S1 (placeholder demo paints its hint; a severity demo renders) — `packages/examples/test/kitchen-sink.smoke.spec.test.ts` ✅ (completed: 2026-07-15 19:10)
- [x] 4.1.2 Red phase: `yarn workspace @jsvision/examples test` — confirmed ST-S1 fails (1 failed, 54 pass) ✅ (completed: 2026-07-15 19:10)

### Step 4.2: Implement the demos

**Reference**: `03-03 §Stories`
**Objective**: Live placeholder + severity demos, green under the smoke test.

- [x] 4.2.1 Add a placeholder `Input` demo to the Input story — `packages/examples/kitchen-sink/stories/input.story.ts` ✅ (completed: 2026-07-15 19:11)
- [x] 4.2.2 Add a `severity: 'error'`/`'warning'` `Text` demo to the Theming story (folded into `theming/presets` at row 15, within the smoke's 16-row mount — no new registration) — `packages/examples/kitchen-sink/stories/theming.story.ts` ✅ (completed: 2026-07-15 19:11)
- [x] 4.2.3 Green phase: `yarn workspace @jsvision/examples test` — ST-S1 + the generic smoke tests pass ✅ (completed: 2026-07-15 19:11 — 164 pass)

### Step 4.3: Role-count honesty pass

**Reference**: `03-03 §Role-count string corrections`
**Objective**: Every user-visible "63" → "67"; the count is now guarded by ST-C2.

- [x] 4.3.1 Correct all ten "63" role-count strings to "67" — `packages/core/src/engine/color/{aliases.ts,index.ts}`, `packages/theme-designer/src/{view/roles-panel.ts,model/types.ts}`, `packages/examples/kitchen-sink/stories/theming.story.ts` (grep `\b63\b` near "role" confirmed none missed) ✅ (completed: 2026-07-15 19:12)

### Step 4.4: Final gate

**Reference**: `03-02`/`03-03` · RD AC #9 · project Prime directive · AR-P1
**Objective**: `yarn verify` green across the branch; CI lands green.

- [x] 4.4.1 Full `yarn verify` — typecheck/build/test/`check:docs`/`check:deps` green; no banned CodeOps/TV refs in shipped `packages/*/src` ✅ (completed: 2026-07-15 19:18 — `TUI_SKIP_PERF=1 yarn verify` exit 0, all 26 turbo tasks; `check:deps` 11/11; the sole raw-verify failure was `editor-perf.spec` ST-35, the load-sensitive 16 ms perf ceiling that per CLAUDE.md never gates + is skipped under CI/TUI_SKIP_PERF — unrelated to RD-09, passes in isolation)
- [x] 4.4.2 Run `yarn lint:fix`; confirm the working tree is clean (commit handled by the active commit mode / `/gitcmp`) ✅ (completed: 2026-07-15 19:18 — lint:fix reformatted `combo-box.ts`; tree is lint-clean + verify-green; commit deferred to end per commit-at-end mode)

**Deliverables**:
- [x] Both demos green; all counts corrected; `yarn verify` green; tree clean

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (core roles)          ← Text/Input can't reference the roles until they exist
    ↓
Phase 2 (Text.severity)
    ↓
Phase 3 (Input.placeholder + propagation)
    ↓
Phase 4 (stories · counts · gate)   ← runs last over the whole branch
```

---

## Success Criteria

**Feature is complete when** (mapped 1:1 to RD-09 §Acceptance Criteria):

1. ✅ `dangerText`/`warningText` are required roles; `defaultTheme` fg `#ef4444`/`#f59e0b`; `createTheme` override flows through; no role name equals an alias name (AC 1)
2. ✅ `Text.severity` maps `'error'`→`dangerText`, `'warning'`→`warningText`, unset→`staticText`; existing calls unchanged (AC 2)
3. ✅ `Input.placeholder` muted-when-empty, gone on first char, never in the value (AC 3/4)
4. ✅ Forwarded to `DatePicker`/`ComboBox`/`inputBox` (AC 5)
5. ✅ Both new strings sanitised on the render path (AC 6/10)
6. ✅ Own-guard + 5 tripwires green; theme-designer `RESERVED_ALIASES` + `roles-panel.spec` revised so danger/warning are no longer reserved (they now drive roles); count guarded at 67 (AC 7)
7. ✅ Kitchen-sink demos pass the smoke test; "63"→"67" corrected (AC 8)
8. ✅ `yarn verify` + `check:docs` green; class `@example`s updated; no banned refs; `yarn lint:fix` clean (AC 9)
9. ✅ No dead code; no new runtime dependency (core/ui zero-dep)
10. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
