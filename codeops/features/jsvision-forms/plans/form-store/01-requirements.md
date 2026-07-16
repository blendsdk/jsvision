# Requirements & Scope — form-store

> **Source**: [RD-01](../../requirements/RD-01-form-field-store.md) · [RD-02](../../requirements/RD-02-validation-error-surfacing.md)
> Register: [00-ambiguity-register.md](00-ambiguity-register.md) (✅ GATE PASSED)

## What this plan builds

The `@jsvision/forms` package and its headless `createForm` store with synchronous Zod validation.

### In scope

- **Package scaffold** — `packages/forms/` (private), ESM/NodeNext, `tsconfig` + `vitest.config`
  mirroring `@jsvision/files`; `@jsvision/ui` dependency; `zod` as a **required peer** + devDep;
  `check:deps`/`check:docs` scripts; workspace/turbo wiring (RD-04 FR-4.1/4.2 packaging subset).
- **Store (RD-01)** — `createForm<S, I>`, `Form` (`field`/`values`/`rawValues`/`errors`/`isValid`/
  `dirty`/`submit`/`reset`), `Field` (`name`/`value`/`error`/`touched`/`dirty`), the raw-signal value
  model, stable memoized handles, dirty-vs-baseline, `reset`, `submit(onValid): Promise<boolean>`,
  unknown-key `FormFieldError`, `createRoot` self-scoping (no public `dispose`).
- **Validation (RD-02)** — one eager memoized `safeParse` computed; per-field `error()` (first
  `ZodIssue` by `path[0]`); `form.errors()` (path-less issues); `isValid()`; coerced `values()`;
  cross-field `.refine` routing; message passthrough; the `z.coerce` constraint documented.

### Out of scope (follow-on plans / slices)

- **RD-03** widget binding (`bindField`/`bindRadio`/`bindCheck`) — separate plan.
- **RD-04** kitchen-sink story + smoke — separate plan (this plan carries only the packaging/test
  scaffolding the store itself needs).
- Async validation, async loading, `formDialog`, `Input` placeholder, plural `errors()`, warnings,
  `disabled`/`readonly`, per-field reset, nested/array-of-object fields, runtime introspection
  (all AR-17).

## Success criteria (definition of done)

- `packages/forms` builds, typechecks, and `yarn workspace @jsvision/forms test` is green.
- Every ST oracle in [07-testing-strategy.md](07-testing-strategy.md) passes.
- Public exports carry JSDoc `@example`; `check:docs` passes; no banned references.
- `check:deps` green (zod is pure JS); core/ui remain zero-runtime-dep.
- `yarn verify` green on the branch.

## Traceability

Every requirement traces to RD-01/RD-02 and an `AR-`/`PA-` entry in the register. No AI-assumed
behavior.
