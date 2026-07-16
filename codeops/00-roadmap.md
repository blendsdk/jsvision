# Portfolio Roadmap: Ink

> **Status**: Active
> **Last Updated**: 2026-07-16
> **Features**: 0 / 3 done · jsvision-forms reopened (first slice shipped; extended with showcase + follow-on slices)
> **CodeOps Skills Version**: 3.0.0

## Legend

⬜ Backlog · 🔄 In progress · ✅ Done · ⛔ Blocked · ⏸️ Deferred · 📦 Archived

## Features

| Feature | Roadmap | Stage Summary | Progress | Status | Last Updated |
|---------|---------|---------------|----------|--------|--------------|
| bun-runtime | [→](features/bun-runtime/00-roadmap.md) | RD-01 ✏️ drafted (Bun runtime support & self-contained executables) | 0/1 RDs | ⬜ | 2026-07-03 |
| docs-website | [→](features/docs-website/00-roadmap.md) | RD-01/02/03/06 ✅ Done (site-foundation · @jsvision/web runtime · live-example system · TypeDoc API ref) · RD-04/05/07…10 ✏️ drafted | 4/10 RDs | ⬜ | 2026-07-13 |
| jsvision-forms | [→](features/jsvision-forms/00-roadmap.md) | RD-01…04 ✅ Done (first slice: store · sync Zod validation · widget-binding · non-functional) · RD-09 ✅ Shipped (styled `Text` severity + `Input` placeholder + `dangerText`/`warningText` theme roles; 32/32 tasks, `yarn verify` green) · RD-06 ✅ Shipped (async validation — per-field `asyncValidators` + `validating()`/`asyncError()` + async-aware `submit()` + idempotent whole-scope `dispose()`; new `src/async.ts` + additive edits; 70 forms tests + one `forms/async` story; 28/28 tasks/4 phases spec-first, `yarn verify` green; preflight ✅ PASSED incl. the generation-stale-guard hardening AR-P11/ST-A16; runtime AR-P12 ST-10↔AR-44) · RD-07 ✅ Shipped (async loading + baseline rebase — `form.load(loader)` + `loading()`; replace + whole-baseline rebase pristine, generation + `AbortController`, root-body `onCleanup` teardown fires on enclosing-scope disposal too; 89 forms tests + one `forms/load` story; 16/16 tasks/2 phases spec-first, `yarn verify` green; plan preflight ✅ PASSED, 8 findings) · RD-08 🔄 Executing (`formDialog()` + modal submit-gate — dialog creates/owns/disposes the form, OK gates on the async `submit()` **sealed during the gate**, new `submitting()` signal resolving RD-07's AR-45 deferral; `exec_plan form-dialog` running, 18 tasks / 3 phases spec-first; plan preflight ✅ PASSED [3 findings applied — 1 major / 2 minor + challenger]) · RD-05 ⬜ planned (showcase, built last) — 2026-07-15 triage; backlog in GH #89 | 7/9 RDs done | 🔄 | 2026-07-16 |

## Archived

| Feature | Roadmap | Completed | Last Updated |
|---------|---------|-----------|--------------|
| jsvision-ui | [→](_archive/jsvision-ui/00-roadmap.md) | 22/22 RDs | 2026-07-08 |
| theme-designer | [→](_archive/theme-designer/00-roadmap.md) | 1/1 RDs | 2026-07-09 |
| jsvision-ui-enhancements | [→](_archive/jsvision-ui-enhancements/00-roadmap.md) | 1/1 RDs | 2026-07-09 |
| jsvision-plugin | [→](_archive/jsvision-plugin/00-roadmap.md) | 2/2 RDs | 2026-07-11 |
