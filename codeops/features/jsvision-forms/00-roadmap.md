# Roadmap: jsvision Forms

> **Feature-Set**: jsvision Forms
> **Status**: In Progress
> **Created**: 2026-07-14
> **Last Updated**: 2026-07-15
> **Progress**: 3 / 4 (75%) · RD-03 done (widget-binding) · RD-04 executing (non-functional)
> **CodeOps Skills Version**: 3.7.0

An enterprise-grade forms engine as a new package `@jsvision/forms`. **This roadmap covers the
first slice**: a headless form/field store, synchronous Zod validation, and binding to the existing
`Input`/`Switch`/`RadioGroup`/`CheckGroup` seams. Design fully disambiguated in the 2026-07-13/14
grill; all decisions in `requirements/00-ambiguity-register.md`. Follow-on slices (async validation,
async loading, `formDialog`, `Input` placeholder) are named and deferred. Source hand-off: GH #85.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| RD-01 | Form & Field Store | [RD-01](requirements/RD-01-form-field-store.md) | [form-store](plans/form-store/00-index.md) | Done | ✅ | 2026-07-15 | Shipped in `@jsvision/forms`: createForm via createRoot (owned computeds, no dispose); value model; stable handles; dirty (element-wise)/reset/isValid/submit; FormFieldError. 27 tests green (17 spec + impl + security). |
| RD-02 | Validation & Error Surfacing | [RD-02](requirements/RD-02-validation-error-surfacing.md) | [form-store](plans/form-store/00-index.md) | Done | ✅ | 2026-07-15 | Shipped: one memoized safeParse drives isValid/values/errors + per-field first-issue routing; path-less→form.errors(); coercion; message passthrough. Verified against real zod 4.4.3. |
| RD-03 | Widget Binding | [RD-03](requirements/RD-03-widget-binding.md) | [widget-binding](plans/widget-binding/00-index.md) | Done | ✅ | 2026-07-15 | Shipped in `@jsvision/forms`: direct text/switch bind (no new code) · `bindField` touched-on-first-blur via `View.focusSignal()` (internal touched-sink WeakMap seam; public `Field` unchanged) · `bindRadio`/`bindCheck` stateless domain-value lenses. `FormFieldError` on a foreign handle. 11 tasks / 11 tests (spec ST-01…07 + impl); `yarn verify` green, forms gained no new dependency. |
| RD-04 | Non-Functional | [RD-04](requirements/RD-04-non-functional.md) | [non-functional](plans/non-functional/00-index.md) | Executing | 🔄 | 2026-07-15 | Executing (`--auto-commit`): kitchen-sink `forms/form` story + smoke · render-path security oracle · RD-01/02/03 coverage audit · barrel-surface lock · verify/lint gate. Preflight ✅ PASSED — [report](plans/non-functional/00-preflight-report.md); 4 findings applied. |

## Deferred (follow-on slices)

Async validation · async loading + baseline rebase · `formDialog()` + submit-as-modal-gate ·
`Input` placeholder + wrapper propagation · plural `errors()` · warning severity ·
`disabled`/`readonly` · per-field reset · nested/array-of-object fields · runtime schema introspection.
