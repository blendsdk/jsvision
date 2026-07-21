# Preflight Report — RD-07 (Async Loading + Baseline Rebase)

> **Artifact:** `requirements/RD-07-async-loading-baseline-rebase.md` (+ AR-46…53 in `00-ambiguity-register.md`)
> **Date:** 2026-07-16 · **Skills Version:** 3.8.0 · **Iteration:** 1
> **Status:** ✅ **PASSED** — all 5 findings resolved (user: "apply all five", 2026-07-16)
> ⚠️ **SAME-SESSION REVIEW** — RD-07 was authored earlier in this session. Same-agent bias
> safeguards applied: every code claim re-verified against real files (`create-form.ts`,
> `async.ts`, `owner.ts`); the sole MAJOR finding was hardened with an independent challenger
> before recording. Consider a fresh-session re-scan for full independence.

## Codebase Context Summary

- **Baseline mutation point (the RD's rebase target).** `create-form.ts:99` `const baseline: Record<string, unknown> = {}`, seeded once at `:103` `baseline[name] = clone(raw[name])`, read by `fieldDirty` (`:142` `!eq(valueSignal(name)(), baseline[name])`) and `reset` (`:174`). Helpers `clone` (`:11`), `eq` (`:16`) exist. `submitAttempted` signal at `:110`. `batch`/`signal`/`createRoot` imported at `:1`. **All RD line references verified accurate.**
- **RD-06 idioms reused.** `async.ts` `run` stale-guard (`:93-107`, `if (g !== s.gen) return` at `:104`); standing trigger effect per async field (`:111-144`); mount run skipped via `firstRun` (`:114`), so a post-construction value change (a load) is treated as a real change; `asyncError` cleared to `null` on change (`:128`). The `AbortSignal` `ctx` shape matches `AsyncValidator` (`types.ts:18`).
- **Disposal mechanics (owner.ts:163-194).** `dispose(owner)` sets `owner.disposed=true`, tears down owned **computations** (effects/computeds), unsubscribes their edges, runs cleanups. It **does not touch any module-local counter, and signals are not owned** — `signal.set()` still executes after disposal (it just notifies no live observer). `onCleanup(cb)` called directly in the `createRoot` body registers on `owner.cleanups` and fires once at dispose — a usable seam for the abort. `form.dispose` is currently `dispose: disposeScope` (`create-form.ts:213`).
- **Dependencies satisfied on-branch:** RD-06 (dispose/stale-guard) and RD-09 (styled `Text`) are both **shipped**. Build order RD-09→RD-06→**RD-07**→RD-08→RD-05 holds.

## Findings

### 🟠 PF-001 (MAJOR) — Disposal guard is under-specified; the stated generation-guard does NOT cover the dispose path
**Dimensions:** 3 (Contradiction), 6 (Feasibility), 13 (Codebase Alignment).
The RD's FR ("a load that resolves after disposal is stale-guarded to a no-op") and AR-51 ("`dispose()` aborts an in-flight load; a completed-after-teardown load is stale-guarded to a no-op") both rest on **step 3's generation check**. But `dispose()` never bumps `loadGen` (owner.ts:163 tears down computations only). So after `dispose()`:
- **Loader ignores abort → resolves:** step 3 `g !== loadGen` is **false** (nothing bumped it) → step 4 runs → rebases baseline + writes every value/touched signal + clears `loading`, on a torn-down form.
- **Loader honors abort → rejects:** step 2 catch runs `if (g === loadGen) loading.set(false)` → **true** → clears `loading()` on a torn-down form.

Both **violate AC #9** ("applies no values, does not rebase, does not clear `loading()` for the torn-down form"). The RD's own text is internally contradictory here — the technical section hedges "_or check the owner-disposed flag before applying_" while the FR/AR assert the generation guard suffices.
**Recommendation:** Pin an explicit **`disposed` flag** (set in a `dispose` wrapper that also aborts `loadController`, e.g. via `onCleanup` in the root body) that the load path checks **before every post-await state write — including the step-2 catch's `loading.set(false)`** (equivalently: `++loadGen` inside `dispose`, so step 3 drops it, AND guard the catch). Correct the FR + AR-51 prose to name this mechanism instead of "the generation guard makes it a no-op."
**Hardening:** Confidence **high** the finding is real (independently confirmed: dispose bumps no counter, signals survive disposal, both sub-cases traced). Severity **MAJOR vs MINOR is a judgment call** — the challenger argued MINOR because AC #9 is a correct spec oracle that would force the fix at the red-test gate. Recorded MAJOR because the defect is a *false rationale in the concurrency core* + a wrong ratified AR that would mislead the plan/impl, which preflight should correct now.

### 🟡 PF-002 (MINOR) — No acceptance criterion for the motivating re-invoke / reload case
**Dimensions:** 4 (Completeness), 7 (Testability).
AR-46 chose a **method** over a `load:` option *specifically* for re-invokability (a Reload button / loading a different record into the same form). Yet the ACs test a single load (#2/#3) and *concurrent* overlapping loads (#8) — none asserts the primary sequential case: **load A resolves, then load B resolves, and the baseline/`reset()` target is now B's record** (not A's, not `initial`).
**Recommendation:** Add an AC — "two sequential successful loads: after the second, `rawValues()`/baseline/`reset()`-target deep-equal the **second** record; `dirty()` is `false`." Locks the headline capability AR-46 exists for.

### 🟡 PF-003 (MINOR) — AC #10 conflates two async outcomes; imprecise as an oracle
**Dimensions:** 1 (Ambiguity), 7 (Testability), 13 (Codebase Alignment).
AC #10 asserts a loaded field's async validator "**runs against the loaded value** after the debounce." But the trigger effect gates on `fieldSyncClean(name)` read untracked (`async.ts:132`): the validator only schedules when the loaded value is **sync-clean**. The `asyncError()`→`null` clear happens unconditionally (`:127-128`); the *run* is conditional. A loaded-but-sync-invalid value clears `asyncError` and does **not** run the validator.
**Recommendation:** Split the AC: (a) `asyncError()` is cleared on load unconditionally; (b) *for a sync-clean loaded value*, the validator runs after the debounce. Prevents an over-broad oracle.

### 🔵 PF-004 (OBSERVATION) — `load` vs. in-flight `submit` interleaving is unaddressed
**Dimensions:** 9 (Edge Cases), 4 (Completeness).
Concurrency is specified for load-vs-load (AR-51) but not load-vs-submit: a `load()` firing while `submit()` awaits `onValid`/async validators rebases the baseline mid-flight. Consistent with AR-52 leaving busy-state to the app, but currently implicit.
**Recommendation (optional):** One doc line in the `load` JSDoc / a note in the RD — "don't `load()` while a `submit()` is in flight; the app gates both via `loading()`/`validating()`." No engine change.

### 🔵 PF-005 (OBSERVATION) — A loader resolving a record missing a key silently blanks that field + its baseline
**Dimensions:** 9 (Edge Cases), 8 (Security-adjacent robustness).
Step 4 iterates the schema `names` and reads `record[name]`; a runtime loader that resolves a partial object (TS-typed `Promise<I>`, but `await res.json()` erases that) sets the missing field **and its baseline** to `undefined`. The type contract + AR-47 out-scope partial merge, so this is a caller-contract violation, not a merge feature.
**Recommendation (optional):** One `@example`/JSDoc line — "the loader must resolve **every** field key; a missing key sets that field to `undefined`." No behavior change.

## Decisions & Resolution

User decision (2026-07-16): **apply all five.**

| # | Sev | Decision | Applied change |
|---|-----|----------|----------------|
| PF-001 | 🟠 MAJOR | **Fix** | RD FR "Disposal aborts an in-flight load" + orchestration `State`/`load flow` steps 2–3/`Disposal` bullet rewritten to a `disposed` flag (checked before every post-await write, incl. the catch's `loading.set(false)`); AR-51 corrected; AC #10 now covers resolve **and** reject after dispose. |
| PF-002 | 🟡 MINOR | **Fix** | New **AC #4** — two sequential loads rebase to the second record (re-invokability, AR-46). Renumbered old #4→#5 … #13→#15. |
| PF-003 | 🟡 MINOR | **Fix** | Old AC #10 split → **AC #11** (`asyncError` cleared unconditionally) + **AC #12** (validator re-runs only for a sync-clean loaded value). |
| PF-004 | 🔵 OBS | **Fix** | New "Interaction with `submit`" orchestration bullet — load-vs-in-flight-submit is an app-composition concern; `@example` note. |
| PF-005 | 🔵 OBS | **Fix** | Raw-record FR now documents the full-record loader contract (a missing key blanks the field + baseline to `undefined`). |

## Pass tier

✅ **PREFLIGHT PASSED — all 5 findings resolved.** No 🔴/🟠/🟡/🔵 remaining open. RD-07 is
implementation-ready. Roadmap advanced to 🔎 **RD Preflighted**.
