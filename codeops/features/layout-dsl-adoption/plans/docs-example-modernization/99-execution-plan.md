# Execution Plan: docs-example-modernization

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-20 18:05
> **Progress**: 30/41 tasks (73%) — Phase 1 complete · Phase 2 complete
> **CodeOps Skills Version**: 3.11.0

## Overview

Build the missing `@example` compile guard, then use it to modernize every layout-shaped example
onto the layout DSL, then retire the seven `at()` shadows in the docs-site examples. GH #112.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks | Routing |
|---|---|---|---|
| 1 | The `@example` compile guard | 15 | complex |
| 2 | JSDoc example modernization | 15 | standard |
| 3 | docs-site shadow retirement | 8 | standard |
| 4 | Close-out | 3 | trivial |

**Total: 41 tasks across 4 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header and Last Updated stamp after EVERY task** — never batch.
>    Only `[x]` counts as complete.
> 4. **Resume** by scanning top-to-bottom: the first `[~]` is resumed first, else the first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

> **🚨 Phase ordering is load-bearing.** Phase 1 is the oracle for phases 2 and 3, and its allowlist
> must capture the **pre-sweep** baseline. Running phase 2 first would silently grandfather anything
> the sweep broke. Do not reorder.

---

## Phase 1: The `@example` compile guard

> **Phase ref**: `f78ff0a0` (phase start)
> **Lenses**: api-surface · perf
> **Routing**: complex — TypeScript compiler API work: a custom `CompilerHost`, JSDoc-tag
> de-duplication across binding nodes, and a keying scheme with three collision cases. Not core
> engine, but nowhere near mechanical.

### Step 1.1: Specification tests

**Reference**: [07](07-testing-strategy.md) ST-1…ST-8, ST-13, ST-14 · [03-01](03-01-example-compile-guard.md) · AR-2, AR-5, AR-9, AR-10, AR-11, AR-12, AR-13, AR-14, AR-15, AR-16
**Objective**: Pin the guard's contract before any of it exists.

- [x] 1.1.1 ✅ (completed: 2026-07-20 16:24) Author the fixtures under `packages/docs-site/test/fixtures/jsdoc-examples/` — a compiling example; a wrong-arity example; a `TS2304` example naming one identifier plus a variant naming two (ST-5); a fenced example; a relative-import example plus its sibling; a two-symbol file (ST-8); a **same-symbol two-block** file mirroring `controls/input.ts:47,58` (ST-14); and an `export const` with one `@example` for the de-duplication impl case. **No fixture may import `@jsvision/*`** (07 §authoring rule)
- [x] 1.1.2 ✅ (completed: 2026-07-20 16:24) [spec-author] Write ST-1…ST-8, ST-13, ST-14 as `checkExamples(collectExamples([fixtureRoot]), injectedAllowlist)` — `packages/docs-site/test/jsdoc-examples.spec.test.ts`. **Drive them through `collectExamples`, not hand-built blocks** — fence stripping and key resolution live there, so a hand-built block makes ST-6 and ST-14 assert nothing. **Do not write ST-12 here**: it needs the allowlist that 1.3.1 creates
- [x] 1.1.3 ✅ (completed: 2026-07-20 16:24) Verify RED — all **nine** fail (the module under test does not exist). Capture the run **after** the fixtures land, or it proves nothing

**Deliverables**: fixtures committed · nine failing spec cases · red run captured
**Verify**: `yarn workspace @jsvision/docs-site test` (inner loop — `yarn verify` is the gate at each step boundary, per AR-8)

### Step 1.2: Implement the harness

**Reference**: [03-01](03-01-example-compile-guard.md) §Implementation details
**Objective**: Make ST-1…ST-8, ST-13 and ST-14 green.

- [x] ✅ (completed: 2026-07-20 16:30) 1.2.1 Implement `collectExamples()` in **`packages/docs-site/src/api/jsdoc-examples.mjs`** (in `src/`, not `test/` — it mirrors `src/api/barrel-exports.mjs`, and `tsconfig.json` typechecks `src/**` but not `test/**`). Walk the **six enumerated roots** `core,ui,web,files,datagrid,forms` — never a `packages/*/src` glob (AR-15). Pull `@example` bodies via `ts.getTextOfJSDocComment`; **de-duplicate by `(file, tag.pos)` and resolve the symbol from the outermost declaration owning the JSDoc** — a naive `getJSDocTags` walk mints one block per *binding node* and produces phantom `(anonymous)` twins (02 §Correction 1); strip code fences unconditionally (AR-12); un-escape `*\/` → `*/`; key as `file::Symbol`, `Class.member` for members, `#N` where a key repeats (AR-10)
- [x] ✅ (completed: 2026-07-20 16:30) 1.2.2 Implement `checkExamples()` — the **six**-row verdict table in 03-01, matching on the **set of diagnostic codes plus the identifier named by each `TS2304`**, never message text and never a single first code (five of the six blocks Phase 2 edits are `TS2304`-grandfathered and a forgotten `at` import is also `TS2304`). Report `stale` for entries that now compile **and** for entries naming a vanished file or symbol (AR-9, AR-11)
- [x] ✅ (completed: 2026-07-20 16:30) 1.2.3 Implement the compile path — **in-memory `ts.CompilerHost`, no filesystem writes at all** (AR-16): each block served as a virtual `SourceFile` at a path **inside its own source's directory** (AR-13 — relative specifiers and `type: module` for the 37 top-level-`await` blocks both depend on it), `writeFile` a no-op, one `ts.createProgram` with `tsconfig.base.json`'s options plus exactly three overrides — `noUnusedLocals: false`, `noUnusedParameters: false` (AR-14), `noEmit: true`
- [x] ✅ (completed: 2026-07-20 16:30) 1.2.4 Add `@jsvision/datagrid` and `@jsvision/forms` to `packages/docs-site/package.json` devDependencies — AR-15 puts them in the guard's roots, and without the declared dependency turbo's `^build` does not order their builds before `docs-site#test`, making the allowlist build-order dependent
- [x] ✅ (completed: 2026-07-20 16:30) 1.2.5 Verify GREEN — ST-1…ST-8, ST-13, ST-14 pass (nine cases)

**Deliverables**: harness module in `src/api/` · nine green spec cases · docs-site devDeps updated
**Verify**: `yarn workspace @jsvision/docs-site test`

### Step 1.3: Establish the baseline

**Reference**: [02](02-current-state.md) §Measured baseline · [01](01-requirements.md) FR-9
**Objective**: Generate the committed allowlist from the **pre-sweep** repo.

- [x] ✅ (completed: 2026-07-20 16:37) 1.3.1 Run the guard over the real repo; generate `packages/docs-site/test/jsdoc-examples.allowlist.json`, sorted, one entry per line, keyed `file::Symbol` with the recorded `codes`, `missingNames` and human-readable `message` (FR-9, and see 03-01 §The allowlist contract for the object shape — the value is **not** a bare string)
- [x] ✅ (completed: 2026-07-20 16:37) 1.3.2 Cross-check against [02](02-current-state.md): confirm the **nine layout-block failures** are present and correctly keyed, and that `application.ts::syncOverlayVisible` is present. **No count is a gate.** The corrected expectation is ~377 blocks and ~160 failures, but the real number is whatever the harness reports — the planning probe's "451/192" were artifacts of a multi-count and of running without `noUnusedLocals`, both now corrected. *(The original "stop if it reports more" rule is deliberately removed: a correct harness legitimately reports more than the probe did.)*
- [x] ✅ (completed: 2026-07-20 16:37) 1.3.3 Record the true block count, failure count and wall-clock in [02](02-current-state.md) §Measured baseline, replacing the corrected-but-still-estimated figures
- [x] ✅ (completed: 2026-07-20 16:37) 1.3.4 [spec-author] **Wire the standing gate (FR-1a).** Add **ST-12** to `jsdoc-examples.spec.test.ts`: `checkExamples(collectExamples(SHIPPED_ROOTS), readAllowlist())` reports zero `unexpected` and zero `stale`, and **fails the suite** when it does not. Green on arrival — it is authored after the allowlist exists, which is why it is excluded from 1.1.3's red run. **Without this task the harness, the fixtures and the allowlist all exist and none of them gates anything**; FR-1/FR-2 would ship inert and Phase 2 would have no oracle

**Deliverables**: allowlist committed · 02 updated with real numbers · **ST-12 green — the guard now actually gates the build**
**Verify**: `yarn verify`

### Step 1.4: Harden

**Reference**: [07](07-testing-strategy.md) §Implementation tests · AC-9
**Objective**: Cover what the oracle does not reach.

- [x] ✅ (completed: 2026-07-20 16:37) 1.4.1 Write `packages/docs-site/test/jsdoc-examples.impl.test.ts` — fence variants (` ``` `, ` ```ts `, ` ```typescript `, none) applied package-agnostically; **comment-terminator un-escaping**; the `(anonymous)` fallback and its `#N` ordinal; the `Class.member` qualifier; and **multi-node tag de-duplication** (an `export const` with one `@example` must yield exactly one `ExampleBlock`, not three)
- [x] ✅ (completed: 2026-07-20 16:37) 1.4.2 AC-9: run the guard three ways — passing, with a fixture forced to fail, and **killed mid-compile with SIGINT** — then confirm `git status --short` is clean and no `.jsdoc-example.*` survives anywhere under `packages/`. Under AR-16 this holds by construction; the case is the regression guard against a filesystem write being reintroduced, which is why the interrupted run is included and not merely a failing one
- [x] ✅ (completed: 2026-07-20 16:37) 1.4.3 Full verify

**Deliverables**: impl tests green · AC-9 evidenced across all three run modes
**Verify**: `yarn verify`

---

## Phase 2: JSDoc example modernization

> **Phase ref**: _(recorded at phase start)_
> **Lenses**: api-surface
> **Routing**: standard — documentation edits, mechanical, with Phase 1's guard as the oracle.

### Step 2.1: The two flex examples

**Reference**: [03-02](03-02-jsdoc-example-modernization.md) §FR-3 · AR-1
**Objective**: FR-3.

- [x] ✅ (completed: 2026-07-20 17:35) 2.1.1 `packages/ui/src/view/group.ts` — recompose with `row({ gap: 1, padding: 1 }, grow(left), grow(right))`. **Keep the back-to-front paint-order lesson** as a comment; dropping it is a documentation regression
- [x] ✅ (completed: 2026-07-20 17:35) 2.1.2 `packages/ui/src/editor/indicator.ts` — recompose with `col(grow(editor), fixed(indicator, 1))`

### Step 2.2: The absolute sweep

**Reference**: [03-02](03-02-jsdoc-example-modernization.md) §FR-4, §FR-5 · AC-2, AC-3
**Objective**: FR-4, FR-5. Baseline **53 lines across 37 files**. Batched at ≤6 files per task so each
is one reviewable change; counts in parentheses are lines, and they sum to 53.

- [x] ✅ (completed: 2026-07-20 17:35) 2.2.1 `ui/src/dialog/` — `buttons.ts` (6), `dialog.ts` (3). The densest file in the sweep
- [x] ✅ (completed: 2026-07-20 17:35) 2.2.2 `ui/src/controls/` A — `text.ts` (3), `label.ts` (2), `button.ts` (2), `input.ts` (1), `switch.ts` (1), `slider.ts` (1)
- [x] ✅ (completed: 2026-07-20 17:35) 2.2.3 `ui/src/controls/` B + `ui/src/color/` — `check-group.ts`, `multi-check-group.ts`, `radio-group.ts`, `color-picker.ts`, `color-swatch.ts` (1 each)
- [x] ✅ (completed: 2026-07-20 17:35) 2.2.4 `ui/src/{list,dropdown,scroll}/` — `list-box.ts` (1), `list-view.ts` (1), `combo-box.ts` (1), `history.ts` (2), `scroll-bar.ts` (1), `scroller.ts` (2)
- [x] ✅ (completed: 2026-07-20 17:35) 2.2.5 `ui/src/{surface,feedback,date}/` — `surface.ts` (1), `surface-view.ts` (2), `progress-bar.ts` (2), `spinner.ts` (1), `calendar.ts` (1), `date-picker.ts` (1)
- [x] ✅ (completed: 2026-07-20 17:35) 2.2.6 `ui/src/{table,tabs,tree,terminal,editor}/` — `data-grid.ts`, `tab-view.ts`, `tree.ts`, `terminal.ts`, `memo.ts` (1 each). **Three of these five are also FR-6 defect files** — do this task first, then 2.3.1 on the same files, so the `at()` edit and the arity fix stay separately reviewable
- [x] ✅ (completed: 2026-07-20 17:35) 2.2.7 `packages/files/src/` — `input/file-input.ts`, `list/dir-list.ts`, `list/file-info-pane.ts`, `list/file-list.ts` (1 each)
- [x] ✅ (completed: 2026-07-20 17:35) 2.2.8 `packages/datagrid/src/` + `packages/forms/src/` — `editable-grid-rows.ts` (1), `grid.ts` (1), `form-dialog.ts` (2)
- [x] ✅ (completed: 2026-07-20 17:35) 2.2.9 `packages/ui/src/split/split-view.ts:109` — `position:'fill'` → `cover()`. **Do not touch `:103`** — that `direction:'row'` is a `SplitView` constructor option, not a layout prop

### Step 2.3: The four live defects

**Reference**: [03-02](03-02-jsdoc-example-modernization.md) §FR-6 · [02](02-current-state.md) §Live defects · AR-6
**Objective**: FR-6.

- [x] ✅ (completed: 2026-07-20 18:05) 2.3.1 Fix the `createEventLoop` arity in `tree/tree.ts`, `tabs/tab-view.ts` and `table/data-grid.ts` — add the `{ caps }` second argument (`caps` is the only required `EventLoopOptions` member, `event/types.ts:37-39`) and import `resolveCapabilities` **from `@jsvision/ui`**, the package each example already imports from (neither file has a `@jsvision/core` import line to extend). Call-shape siblings: `dialog/dialog.ts:72`, `dialog/buttons.ts:29` — **not** `group.ts:57`, which documents `createRenderRoot`. **Remove their three allowlist entries**; a stale entry fails the build by design
- [x] ✅ (completed: 2026-07-20 18:05) 2.3.2 `packages/ui/src/app/application.ts:275` — resolve the unreachable `syncOverlayVisible` import per 03-02's **four**-branch rule. The symbol is **not a phantom**: it exists at `:288`, is exported from `app/index.ts:8`, used by `menu/controller.ts` and pinned by `ui/test/dropdown.seams.spec.test.ts:26` — it is absent only from the root barrel. If branch 0 applies (the barrel omission is the defect), **surface it for a maintainer ruling rather than working around it or silently exporting it**. Record the branch taken as **AR-R1**. **Remove its allowlist entry** once the block compiles

### Step 2.4: Accept

**Reference**: [01](01-requirements.md) AC-2, AC-3, AC-5
**Objective**: Prove the sweep is complete, not merely applied.

- [x] ✅ (completed: 2026-07-20 18:05) 2.4.1 Acceptance greps — AC-2 reaches 0 (from 53); **AC-3's remaining hits are confined to `packages/ui/src/view/dsl/`** (`absolute.ts:21`, `flex.ts:5`, `index.ts:4` — three prose references inside the docs of the builders that replace the raw field); AC-5 confirms the four defects compile and none is allowlisted; **AC-6 confirms the net allowlist movement is exactly −4 / +0** — six of the nine layout blocks remain, the three arity defects and `application.ts::syncOverlayVisible` are gone, and no file this plan edits contributed a new entry
- [x] ✅ (completed: 2026-07-20 18:05) 2.4.2 Full verify, including `check:docs`

**Deliverables**: 53 → 0 · four defects fixed · guard green with an allowlist shrunk by exactly four
**Verify**: `yarn verify`

---

## Phase 3: docs-site shadow retirement

> **Phase ref**: _(recorded at phase start)_
> **Lenses**: api-surface
> **Routing**: standard — mechanical conversion, but the audit gates it.

### Step 3.1: Audit before migration

**Reference**: [03-03](03-03-docs-site-shadow-retirement.md) §The two behavioural deltas · AR-3
**Objective**: Clear Delta A and Delta B **before** anything is converted.

- [ ] 3.1.1 Capture rendered baselines for all seven examples at a fixed viewport into the session scratchpad, after a build (docs-site resolves `@jsvision/ui` from `dist/`)
- [ ] 3.1.2 Run queries A1–A4 and B1; fill the audit table in [03-03](03-03-docs-site-shadow-retirement.md). Hunt **padding-carrying arguments** specifically — under `position:'absolute'` a preserved `size` is inert and `direction:'row'` is the default, so `padding` is the only load-bearing preserved prop. An empty table is not a pass; every surfaced row gets a verdict, and any ⛔ is resolved by the three-way rule, never absorbed

### Step 3.2: Specification tests

**Reference**: [07](07-testing-strategy.md) ST-9…ST-11
**Objective**: Pin the builder's contract from a docs-site surface.

- [ ] 3.2.1 [spec-author] Write ST-9…ST-11 — `packages/docs-site/test/example-at.spec.test.ts`. **These are green before and after**; they are a standing contract, not a red-to-green transition. The retirement's evidence is the audit table plus the unedited regression net

### Step 3.3: Convert

**Reference**: [03-03](03-03-docs-site-shadow-retirement.md) §Proposed changes, §FR-8
**Objective**: FR-7, FR-8.

- [ ] 3.3.1 Delete all seven local `at()` helpers; add `at` to **six** files' `@jsvision/ui` import; drop the now-unused `View` type import where the helper was its only consumer. **Do not add `at` to `list-box.ts`** — 3.3.2 removes all three of its `at()` calls in the very next task, so the import would be dead on arrival and fail lint + success criterion 4. 38 call sites before; **35 after**
- [ ] 3.3.2 `examples/containers/list-box.ts` → `cover(col(grow(list), spacer({ fixed: 1 }), fixed(echo, 1)))`; import `cover`/`col`/`grow`/`fixed`/`spacer` from `@jsvision/ui`. Delete the now-dead `WIDTH`/`HEIGHT` consts. Two non-optional details: the **`cover()`** (a `col()` container with no extent collapses to nothing) and **`spacer({ fixed: 1 })`, never `spacer(1)`** — `view/dsl/flex.ts:219-225` reads a numeric argument as a flex **weight**, so `spacer(1)` would hand the gap a 1fr share and eat half the column

### Step 3.4: Accept

**Reference**: [01](01-requirements.md) AC-4, AC-7 · [07](07-testing-strategy.md) §End-to-end
**Objective**: Prove parity.

- [ ] 3.4.1 **The primary control** — re-render all seven after a build and diff against 3.1.1's baselines. Byte-identical for six; `list-box.ts` changes **substantially** by design (`cover()` takes it from a pinned 40×12 box to the full viewport), and its diff is reviewed and recorded, not required to be empty. This is the real witness for FR-7/FR-8: four of the seven existing docs-site suites never build an example at all, so `paint-smoke` is a liveness backstop and nothing else catches a merge-preserved `padding` shifting a child by a cell
- [ ] 3.4.2 AC-4 grep reaches 0; AC-7 confirms no pre-existing `packages/docs-site/test/` file appears in `git diff --name-only`
- [ ] 3.4.3 Full verify

**Deliverables**: audit table filled · 7 shadows gone · render parity recorded
**Verify**: `yarn verify`

---

## Phase 4: Close-out

> **Phase ref**: _(recorded at phase start)_
> **Routing**: trivial

- [ ] 4.1.1 File the allowlist-drain follow-up issue — the committed allowlist **is** its worklist (AC-10). Link it from the feature roadmap. **Say plainly in the issue body that a residue is permanent, not backlog**: a literal `{ ... }` elision (`core/engine/capability/index.ts:75,123`) and a top-level `return` (`datagrid/src/validation.ts:83`) are legitimate documentation idioms that cannot compile standalone
- [ ] 4.1.2 Roadmap sync via the roadmap skill: set #112's row to ✅, cascade to the portfolio `codeops/00-roadmap.md`, and post a close-out comment on #112 recording the scope expansion (AR-1), the four defects found and fixed, the `#129` boundary (AR-4) **and the one docs-site canvas this plan converted inside that boundary (`list-box.ts`, the AR-4 named exception), so #129 does not go looking for it**
- [ ] 4.1.3 `yarn lint:fix`, commit whatever it changes, then final `yarn verify` before the PR-bound push (CLAUDE.md prime directive)

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1  (the guard — the oracle for everything after it)
    ↓
Phase 2  (JSDoc sweep, verified by the guard)
    ↓
Phase 3  (docs-site retirement — independent of Phase 2, but sequenced
          after it so the guard's allowlist has already settled)
    ↓
Phase 4  (close-out)
```

Phase 3 has no technical dependency on Phase 2 and could run in parallel. It is sequenced serially
purely for **review hygiene** — one moving surface at a time. *(An earlier draft justified the
serialization by saying the allowlist must not be regenerated while a second surface moves; that
cannot happen. Phase 3 edits `packages/docs-site/examples/**`, which is outside the guard's roots
and outside `packages/*/src` entirely, and cannot add, remove or invalidate a single entry.)*

---

## Success Criteria

**Feature is complete when:**

1. ✅ All 41 tasks completed
2. ✅ `yarn verify` green, including `check:docs` and `check-plugin.mjs`
3. ✅ AC-1…AC-10 in [01](01-requirements.md) all satisfied
4. ✅ No dead code — no unused imports (including `at` in `list-box.ts`), consts (`WIDTH`/`HEIGHT`), or helpers left behind
5. ✅ The guard writes nothing — passing, failing **and interrupted** runs all leave the tree clean (AC-9)
6. ✅ Zero existing test files edited (AC-7)
7. ✅ **ST-12 exists and gates the build** — the allowlist is read by something, not merely committed
8. ✅ The allowlist shrank by exactly the **four** fixed defects (three `TS2554` arity + `application.ts::syncOverlayVisible`) and grew by nothing
9. ✅ Follow-up issue filed and roadmap synced
10. ✅ Post-completion project re-analysis (handled by the exec_plan skill)
