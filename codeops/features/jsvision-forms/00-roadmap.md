# Roadmap: jsvision Forms

> **Feature-Set**: jsvision Forms
> **Status**: In Progress
> **Created**: 2026-07-14
> **Last Updated**: 2026-07-15
> **Progress**: 0 / 4 (0%)
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
| RD-01 | Form & Field Store | [RD-01](requirements/RD-01-form-field-store.md) | [form-store](plans/form-store/00-index.md) | Executing | 🔄 | 2026-07-15 | Executing form-store. createForm via createRoot (PA-1); value model; dirty/reset/isValid/submit; typing AR-18. Preflighted ([report](plans/form-store/00-preflight-report.md)): 0 crit/0 major, 8 findings applied; zod@4 verified empirically. |
| RD-02 | Validation & Error Surfacing | [RD-02](requirements/RD-02-validation-error-surfacing.md) | [form-store](plans/form-store/00-index.md) | Executing | 🔄 | 2026-07-15 | Executing form-store (with RD-01). Single eager safeParse computed; per-field + form-level errors; cross-field .refine; coercion — all confirmed against real zod@4. |
| RD-03 | Widget Binding | [RD-03](requirements/RD-03-widget-binding.md) | — | RD Drafted | ✏️ | 2026-07-14 | Direct text/switch bind · bindField touched-on-blur (focusSignal) · bindRadio/bindCheck domain-value adapters. |
| RD-04 | Non-Functional | [RD-04](requirements/RD-04-non-functional.md) | — | RD Drafted | ✏️ | 2026-07-14 | Package + zod peer (core/ui stay zero-dep) · security posture · spec-first tests · kitchen-sink story + smoke · JSDoc @example · verify/lint gates. |

## Deferred (follow-on slices)

Async validation · async loading + baseline rebase · `formDialog()` + submit-as-modal-gate ·
`Input` placeholder + wrapper propagation · plural `errors()` · warning severity ·
`disabled`/`readonly` · per-field reset · nested/array-of-object fields · runtime schema introspection.
