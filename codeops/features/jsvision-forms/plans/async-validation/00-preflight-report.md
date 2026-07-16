# Preflight Report: Async Validation (plan)

> **Status**: ✅ PASSED — all 4 findings resolved & applied (2026-07-16)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/jsvision-forms/plans/async-validation/`
> **Codebase Grounded**: 18 source files examined, ~40 references verified
> **Last Updated**: 2026-07-16
> **Reviewer independence**: Fresh session (plan authored 2026-07-15 in a prior session). Same-session
>   bias is not elevated. The one MAJOR finding was hardened by an independent challenger subagent
>   (advisor tool unavailable this session).

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM, NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zod 4.4.3
(peer). `@jsvision/forms` depends only on `@jsvision/ui`; zero native deps.
**Architecture:** Headless reactive form store. `createForm` → `createRoot(() => buildForm(...))`; one
memoized `computed(() => schema.safeParse(rawValues()))` drives every accessor; per-field raw value
signals; lazy `field()` handles; a Solid-style reactive core (`signal`/`computed`/`effect`/
`createRoot`/`onCleanup`/`untrack`) re-exported from `@jsvision/ui`.
**Key Files Examined:** `packages/forms/src/{create-form,validation,types,index,internal}.ts`;
`packages/ui/src/reactive/{effect,owner,scheduler,index}.ts`; `packages/ui/src/controls/{text,input}.ts`;
`packages/core/src/engine/{safety/sanitize,render/buffer}.ts`; `packages/forms/test/{validation.spec,
security.spec,surface.impl}.test.ts`; `packages/examples/test/kitchen-sink.smoke.spec.test.ts`;
`packages/examples/kitchen-sink/stories/index.ts`; RD-06 + requirements register + RD-06 preflight report.

**Reference Verification:** Every `file:line` anchor in `02-current-state.md` and `03-01-async-engine.md`
was checked against the working tree and is accurate (create-form 168 lines, validation 45, types 73,
index 5, internal 15; `create-form.ts:64` discards the disposer; `validation.ts:25` the memoized parse;
`effect.ts:47` immediate first run; `owner.ts:73-82/141/163-165` createRoot/onCleanup/dispose; ui barrel
re-exports at `index.ts:42`). The security oracle's load-bearing claim is confirmed: `Text.draw` →
`ctx.text` → `ScreenBuffer.text` → `sanitize()` strips ESC/C0/BEL **and C1 (0x80–0x9f)**
(`sanitize.ts:52`), so ST-A-SEC is feasible and will pass. `Input.placeholder`, `Text` reactive-getter +
`severity`, `bindField`, the `paintedOf` smoke helper, and the createRoot-wrapped smoke mounts all exist
as the plan assumes. RD-06 preflight PF-001…006 are fully applied into RD-06/register and correctly
carried into this plan — not re-litigated here.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 0 | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 1 | 🔵 |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 2 | 🟠 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 | 🟡 |
| 13 | Codebase Alignment | 0 (all anchors verified) | — |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 1 | ✅ resolved & applied |
| MINOR | 2 | ✅ resolved & applied |
| OBSERVATION | 1 | ✅ resolved & applied |

---

### PF-101: Generation stale-guard is bumped at run-start, not on supersede — an abort-ignoring validator can land a confident wrong verdict 🟠 MAJOR

**Dimension:** 9 (Edge Cases) / 13 (Codebase Alignment — the concurrency model)
**Location:** `03-01-async-engine.md` §B.3 (`run`), §B.4 (trigger effect); register AR-38/AR-P8; RD-06 AC-4.
**Codebase Evidence:** `packages/ui/src/reactive/scheduler.ts:97` (`execute()` fires a computation's
cleanups at the START of each re-run, before `fn()`); `packages/ui/src/reactive/owner.ts:141-146`
(`onCleanup` registers on the effect, fires before the next run and at dispose). The plan bumps
`s.gen` only inside `run()` (`§B.3: const g = ++s.gen`); the effect (`§B.4`) aborts + reschedules but
never advances `gen`.

**The Problem:** The design pairs a "generation stale-guard (drop superseded)" with an `AbortSignal`
(cancel superseded work), and RD-06 words the guarantees as absolute — AC-4: "a slow response for an
old value **can never** overwrite a newer result"; AR-P8: "a just-changed value **never** displays the
prior value's message; `isValid()` is **not** held false by a superseded verdict." RD-06:233 states
"**Guard guarantees correctness**; the signal lets a `fetch` abort" — i.e. correctness is explicitly
*not* supposed to depend on the validator honoring the abort.

But `s.gen` only advances when the *next* `run()` starts. Between a value change and the next run
firing (the new value's debounce window), the generation is unchanged — so a still-in-flight run for
the *previous* value, if its validator ignores the `AbortSignal`, passes the `g === s.gen` guard and
writes its result. Timeline (debounce = 300 ms):

```
t=0    type "ab" (sync-clean) → effect schedules run for t=300
t=300  run("ab"): g=1, s.gen=1, validating=true, await validator("ab")   [validator ignores signal]
t=350  type "abc" → effect re-runs: onCleanup → clearTimeout(no-op) + controller.abort() [IGNORED];
                    asyncError.set(null); schedules run for t=650.  (s.gen NOT bumped → still 1)
t=400  validator("ab") resolves "taken": g=1, s.gen=1 → g===s.gen → asyncError.set("taken"),
                    validating.set(false)
       ⇒ field value is "abc", but asyncError()="taken", validating=false, isValid()=false —
         a settled, confident WRONG verdict — until run("abc") completes (~t=650+).
```

Validators that legitimately ignore the signal are in-contract: a pure in-memory async check (nothing
to abort), a validator whose `fetch` already returned before the abort, and — most commonly — one that
simply forgets to thread `signal` into `fetch` (the `AsyncValidator` type cannot enforce it; the
`@example` merely *shows* it as good practice). The generation guard is meant to be the belt that makes
all of these safe; it has a hole.

The oracles do not cover this. ST-A4 (`07:33`) resolves the older run "last" but only in the case where
**both** runs have started (so B's `run()` already bumped `gen` to 2). ST-A14 (`07:43`) checks
`asyncError` is null *immediately* on change but never advances time to let the in-flight v1 run resolve
during v2's debounce. So a faithful implementation of the plan passes every spec while carrying the bug.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | **In the trigger effect, make a superseded run a total no-op:** on each genuine (post-`firstRun`) change, before the gate/reschedule, do `++s.gen; s.controller?.abort(); s.validating.set(false); s.asyncError.set(null);`. Add a spec oracle for the uncovered timing (old run resolves during the new value's debounce → its result is dropped). | Closes the window for *any* validator regardless of abort-honoring; keeps `validating` coherent on both sync-clean and sync-invalid supersede paths; matches the design's "optimistic during debounce" model; verified safe against ST-A13 (bump lives after `firstRun`), ST-A5 (gen is internal/never asserted; final run still fires once), ST-A9 (force-run takes a fresh gen). | A few extra lines in the effect + one new oracle. |
| B | Bump `s.gen` alone in the effect (`++s.gen`) without resetting `validating`. | Minimal. | **Introduces a regression:** on the sync-*invalid* supersede path the effect returns at the gate without scheduling; the in-flight run then hits `g !== s.gen` and returns *before* `validating.set(false)`, stranding `validating()===true` (a stuck "checking…" spinner). Rejected. |
| C | Require validators to honor the `AbortSignal` (document it as mandatory), leave the code as-is. | No code change. | Contradicts RD-06:233 ("guard guarantees correctness"); pushes a correctness invariant onto author discipline the type can't enforce; the common "forgot to pass `signal`" mistake still breaks it. Rejected. |

**Recommendation:** Option **A** — it restores the guarantee the RD states as absolute, independent of
validator abort-honoring, and the challenger confirmed it is safe against the existing oracles when the
`gen` bump + state reset sit after the `firstRun` guard. Add the missing-timing oracle so the fix is
regression-locked. `Confidence: High. Hardening: independent challenger CONFIRMED the timeline is
reachable and that the naked-`++gen` variant (Option B) strands `validating`; recommendation unchanged
from pre-challenge, strengthened to the full-reset form.`

**User Decision:** Resolved — User accepted recommendation (Option A). **Applied** to `03-01 §B.3/§B.4`
(effect bumps `s.gen` + resets `validating`/`asyncError`/`abort` on supersede), register **AR-P11**,
`07` mapping (**ST-A16**), and `99` Phase 2 (steps 2.1/2.4/2.6).

---

### PF-102: `run()` overwrites `s.controller` without aborting the prior — submit's force-run leaks an in-flight debounced fetch 🟡 MINOR

**Dimension:** 9 (Edge Cases)
**Location:** `03-01-async-engine.md` §B.3 (`run`), §B.5 (`runAllForced` / `cancelPendingDebounces`).
**Codebase Evidence:** `03-01 §B.3`: `run()` does `s.controller = new AbortController()` with no prior
`abort()`. `§B.5`: `cancelPendingDebounces()` only clears *pending* timers, not an already-started run.

**The Problem:** On the normal debounced path the effect's `onCleanup` aborts the prior controller
before the next run, so this is invisible. But `submit()` calls `run()` **directly** via `runAllForced`
(no effect, no `onCleanup` in between). If a debounced run is already in flight when `submit()` is
called, `cancelPendingDebounces()` cannot stop it (its timer already fired), and the force-run's
`run()` overwrites `s.controller` without aborting the in-flight one — so that request is **not
cancelled** (its `fetch` keeps running to completion). Correctness is preserved (the orphaned run's
result is dropped by the generation guard), but AR-38's "the prior run's `AbortSignal` is aborted so
cancellable work can stop" leaks on the force-run path.

**Options:** One dominant fix — have `run()` abort the prior controller before reassigning:
`s.controller?.abort(); s.controller = new AbortController();`. This makes *every* new run (debounced or
forced) cancel a superseded in-flight request, subsuming the special-case reasoning. (Considered and
dropped: aborting only inside `runAllForced` — narrower, but leaves the same latent gap for any future
direct caller of `run()`; centralizing it in `run()` is strictly better.)

**Recommendation:** Fold the one-line abort-before-reassign into `run()` (pairs naturally with PF-101's
effect-level reset). Optionally extend the impl test "force-run supersedes a just-started debounced run"
(`07 §Implementation tests`) to assert the superseded run's signal is aborted.

**User Decision:** Resolved — User accepted recommendation. **Applied** to `03-01 §B.3` (`run()` calls
`s.controller?.abort()` before reassigning), register AR-P11, `99` step 2.3, and the `07`
force-run-supersedes impl-test bullet (now asserts the abort).

---

### PF-103: Oracle-range and helper-name drift across plan documents 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** `00-index.md:115` vs `07-testing-strategy.md:11` + mapping table; `00-index.md:51`;
register `00-ambiguity-register.md` AR-P6 vs `03-01 §B.6/§B.7/§C.3`.

**The Problem:** Three small internal inconsistencies an executor could trip on:
1. `00-index.md:115` says `async.spec.test.ts` holds "store-level async oracles **ST-A1…A12**", but
   `07-testing-strategy.md:11` and its mapping table define **ST-A1…A15** (plus ST-A-SEC, ST-AS1).
2. `00-index.md:51` calls the oracles "mapped **1:1** to the 16 RD ACs" — actually 17 oracles, with
   AC-11 covered by two (ST-A1 + ST-A11), AC-13 covered by a regression oracle (ST-11, not an ST-A*),
   and ST-A13/A14/A15 mapping to AR-P7/P8/P9 rather than ACs. The intent (every AC has an oracle) holds;
   the "1:1" wording does not.
3. The register AR-P6 writes `isValid: () => validation.isValid() && async.allClean()`, while the plan's
   authoritative spec (`03-01 §B.6/§B.7/§C.3`) names the helper `allAsyncClean()`. Internal name only
   (no test asserts it), but the drift is a paper-cut.

**Options:** Correct the three references (range `A1…A12`→`A1…A15`; soften "1:1" to "every AC maps to at
least one oracle"; `allClean`→`allAsyncClean` in AR-P6). No genuine alternative.

**Recommendation:** Apply the three text corrections. Purely documentation; zero behavioral impact.

**User Decision:** Resolved — User accepted recommendation. **Applied**: `00-index.md` range
`A1…A12`→`A1…A16` and "1:1"→"every AC maps to ≥1 oracle"; register AR-P6 `allClean`→`allAsyncClean`.

---

### PF-104: `Text` content getter is `() => string`, but `asyncError()` returns `string | null` — the story/oracle must coerce 🔵 OBSERVATION

**Dimension:** 6 (Feasibility)
**Location:** `03-02-story.md` (state-echo `Text` bound to `field.asyncError()`); `07:45` ST-A-SEC
("render a `Text` bound to `field.asyncError()`").
**Codebase Evidence:** `packages/ui/src/controls/text.ts:120` — `constructor(content: string | (() =>
string), …)`. `asyncError(): string | null` (`03-01 §A`). `() => string | null` is not assignable to
`() => string`, so `new Text(() => field.asyncError())` will not typecheck.

**The Problem:** Not a defect in the design, but the snippet as written won't compile — the executor must
coerce null, e.g. `new Text(() => field.asyncError() ?? '')` (and, in the story's error branch, gate the
`severity: 'error'` `Text` on `asyncError() !== null` so an empty string isn't painted danger-red). Worth
pinning so the executor doesn't accidentally render the literal `"null"`.

**Recommendation:** Add a one-line note to `03-02`/`07` that `asyncError()` is coerced (`?? ''`) at the
`Text` boundary. Trivial; optional.

**User Decision:** Resolved — User accepted recommendation. **Applied**: coercion + non-null gating note
added to `03-02` (state echo) and `07` (`Text`-binding note).

---

## Not findings (verified sound — recorded for the audit trail)

- **Security oracle (ST-A-SEC / AC-15):** feasible and will pass — `Text.draw` uses the same
  `ctx.text` → `ScreenBuffer.text` → `sanitize()` path as the existing `Input` oracle, and `sanitize`
  strips C1 (`sanitize.ts:52`), the load-bearing byte class.
- **ST-11 immutability (AC-13 / PF-006):** the guard wraps the one memoized `safeParse` and adds no new
  call; `isValid()` ANDs signal reads. Verified against `validation.spec.test.ts:10`.
- **Surface lock (AR-P5):** `AsyncValidator` is a *type* export → no runtime key → `surface.impl.test.ts`
  needs no edit. Verified.
- **`dispose()` seam (AR-44):** `createRoot`'s disposer (`owner.ts:78`) is idempotent (`owner.ts:164`);
  exposing it as `form.dispose()` is exactly the discarded disposer at `create-form.ts:64`. Verified.
- **The `AsyncValidator<unknown>` widening cast (`§C.2`):** legal as a single-step `as` assertion (the
  target is assignable to the source under contravariance), so it does **not** require a banned
  `as unknown as`. Verified — not a standards violation.
- **Reactive semantics** (immediate first run, self-writing effect safety, `untrack` gate, `onCleanup`
  timing, createRoot-wrapped smoke mounts): all verified against source.

---

## ✅ PREFLIGHT PASSED — all 4 findings resolved (2026-07-16)

All four findings were accepted by the user and applied to the plan documents (fixes below). No
🔴/🟠 remain unresolved.

- **PF-101 (MAJOR)** → `03-01 §B.3/§B.4`, register AR-P11, `07` ST-A16, `99` steps 2.1/2.4/2.6.
- **PF-102 (MINOR)** → `03-01 §B.3`, register AR-P11, `99` step 2.3, `07` impl-test bullet.
- **PF-103 (MINOR)** → `00-index.md` (range + wording), register AR-P6 name.
- **PF-104 (OBSERVATION)** → `03-02` + `07` `Text`-boundary coercion note.

**Iteration-2 consistency re-check (post-fix):** the new supersede logic composes with every existing
oracle — ST-A13 (bump sits after the `firstRun` guard → mount still skipped), ST-A5 (internal `gen`
never asserted → coalescing intact), ST-A9/A15 (submit force-run takes a fresh `gen` → still
authoritative), ST-A14 (`asyncError`→null immediately preserved). Task count unchanged at 28 (ST-A16
folds into the existing spec-first task 2.1). No new contradictions introduced.

**Roadmap:** plan advanced to **Plan Preflighted (🔬)**. Next: `exec_plan async-validation`.
