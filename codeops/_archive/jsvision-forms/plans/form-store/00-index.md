# Plan: form-store (@jsvision/forms headless store + validation)

> **Implements**: jsvision-forms/RD-01, jsvision-forms/RD-02
> **Type**: Feature · **Feature**: jsvision-forms
> **CodeOps Skills Version**: 3.7.0
> **Status**: Ready to execute

## Overview

Create the new package `@jsvision/forms` and its headless core: a `createForm` store over jsvision's
Solid-style signals, with **synchronous Zod validation**. This is the foundation slice — no widget
binding (RD-03) and no kitchen-sink story (RD-04) here. The store owns raw editing values, validates
the whole object through `schema.safeParse` in one memoized computed, and exposes per-field and
form-level accessors plus `submit`/`reset`.

Combining RD-01 (store) and RD-02 (validation) into one plan is deliberate (PA-2): they are one
reactive graph, and a stubbed validation would be dead code that defeats spec-first testing.

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — inherited AR-01…24 + plan-level PA-1…6. ✅ GATE PASSED. |
| [01-requirements.md](01-requirements.md) | Scope, sources (RD-01 + RD-02), success criteria |
| [02-current-state.md](02-current-state.md) | Grounded analysis of the reactive core + package scaffolding |
| [03-01-package-and-store.md](03-01-package-and-store.md) | Component: package scaffold + the store (createForm/Form/Field/errors) |
| [03-02-validation.md](03-02-validation.md) | Component: the `safeParse` computed + error/values/isValid surfacing |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases (ST-01…ST-17) |
| [99-execution-plan.md](99-execution-plan.md) | Phases, sessions, task checklist |

## Key decisions (traceable)

- Value model: `field.value` = the store-owned raw `Signal`; `form.values()` = schema-coerced (AR-01).
- Validation: Zod used directly (`schema.safeParse`); `zod` is a required peer dep (AR-02).
- Eager validation in one memoized `computed`; `error()` always-live; app composes reveal (AR-03).
- `createForm` self-scoped via `createRoot` — owned computeds, no public `dispose()` (PA-1).
- Fields enumerated from `Object.keys(initial)`; value+touched signals created eagerly (PA-5).

## Verify

- Per task: `yarn workspace @jsvision/forms test`
- Phase gate: `yarn verify` (lint → typecheck → build → test → check:docs)
