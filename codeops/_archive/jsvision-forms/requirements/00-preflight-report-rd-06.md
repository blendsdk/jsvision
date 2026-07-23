# Preflight Report — RD-06 Async Validation

> **Artifact**: `requirements/RD-06-async-validation.md` (+ register rows AR-33…45)
> **Date**: 2026-07-15
> **Scanner**: preflight 3.7.0 · 13-dimension, codebase-grounded
> **Result**: ✅ PASSED WITH NOTES (6 findings — 2 MAJOR / 3 MINOR / 1 OBSERVATION; all resolved by RD amendment)

> ⚠️ **SAME-SESSION REVIEW** — RD-06 was authored earlier in this session, so same-session blind
> spots are likely. Counter-measures applied: every code-touching claim was re-verified against the
> real `@jsvision/ui` reactive-core source (not from memory); the pivotal architecture (AR-33) had
> already been hardened by an independent adversarial reviewer that empirically confirmed the
> sync-`safeParse`-throws-on-async-refine behaviour against the pinned zod 4.4.3. Consider a
> fresh-session re-scan for full independence.

---

## Codebase Context Summary

| Claim in RD-06 | Verified against | Verdict |
|---|---|---|
| Current validation is one sync memoized parse | `packages/forms/src/validation.ts:25` — `computed(() => schema.safeParse(rawValues()))` | ✅ true |
| `submit()` gates on sync `isValid()` | `create-form.ts:150` — `if (!validation.isValid()) return false` | ✅ true |
| A standing `effect` primitive exists | `@jsvision/ui` re-exports `effect` (`reactive/index.ts`); `effect.ts:33` runs once + re-runs on dep change | ✅ true |
| `createRoot` gives a disposer | `owner.ts:73` — `createRoot(fn: (dispose)=>T)`; **current `create-form.ts:64` discards it** | ✅ true (disposer available, currently unused) |
| `onCleanup` for the timer/abort teardown | `owner.ts:141` — fires before each re-run and at disposal | ✅ true |
| `computed` is lazy + memoized | `reactive/index.ts` doc + `validation.ts` memoization (ST-11) | ✅ true |
| `Show` for the "checking…" swap | `@jsvision/ui` re-exports `Show` (`reactive/index.ts`) | ✅ true |
| Sync `safeParse` throws on an async refine | adversarial review ran zod 4.4.3 → `$ZodAsyncError` thrown out of the call | ✅ true |
| Forms test layer can render for a security oracle | `security.spec.test.ts:27-40` — `createRenderRoot` + mount + buffer scan | ✅ true |
| `vi` fake timers + real zod are the test idiom | `validation.spec.test.ts:5,13` — `vi.spyOn`, `import { z } from 'zod'` | ✅ true |

---

## Findings

### 🟠 PF-001 (MAJOR) — `dispose()` semantics: "no-op without async validators" is inaccurate; `createRoot`'s disposer tears down the **whole** scope

`createRoot`'s `dispose(owner)` (`owner.ts:163-194`) disposes the **entire** scope depth-first —
every owned computation (the validation `computed`, all field computeds), not just an effect — and
`effect` has **no individual disposer** (`effect.ts:9`: "an effect lives until the owner scope … is
disposed"). So the natural implementation of `form.dispose()` (expose the disposer `createRoot`
already passes at `create-form.ts:64`) disposes the whole form; it is **not** a no-op when no async
validators are present (it still tears down the lazy validation computed). AR-44 / AC-1 ("`dispose()`
is a safe no-op") and AC-11 mis-describe this.

**Resolution options:**
- **(a) `dispose()` = the `createRoot` disposer — disposes the form's whole scope; reword AR-44/AC-1.**
  Idempotent via the owner-disposed guard (`owner.ts:164`); "after `dispose()` the form must not be
  used." A sync-only form simply never needs to call it (nothing standing to leak). **Recommended** —
  simplest, honest teardown, matches the per-dialog intent (you dispose because you are done with the
  form).
- **(b) Isolate the async effect in its own nested child scope; `dispose()` tears down only that.**
  Matches the current wording (form stays usable after dispose), but adds a scope for a non-use-case
  (why keep a form's sync validation alive after disposing it?).

### 🟠 PF-002 (MAJOR) — per-field async isolation: the sync-cleanliness gate subscribes each field's effect to the **shared** parse, so any field's edit re-runs (and aborts) every field's async check

AR-36 gates async on `fieldError(name) === null`, but `fieldError` reads the one memoized
whole-object parse (`validation.ts:39-43`). An effect that reads it for gating therefore subscribes
to the shared result, so editing field **B** re-runs field **A**'s effect → its `onCleanup` aborts
A's in-flight check and reschedules it. That is a real UX/efficiency defect (typing your name cancels
the in-flight email-uniqueness check) the naive implementation would ship.

**Resolution (recommended):** the RD's technical section should specify that each field's async
effect subscribes **only to its own field's value** (tracked) and reads the sync-cleanliness gate
**untracked** (`untrack(() => fieldError(name) === null)`), so unrelated field edits neither re-run
nor abort an in-flight check. Add it as a technical note + an acceptance criterion.

### 🟡 PF-003 (MINOR) — `submit()` ↔ debounce race

`submit()` force-runs all async validators while a debounced run may be pending; both write the same
generation-guarded signals, so a concurrent debounced run could supersede `submit()`'s force-run,
leaving `submit()`'s gate reading a not-yet-settled state. **Resolution:** `submit()` cancels any
pending debounce timers before force-running (so it awaits the authoritative result). AC-9's intent
is correct; add a one-line note to the submit technical requirement.

### 🟡 PF-004 (MINOR) — the `validating` / `asyncError` signals must be created eagerly per field

`form.validating()` ORs over all fields and `isValid()` ANDs `asyncError` across all fields, but
`field(name)` memoizes handles **lazily** (`create-form.ts:112-131`). The async signals must be
created in the eager `for (const name of names)` loop (like `valueSignals` / `touchedSignals` at
`create-form.ts:79-83`) so aggregation never depends on `field()` having been called first.
**Resolution:** note it in the technical requirements.

### 🟡 PF-005 (MINOR) — AC-13 validates `Text`'s existing render path applied to a stored string, not a new RD-06 path

The async message is a plain string stored in a signal; the engine adds no rendering. Sanitisation
happens when the app renders it via `Text` (RD-09's path, already oracle-locked). The existing forms
security oracle renders a bound `Input` (`security.spec.test.ts`); AC-13 would mirror that by
rendering a `Text` bound to `asyncError()`. Feasible and consistent — but frame AC-13 as "the stored
async message is inert data and, when rendered via `Text`, is sanitised by the existing path," not as
a sanitisation path RD-06 introduces. **Resolution:** reframe AC-13 (keep the oracle).

### 🔵 PF-006 (OBSERVATION) — guard ST-11 immutability

RD-06's `isValid()` async-AND and the async effect must not regress ST-11
(`validation.spec.test.ts:10` — "one `safeParse` recompute per change"). For sync-only forms there is
no effect, so ST-11 is untouched; for async forms the effect reads the same memoized result (no extra
`safeParse`). **Resolution:** add an explicit AC/note that RD-06 introduces no additional `safeParse`
call, so ST-11 stays green.

---

## Dimensions scanned (13/13)

Ambiguities · Implicit Assumptions · Logical Contradictions · Completeness Gaps · Dependency Issues ·
Feasibility · Testability · Security Blind Spots · Edge Cases · Scope Creep · Ordering · Consistency ·
**Codebase Alignment** (the source of PF-001/002/004). No CRITICAL findings — the architecture is
sound and implementable with the real primitives; AR-33's foreclosure of cross-field async is an
explicit, recorded decision (AR-43), not a gap.

## Status — ✅ PASSED WITH NOTES (all 6 findings resolved & applied, 2026-07-15)

User decisions recorded and applied to `RD-06-async-validation.md` + `00-ambiguity-register.md`:

- **PF-001 → option (a):** `form.dispose()` disposes the form's whole reactive scope (idempotent;
  after dispose the form must not be used). Reworded the `dispose()` Must-Have, AR-44, AC-1, AC-11.
- **PF-002 (applied):** one trigger effect per async field, each subscribing only to its own value
  and reading the sync gate `untrack`ed. Added a "Per-field isolation" Must-Have, an Orchestration
  note, AR-36 refinement, and AC-15.
- **PF-003 (applied):** `submit()` cancels pending debounce timers before force-running. Orchestration
  note + AR-41 refinement.
- **PF-004 (applied):** the `validating`/`asyncError`/generation signals are created eagerly per field
  (not lazily in `field()`). Orchestration note.
- **PF-005 (applied):** AC-13 reframed — the engine stores the message as inert data; sanitisation is
  `Text`'s existing render path, tested by mirroring `security.spec.test.ts` with a `Text`.
- **PF-006 (applied):** AC-16 + a sync-parse-guard note asserting RD-06 adds no `safeParse` call, so
  ST-11 stays green.

No 🔴/🟠 remain unresolved. Roadmap advanced to **RD Preflighted (🔎)**. Next: `make_plan` for RD-06.
