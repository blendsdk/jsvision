# Portfolio Roadmap: Ink

> **Status**: Active
> **Last Updated**: 2026-07-16
> **Features**: 0 / 4 done · datagrid (RD-09 footer, aggregation & master-detail done — 10/15 RDs) + jsvision-forms reopened (first slice shipped; extended with showcase + follow-on slices)
> **CodeOps Skills Version**: 3.0.0

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| bun-runtime | [→](features/bun-runtime/00-roadmap.md) | RD-01 ✏️ drafted (Bun runtime support & self-contained executables) | 0/1 RDs | ⬜ | 2026-07-03 |
| docs-website | [→](features/docs-website/00-roadmap.md) | RD-01/02/03/06 ✅ Done (site-foundation · @jsvision/web runtime · live-example system · TypeDoc API ref) · RD-04/05/07…10 ✏️ drafted | 4/10 RDs | ⬜ | 2026-07-13 |
| datagrid | [→](features/datagrid/00-roadmap.md) | RD-01…RD-04 ✅ Done (foundation · editing-engine · cell-editors · formatting-rendering) · RD-05 ✅ Done (sorting) · RD-06 ✅ Done (filtering) · RD-07 ✅ Done (columns & layout — 58 tasks / 7 phases) · RD-08 ✅ Done (rows & selection — 50 tasks / 6 phases) · RD-09 ✅ Done (footer, aggregation & master-detail — 47 tasks / 6 phases; sticky reactive aggregate footer + honesty labelling + widget row + editable write-through master-detail; exec_plan COMPLETE 2026-07-17 `--auto-commit`, full verify green; 3 runtime ARs incl. a ui `Text`/`Button` `measure()` enabler) · RD-10 🔄 Executing (navigation & interaction — consolidated remappable keymap→GridAction + Tab cell-traversal + double-click; 45 tasks / 5 phases, spec-first, `--auto-commit`; Phases 1–2/5 done — keymap model + body-dispatch refactor, zero regression; preflight PASSED; no core/ui change) · RD-11…RD-14 🔎 RD Preflighted · RD-15 ✅ Done (showcase app — 51 demos) | 10/15 RDs | 🔄 | 2026-07-17 |
| jsvision-forms | [→](features/jsvision-forms/00-roadmap.md) | RD-01…04 ✅ Done (first slice: store · sync Zod validation · widget-binding · non-functional) · RD-09 ✅ Shipped (styled `Text` severity + `Input` placeholder + `dangerText`/`warningText` theme roles; 32/32 tasks, `yarn verify` green) · RD-06 ✅ Shipped (async validation — per-field `asyncValidators` + `validating()`/`asyncError()` + async-aware `submit()` + idempotent whole-scope `dispose()`; new `src/async.ts` + additive edits; 70 forms tests + one `forms/async` story; 28/28 tasks/4 phases spec-first, `yarn verify` green; preflight ✅ PASSED incl. the generation-stale-guard hardening AR-P11/ST-A16; runtime AR-P12 ST-10↔AR-44) · RD-05/07/08 ⬜ planned (showcase + async loading/rebase + `formDialog`) — 2026-07-15 triage; backlog in GH #89 | 6/9 RDs done | 🔄 | 2026-07-16 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| jsvision-ui | [→](_archive/jsvision-ui/00-roadmap.md) | 22/22 RDs | 2026-07-08 |
| theme-designer | [→](_archive/theme-designer/00-roadmap.md) | 1/1 RDs | 2026-07-09 |
| jsvision-ui-enhancements | [→](_archive/jsvision-ui-enhancements/00-roadmap.md) | 1/1 RDs | 2026-07-09 |
| jsvision-plugin | [→](_archive/jsvision-plugin/00-roadmap.md) | 2/2 RDs | 2026-07-11 |
