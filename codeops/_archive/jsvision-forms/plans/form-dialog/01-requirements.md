# 01 — Requirements

> **Source**: [RD-08](../../requirements/RD-08-form-dialog-modal-submit-gate.md) (preflighted ✅ —
>   [00-preflight-report-rd-08.md](../../requirements/00-preflight-report-rd-08.md), PASSED, 9 findings applied)
> **Register**: [00-ambiguity-register.md](00-ambiguity-register.md) (RD AR-54…61 imported; plan AR-PL1…PL7)

This document is a **delta view**, not a restatement. RD-08 is the owning requirements doc — its
Functional Requirements, Technical Requirements, Scope Decisions, Security Considerations, and 14
Acceptance Criteria are the contract. Read it first. Below: the scope this plan implements, what it
explicitly does not, and the plan-level decisions layered on top of the RD.

## What this plan builds

A single deliverable in three moving parts, all inside `@jsvision/forms` plus one story:

1. **`formDialog(host, options): Promise<z.output<S> | null>`** — the first `createForm`→modal `Dialog`
   bridge. Creates/owns/**disposes** the form, mounts a caller-built `body(form)` + OK/Cancel, runs it
   modally via `host.loop.execView`, and gates OK on the **async** `form.submit()`. New module
   `packages/forms/src/form-dialog.ts` (AR-PL1). RD-08 §Functional "Must Have" 1–8, §Technical
   "Orchestration".
2. **`form.submitting(): boolean`** — a new form-level in-flight signal, additive to `create-form.ts` +
   `types.ts` + the barrel type export. RD-08 FR "`form.submitting()` signal"; resolves RD-07 AR-45.
3. **A kitchen-sink `forms/dialog` story + smoke oracle** — the mandated live demo (AR-PL4 / AR-61 /
   RD-08 AC #12).

## Scope boundaries (delta over the RD)

**IN** (this plan): the `formDialog` factory + the internal `FormDialog` subclass (AR-PL7); the
`submitting()` signal; the barrel export + surface-lock bump 5→6 (AR-PL3); the story + smoke; the full
spec/impl/security test set (AR-PL5).

**OUT** (unchanged from RD-08 §"Won't Have", carried verbatim — do not implement): load-before-show
inside `formDialog` (AR-59); a minted error UI for a failed `onSubmit` (AR-58); button sets beyond
OK/Cancel (AR-60); a Cancel-with-unsaved-changes guard (AR-60); a non-modal/modeless form window; a
multi-step/wizard dialog. **No `@jsvision/ui` change** — the plan composes over the public
`Dialog`/`execView`/`Button`/`Commands` seams (RD-08 §"Reactive-core & layering constraints").

## Plan-level decisions (this plan adds, over the RD)

| # | Decision | Where |
|---|----------|-------|
| AR-PL1 | `formDialog` lives in a **new module** `src/form-dialog.ts` (not inline in `create-form.ts`) | [AR](00-ambiguity-register.md), [03-01](03-01-form-dialog.md) |
| AR-PL2 | `submitting()` oracles (ST-D-SUB1…3) live **in `form-dialog.spec.test.ts`** (asserted on `submit()` directly) | [AR](00-ambiguity-register.md), [07](07-testing-strategy.md) |
| AR-PL3 | Barrel gains `formDialog` + `FormDialogOptions`; `surface.impl.test.ts` lock **5→6** | [AR](00-ambiguity-register.md), [03-02](03-02-submitting.md) |
| AR-PL4 | Story `forms/dialog` (`rd: 'RD-08'`), degrades to launch-button + echo headlessly | [AR](00-ambiguity-register.md), [03-03](03-03-story.md) |
| AR-PL5 | `createEventLoop` harness; `ST-D*` prefix; spec/impl/security test files | [AR](00-ambiguity-register.md), [07](07-testing-strategy.md) |
| AR-PL6 | Verify = `yarn verify` + a plain banned-ref `grep` over `packages/forms/src` | [AR](00-ambiguity-register.md), [99](99-execution-plan.md) |
| AR-PL7 | `FormDialog` overrides `handleTerminating` / `resolveCancel` / `valid` | [AR](00-ambiguity-register.md), [03-01](03-01-form-dialog.md) |

## Success criteria (the definition of done)

- Every RD-08 Acceptance Criterion (1–14) maps to ≥1 spec oracle in [07-testing-strategy.md](07-testing-strategy.md).
- Specification-first: every `ST-D*` spec test is written and **red** before the code that satisfies it.
- `yarn verify` is green (lint → typecheck/build/test/check:docs across the workspace) and a plain
  banned-ref grep over `packages/forms/src` is clean (AR-PL6; RD-08 AC #14).
- The `forms/dialog` story is registered and `kitchen-sink.smoke.spec.test.ts` passes (RD-08 AC #12).
- `@jsvision/core` / `@jsvision/ui` stay zero runtime deps; `zod` stays the only peer dep (RD-08 §layering).
