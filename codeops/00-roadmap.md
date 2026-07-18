# Portfolio Roadmap: Ink

> **Status**: Active
> **Last Updated**: 2026-07-18
> **Features**: 2 / 5 done · split-panes ✅ complete (SplitView + follow-ups: grab-mark toggle · scroll-in-pane demo · amiga-clock split window) · jsvision-forms ✅ complete (9/9 RDs — first slice + async/loading/dialog/placeholder + comprehensive showcase; GH #89 backlog deferred, out of scope) · code-editor 🔄 requirements drafted (RD-01…04 — Lezer code-grade editor, GH #102)
> **CodeOps Skills Version**: 3.0.0

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| bun-runtime | [→](features/bun-runtime/00-roadmap.md) | RD-01 ✏️ drafted (Bun runtime support & self-contained executables) | 0/1 RDs | ⬜ | 2026-07-03 |
| docs-website | [→](features/docs-website/00-roadmap.md) | RD-01/02/03/06 ✅ Done (site-foundation · @jsvision/web runtime · live-example system · TypeDoc API ref) · RD-04/05/07…10 ✏️ drafted | 4/10 RDs | ⬜ | 2026-07-13 |
| split-panes | [→](features/split-panes/plans/split-panes/00-index.md) | ✅ Done — resizable split panes (GH #10) shipped on `feat/split-panes`. All 4 phases green: (P1) optional `min` on the flex layout engine; (P2) `splitter`/`splitterDragging` theme roles; (P3) the **`SplitView` component** — declarative `fr`-track container, captured-drag + keyboard resize, `minSize` clamp, nesting; (P4) kitchen-sink story `layout/split`. ST-1…ST-31 green (spec + impl); the 4 preflight defects (PF-001…004) each pinned by a failure-mode test. Hover affordance deferred → GH #97. `CI=1 yarn verify` green. **Follow-ups:** [split-panes-followups](features/split-panes/plans/split-panes-followups/00-index.md) ✅ Done — reactive grab-mark toggle (public `SplitView.grabMark` signal + `‹g›` story toggle) · scroll-in-a-pane demo (`layout/split-scroll` story) · amiga-clock 4th `Clocks` split window (13/13 tasks · 4/4 phases; spec-first, `CI=1 yarn verify` green; live TTY tuning of the clock window is the one pending manual step) | 45/45 tasks · 4/4 phases · +followups ✅ | ✅ | 2026-07-17 |
| code-editor | [→](features/code-editor/00-roadmap.md) | RD-01…04 ✏️ drafted (core seam + roles · `@jsvision/lang` Lezer engine · editor view features · non-functional) — Lezer code-grade editor (GH #102); prereq #101; deferrals #104–107 | 0/4 RDs | 🔄 | 2026-07-18 |
| jsvision-forms | [→](features/jsvision-forms/00-roadmap.md) | RD-01…04 ✅ Done (first slice: store · sync Zod validation · widget-binding · non-functional) · RD-09 ✅ Shipped (styled `Text` severity + `Input` placeholder + `dangerText`/`warningText` theme roles; 32/32 tasks, `yarn verify` green) · RD-06 ✅ Shipped (async validation — per-field `asyncValidators` + `validating()`/`asyncError()` + async-aware `submit()` + idempotent whole-scope `dispose()`; new `src/async.ts` + additive edits; 70 forms tests + one `forms/async` story; 28/28 tasks/4 phases spec-first, `yarn verify` green; preflight ✅ PASSED incl. the generation-stale-guard hardening AR-P11/ST-A16; runtime AR-P12 ST-10↔AR-44) · RD-07 ✅ Shipped (async loading + baseline rebase — `form.load(loader)` + `loading()`; replace + whole-baseline rebase pristine, generation + `AbortController`, root-body `onCleanup` teardown fires on enclosing-scope disposal too; 89 forms tests + one `forms/load` story; 16/16 tasks/2 phases spec-first, `yarn verify` green; plan preflight ✅ PASSED, 8 findings) · RD-08 ✅ Shipped (`formDialog()` + modal submit-gate — dialog creates/owns/disposes the form, OK **intercepts** + gates on the async `submit()` **sealed during the gate**, new `submitting()` signal resolving RD-07's AR-45 deferral; new module `src/form-dialog.ts` + `forms/dialog` story; 18/18 tasks / 3 phases spec-first, `yarn verify` green; commits 0f750377 · 905c820b · 4ab057bc) · RD-05 ✅ Done ([comprehensive-showcase](features/jsvision-forms/plans/comprehensive-showcase/00-index.md) — flagship `forms/showcase` story: live state inspector + amber privileged-port advisory + right/below error-layout toggle + inline async/load/dialog tour; purely `packages/examples`, no engine change; 10/10 tasks / 1 phase spec-first, `yarn verify` green — 26/26 turbo, examples 200 passed; planned directly — no standalone RD) — 2026-07-15 triage; backlog in GH #89 | 9/9 RDs done | ✅ | 2026-07-17 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| jsvision-ui | [→](_archive/jsvision-ui/00-roadmap.md) | 22/22 RDs | 2026-07-08 |
| theme-designer | [→](_archive/theme-designer/00-roadmap.md) | 1/1 RDs | 2026-07-09 |
| jsvision-ui-enhancements | [→](_archive/jsvision-ui-enhancements/00-roadmap.md) | 1/1 RDs | 2026-07-09 |
| jsvision-plugin | [→](_archive/jsvision-plugin/00-roadmap.md) | 2/2 RDs | 2026-07-11 |
