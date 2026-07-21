# Roadmap: jsvision Forms

> **Feature-Set**: jsvision Forms
> **Status**: Active (extended — comprehensive showcase + un-deferred follow-on slices)
> **Created**: 2026-07-14
> **Last Updated**: 2026-07-15
> **Progress**: 9 / 9 done (100%) · RD-01…04 done (first slice: store · validation · binding · non-functional) · RD-09 ✅ shipped (styled `Text.severity` + `Input.placeholder` + `dangerText`/`warningText` roles) · RD-06 ✅ shipped (async validation — per-field `asyncValidators` + `validating()`/`asyncError()` + async-aware `submit()` + idempotent `dispose()`) · RD-07 ✅ shipped (async loading + baseline rebase — `form.load(loader)` + `loading()`; replace+rebase pristine, generation + `AbortController`, root-body `onCleanup` teardown; 89 forms tests + `forms/load` story) · RD-08 ✅ shipped (formDialog + modal submit-gate — dialog owns/disposes the form, OK intercepts + gates on async `submit()` sealed during the gate, new `submitting()` signal; new `src/form-dialog.ts` + `forms/dialog` story; 18/18 tasks / 3 phases spec-first, `yarn verify` green; commits 0f750377 · 905c820b · 4ab057bc) · RD-05 ✅ shipped (comprehensive-showcase — flagship `forms/showcase` story: live state inspector + amber privileged-port advisory + right/below error-layout toggle + inline async/load/dialog tour; purely `packages/examples`, no engine change; 10/10 tasks, `yarn verify` green)
> **Last Updated**: 2026-07-16
> **CodeOps Skills Version**: 3.8.0

An enterprise-grade forms engine as a new package `@jsvision/forms`. The **first slice** (RD-01…04,
done) is a headless form/field store, synchronous Zod validation, and binding to the existing
`Input`/`Switch`/`RadioGroup`/`CheckGroup` seams. Design fully disambiguated in the 2026-07-13/14
grill; all decisions in `requirements/00-ambiguity-register.md`. Source hand-off: GH #85.

**Extended 2026-07-15** — a post-slice-1 triage re-evaluated the deferred follow-ons before locking
scope. The async/`formDialog`/placeholder slices are promoted to RD-06…09 (each already has vetted
design in #85), with a comprehensive kitchen-sink showcase at RD-05. The remaining deferrals
(nested/array fields, runtime schema introspection, plural per-field `errors()`, `disabled`/`readonly`,
a warning-severity engine tier) are recorded as a backlog in GH #89.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| RD-01 | Form & Field Store | [RD-01](requirements/RD-01-form-field-store.md) | [form-store](plans/form-store/00-index.md) | Done | ✅ | 2026-07-15 | Shipped — `createForm` via `createRoot` (owned computeds) · value model · stable field handles · element-wise `dirty`/`reset`/`isValid`/`submit` · `FormFieldError` |
| RD-02 | Validation & Error Surfacing | [RD-02](requirements/RD-02-validation-error-surfacing.md) | [form-store](plans/form-store/00-index.md) | Done | ✅ | 2026-07-15 | Shipped — one memoized `safeParse` drives `isValid`/`values`/`errors` + per-field first-issue routing · path-less→`form.errors()` · coercion · message passthrough, on real zod 4.4.3 |
| RD-03 | Widget Binding | [RD-03](requirements/RD-03-widget-binding.md) | [widget-binding](plans/widget-binding/00-index.md) | Done | ✅ | 2026-07-15 | Shipped — direct text/switch bind · `bindField` touched-on-first-blur via `View.focusSignal()` · `bindRadio`/`bindCheck` stateless domain-value lenses · `FormFieldError` on a foreign handle |
| RD-04 | Non-Functional | [RD-04](requirements/RD-04-non-functional.md) | [non-functional](plans/non-functional/00-index.md) | Done | ✅ | 2026-07-15 | Shipped — kitchen-sink `forms/form` story (all 5 binding paths, touched-gated errors, submit gate) + smoke · render-path control-byte oracle · barrel surface-lock · coverage audit zero gaps |
| RD-05 | Comprehensive Forms Showcase | — (planned directly) | [comprehensive-showcase](plans/comprehensive-showcase/00-index.md) | Done | ✅ | 2026-07-17 | Shipped ✅ — flagship `forms/showcase` story: state inspector · amber privileged-port advisory · right/below error-layout toggle · async/load/dialog tour — purely `packages/examples`, no engine change |
| RD-06 | Async Validation | [RD-06](requirements/RD-06-async-validation.md) | [async-validation](plans/async-validation/00-index.md) | Done | ✅ | 2026-07-16 | Shipped ✅ — new `src/async.ts`: per-field `asyncValidators` with debounce, a supersede-bumped generation stale-guard and `AbortSignal` cancel, plus `validating()` + async-aware `submit()` |
| RD-07 | Async Loading + Baseline Rebase | [RD-07](requirements/RD-07-async-loading-baseline-rebase.md) | [async-loading](plans/async-loading/00-index.md) | Done | ✅ | 2026-07-16 | Shipped ✅ — `form.load(loader)` + `loading()`: rebase values and baseline pristine in one `batch()`, generation/`AbortController` guarded · [preflight](plans/async-loading/00-preflight-report.md) |
| RD-08 | formDialog() + Modal Submit-Gate | [RD-08](requirements/RD-08-form-dialog-modal-submit-gate.md) | [form-dialog](plans/form-dialog/00-index.md) | Done | ✅ | 2026-07-16 | Shipped ✅ — `formDialog()` (`src/form-dialog.ts`) owns/disposes the form, its OK path awaits `submit()` and seals it while `submitting()` · [preflight](plans/form-dialog/00-preflight-report.md) |
| RD-09 | Styled Error Text & Input Placeholder | [RD-09](requirements/RD-09-styled-error-text-input-placeholder.md) | [styled-text-input-placeholder](plans/styled-text-input-placeholder/00-index.md) | Done | ✅ | 2026-07-15 | Shipped — core `dangerText`/`warningText` roles + ui `Text.severity` + `Input.placeholder` (also on `DatePicker`/`ComboBox`/`inputBox()`) · [preflight](requirements/00-preflight-report-rd-09.md) |

## Deferred (follow-on slices)

**Promoted to RDs (2026-07-15 triage):** async validation → RD-06 · async loading + baseline rebase
→ RD-07 · `formDialog()` + submit-as-modal-gate → RD-08 · styled `ErrorText` + `Input` placeholder
(+ optional per-field reset) → RD-09 · comprehensive showcase → RD-05.

**Still deferred / decided-out (backlog in GH #89):** nested/array-of-object fields · runtime schema
introspection · plural per-field `errors()` · `disabled`/`readonly` (a widget/app concern) ·
warning-severity engine tier. Warnings appear in the showcase as app-level advisory text (a separate
computed, styled amber) — no engine change, keeping the "use Zod directly, no abstraction" guardrail.
