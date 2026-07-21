# Execution Plan: Async Validation

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-16 01:03 (Phase 4 complete — `yarn verify` green)
> **Progress**: 28/28 tasks (100%) — Phase 1 ✅ · Phase 2 ✅ · Phase 3 ✅ · Phase 4 ✅
> **CodeOps Skills Version**: 3.7.0

## Overview

Implement RD-06 inside `@jsvision/forms`: an opt-in per-field async validator layer beside the
retained sync parse, with `validating()`/`asyncError()`, debounce + generation stale-guard +
`AbortSignal`, an async-aware `submit()`, a schema-async guard, and an idempotent `dispose()`; plus a
kitchen-sink async story. `@jsvision/core`/`@jsvision/ui` untouched (zero-dep); `zod` stays the only
peer dep. Spec-first per phase.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Async surface + schema-async guard + `dispose()` (inert async layer) | 7 |
| 2 | The per-field async trigger (debounce · stale-guard · abort · isolation · mount-skip · clear-on-change) | 8 |
| 3 | Async-aware `submit()` | 5 |
| 4 | Security oracle · kitchen-sink story · final gate | 8 |

**Total: 28 tasks across 4 phases** (no hour estimates).

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated** after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]` resumed first, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.
> **Zero-ambiguity during execution:** if a detail is not covered by the plan docs or the register,
> STOP, get a user decision, record it in `00-ambiguity-register.md` tagged `(runtime)`, then resume.

---

## Phase 1: Async surface + schema-async guard + `dispose()`

Delivers the full public surface and an **inert** async layer (constants when no validators), the
schema-async guard, and `dispose()` — so a sync-only form is behaviourally identical to the first
slice. No trigger effect yet.

### Step 1.1: Spec first

**Reference**: `03-01 §A/§D` · `07` ST-A1, ST-A10 · AR-33/42/44, AR-P5
**Objective**: Failing oracles for sync-only back-compat, the schema-async guard, and `dispose()`.

- [x] 1.1 Write `async.spec.test.ts` with **ST-A1** (sync-only: `validating()===false`,
      `asyncError()===null`, `form.validating()===false`, `dispose()` idempotent/safe, first-slice
      accessors unchanged) and **ST-A10** (async-`.refine` schema → `isValid()`/`values()`/
      `errors()`/`field.error()` throw the **named** async-schema error, not a raw `$ZodAsyncError`)
      — `packages/forms/test/async.spec.test.ts` ✅ (completed: 2026-07-16 00:33)
- [x] 1.2 Red phase: `yarn workspace @jsvision/forms test` — confirm ST-A1/ST-A10 fail (no
      `validating`/`asyncError`/`dispose`; the sync parse currently throws a raw Zod error) ✅ (completed: 2026-07-16 00:34)

### Step 1.2: Implement the surface + guard + dispose

**Reference**: `03-01 §A/§C.1/§C.2/§C.3/§D/§E`
**Objective**: The new types, an inert `createAsyncValidation`, the `dispose()` seam, and the guard.

- [x] 1.3 Add `AsyncValidator<T>`, `Field.validating()`/`asyncError()`, `Form.validating()`/
      `dispose()`, and `CreateFormOptions.asyncValidators`/`asyncDebounceMs` to `types.ts`; export
      `AsyncValidator` from the barrel `export type` line — `packages/forms/src/types.ts`,
      `packages/forms/src/index.ts` ✅ (completed: 2026-07-16 00:39)
- [x] 1.4 Create `async.ts` with `createAsyncValidation(config)` returning
      `{ fieldValidating, fieldAsyncError, anyValidating, allAsyncClean, cancelPendingDebounces,
      runAllForced }` — **inert branch only** (eager-but-dormant per-field signals, constant
      aggregates, no-op force/cancel; a form with validators does not yet run them — keeps Phase 2
      red) — `packages/forms/src/async.ts` (AR-P2/P3) ✅ (completed: 2026-07-16 00:40)
- [x] 1.5 Guard the sync parse in `validation.ts`: wrap the memoized `safeParse` in `try/catch`,
      rethrow a **named** `Error` (message names `asyncValidators`, `cause` preserved); **no extra
      `safeParse` call**; correct the stale `:19-20` doc-comment — `packages/forms/src/validation.ts`
      (AR-42 / PF-006) ✅ (completed: 2026-07-16 00:41)
- [x] 1.6 Wire `create-form.ts`: expose the `createRoot` disposer as `dispose` (change to
      `createRoot((disposeScope) => buildForm(options, disposeScope))`); construct
      `createAsyncValidation({...})`; add `validating()`/`asyncError()` to the `field()` handle; wrap
      `isValid: () => validation.isValid() && async.allAsyncClean()`; add `validating`/`dispose` to
      the returned form; update the `:61-63` JSDoc + the class `@example` (AR-P4-aware validator with
      `try/catch`) — `packages/forms/src/create-form.ts` (AR-44/41/P6, AC-16) ✅ (completed: 2026-07-16 00:42)
- [x] 1.7 Green phase: `yarn workspace @jsvision/forms test` — ST-A1/ST-A10 pass; **ST-11…ST-17,
      store/adapters/bind-field/security/surface specs stay green**; typecheck + lint + check:docs
      clean. **Runtime AR-P12** (user): first-slice ST-10 asserted no-dispose (AR-15); AR-44 revises
      that, so ST-10's dispose assertion was updated to require an idempotent `dispose()` (the
      no-dev-warning assertion kept). ✅ (completed: 2026-07-16 00:43)

**Deliverables**:
- [x] Full async surface present; sync-only forms unchanged; schema-async guard throws the named
      error; `dispose()` idempotent; the runtime barrel is still exactly 5 values

**Verify**: `yarn verify`

---

## Phase 2: The per-field async trigger

Fills in `createAsyncValidation`'s live path: eager per-async-field signals, one isolated trigger
effect per field, the per-field run, aggregates.

### Step 2.1: Spec first

**Reference**: `03-01 §B` · `07` ST-A2…A8, A11(effect-gone), A12, A13, A14, A16 · AR-36/37/38/39/P7/P8/P11, PF-002
**Objective**: Failing oracles for the whole trigger lifecycle.

- [x] 2.1 Extend `async.spec.test.ts` with **ST-A2** (validating true→false, asyncError null),
      **ST-A3** (asyncError distinct from error), **ST-A4** (stale-guard + AbortSignal aborted),
      **ST-A5** (debounce coalescing + custom ms, fake timers), **ST-A6** (sync-clean gating),
      **ST-A7** (isValid reflects async, optimistic pending), **ST-A8** (form.validating),
      **ST-A11** (after `dispose()` a change does not invoke the validator), **ST-A12** (per-field
      isolation — editing A doesn't abort/re-run B), **ST-A13** (mount run skipped), **ST-A14**
      (asyncError cleared on change), **ST-A16** (an abort-ignoring validator's stale result is
      dropped when it resolves during the next value's debounce window — AR-P11) —
      `packages/forms/test/async.spec.test.ts` ✅ (completed: 2026-07-16 00:48)
- [x] 2.2 Red phase: `yarn workspace @jsvision/forms test` — confirmed 10 new ST-A* fail (inert layer
      never invokes a validator); ST-A11/ST-A13 are negative "never runs" oracles that also hold
      inert — they stay green through implementation ✅ (completed: 2026-07-16 00:49)

### Step 2.2: Implement the trigger

**Reference**: `03-01 §B.2–B.6`
**Objective**: Live per-field async orchestration, isolated and torn down with the scope.

- [x] 2.3 In `async.ts`, eagerly create the per-async-field state (`validating`/`asyncError` signals,
      `gen`, `timer`, `controller`, `firstRun`); implement `run(name, s)` (gen-bump → **abort the prior
      controller** (PF-102) → `validating=true` → new `AbortController` → `await validator(rawValue,
      {signal})` → **catch→null** (AR-P4) → gen-guard drop → set `asyncError`/`validating=false`) —
      `packages/forms/src/async.ts` (AR-38/P4/P11) ✅ (completed: 2026-07-16 00:51)
- [x] 2.4 Implement the per-field trigger `effect`: subscribe to own value (tracked); **skip the
      first (mount) run** via `firstRun` (AR-P7); on change, **supersede as a total no-op — bump the
      generation, abort the controller, reset `validating`→false + `asyncError`→null** (AR-P8/AR-P11)
      — before the gate; read the sync-clean gate `untrack(() => fieldSyncClean(name))` (PF-002);
      `setTimeout(run, debounceMs)`; `onCleanup` clears the timer + aborts the controller (AR-P10) —
      `packages/forms/src/async.ts` (AR-36/37) ✅ (completed: 2026-07-16 00:51)
- [x] 2.5 Implement the aggregates: `anyValidating` (`computed` over the async-field `validating`
      signals) and `allAsyncClean` (`every asyncError===null`); confirm `field()` accessors + form
      `validating()`/`isValid()` now read them — `packages/forms/src/async.ts`, `create-form.ts`
      (AR-39/41/P6) ✅ (completed: 2026-07-16 00:51)
- [x] 2.6 Green phase: `yarn workspace @jsvision/forms test` — ST-A2…A8, A11, A12, A13, A14, A16 pass;
      the Phase-1 specs + first-slice specs stay green (61 tests) ✅ (completed: 2026-07-16 00:51)

### Step 2.3: Impl tests & hardening

**Reference**: `07 §Implementation tests` · AR-P4/P10
**Objective**: Lock the internals the spec oracles don't reach.

- [x] 2.7 Write `async.impl.test.ts`: validator rejection→no-error (AR-P4); `ctx.signal` is a live
      `AbortSignal` and fires on supersede; `dispose()` clears a pending timer / aborts an in-flight
      run; eager aggregation correct **before** the per-field accessor is read (PF-004) —
      `packages/forms/test/async.impl.test.ts` ✅ (completed: 2026-07-16 00:52)
- [x] 2.8 Verify — `yarn workspace @jsvision/forms test` green (66 tests); typecheck + lint clean;
      sizes within target (async.ts 166 · create-form.ts 206 · validation.ts 59 · types.ts 130) ✅ (completed: 2026-07-16 00:52)

**Deliverables**:
- [x] Live per-field async validation: debounced, sync-gated, isolated, stale-guarded, abortable,
      mount-skipped, stale-cleared, torn down by `dispose()`

**Verify**: `yarn verify`

---

## Phase 3: Async-aware `submit()`

### Step 3.1: Spec first

**Reference**: `03-01 §B.5/§C.4` · `07` ST-A9, ST-A15 · AR-41/P9, PF-003
**Objective**: Failing oracles for the async-aware gate and the sync-invalid short-circuit.

- [x] 3.1 Extend `async.spec.test.ts` with **ST-A9** (sync-valid + async error → `submit` resolves
      `false`, `onValid` not called; sync-valid + async-clean → `true` + `onValid(values)`;
      force-runs even with no debounce elapsed) and **ST-A15** (sync-**invalid** form → `submit`
      resolves `false` **without invoking** the async validator) — `packages/forms/test/async.spec.test.ts` ✅ (completed: 2026-07-16 00:54)
- [x] 3.2 Red phase: `yarn workspace @jsvision/forms test` — ST-A9 failed (submit gated on sync only,
      no force-run); ST-A15 already green (the existing sync short-circuit *is* AR-P9 — a negative
      oracle that stays green through the rewrite) ✅ (completed: 2026-07-16 00:54)

### Step 3.2: Implement

**Reference**: `03-01 §C.4`
**Objective**: `submit()` = mark touched → sync short-circuit → cancel debounces → force-run+await
async → re-check → gate.

- [x] 3.3 Rewrite `submit()` in `create-form.ts`: after mark-touched, `if (!validation.isValid())
      return false` (AR-P9); `asyncLayer.cancelPendingDebounces()` (PF-003); `await
      asyncLayer.runAllForced()` (AR-41); re-check the extracted `isValidForm()` (also used by the
      returned `isValid`); then the existing `values()` null-guard → `await onValid` → `true` —
      `packages/forms/src/create-form.ts` ✅ (completed: 2026-07-16 00:55)
- [x] 3.4 Green phase: `yarn workspace @jsvision/forms test` — ST-A9/ST-A15 pass; **ST-17** (submit
      marks touched) and all prior specs stay green (68 tests) ✅ (completed: 2026-07-16 00:55)

### Step 3.3: Impl tests & hardening

**Reference**: `07 §Implementation tests`

- [x] 3.5 Add to `async.impl.test.ts`: a force-run supersedes a just-started debounced run (its late
      result dropped by the generation guard + its controller aborted; `submit` gates on the
      force-run) — `packages/forms/test/async.impl.test.ts` ✅ (completed: 2026-07-16 00:56)

**Deliverables**:
- [x] `submit()` is the authoritative async-aware gate; no async calls on a sync-invalid submit

**Verify**: `yarn verify`

---

## Phase 4: Security oracle · kitchen-sink story · final gate

### Step 4.1: Spec first — security + story smoke

**Reference**: `03-02` · `07` ST-A-SEC, ST-AS1 · AC-14/15 · AR-45, PF-005
**Objective**: Failing oracles for control-byte sanitisation of an async message and the async story.

- [x] 4.1 Write `async-security.spec.test.ts`: a validator resolves the control-byte message
      `'a\x00b\x1b[31mc\x07\r\n\x9b'`; drive it (fake timers) to populate `asyncError()`; render a
      `Text` bound to `field.asyncError()` via `createRenderRoot`; scan the buffer — **no** cell with
      cp `< 0x20`, `=== 0x7f`, or `0x80–0x9f` (ST-A-SEC) — `packages/forms/test/async-security.spec.test.ts` ✅ (completed: 2026-07-16 00:58)
- [x] 4.2 Extend `kitchen-sink.smoke.spec.test.ts` with **ST-AS1** (build+mount `forms/async`; the
      buffer contains the `Username` label + the `checking…` hint) — `packages/examples/test/kitchen-sink.smoke.spec.test.ts` ✅ (completed: 2026-07-16 00:59)
- [x] 4.3 Red phase: ST-A-SEC **held** (the render path already sanitizes — locks the promise); ST-AS1
      failed (no `forms/async` story yet) ✅ (completed: 2026-07-16 00:59)

### Step 4.2: Implement the story

**Reference**: `03-02`
**Objective**: A live async-validation story, green under the smoke test.

- [x] 4.4 Create `forms-async.story.ts` (`id: 'forms/async'`, `rd: 'RD-06'`): simulated availability
      check (`sleep(500, signal)` + a `TAKEN` set), live `Input` + state echo (`checking…` /
      `severity:'error'` async message / `✓ available`), touched-gated sync error, `valid ·
      validating` echo, a submit `Button` (`disabled: () => !isValid() || validating()`), and the
      always-painted interaction hint — `packages/examples/kitchen-sink/stories/forms-async.story.ts` ✅ (completed: 2026-07-16 01:00)
- [x] 4.5 Register the story — one import + one entry in `packages/examples/kitchen-sink/stories/index.ts` ✅ (completed: 2026-07-16 01:00)
- [x] 4.6 Green phase: `yarn workspace @jsvision/examples test` — ST-AS1 + the generic smoke loop
      pass (57 smoke tests); ST-A-SEC green. Required rebuilding `@jsvision/forms` dist so examples
      resolve the new runtime surface (examples import `@jsvision/forms` by name → dist) ✅ (completed: 2026-07-16 01:01)

### Step 4.3: Final gate

**Reference**: RD-06 AC-16 · project Prime directive · AR-P1
**Objective**: `yarn verify` green across the branch; `check:docs` green; tree clean.

- [x] 4.7 Full `yarn verify` — `lint` → typecheck/build/test/`check:docs` green (26/26 turbo tasks);
      the `createForm` class `@example` covers `asyncValidators`/`validating()`/`asyncError()`/
      `dispose()`; no banned CodeOps/TV refs in `packages/forms/src` (plain grep); `check:deps` zero
      native deps (11/11) ✅ (completed: 2026-07-16 01:02)
- [x] 4.8 Ran `yarn lint:fix` (no-op — tree already clean; `dist/` gitignored). Commit handled by the
      active commit mode / `/gitcmp` ✅ (completed: 2026-07-16 01:03)

**Deliverables**:
- [x] Security oracle green; async story green under smoke; `yarn verify` green; tree clean

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (surface + guard + dispose; inert async layer)
    ↓   the trigger fills in behavior behind the surface Phase 1 established
Phase 2 (per-field trigger + run + aggregates)
    ↓   submit force-runs the trigger's per-field run
Phase 3 (async-aware submit)
    ↓   the story + security oracle exercise the whole surface
Phase 4 (security · story · gate)   ← runs last over the whole package
```

---

## Success Criteria

**Feature is complete when** (mapped 1:1 to RD-06 §Acceptance Criteria 1–16):

1. ✅ Sync-only back-compat (ST-A1) — AC-1
2. ✅ validating true→false, asyncError null (ST-A2) — AC-2
3. ✅ asyncError distinct from sync error() (ST-A3) — AC-3
4. ✅ Stale-guard + AbortSignal (ST-A4) — AC-4
5. ✅ Debounce coalescing + custom ms (ST-A5) — AC-5
6. ✅ Sync-clean gating (ST-A6) — AC-6
7. ✅ isValid() reflects async, optimistic pending (ST-A7) — AC-7
8. ✅ form.validating() (ST-A8) — AC-8
9. ✅ Async-aware submit gate (ST-A9) — AC-9
10. ✅ Schema-async named guard (ST-A10) — AC-10
11. ✅ dispose() stops the effect + idempotent (ST-A1 + ST-A11) — AC-11
12. ✅ Per-field isolation (ST-A12) — AC-12
13. ✅ ST-11 unchanged — no extra safeParse (Phase 1/2 green) — AC-13
14. ✅ Kitchen-sink async story + smoke (ST-AS1) — AC-14
15. ✅ Async-message control-byte sanitisation via Text (ST-A-SEC) — AC-15
16. ✅ `yarn verify` + `check:docs` green; `@example` updated; no banned refs; `lint:fix` clean — AC-16

**Plus the plan-pinned forks:** AR-P7 mount-skip (ST-A13) · AR-P8 clear-on-change (ST-A14) · AR-P9
submit short-circuit (ST-A15) · AR-P11 supersede-bumps-generation, abort-independent stale-guard
(ST-A16; PF-101/PF-102).
