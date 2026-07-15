# Roadmap: jsvision Forms

> **Feature-Set**: jsvision Forms
> **Status**: Active (extended — comprehensive showcase + un-deferred follow-on slices)
> **Created**: 2026-07-14
> **Last Updated**: 2026-07-15
> **Progress**: 6 / 9 done (67%) · RD-01…04 done (first slice: store · validation · binding · non-functional) · RD-09 ✅ shipped (styled `Text.severity` + `Input.placeholder` + `dangerText`/`warningText` roles) · RD-06 ✅ shipped (async validation — per-field `asyncValidators` + `validating()`/`asyncError()` + async-aware `submit()` + idempotent `dispose()`) · RD-05/07/08 planned (showcase + async loading + formDialog)
> **Last Updated**: 2026-07-16
> **CodeOps Skills Version**: 3.7.0

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
| RD-01 | Form & Field Store | [RD-01](requirements/RD-01-form-field-store.md) | [form-store](plans/form-store/00-index.md) | Done | ✅ | 2026-07-15 | Shipped in `@jsvision/forms`: createForm via createRoot (owned computeds, no dispose); value model; stable handles; dirty (element-wise)/reset/isValid/submit; FormFieldError. 27 tests green (17 spec + impl + security). |
| RD-02 | Validation & Error Surfacing | [RD-02](requirements/RD-02-validation-error-surfacing.md) | [form-store](plans/form-store/00-index.md) | Done | ✅ | 2026-07-15 | Shipped: one memoized safeParse drives isValid/values/errors + per-field first-issue routing; path-less→form.errors(); coercion; message passthrough. Verified against real zod 4.4.3. |
| RD-03 | Widget Binding | [RD-03](requirements/RD-03-widget-binding.md) | [widget-binding](plans/widget-binding/00-index.md) | Done | ✅ | 2026-07-15 | Shipped in `@jsvision/forms`: direct text/switch bind (no new code) · `bindField` touched-on-first-blur via `View.focusSignal()` (internal touched-sink WeakMap seam; public `Field` unchanged) · `bindRadio`/`bindCheck` stateless domain-value lenses. `FormFieldError` on a foreign handle. 11 tasks / 11 tests (spec ST-01…07 + impl); `yarn verify` green, forms gained no new dependency. |
| RD-04 | Non-Functional | [RD-04](requirements/RD-04-non-functional.md) | [non-functional](plans/non-functional/00-index.md) | Done | ✅ | 2026-07-15 | Shipped: kitchen-sink `forms/form` showcase story (all 5 binding paths, touched-gated errors, `valid · dirty` echo, submit gate) + ST-N1 smoke · render-path control-byte oracle (`security.spec.test.ts`, C0/DEL/C1) · barrel surface-lock (`surface.impl.test.ts`) · coverage audit ✅ zero gaps (20 ACs → shipped oracles 1:1) · `yarn verify` green. Preflight ✅ PASSED (4 findings applied). |
| RD-05 | Comprehensive Forms Showcase | — | — | Backlog | ⬜ | 2026-07-15 | Dedicated kitchen-sink `Forms` suite (built **last**): curates the capability stories + a live state inspector (`rawValues`/`values`/`errors`/`isValid`/`dirty`), app-level advisory warnings (amber, no engine change), and right/below error-layout variants via the `col`/`row` DSL. Depends on RD-06…09. |
| RD-06 | Async Validation | [RD-06](requirements/RD-06-async-validation.md) | [async-validation](plans/async-validation/00-index.md) | Done | ✅ | 2026-07-16 | **Shipped ✅ — 28/28 tasks / 4 phases spec-first, `yarn verify` green** (26/26 turbo; `check:deps` 11/11 zero native deps). New `src/async.ts` (`createAsyncValidation`: eager per-async-field signals · one standing trigger effect per field, own value tracked + sync-gate untracked · debounce · generation stale-guard bumped **on supersede** so an abort-ignoring but in-contract validator can't land a stale verdict · `AbortSignal` best-effort cancel · `onCleanup` teardown) + additive edits to `types.ts`/`create-form.ts` (async-aware `submit` force-run + short-circuit; wrapped `isValid`; `validating`; `dispose` from the `createRoot` disposer)/`validation.ts` (schema-async guard → named error) + barrel `AsyncValidator` type. Forms: 70 tests (spec ST-A1…A16 + ST-A-SEC · impl · security). One `forms/async` kitchen-sink story + ST-AS1 smoke. Runtime **AR-P12** (user): first-slice ST-10's no-dispose assertion updated to idempotent-dispose per AR-44. Register AR-33…45 + AR-P1…P12. **Plan preflighted ✅ PASSED** (4 findings applied: 1 major / 2 minor / 1 obs — see `plans/async-validation/00-preflight-report.md`). The major (PF-101): the generation stale-guard was bumped only at run-start, so an abort-ignoring but in-contract validator could land a stale verdict during the next value's debounce window — fixed by bumping the generation (+ reset/abort) on supersede in the effect (register AR-P11, new oracle ST-A16). **Plan created ✅ (gate passed)** — 8 docs at `plans/async-validation/`, 28 tasks / 4 phases (surface+guard+`dispose` → per-field trigger → async-aware `submit` → security+story+gate), spec-first, ST-A1…A16 + ST-A-SEC + ST-AS1 (every AC → ≥1 oracle). Grounding the RD's orchestration onto the real `effect` (fires once on mount, `effect.ts:47`) surfaced **3 new async-lifecycle forks** the RD didn't pin, resolved with the user (register AR-P7 skip the mount run · AR-P8 clear the stale `asyncError` on change · AR-P9 short-circuit `submit` on sync-invalid). New `src/async.ts` module (`createAsyncValidation`), additive edits to `types.ts`/`create-form.ts`/`validation.ts`/barrel; `@jsvision/forms`-only + one `forms/async` story; core/ui untouched. Carries the RD design: per-field `asyncValidators` beside the retained sync parse, debounce+generation stale-guard+`AbortSignal`, distinct `asyncError()`, whole-scope `dispose()`, `$ZodAsyncError` guard. Next: `exec_plan async-validation`. |
| RD-07 | Async Loading + Baseline Rebase | — | — | Backlog | ⬜ | 2026-07-15 | `load()` callback + `loading()` state; rebase the (currently immutable) baseline to the loaded record so `dirty`/`reset` track against it. Well-defined mutation point exists (baseline is a snapshot at `createForm`). Design in #85. |
| RD-08 | formDialog() + Modal Submit-Gate | — | — | Backlog | ⬜ | 2026-07-15 | `formDialog()` helper mirroring `messageBox`/`runDialog`; `form.submit()` becomes the async-aware gate that supersedes `Dialog.valid()`'s sync child-sweep. Submit signature was pre-wired for this. Design in #85 (rec A). |
| RD-09 | Styled Error Text & Input Placeholder | [RD-09](requirements/RD-09-styled-error-text-input-placeholder.md) | [styled-text-input-placeholder](plans/styled-text-input-placeholder/00-index.md) | Done | ✅ | 2026-07-15 | **Shipped** (32/32 tasks, `yarn verify` green): `@jsvision/core` `dangerText`/`warningText` theme roles (promote the unused `danger`/`warning` aliases; names avoid the alias collision) + `@jsvision/ui` `Text` `severity` option (public `'error'\|'warning'`) + `Input` `placeholder` (muted-when-empty, propagated to `DatePicker`/`ComboBox`/`inputBox()`). **No `forms` change** — touched-gating stays app-composed. Per-field `field.reset()` deferred (#89). RD preflight ✅ PASSED ([report](requirements/00-preflight-report-rd-09.md), 7 findings applied). **Plan preflight ✅ PASSED** ([report](plans/styled-text-input-placeholder/00-preflight-report.md), 4 findings applied — theme-designer `RESERVED_ALIASES`/`roles-panel.spec` update per AC #7, `TextOptions` barrel export, `aliases.ts:65,67` pin, ST-S1 caret hardening). **Executed ✅: 32/32 tasks / 4 phases** (core roles → `Text.severity` → `Input.placeholder`+propagation → stories/counts/gate); +5 new spec/impl test files, ST-C1…4 · ST-U1…12 · ST-S1 all green. Two runtime finds handled (AR-P7 — 2 extra danger/warning guards revised as oracle-follows-requirement, user-approved; AR-P8 — `input.ts` kept under the ≤500 oracle via `resolvePlaceholder` extraction). Register AR-25…32 + AR-P1…8. |

## Deferred (follow-on slices)

**Promoted to RDs (2026-07-15 triage):** async validation → RD-06 · async loading + baseline rebase
→ RD-07 · `formDialog()` + submit-as-modal-gate → RD-08 · styled `ErrorText` + `Input` placeholder
(+ optional per-field reset) → RD-09 · comprehensive showcase → RD-05.

**Still deferred / decided-out (backlog in GH #89):** nested/array-of-object fields · runtime schema
introspection · plural per-field `errors()` · `disabled`/`readonly` (a widget/app concern) ·
warning-severity engine tier. Warnings appear in the showcase as app-level advisory text (a separate
computed, styled amber) — no engine change, keeping the "use Zod directly, no abstraction" guardrail.
