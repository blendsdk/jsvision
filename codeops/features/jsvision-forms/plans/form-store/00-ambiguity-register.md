# Ambiguity Register — form-store plan

> **✅ GATE PASSED (2026-07-14)**
> Implements `jsvision-forms/RD-01 + RD-02`. Design ambiguity was resolved in the requirements
> register (`../../requirements/00-ambiguity-register.md`, AR-01…AR-24) and the 2026-07-13/14 grill;
> those enter here as ✅ Resolved. Plan-level items (PA-1…PA-6) surfaced during current-state
> analysis and were confirmed by the user.

## Inherited (requirements register — all ✅ Resolved)

AR-01…AR-24 are resolved in `../../requirements/00-ambiguity-register.md` with explicit user
decisions. Every plan doc back-references them. The load-bearing ones for this plan: AR-01 (value
model), AR-02 (Zod-direct `safeParse`, peer dep), AR-03 (composable error timing, eager validation,
`isValid()`=actual), AR-04 (`error()` first issue), AR-05 (touched=first blur / submit-marks-all),
AR-06 (`values()`→`z.output<S>|null`, `rawValues()` always), AR-07 (`submit`), AR-11 (cross-field via
`.refine`; path-less→`form.errors()`), AR-12 (dirty/baseline), AR-13 (reset), AR-18 (typing), AR-19
(unknown-key throw), AR-21 (stable handles), AR-22 (security), AR-24 (message passthrough).

## Plan-level items (confirmed by the user 2026-07-14)

| PA | Item | Resolution | Status |
|----|------|------------|--------|
| PA-1 | "Owner-free" store & the dev-warning consequence — a `computed` created outside an owner scope emits a one-time dev warning and is never auto-disposed (`packages/ui/src/reactive/owner.ts:20-33`). | `createForm` wraps its reactive graph in **`createRoot`** (verified `owner.ts` `createRoot<T>(fn:(dispose)=>T):T`). Computeds are then owned (no warning), disposed with the ambient scope when nested, GC'd when created at module scope. **No public `dispose()`** — AR-15's spirit holds. Refines AR-15. | ✅ Resolved |
| PA-2 | Plan scope — RD-01's `values()`/`isValid()`/`error()`/`submit()` depend on RD-02's validation `safeParse`; a stub would be dead code and would break spec-first. | **One plan** = package scaffold **+ the complete headless store *including* validation** (RD-01 **and** RD-02). RD-03 (widget binding) and RD-04's kitchen-sink story are separate follow-on plans. | ✅ Resolved |
| PA-3 | Verify command | Per-task fast: `yarn workspace @jsvision/forms test`. Phase-final gate: `yarn verify`. From CLAUDE.md; nothing invented. | ✅ Resolved |
| PA-4 | Module breakdown for `packages/forms/src/` | `index.ts` (barrel) · `types.ts` (`Form`/`Field`/`CreateFormOptions`) · `errors.ts` (`FormFieldError`) · `create-form.ts` (the store: field enumeration, value/dirty/reset/submit, `createRoot`) · `validation.ts` (the `safeParse` computed + `error`/`errors`/`isValid`/`values` derivations). All ≤500 lines. | ✅ Resolved |
| PA-5 | Field enumeration & signal creation — how the store knows the field set without runtime schema introspection (AR-2.6 deferred that). | Fields = `Object.keys(initial)`; the store **eagerly** creates one `value` signal + one `touched` signal per field at `createForm` time (⇒ complete `rawValues()`, stable handles AR-21, working dirty/touched). No `schema.shape` access — validation is `schema.safeParse(rawValues)`. | ✅ Resolved |
| PA-6 | `FormFieldError` base & the baseline snapshot | `FormFieldError extends Error` (native; no cross-package error coupling this slice). Baseline = a defensively-copied snapshot of `initial` captured at `createForm` (array values copied) so `reset()`/`dirty()` compare against an immutable original. | ✅ Resolved |

## Gate status

- [x] Every inherited AR is ✅ Resolved (requirements register) with explicit user decisions.
- [x] Every plan-level PA is ✅ Resolved and user-confirmed.
- [x] Zero deferred items within this plan's scope.
- [x] Header reads ✅ GATE PASSED.
