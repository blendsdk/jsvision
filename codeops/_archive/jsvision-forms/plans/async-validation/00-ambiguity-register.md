# Ambiguity Register — Async Validation (RD-06 plan)

> **✅ GATE PASSED** (2026-07-15)
> **Parent**: [Index](00-index.md) · **Implements**: jsvision-forms/RD-06
>
> This plan implements a **fully preflighted** RD. Every semantically-weighted requirements decision
> was resolved upstream in the requirements register (`../../requirements/00-ambiguity-register.md`,
> AR-33…AR-45, four user-decided + the rest codebase-derived) and hardened by the RD-06 preflight
> (`../../requirements/00-preflight-report-rd-06.md`, PF-001…PF-006, all applied). Those rows import
> here as **resolved** and are **not** re-confirmed (shared gate rule 3). Only genuinely NEW,
> plan-local decisions that surfaced while grounding the RD in the real reactive-core `effect`
> semantics get a row below — three of them needed a fresh user call (AR-P7/P8/P9), the rest are
> derivations or obvious facts.

## Imported — resolved upstream (RD-06 requirements register + preflight)

| AR | Decision (one-line gloss) | Source |
|----|---------------------------|--------|
| AR-33 | Sync whole-object `safeParse` retained + an opt-in **per-field async validator layer beside it** (not whole-object `safeParseAsync`) | requirements AR-33 (user) |
| AR-34 | `CreateFormOptions.asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> }`, keyed by field name | requirements AR-34 |
| AR-35 | The validator receives the field's **raw** editing value (`I[K]`); it coerces itself if needed | requirements AR-35 |
| AR-36 | Trigger: debounced **on value change, only when sync-clean**; force-run on submit. One effect **per async field**, own value tracked, gate read `untrack`ed (PF-002) | requirements AR-36 (user; PF-002) |
| AR-37 | Debounce: form-level `asyncDebounceMs?: number`, default **300**; per-field override deferred | requirements AR-37 |
| AR-38 | Concurrency: per-field monotonic **generation counter** (drop superseded) **+ `AbortSignal`** (cancel superseded work) | requirements AR-38 |
| AR-39 | `field.validating()` (per-field) + `form.validating()` (OR over fields) | requirements AR-39 |
| AR-40 | **Distinct `field.asyncError(): string \| null`**; `error(): ZodIssue \| null` unchanged; app composes | requirements AR-40 (user) |
| AR-41 | `isValid()` = sync-valid AND no async error (**optimistic re pending**); `submit()` force-runs + awaits async then gates; cancels pending debounces first (PF-003) | requirements AR-41 (PF-003) |
| AR-42 | In-schema async `.refine` → the sync parse is guarded; rethrows a **named** developer error → `asyncValidators` | requirements AR-42 |
| AR-43 | Cross-field **async** out of scope (the per-field model can't express it); cross-field **sync** unchanged | requirements AR-43 (user, via AR-33) |
| AR-44 | `form.dispose()` tears down the **whole reactive scope** (exposes the `createRoot` disposer currently discarded); **idempotent**; revises AR-15 | requirements AR-44 (user; PF-001) |
| AR-45 | Kitchen-sink async story (live "checking…" + async error) + smoke; `form.submitting()` deferred to RD-08 | requirements AR-45 |

> Do not restate the above. Every plan document cites `AR-33…AR-45` and the RD sections they own.

## Plan-local rows — NEW user decisions (async-trigger lifecycle forks the RD did not pin)

> Grounding the RD's orchestration onto the **real** `effect` (which fires once immediately on
> creation — `packages/ui/src/reactive/effect.ts:47`) and the debounce model surfaced three
> behavioral forks with observable, `isValid()`-affecting consequences. Presented to the user with
> grounded recommendations (AskUserQuestion, 2026-07-15); all three chosen as recommended.

| AR | Item | Resolution (user decision) | Evidence | Status |
|----|------|----------------------------|----------|--------|
| AR-P7 | **Mount run** — the per-field trigger `effect` fires once on `createForm`. Does the async validator run for the field's *initial* value on mount, or only on a later change? | **Only on user changes.** The effect skips its first (mount) execution via a per-field `firstRun` guard — it still *reads* the value to subscribe, but schedules nothing. Matches AR-36's "on value change" wording; avoids an edit-form firing an availability check on its own pre-filled value at open (flagging the record's own current value as a conflict). | `effect.ts:33-48` (runs once immediately); AR-36 "on value change" | ✅ Resolved (user, 2026-07-15) |
| AR-P8 | **Stale async verdict** — when a sync-clean field's value changes (entering the debounce window, before the validator re-runs), is the prior `asyncError()` cleared? | **Clear on change.** On *any* value change the effect resets that field's `asyncError` to `null` immediately (an async verdict describes one specific value; a changed value invalidates it). A just-fixed value never briefly displays the old value's message, and `isValid()` is not held `false` by a superseded verdict during the debounce + network window. | `validating()` defined as "from the moment a validation begins" (RD MH, so `validating` stays false during debounce → without clearing, a stale error would show); AR-41 `isValid` | ✅ Resolved (user, 2026-07-15) |
| AR-P9 | **Submit async-run scope** — `submit()` force-runs async validators before gating. If the object is already synchronously invalid, does it still invoke every async validator? | **Short-circuit on sync-invalid.** `submit()` marks touched, then if `!validation.isValid()` returns `false` **without** invoking any async validator (no pointless network calls on a doomed submit; no malformed value handed to a validator). It force-runs async only when the object is sync-valid (so every field is sync-clean). The gate result is identical to "always run". Refines AR-41's "force-runs every" to "force-runs every *when the sync gate is open*". | `create-form.ts:150` current sync short-circuit; AR-41; AR-36 "only checks well-formed values" | ✅ Resolved (user, 2026-07-15) |

## Plan-local rows — derivations / obvious facts (not re-confirmed)

| AR | Item | Resolution | Evidence | Status |
|----|------|-----------|----------|--------|
| AR-P1 | **Verify command** | `yarn verify` (= `yarn lint` then `turbo run typecheck build test check:docs`) fills every Verify line | `CLAUDE.md` §Commands | ✅ Resolved (obvious) |
| AR-P2 | **Module boundary** for the async orchestration | A new `packages/forms/src/async.ts` holds `createAsyncValidation(...)` (eager signals + per-field trigger effects + per-field run + force-run/cancel helpers), mirroring how `validation.ts` isolates the sync layer. Keeps `create-form.ts` focused and well under the file-size norm. | Existing split: `validation.ts`, `bind-choice.ts`, `bind-field.ts` are separate concerns; `create-form.ts` is 168 lines | ✅ Resolved (structural) |
| AR-P3 | **Eager signals only for async fields** | The `validating`/`asyncError`/`gen` signals are created eagerly **only for fields that have a validator**; a field without one has `validating() === false` and `asyncError() === null` as constants. `form.validating()`/`isValid()` aggregate over the async-field signals — never via `field()` (PF-004 satisfied). | PF-004 (aggregation must not depend on `field()`); a non-async field has no async state to hold | ✅ Resolved (derived from PF-004) |
| AR-P4 | **Validator rejection** (out of the `Promise<string \| null>` contract, e.g. a network throw) | Caught and treated as **"no async error"** (the run yields `null`, `validating`→`false`); the rejection is swallowed. Documented in the `createForm` `@example`: an author whose validator can fail must `catch` inside and return a message (e.g. `'Could not verify'`) to surface it — an uncaught rejection is a no-error. Avoids fabricating a `ZodIssue`/message and avoids crashing the effect. | AR-40 (no fabricated messages); the validator owns its own I/O + error handling (Security §) | ✅ Resolved (derived) |
| AR-P5 | **`AsyncValidator` type export** | Add `AsyncValidator` to the barrel's `export type { … }` line (sibling convention — every public type is barrel-exported). Runtime surface is **unchanged** (still 5 values), so `surface.impl.test.ts` needs no edit; the type surface is held by `typecheck`. | `index.ts:5` type exports; `surface.impl.test.ts` asserts runtime keys only | ✅ Resolved (derived) |
| AR-P6 | **Where `isValid()`/`validating()` wrap the sync layer** | `isValid: () => validation.isValid() && async.allAsyncClean()`; `validating: () => async.anyValidating()`; both read the async-field signals reactively so they repaint through the existing path. No new `safeParse` call is added, so ST-11 stays green (PF-006). | `validation.ts:28` `isValid`; PF-006 | ✅ Resolved (derived) |
| AR-P10 | **Abort/timer teardown** | Each field's effect stores its pending `setTimeout` id and the active run's `AbortController`; an `onCleanup` in the effect body clears the timer and aborts the controller — it fires on the next value change (supersede) and at `dispose()`. A completed controller aborts as a harmless no-op. | `owner.ts:141` (`onCleanup` fires before each re-run and at disposal); AR-38 | ✅ Resolved (derived) |
| AR-P11 | **Generation bumped on supersede, not only at run-start** | The per-field trigger effect increments `s.gen` (and resets `validating`→`false`, `asyncError`→`null`, best-effort `abort()`) the moment the value changes — before scheduling the debounce. This makes a superseded in-flight run a **total no-op independent of whether its validator honours the `AbortSignal`**: an old-value run that resolves during the new value's debounce window sees `g !== s.gen` and is dropped, so it can never write a stale verdict (which a run-start-only bump allowed for an abort-ignoring — but in-contract — validator). Additionally `run()` aborts the prior controller before creating a new one, so a submit force-run cancels an in-flight debounced request. | Plan preflight PF-101/PF-102 (`00-preflight-report.md`); RD-06 Scope-Decisions row ("Guard guarantees correctness"); `effect.ts:47`, `scheduler.ts:97` | ✅ Resolved (preflight-hardened, 2026-07-16) |

## Runtime decisions (surfaced during execution — tagged `(runtime)`)

| AR | Item | Resolution (user decision) | Evidence | Status |
|----|------|----------------------------|----------|--------|
| AR-P12 | **First-slice oracle ST-10 conflicts with AR-44.** `store.spec.test.ts` ST-10 asserts `'dispose' in form === false` (the first slice deliberately exposed no dispose, AR-15). AR-44 revises AR-15 to expose an idempotent `form.dispose()`, so exposing it breaks ST-10 — yet `02-current-state`/`07` list `store.spec.test.ts` as "must stay green" (a plan inconsistency the preflight missed). | **Update ST-10 to match AR-44** (sanctioned spec change — a later user-approved requirement superseded the one ST-10 encoded; the immutability rule protects specs from being bent to buggy code, not from a deliberate requirement change). ST-10's second assertion now requires `dispose` to exist and be idempotent; its no-dev-warning assertion is unchanged. The plan's "store.spec stays green" note is understood as "all of store.spec **except** ST-10's superseded dispose line". | `store.spec.test.ts:107-114`; register AR-44 ("revises AR-15"); RD-06 PF-001 (idempotent dispose). User decision (2026-07-16, AskUserQuestion). | ✅ Resolved (runtime, user) |

### Gate confirmation
- [x] Every semantic decision traces to a **user-confirmed** upstream AR (AR-33/36/40/44), a
      preflight-hardened derivation (AR-34/35/37/38/39/41/42/43/45), or a **fresh user decision**
      collected for this plan (AR-P7/P8/P9).
- [x] Zero deferred *in-scope* items. Cross-field async (AR-43) and `submitting()` (AR-45→RD-08) are
      explicit out-of-scope decisions, not gaps.
- [x] The three new async-lifecycle forks the RD did not pin were surfaced to the user and decided
      before any plan document was written.
- [x] Header reads **✅ GATE PASSED**.
