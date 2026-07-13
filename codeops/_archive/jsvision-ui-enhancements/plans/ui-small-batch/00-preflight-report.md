# Preflight Report: UI Small Batch

> **Artifact**: `codeops/features/jsvision-ui-enhancements/plans/ui-small-batch/` (full plan set)
> **Scanned**: 2026-07-09 · git `master @ 89808fb`
> **Reviewer**: fresh-session preflight (independent of the same-session authoring the AR flagged)
> **CodeOps Skills Version**: 3.3.2

## Outcome

**✅ PASSED — all 6 findings resolved** (0 CRITICAL, 0 MAJOR, 4 MINOR, 2 OBSERVATION).
User elected to apply every recommended fix (2026-07-09); the plan docs, `07`, `03-02`, `01`, `00-index`,
and `99` were corrected, and the decisions are recorded as AR-21…AR-24 in the register. PF-004 resolved to
**strip tabs only**.

**Applied:** PF-001 (filename → `tree-graph.*`, tree markers moved to a new `tree-markers.spec`) ·
PF-002 (ST-1…ST-8 isolated in the new file — no collision) · PF-003 (bar-title check → `menu/menubar.ts`) ·
PF-004 (tab scope = strip tabs only, data-level over `tabs()`) · PF-005 (verify already runs lint +
check:docs) · PF-006 (mount-walk static-children caveat documented).

The plan is well-grounded: the additive-only claim holds, every reused theme role exists, the `Slider`
`measure()` / `focusable + postProcess` / `DrawContext.caps` precedents the design leans on are all real,
and `check-jsdoc`'s `@example` rule (classes/functions only; types exempt) matches what the plan promises.
All findings are wiring/traceability refinements, not design flaws.

## Codebase Context Summary

| Plan claim | Verified against | Verdict |
|---|---|---|
| `tree/graph.ts` `createGraph(level,lines,flags,guides=true)` + `graphWidth(level)`, `LEVEL_WIDTH=3`, `+`/`─` markers, `OV_*` flags | `packages/ui/src/tree/graph.ts` | ✅ accurate; new `style` param defaults keep existing 3-/4-arg test calls compiling |
| hit-zone `mouse.x < graphWidth(level)` auto-adapts | `tree/tree-rows.ts` `handleMouseDown` | ✅ accurate |
| `parseTilde`/`tildeSegments` in `menu/builders.ts`; `MenuItem` has no `disabled` | `menu/builders.ts` | ✅ accurate |
| first-match-wins hotkey resolution | `menu/controller.ts` `findIndex`/`find` | ✅ accurate |
| `button.ts`/`label.ts`/`cluster.ts` each hold `parsed` | those files | ✅ accurate (`Button` also `postProcess=true`) |
| `TabStrip` parses each tab's `~X~`; Alt handled at `TabView` | `tabs/tab-view.ts`, `tab-strip.ts` | ⚠️ Alt-dispatch + tab data live on **TabView**; `TabStrip` renders from `tabs()` and stores no hotkeys (see PF-004) |
| reuse `button`/`buttonFocused`/`staticText`/`clusterDisabled` roles | `core/.../color/theme.ts:291-304` | ✅ all present |
| `Slider` is the `Switch` template (single bound value, `measure()`) | `controls/slider.ts:118` | ✅ `override measure(): Size2D` present |
| `check-jsdoc` needs `@example` on public exports | `scripts/check-jsdoc.mjs:15-18` | ✅ classes/functions only; **types/interfaces exempt** (so `MarkerStyle`/`SwitchOptions`/`DuplicateAccelerator` need none) |
| `menuBar()` build-time check "in `menu/builders.ts`" | `menu/menubar.ts:179` | ❌ `menuBar()` is in **menubar.ts**, not builders.ts (see PF-003) |
| test files `graph.spec.test.ts`/`graph.impl.test.ts` | `test/` listing | ❌ actual files are `tree-graph.spec.test.ts`/`.impl` (see PF-001) |
| `yarn verify` = typecheck+build+test+check:docs; lint separate | root `package.json:23` | ⚠️ verify now also runs `yarn lint` up-front (see PF-005) |

---

## Findings

### PF-001 · 🟡 MINOR · Codebase Alignment (phantom reference)
**Where:** `99-execution-plan.md` steps 1.1.1 / 1.3.1; `07-testing-strategy.md` heading.
The plan names `packages/ui/test/graph.spec.test.ts` (extend) and `graph.impl.test.ts`. No such files
exist — the real ones are `tree-graph.spec.test.ts` and `tree-graph.impl.test.ts`. (03-01's glob
`packages/ui/test/*graph*` is correct, so the plan is internally inconsistent.)
**Impact:** an executor following the explicit names would create a wrongly-named duplicate file.
**Options:** (a) **[rec]** correct the two step references to `tree-graph.{spec,impl}.test.ts`; (b) leave
the glob and drop the explicit names. → **(a)**, a one-line fix that keeps the executor on the real oracle.

### PF-002 · 🟡 MINOR · Testability / Consistency (ST-ID collision)
**Where:** `07-testing-strategy.md` tree block (ST-1…ST-8) + `99` step 1.1.1 ("extend `graph.spec`").
`tree-graph.spec.test.ts` **already** contains `ST-1…ST-7`, and the wider tree suite uses ST-7…ST-16
(`tree.spec`) and ST-21 (`fidelity.tree.spec`). Adding the plan's fresh `ST-1…ST-8` *into the same file*
produces two `ST-2`s (etc.) asserting different things, breaking the 1:1 ST↔oracle traceability the
strategy relies on. (The #6/#11 blocks land in new files — `accelerators.spec`, `switch.spec` — so only
the tree part collides.)
**Options:** (a) **[rec]** put the new tree-marker cases in a new `tree-markers.spec.test.ts` with their
own ST-1…ST-8; (b) keep extending `tree-graph.spec` but renumber the new cases to continue after its
last ST (ST-8+). → **(a)** — cleanest separation, no renumber churn, matches how #6/#11 already get
their own files.

### PF-003 · 🟡 MINOR · Codebase Alignment (wrong file for a call site)
**Where:** `AR-10`, `01-requirements.md` R2, `03-02` §4, `99` step 2.2.4.
The menu-bar **top-title** duplicate check is placed "in `menu/builders.ts`". `subMenu()` *is* there (so
the per-submenu check belongs there), but `menuBar()` is defined in `menu/menubar.ts:179` and produces a
`MenuBar` view. The bar-scope check has to hook menubar.ts (the `menuBar()` builder or `MenuBar.items`),
not builders.ts.
**Impact:** an executor looking in builders.ts for a `menuBar` to instrument won't find one.
**Options:** (a) **[rec]** amend the docs to "submenu items checked in `builders.ts` at `subMenu()`;
bar titles checked in `menubar.ts` at `menuBar()`"; (b) move `menuBar()` into builders.ts (larger, out of
scope). → **(a)**.

### PF-004 · 🟡 MINOR · Ambiguity / Edge case (tab-accelerator scope boundary)
**Where:** `AR-10`, `03-02` §3–4 (TabStrip override + mount-time subtree walk).
The tab scope is described two ways that don't fully agree: as "each tab's `~X~` hotkey" (strip-only) but
enforced by "a subtree walk collecting `view.accelerators()` that stops at a nested `Dialog`/`TabView`".
A `TabView`'s pages are plain `Group`s (not scope boundaries) and stay mounted (`tab-view.ts:38`), so the
walk would also pull every page's `Button`/`Label` accelerators into the tab scope — mixing tab hotkeys
with page-content hotkeys. Separately, `TabStrip` stores no parsed hotkeys today (it renders from
`tabs()`), while Alt-dispatch lives on `TabView` — so the override home isn't settled either.
**Question for you:** is the tab scope (a) **strip tabs only** — then read the tabs directly (override on
`TabView`, or `TabStrip` gains a hotkey list) and do **not** descend into pages; or (b) **strip + page
contents** — genuinely conflicting under `TabView`'s focus-scoped Alt-dispatch, then keep the walk but say
so explicitly. **[rec] (a)** for v1: it matches the "strip" wording, avoids false positives on hidden
pages, and keeps the tab check parallel to the menu (data-level) check.

**✅ RESOLVED (user, 2026-07-09): (a) strip tabs only.** The tab-accelerator check covers only the tab
titles' `~X~` hotkeys, read directly from the tab data — the mount walk must **not** descend into page
contents for the TabView scope. Consequence for 03-02: the tabs check is a data-level check (like the
menu check) over `tabs()`, not a subtree walk; the accelerator source is `TabView` (which owns the tab
data + Alt-dispatch), and `TabStrip`'s role is display only.

### PF-005 · 🔵 OBSERVATION · Consistency (stale toolchain framing)
**Where:** `AR-20` ("…`yarn lint`… which `yarn verify` does not cover"), echoed in `00-index`, `01`, `07`, `99`.
Root `package.json:23` now defines `verify` as `yarn lint && turbo run typecheck build test check:docs` —
so `yarn verify` **already** runs eslint + prettier (and check:docs) every time. The "run lint separately
because verify doesn't cover it" rationale is outdated; the extra final-gate lint is redundant, not wrong.
**Options:** (a) **[rec]** reword to "verify already includes lint + check:docs; the final gate just
re-confirms"; (b) leave as harmless belt-and-suspenders. → **(a)** to keep the plan's toolchain notes
accurate. (Also flags a stale project memory — I'll offer to update it.)

### PF-006 · 🔵 OBSERVATION · Edge case (mount-walk sees only static children)
**Where:** `03-02` §4 (scope-root mount walk for Dialog/TabView).
`onMount` fires after first layout, and `Group.mount` walks `children[]`, but `addDynamic` (Show/For)
children are produced by a reconcile effect and may not be present the instant a Dialog/TabView's own
`onMount` runs. Dialogs and tab strips are almost always statically composed, so impact is low — worth one
sentence noting the check covers statically-added accelerator views (a reactively-inserted button/tab
won't be re-checked).
**Options:** (a) **[rec]** add the one-line caveat to 03-02; (b) accept silently. → **(a)**.

---

## Dimension coverage

All 13 scanned. Clean (no findings): Implicit Assumptions, Logical Contradictions, Completeness Gaps,
Dependency Issues, Feasibility, Security Blind Spots, Scope Creep, Ordering & Sequencing. The additive-only
/ no-core-change contract, the spec-first RED→GREEN ordering, and the kitchen-sink story gate are all sound
and code-consistent. Findings cluster in **Codebase Alignment** (PF-001/003/004/005) and **Testability**
(PF-002).

## Same-session bias

The AR recommended a fresh-session preflight; this run satisfies that (executed after `/clear`, independent
of authoring). No standard-bound behavior needed external citation.
