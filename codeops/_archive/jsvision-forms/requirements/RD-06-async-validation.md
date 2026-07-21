# RD-06: Async Validation

> **Document**: RD-06-async-validation.md
> **Status**: Draft
> **Created**: 2026-07-15
> **Project**: jsvision Forms
> **Depends On**: RD-01 (Form & Field Store), RD-02 (Validation & Error Surfacing) — extends both.
>   Soft-consumes RD-09's styled `Text` in its demo story (not an engine dependency).
> **CodeOps Skills Version**: 3.7.0

---

## Feature Overview

Add **asynchronous, per-field validation** to `@jsvision/forms` — the "is this username / email
already taken?" class of check that can only be answered by a round-trip. Today the engine is
strictly synchronous: one memoized `computed(() => schema.safeParse(rawValues()))` drives every
accessor (`validation.ts:25`), and `submit()` gates on that sync `isValid()` (`create-form.ts:150`).
A field cannot say "checking…", a slow server answer for an old keystroke could clobber a newer one,
and `submit()` can wave through a value an async rule would reject.

This RD adds an **opt-in per-field async validator layer that sits *beside* the synchronous parse**,
not replacing it. The instant synchronous feedback the first slice delivers is preserved unchanged;
async is a separate, per-field concern with its own `validating()` state, a generation stale-guard,
debounce, and cancellation. `submit()` becomes async-aware — it force-runs and awaits every async
validator before deciding validity, so it is the single authoritative gate (the modal `formDialog`
wiring built on that gate is RD-08).

**Why not native Zod `.refine(async)` in the one schema?** Because a synchronous `schema.safeParse`
on a schema that contains an async refinement **throws** (`$ZodAsyncError`, verified against the
pinned zod 4.4.3) rather than returning a failure — it would crash every accessor. Answering "which
field is currently validating?" from a whole-object `safeParseAsync` would require reading
`schema.shape`, which the feature's guardrails forbid. The per-field validator layer is the only
model that yields field-granular `validating()` state, per-field debounce, and a per-field
stale-guard while leaving the instant sync `isValid()` intact (AR-33). The trade-off it accepts:
**cross-field *async* validation is out of scope** (AR-43) — cross-field *sync* validation via schema
`.refine`/`.superRefine` is unchanged (AR-11).

---

## Functional Requirements

### Must Have

- [ ] **Async validator config.** `CreateFormOptions` gains an optional
      `asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> }` map, keyed by field name, where
      `AsyncValidator<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<string | null>` —
      returns an error message, or `null` for "no async error". The validator receives the field's
      **raw** editing value (`I[K]`, exactly what `field.value` holds); the author coerces inside the
      validator if a typed value is needed (AR-34, AR-35).
- [ ] **Per-field `validating()` state.** The `Field<T>` handle gains `validating(): boolean` — `true`
      from the moment an async validation for that field begins until its (non-superseded) result
      lands. A form-level `form.validating(): boolean` returns `true` while **any** field is
      validating (AR-39).
- [ ] **Distinct async error surface.** The `Field<T>` handle gains `asyncError(): string | null` —
      the message from the field's most recent, non-superseded async validation (or `null`).
      `error(): ZodIssue | null` is **unchanged** — it still returns only real synchronous Zod issues;
      the async message is never fabricated into a `ZodIssue`. The app composes the display
      (`field.error()?.message ?? field.asyncError()`) (AR-40).
- [ ] **Trigger: on change (debounced), gated by sync-cleanliness.** When a field's raw value changes,
      its async validator runs after a debounce window **only if the field currently has no
      synchronous issue** (`fieldError(name) === null`) — no point checking uniqueness of a malformed
      email. A pending run is superseded by a newer change (AR-36).
- [ ] **Per-field isolation.** Each field's async trigger effect must subscribe **only to its own
      field's value signal** (tracked); it reads the sync-cleanliness gate **untracked**
      (`untrack(() => fieldError(name) === null)`). Because `fieldError` reads the one shared
      whole-object parse, subscribing to it would make an edit to *any* field re-run *every* field's
      effect — aborting unrelated in-flight checks. Reading the gate untracked keeps a field's async
      check tied to that field's own edits only (PF-002).
- [ ] **Debounce.** A form-level `asyncDebounceMs?: number` (default **300**) sets the change→run
      delay; multiple changes inside the window coalesce to a single run with the final value (AR-37).
- [ ] **Generation stale-guard + cancellation.** Each field carries a monotonic generation counter;
      a validation result is applied only if its generation is still current, so a slow response for
      an old value can never overwrite a newer result. When a run is superseded (or the form is
      disposed), the prior run's `AbortSignal` is aborted so cancellable work (e.g. `fetch`) can stop
      (AR-38).
- [ ] **`isValid()` accounts for async.** `form.isValid()` returns `true` only when the whole object
      is synchronously valid **and** no field currently holds an async error. It is **sync-optimistic
      about pending** work — a field whose async check has not yet run (or is in flight) does not make
      `isValid()` `false` on its own; `submit()` is the authoritative resolver (AR-41).
- [ ] **`submit()` becomes async-aware.** `form.submit(onValid)` marks all fields touched (unchanged),
      then **force-runs every configured async validator immediately** (bypassing debounce), awaits
      them all with the stale-guard applied, re-checks `isValid()`, and only then gates: resolves
      `false` (without calling `onValid`) if any sync or async issue stands, else awaits
      `onValid(values)` and resolves `true`. The signature is unchanged (AR-41).
- [ ] **Schema-async guard.** The synchronous whole-object parse is guarded: if `schema.safeParse`
      throws (which Zod does when the schema contains an async refinement), the engine rethrows a
      clear, named developer error explaining that in-schema async refinements are unsupported and
      directing the author to `asyncValidators` — instead of letting a raw `$ZodAsyncError` crash
      every accessor. In-schema async refinements are an unsupported input, documented as such (AR-42).
- [ ] **`form.dispose()`.** `createForm` gains a `dispose(): void` that tears down the form's whole
      reactive scope — the async trigger effect **and** the validation/field computeds — by exposing
      the disposer the existing `createRoot` already provides (currently discarded). It is
      **idempotent** (guarded by the reactive core's owner-disposed flag), so calling it more than
      once is safe. **After `dispose()` the form must not be used.** A sync-only form (no
      `asyncValidators`) has no standing effect to leak, so it never *needs* `dispose()`, but calling
      it is still safe. This revises the first slice's "nothing to dispose" property (AR-15) now that
      the store owns a standing effect (AR-44).
- [ ] **Kitchen-sink async story.** A new (or extended) kitchen-sink story demonstrates async
      validation — a field with a simulated availability check showing the live "checking…" state and
      the resulting async error — and passes the headless smoke test (AR-45).

### Should Have

- [ ] `form.validating()` is cheap to read repeatedly (a memoized derivation over the per-field
      `validating()` signals), so a Save button can bind `disabled: () => !isValid() || validating()`
      without recomputation concerns.

### Won't Have (Out of Scope)

- **Cross-field / object-level *async* validation** — a per-field validator sees only its own field's
  value and writes only its own channel; it structurally cannot express "(username, tenant) pair is
  taken". Deferred; recorded as the tie-breaker in AR-43 (if cross-field async later becomes a hard
  requirement, the whole-object `safeParseAsync` architecture must be revisited, as it cannot be
  retrofitted onto this model). Cross-field **sync** validation is unchanged (schema `.refine`, AR-11).
- **In-schema async refinements** (`z.string().refine(async …)`) — actively rejected with a clear
  error (AR-42), not silently supported. Use `asyncValidators`.
- **`form.submitting()`** — the submit-in-flight lifecycle signal belongs with the submit-gate slice;
  deferred to RD-08 (AR-45).
- **Async loading / baseline rebase** (`load()` / `loading()`) — RD-07.
- **Per-field `asyncDebounceMs` override** — one form-level default this slice; add a per-field
  override only if a real need lands (AR-37).
- **A warning severity tier** for async issues — async errors are plain messages; no severity
  concept in the engine (GH #89 fence).

---

## Technical Requirements

### New public surface (`@jsvision/forms`)

```ts
/** An async field validator: resolves an error message, or null for "no async error". */
type AsyncValidator<T> = (value: T, ctx: { signal: AbortSignal }) => Promise<string | null>;

interface CreateFormOptions<S, I> {
  schema: S;
  initial: I;
  // NEW — both optional; absent ⇒ the store is fully synchronous and owner-free exactly as today.
  asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> };
  asyncDebounceMs?: number; // default 300
}

interface Field<T> {
  // …existing: name, value, error(), touched(), dirty()
  validating(): boolean;          // NEW — an async validation for this field is in flight
  asyncError(): string | null;    // NEW — the latest non-superseded async message, or null
}

interface Form<S, I> {
  // …existing: field, values, rawValues, errors, isValid, dirty, submit, reset
  validating(): boolean;          // NEW — any field validating
  dispose(): void;                // NEW — idempotent; tears down the async effect (no-op if none)
}
```

### Orchestration (internal)

- **Signals (eager).** The per-field `validating`, `asyncError`, and generation-counter signals are
  created **eagerly**, in the same `for (const name of names)` loop that already seeds
  `valueSignals` / `touchedSignals` (`create-form.ts:79-83`) — **not** lazily inside `field()` (which
  memoizes handles on first call, `create-form.ts:112-131`). Aggregation (`form.validating()`,
  `isValid()`) must not depend on `field(name)` having been called first (PF-004).
- **Trigger.** When `asyncValidators` is non-empty, `createForm` establishes **one standing effect
  per field that has an async validator** (owned by the existing `createRoot` scope). Each effect
  subscribes **only to its own field's value** (tracked) and reads the gate **untracked**
  (`untrack(() => fieldError(name) === null)`, PF-002); when its value changes and the field is
  sync-clean it schedules that field's run after `asyncDebounceMs` (re-checking cleanliness after the
  debounce). The debounce `setTimeout` and the run's `AbortController` are torn down via `onCleanup`
  (`owner.ts:141`) on the next re-run and at disposal. These are the store's first eager
  subscriptions — hence `dispose()` (AR-44).
- **Per-field run.** `gen = ++field.gen; field.validating.set(true);` create an `AbortController`;
  `const msg = await validator(field.value(), { signal: controller.signal });` — if
  `gen !== field.gen` (superseded), drop the result and return; else
  `field.asyncError.set(msg); field.validating.set(false)`. Superseding a run calls
  `controller.abort()` on the prior one (AR-38).
- **`isValid()`** reads the sync `validation.isValid()` **and** ANDs `asyncError() === null` across
  every field (reactive) (AR-41).
- **`submit()`** wraps the existing flow: after marking touched, it **cancels any pending debounce
  timers** (so a queued debounced run cannot supersede the force-run mid-gate, PF-003), then
  `await Promise.all(...)` of a force-run (debounce-bypassing) of every configured async validator
  (each still stale-guarded), then the existing `if (!isValid()) return false` gate now also reflects
  async errors (AR-41).
- **Sync-parse guard.** `createValidation`'s memoized computed wraps `schema.safeParse` in
  `try/catch`; a throw is rethrown as the named async-schema error (AR-42). `safeParse` does not throw
  for ordinary validation failures (it returns `{ success: false }`), so a throw unambiguously means
  an async refinement. The guard adds **no** extra `safeParse` call, so the first slice's
  one-recompute-per-change memoization oracle (ST-11) stays green (PF-006).

### Reactive-core & layering constraints

- Async results are written into plain `@jsvision/ui` signals, so the renderer repaints through the
  existing reactive path — no new framework primitive, no `createResource`/Suspense (guardrail).
- `@jsvision/forms` keeps `zod` as its only peer dependency; `@jsvision/core` and `@jsvision/ui` stay
  zero runtime deps. The debounce timer uses the platform `setTimeout` (no new dependency).
- The store remains headless — it draws nothing; the "checking…" swap is the app reading
  `field.validating()` through the existing `Show`.

---

## Integration Points

### With RD-01 / RD-02 (the store & sync validation it extends)
Additive and backward-compatible: `createForm({ schema, initial })` with no `asyncValidators` behaves
exactly as the first slice (fully synchronous, owner-free, `dispose()` a no-op). `error()`,
`isValid()` for all-sync forms, `values()`, `dirty()`, `reset()` are unchanged in behavior.

### With RD-07 (Async Loading + Baseline Rebase)
RD-07 depends on RD-06 — it reuses the same plain-Promise + stale-guard idiom for `load()`, and the
`dispose()` seam this RD introduces gives loading a clean teardown point too.

### With RD-08 (formDialog + Modal Submit-Gate)
RD-08 builds directly on the async-aware `submit()` this RD delivers: the dialog's Save action awaits
`form.submit()` as the authoritative gate (mark-touched → await async → validate → `endModal`), and
adds the deferred `form.submitting()` state. RD-08 opens a form per dialog, so `dispose()` from this
RD is what prevents a per-dialog effect leak.

### With RD-09 (Styled Error Text) / RD-05 (Showcase)
The demo story renders the async error via the styled `Text` (`severity: 'error'`) and a plain
"checking…" `Text`; the comprehensive showcase (RD-05) curates the same.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Async architecture | (a) sync parse + per-field async layer · (b) whole-object `safeParseAsync` + native `.refine(async)` | **(a) Sync parse retained + per-field async layer** | Only model that yields per-field `validating()` without reading `schema.shape` (banned); preserves instant sync `isValid()`; sync parse on an async schema *throws* (verified). Cost: no cross-field async. | AR-33 |
| Validator config surface | per-field `asyncValidators` map vs schema-embedded async refine | **`asyncValidators?: { [K]?: AsyncValidator }` on `CreateFormOptions`** | Typed, additive, keeps the schema the sync source of truth; doesn't touch the flat field model | AR-34 |
| Value passed to validator | raw editing value vs schema-coerced value | **Raw value (`I[K]`)** | Coerced value is only available on whole-object success (`result.data` is `null` otherwise); raw avoids the null-data trap and enables per-field gating; author coerces if needed | AR-35 |
| Trigger timing | (a) on change (debounced) + submit · (b) on blur + submit · (c) on submit only | **(a) On change, debounced, when sync-clean; forced on submit** | Live "checking…" feedback; debounce bounds request volume; only checks well-formed values | AR-36 |
| Debounce | fixed vs configurable; form-level vs per-field | **Form-level `asyncDebounceMs`, default 300; per-field deferred** | Sensible default, one knob; per-field override is speculative surface until a use lands | AR-37 |
| Concurrency correctness | stale-guard only vs stale-guard + AbortSignal | **Generation stale-guard (drops superseded results) + AbortSignal (cancels superseded work)** | Guard guarantees correctness; the signal lets a `fetch` abort — mirrors the `load({ signal })` idiom | AR-38 |
| `validating()` shape | per-field only vs per-field + form-level | **Per-field `field.validating()` + form-level `form.validating()`** | Per-field drives the row spinner; form-level drives the global "busy"/Save-disabled state | AR-39 |
| Async error surface | (a) distinct `asyncError(): string \| null` · (b) merge into `error()` as a synthetic `ZodIssue` | **(a) Distinct `asyncError()`; `error()` stays sync-only `ZodIssue`** | Honest (no fabricated issue), back-compatible, keeps the `ZodIssue`-passthrough guardrail; app composes the two | AR-40 |
| `isValid()` / submit gate | sync-only vs sync + async; who awaits | **`isValid()` = sync-valid AND no async error (optimistic re pending); `submit()` force-runs + awaits async then gates** | One authoritative gate; live `isValid()` stays instant; RD-06 owns submit's async-awareness, RD-08 adds the dialog | AR-41 |
| In-schema async refine | silently support (impossible) vs guard & reject | **Guard the sync parse; rethrow a clear developer error → `asyncValidators`** | A raw `$ZodAsyncError` would crash every accessor; a loud, documented boundary is safer than a silent landmine | AR-42 |
| Cross-field async | in scope vs deferred | **Deferred (out of scope)** | The per-field model can't express it; forecloses it — recorded as the architecture tie-breaker. Cross-field **sync** unchanged (AR-11) | AR-43 |
| Store lifecycle | keep owner-free vs add `dispose()` | **Add `form.dispose()`** — disposes the form's whole reactive scope, idempotent (revises AR-15; PF-001) | The async trigger is the store's first standing effect; `createRoot`'s disposer tears down the whole scope; per-dialog forms (RD-08) must tear it down to avoid a leak | AR-44 |
| Repo gates | — | **Kitchen-sink async story + smoke test; `submitting()` deferred to RD-08** | Story is non-negotiable; `submitting()` belongs with the submit-gate slice | AR-45 |

> **Traceability:** every decision references `00-ambiguity-register.md` (AR-33…AR-45).

---

## Security Considerations

- **Data sensitivity**: the async validator is author-supplied and typically performs a network call
  (e.g. an availability check). The engine passes the field's raw value to it and stores only the
  returned message string — it holds no credentials/PII and performs no I/O itself.
- **Input validation**: the returned async message is developer-supplied display copy; it renders
  through the existing control-byte sanitisation path (`ScreenBuffer.set` replaces C0/DEL, `sanitize`
  drops ESC/C1) exactly as a sync `issue.message` does — a message carrying control bytes cannot
  paint a raw control cell (asserted by an oracle, mirroring RD-04's contract).
- **Injection risks**: none introduced — no `eval`/dynamic code; the engine builds no queries/paths.
  Any network call lives entirely inside the author's validator, which owns its own URL construction
  and escaping (documented in the `@example`).
- **Availability / abuse**: the debounce (default 300 ms) plus the generation stale-guard bound how
  often an author's validator (and thus their endpoint) is invoked during typing; the `AbortSignal`
  lets superseded requests be cancelled. Server-side rate-limiting of the endpoint remains the app's
  responsibility (a TUI-client concern out of the library's control).
- **Authentication & authorization / encryption / infrastructure**: N/A — an in-process reactive
  orchestrator with no endpoints or persistence of its own.

---

## Acceptance Criteria

1. [ ] `createForm({ schema, initial })` with **no** `asyncValidators` behaves identically to the
       first slice: `field.validating()` is always `false`, `field.asyncError()` is always `null`,
       `form.validating()` is `false`, `form.dispose()` is idempotent and safe to call (though
       unnecessary — there is no standing effect to tear down), and every existing accessor/`submit`/
       `reset` behaves exactly as before (regression-locked).
2. [ ] A field with an async validator resolving `null`: after a change and the debounce window,
       `field.validating()` transitions `true`→`false` and `field.asyncError()` is `null`.
3. [ ] A field whose validator resolves `'Already in use'`: `field.asyncError() === 'Already in use'`,
       while `field.error()` still returns only the synchronous `ZodIssue | null` (never the async
       message).
4. [ ] **Stale-guard:** given two rapid changes whose validations resolve out of order (the older one
       last), only the **newer** value's result is applied; the superseded result is dropped and the
       superseded run's `AbortSignal` is aborted.
5. [ ] **Debounce:** N changes within `asyncDebounceMs` invoke the validator **once**, with the final
       value (verified with fake timers); a custom `asyncDebounceMs` is honoured.
6. [ ] **Sync gating:** while `fieldError(name) !== null` the async validator is **not** invoked; once
       the sync issue clears, a change invokes it.
7. [ ] `form.isValid()` is `false` whenever any field holds an async error, and `true` when the object
       is sync-valid and no async error is present; a field with a not-yet-run async check does not by
       itself make `isValid()` `false`.
8. [ ] `form.validating()` is `true` while any field is validating and `false` once all settle.
9. [ ] **Submit gate:** for a form that is sync-valid but whose async validator resolves an error,
       `await form.submit(onValid)` resolves `false` and `onValid` is **not** called; for a sync-valid,
       async-clean form it resolves `true` and calls `onValid` with the coerced `values()`. Submit
       force-runs async validators even if no debounce had elapsed.
10. [ ] **Schema-async guard:** a schema containing an async `.refine` causes reads of
        `isValid()`/`values()`/`errors()`/`field.error()` to throw the engine's **named** async-schema
        error (message names `asyncValidators`) — not a raw `$ZodAsyncError`, not a silent wrong
        result (verified against the installed zod).
11. [ ] **`dispose()`:** after `form.dispose()` the form's whole reactive scope is torn down —
        changing a value does **not** invoke the async validator (the standing effect is gone);
        calling `dispose()` again is a safe no-op (idempotent).
12. [ ] **Per-field isolation:** with two fields each carrying an async validator, editing field A
        while field B's async check is in flight does **not** abort or re-run B's check (the effects
        subscribe only to their own value; the sync gate is read untracked) (PF-002).
13. [ ] **ST-11 unchanged:** the first slice's "one `safeParse` recompute per raw change" oracle
        (`validation.spec.test.ts`) stays green — RD-06 introduces no additional `safeParse` call
        (PF-006).
14. [ ] Kitchen-sink async story: renders the live "checking…" state and the resulting async error,
        has a unique id + required metadata, and passes `kitchen-sink.smoke.spec.test.ts`.
15. [ ] Security: the engine stores an async message verbatim as inert data (it renders nothing
        itself); when that message — e.g. `'a\x00b\x1b[31mc\x9b'` — is rendered via a `Text` bound to
        `field.asyncError()`, the **existing** sanitisation path (the same `Text`/`ScreenBuffer.set`
        path RD-09 oracle-locked) paints no cell with a code point `< 0x20`, `=== 0x7f`, or in
        `0x80–0x9f`. The oracle mirrors `security.spec.test.ts`'s render-and-scan pattern with a
        `Text` in place of the bound `Input` (PF-005).
16. [ ] `yarn verify` is green; `yarn check:docs` passes — the new `AsyncValidator` usage, the
        `asyncValidators` option, and the new `validating()`/`asyncError()`/`dispose()` surface are
        covered by an updated `createForm` **class**-level `@example`; no banned CodeOps/TV references
        in shipped code.
